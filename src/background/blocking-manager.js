import { storage } from '../common/storage.js';
import { STORAGE_KEYS } from '../common/constants.js';
import { Logger } from '../common/logger.js';
import { statisticsManager } from './statistics-manager.js';

const logger = new Logger('BlockingManager');

/**
 * Manages declarativeNetRequest rules for blocking websites
 */
export class BlockingManager {
  constructor() {
    this.RULE_ID_START = 1000; // Start IDs from 1000 to avoid conflicts
    this.blockedPageUrl = chrome.runtime.getURL('src/interstitial/blocked.html');
    this.exemptTabs = new Set(); // Tabs with active budget sessions
  }

  /**
   * Initialize blocking rules from storage
   * NOTE: This only loads blocked sites list, it doesn't create DNR rules.
   * Use setBlockingEnabled() to actually enable/disable blocking based on schedule.
   */
  async initialize() {
    logger.info('Initializing blocking manager...');
    
    try {
      const blockedSites = await storage.get(STORAGE_KEYS.BLOCKED_SITES) || [];
      // Don't create rules here - let the schedule manager determine if blocking should be active
      // Just log what we loaded
      logger.info(`Loaded ${blockedSites.length} blocked sites (rules not yet applied)`);
    } catch (error) {
      logger.error('Failed to initialize blocking:', error);
    }
  }

  /**
   * Convert site pattern to Chrome URL filter for exception rules
   * Uses explicit domain matching with urlFilter
   * @param {string} pattern - User-provided pattern
   * @returns {object} Condition object for declarativeNetRequest exception
   */
  patternToExceptionCondition(pattern) {
    // Remove protocol if present
    pattern = pattern.replace(/^https?:\/\//, '');
    
    if (pattern.includes('/')) {
      // Path-specific exception: music.youtube.com/browse
      const [domain, ...pathParts] = pattern.split('/');
      const path = pathParts.join('/');
      return {
        urlFilter: `*://${domain}/${path}*`,
        resourceTypes: ['main_frame']
      };
    } else {
      // Domain-only exception: music.youtube.com
      // Match the domain and all its subdomains explicitly
      return {
        urlFilter: `*://${pattern}/*`,
        resourceTypes: ['main_frame']
      };
    }
  }

  /**
   * Convert site pattern to Chrome URL filter
   * @param {string} pattern - User-provided pattern
   * @returns {object} URL filter for declarativeNetRequest
   */
  patternToFilter(pattern) {
    // Remove protocol if present
    pattern = pattern.replace(/^https?:\/\//, '');
    
    // Handle wildcards
    if (pattern.startsWith('*.')) {
      // *.example.com -> matches all subdomains
      const domain = pattern.substring(2);
      return {
        urlFilter: `||${domain}`,
        resourceTypes: ['main_frame']
      };
    } else if (pattern.includes('*')) {
      // Contains wildcard
      return {
        urlFilter: pattern,
        resourceTypes: ['main_frame']
      };
    } else if (pattern.includes('/')) {
      // Path-specific: reddit.com/r/all
      const [domain, ...pathParts] = pattern.split('/');
      const path = pathParts.join('/');
      return {
        urlFilter: `||${domain}/${path}*`,
        resourceTypes: ['main_frame']
      };
    } else {
      // Simple domain: facebook.com
      return {
        urlFilter: `||${pattern}`,
        resourceTypes: ['main_frame']
      };
    }
  }

  /**
   * Check if URL should never be blocked (essential Chrome pages)
   * @param {string} url
   * @returns {boolean}
   */
  isEssentialUrl(url) {
    const essentialPatterns = [
      'chrome://',
      'chrome-extension://',
      'edge://',
      'about:',
      this.blockedPageUrl
    ];
    
    return essentialPatterns.some(pattern => url.startsWith(pattern));
  }

  /**
   * Create blocking rule from site entry
   * @param {object} site - Blocked site object
   * @param {number} index - Rule index
   * @returns {object} declarativeNetRequest rule
   */
  createRule(site, index) {
    const ruleId = this.RULE_ID_START + index;
    const filter = this.patternToFilter(site.pattern);
    
    // Create redirect URL with blocked site info
    const redirectUrl = new URL(this.blockedPageUrl);
    redirectUrl.searchParams.set('url', site.pattern);
    redirectUrl.searchParams.set('id', site.id);
    
    const rule = {
      id: ruleId,
      priority: 1,
      action: {
        type: 'redirect',
        redirect: { url: redirectUrl.toString() }
      },
      condition: {
        ...filter,
        resourceTypes: ['main_frame'] // Only block main page navigation
      }
    };
    
    // If there are exceptions, we need to explicitly list which domains to block
    // instead of using urlFilter which matches all subdomains
    if (site.exceptions && site.exceptions.length > 0) {
      // Extract the base domain from the pattern
      const baseDomain = site.pattern.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
      
      // Extract exception domains
      const exceptionDomains = site.exceptions.map(exc => 
        exc.replace(/^https?:\/\//, '').split('/')[0]
      );
      
      // Use requestDomains to match the base domain (which includes subdomains)
      // But exclude the exception domains explicitly
      rule.condition.requestDomains = [baseDomain];
      rule.condition.excludedRequestDomains = exceptionDomains;
      
      logger.info(`Created block rule with exceptions:`, {
        pattern: site.pattern,
        ruleId: ruleId,
        requestDomains: [baseDomain],
        excludedRequestDomains: exceptionDomains
      });
    }
    
    return rule;
  }

  /**
   * Update all blocking rules
   * @param {Array} blockedSites - Array of blocked site objects
   */
  async updateBlockingRules(blockedSites) {
    try {
      // Filter to only enabled sites
      const enabledSites = blockedSites.filter(site => site.enabled);
      
      // Get current rules
      const currentRules = await chrome.declarativeNetRequest.getDynamicRules();
      const currentRuleIds = currentRules.map(rule => rule.id);
      
      // Create blocking rules AND exception rules
      const allRules = [];
      let ruleIdCounter = this.RULE_ID_START;
      
      enabledSites.forEach((site, index) => {
        // Add the main blocking rule
        const blockRule = this.createRule(site, index);
        allRules.push(blockRule);
        
        // NO LONGER CREATING ALLOW RULES - requestDomains in block rule handles exceptions
      });
      
      // Update rules atomically
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: currentRuleIds,
        addRules: allRules
      });
      
      logger.info(`Updated blocking rules: ${allRules.length} total rules (blocks + exceptions)`);
      
      // Debug: Log exception rules for troubleshooting
      const exceptionRules = allRules.filter(r => r.action.type === 'allow');
      if (exceptionRules.length > 0) {
        logger.info(`Exception rules created: ${exceptionRules.length}`);
        exceptionRules.forEach(rule => {
          logger.debug('Exception rule:', {
            id: rule.id,
            priority: rule.priority,
            condition: rule.condition
          });
        });
      }
    } catch (error) {
      logger.error('Failed to update blocking rules:', error);
      throw error;
    }
  }

  /**
   * Add a single site to block list
   * @param {string} pattern - URL pattern to block
   * @returns {object} Created site object
   */
  async addBlockedSite(pattern) {
    // Validate pattern
    if (!pattern || typeof pattern !== 'string') {
      throw new Error('Invalid pattern');
    }
    
    // Check if essential URL
    if (this.isEssentialUrl(pattern)) {
      throw new Error('Cannot block essential browser pages');
    }
    
    try {
      // Get current blocked sites
      const blockedSites = await storage.get(STORAGE_KEYS.BLOCKED_SITES) || [];
      
      // Check for duplicates
      const exists = blockedSites.some(site => site.pattern === pattern);
      if (exists) {
        throw new Error('Site already blocked');
      }
      
      // Create new site entry
      const newSite = {
        id: crypto.randomUUID(),
        pattern: pattern,
        enabled: true,
        addedDate: Date.now(),
        blockCount: 0
      };
      
      // Add to list
      blockedSites.push(newSite);
      await storage.set(STORAGE_KEYS.BLOCKED_SITES, blockedSites);
      
      // Update rules
      await this.updateBlockingRules(blockedSites);
      
      logger.info(`Added blocked site: ${pattern}`);
      return newSite;
    } catch (error) {
      logger.error('Failed to add blocked site:', error);
      throw error;
    }
  }

  /**
   * Remove a site from block list
   * @param {string} siteId - Site ID to remove
   */
  async removeBlockedSite(siteId) {
    try {
      const blockedSites = await storage.get(STORAGE_KEYS.BLOCKED_SITES) || [];
      const filtered = blockedSites.filter(site => site.id !== siteId);
      
      await storage.set(STORAGE_KEYS.BLOCKED_SITES, filtered);
      await this.updateBlockingRules(filtered);
      
      logger.info(`Removed blocked site: ${siteId}`);
    } catch (error) {
      logger.error('Failed to remove blocked site:', error);
      throw error;
    }
  }

  /**
   * Toggle site enabled/disabled
   * @param {string} siteId - Site ID
   * @param {boolean} enabled - New enabled state
   */
  async toggleSite(siteId, enabled) {
    try {
      const blockedSites = await storage.get(STORAGE_KEYS.BLOCKED_SITES) || [];
      const site = blockedSites.find(s => s.id === siteId);
      
      if (!site) {
        throw new Error('Site not found');
      }
      
      site.enabled = enabled;
      await storage.set(STORAGE_KEYS.BLOCKED_SITES, blockedSites);
      await this.updateBlockingRules(blockedSites);
      
      logger.info(`Toggled site ${siteId}: ${enabled}`);
    } catch (error) {
      logger.error('Failed to toggle site:', error);
      throw error;
    }
  }

  /**
   * Increment block counter for a site
   * @param {string} siteId
   */
  async incrementBlockCount(siteId) {
    try {
      const blockedSites = await storage.get(STORAGE_KEYS.BLOCKED_SITES) || [];
      const site = blockedSites.find(s => s.id === siteId);
      
      if (site) {
        site.blockCount = (site.blockCount || 0) + 1;
        await storage.set(STORAGE_KEYS.BLOCKED_SITES, blockedSites);
        
        // Record in statistics
        await statisticsManager.recordBlock(siteId, site.pattern);
      }
    } catch (error) {
      logger.error('Failed to increment block count:', error);
    }
  }

  /**
   * Get all blocked sites
   * @returns {Array}
   */
  async getBlockedSites() {
    return await storage.get(STORAGE_KEYS.BLOCKED_SITES) || [];
  }

  /**
   * Get current blocking rules (for debugging)
   * @returns {Array}
   */
  async getCurrentRules() {
    return await chrome.declarativeNetRequest.getDynamicRules();
  }

  /**
   * Add tab to exemption list (won't be blocked during budget session)
   * @param {number} tabId
   * @param {string} pattern - Site pattern to allow for this tab
   */
  async addExemptTab(tabId, pattern) {
    logger.info('Adding tab to exemption list:', tabId, pattern);
    this.exemptTabs.add(tabId);
    
    // Create a session-scoped allowlist rule with higher priority for this tab
    const filter = this.patternToFilter(pattern);
    const sessionRule = {
      id: tabId, // Use tabId as rule ID for easy cleanup
      priority: 100, // Higher priority than blocking rules (which are priority 1)
      action: {
        type: 'allow' // Allow this tab through
      },
      condition: {
        ...filter,
        resourceTypes: ['main_frame'],
        tabIds: [tabId] // Only apply to this specific tab
      }
    };
    
    try {
      await chrome.declarativeNetRequest.updateSessionRules({
        addRules: [sessionRule]
      });
      logger.info('Session rule added for tab:', tabId);
    } catch (error) {
      logger.error('Failed to add session rule:', error);
      throw error;
    }
  }

  /**
   * Remove tab from exemption list
   * @param {number} tabId
   */
  async removeExemptTab(tabId) {
    logger.info('Removing tab from exemption list:', tabId);
    this.exemptTabs.delete(tabId);
    
    // Remove the session-scoped rule for this tab
    try {
      await chrome.declarativeNetRequest.updateSessionRules({
        removeRuleIds: [tabId]
      });
      logger.info('Session rule removed for tab:', tabId);
    } catch (error) {
      logger.error('Failed to remove session rule:', error);
      // Don't throw - session rules are cleaned up on browser restart anyway
    }
  }

  /**
   * Add exception to a blocked site
   * @param {string} siteId - Site ID
   * @param {string} exceptionPattern - Pattern to allow (e.g., 'music.youtube.com')
   * @returns {object} Updated site object
   */
  async addException(siteId, exceptionPattern) {
    try {
      const blockedSites = await storage.get(STORAGE_KEYS.BLOCKED_SITES) || [];
      const site = blockedSites.find(s => s.id === siteId);
      
      if (!site) {
        throw new Error('Site not found');
      }
      
      // Initialize exceptions array if it doesn't exist
      if (!site.exceptions) {
        site.exceptions = [];
      }
      
      // Normalize pattern
      exceptionPattern = exceptionPattern.replace(/^https?:\/\//, '').trim();
      
      // Check for duplicates
      if (site.exceptions.includes(exceptionPattern)) {
        throw new Error('Exception already exists');
      }
      
      // Validate that exception is more specific than the block pattern
      if (!this.isValidException(site.pattern, exceptionPattern)) {
        throw new Error('Exception must be related to the blocked pattern');
      }
      
      site.exceptions.push(exceptionPattern);
      await storage.set(STORAGE_KEYS.BLOCKED_SITES, blockedSites);
      await this.updateBlockingRules(blockedSites);
      
      logger.info(`Added exception ${exceptionPattern} to ${site.pattern}`);
      return site;
    } catch (error) {
      logger.error('Failed to add exception:', error);
      throw error;
    }
  }

  /**
   * Remove exception from a blocked site
   * @param {string} siteId - Site ID
   * @param {string} exceptionPattern - Pattern to remove
   * @returns {object} Updated site object
   */
  async removeException(siteId, exceptionPattern) {
    try {
      const blockedSites = await storage.get(STORAGE_KEYS.BLOCKED_SITES) || [];
      const site = blockedSites.find(s => s.id === siteId);
      
      if (!site || !site.exceptions) {
        throw new Error('Site or exception not found');
      }
      
      site.exceptions = site.exceptions.filter(e => e !== exceptionPattern);
      await storage.set(STORAGE_KEYS.BLOCKED_SITES, blockedSites);
      await this.updateBlockingRules(blockedSites);
      
      logger.info(`Removed exception ${exceptionPattern} from ${site.pattern}`);
      return site;
    } catch (error) {
      logger.error('Failed to remove exception:', error);
      throw error;
    }
  }

  /**
   * Validate that exception is related to block pattern
   * @param {string} blockPattern - The blocked pattern
   * @param {string} exceptionPattern - The exception pattern
   * @returns {boolean}
   */
  isValidException(blockPattern, exceptionPattern) {
    // Remove protocols
    blockPattern = blockPattern.replace(/^https?:\/\//, '').replace(/^www\./, '');
    exceptionPattern = exceptionPattern.replace(/^https?:\/\//, '').replace(/^www\./, '');
    
    // Remove wildcards for comparison
    const basePattern = blockPattern.replace('*.', '');
    
    // Exception should be more specific (contain the block pattern or be a subdomain)
    // e.g., music.youtube.com contains youtube.com
    // e.g., reddit.com/r/programming is more specific than reddit.com
    return exceptionPattern.includes(basePattern) || exceptionPattern.startsWith(basePattern);
  }

  /**
   * Enable or disable all blocking rules based on schedule
   * @param {boolean} enabled - Whether blocking should be enabled
   */
  async setBlockingEnabled(enabled) {
    try {
      logger.info(`=== setBlockingEnabled called: ${enabled} ===`);
      
      // Store the blocking state
      await storage.set('blockingEnabled', enabled);
      
      if (enabled) {
        // Re-enable blocking by updating rules from current blocked sites
        const blockedSites = await storage.get(STORAGE_KEYS.BLOCKED_SITES) || [];
        const enabledSites = blockedSites.filter(site => site.enabled);
        logger.info(`🔒 Re-enabling blocking for ${enabledSites.length} sites`);
        await this.updateBlockingRules(blockedSites);
        logger.info('✓ Blocking rules enabled');
      } else {
        // Disable blocking by removing all dynamic rules
        const currentRules = await chrome.declarativeNetRequest.getDynamicRules();
        const currentRuleIds = currentRules.map(rule => rule.id);
        
        logger.info(`🔓 Disabling blocking by removing ${currentRuleIds.length} rules`);
        
        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: currentRuleIds,
          addRules: []
        });
        
        logger.info('✓ Blocking rules disabled - all sites accessible');
        
        // Verify rules were removed
        const verifyRules = await chrome.declarativeNetRequest.getDynamicRules();
        logger.info(`🔍 Verification: ${verifyRules.length} rules remaining`);
      }
    } catch (error) {
      logger.error('Failed to set blocking enabled state:', error);
      throw error;
    }
  }
}

// Singleton instance
export const blockingManager = new BlockingManager();
