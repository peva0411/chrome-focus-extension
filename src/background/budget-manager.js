import { storage } from '../common/storage.js';
import { STORAGE_KEYS, TIME, BUDGET_THRESHOLDS, DEFAULTS } from '../common/constants.js';
import { Logger } from '../common/logger.js';
import { getCurrentDate } from '../common/utils.js';

const logger = new Logger('BudgetManager');

/**
 * Manages time budgets for blocked sites
 */
export class BudgetManager {
  constructor() {
    this.globalBudget = 30; // minutes
    this.resetTime = '00:00';
    this.todaysBudget = null;
    this.activeSessions = new Map(); // Track active budget usage
    this.lastWarnings = new Set(); // Track sent warnings to avoid spam
  }

  /**
   * Initialize budget manager
   */
  async initialize() {
    logger.info('Initializing budget manager...');

    try {
      await this.loadBudgetConfig();
      await this.checkDailyReset();
      this.setupResetAlarm();
      
      logger.info('Budget manager initialized', {
        globalBudget: this.globalBudget,
        resetTime: this.resetTime
      });
    } catch (error) {
      logger.error('Failed to initialize budget manager:', error);
    }
  }

  /**
   * Load budget configuration from storage
   */
  async loadBudgetConfig() {
    const budgetData = await storage.get(STORAGE_KEYS.TIME_BUDGET);
    
    if (budgetData) {
      this.globalBudget = budgetData.globalBudget || 30;
      this.resetTime = budgetData.resetTime || '00:00';
      this.todaysBudget = budgetData.today;
    } else {
      // Initialize with defaults
      this.globalBudget = DEFAULTS.timeBudget.globalBudget;
      this.resetTime = DEFAULTS.timeBudget.resetTime;
      await this.saveBudgetData();
    }
  }

  /**
   * Check if budget needs daily reset
   */
  async checkDailyReset() {
    const today = getCurrentDate();
    
    if (!this.todaysBudget || this.todaysBudget.date !== today) {
      logger.info('Resetting daily budget', { today, previous: this.todaysBudget?.date });
      await this.resetDailyBudget();
    }
  }

  /**
   * Reset daily budget
   */
  async resetDailyBudget() {
    const today = getCurrentDate();
    
    // Save yesterday's data to history if it exists
    if (this.todaysBudget) {
      await this.saveToHistory(this.todaysBudget);
    }

    // Create new day's budget
    this.todaysBudget = {
      date: today,
      used: 0,
      perSite: {}
    };

    // Reset warning tracking
    this.lastWarnings.clear();

    await this.saveBudgetData();
    
    // Send notification
    try {
      await chrome.notifications.create('budgetReset', {
        type: 'basic',
        iconUrl: 'src/assets/icons/icon128.png',
        title: 'Focus Extension',
        message: `Your time budget has been reset! You have ${this.globalBudget} minutes today.`
      });
    } catch (error) {
      logger.warn('Failed to send reset notification:', error);
    }
  }

  /**
   * Setup alarm for daily reset
   */
  setupResetAlarm() {
    // Clear existing alarm
    chrome.alarms.clear('budgetReset');

    // Calculate next reset time
    const [hours, minutes] = this.resetTime.split(':').map(Number);
    const now = new Date();
    const resetTime = new Date();
    resetTime.setHours(hours, minutes, 0, 0);

    // If reset time already passed today, set for tomorrow
    if (resetTime <= now) {
      resetTime.setDate(resetTime.getDate() + 1);
    }

    // Create alarm
    chrome.alarms.create('budgetReset', {
      when: resetTime.getTime(),
      periodInMinutes: 24 * 60 // Daily
    });

    logger.info(`Budget reset alarm set for ${resetTime.toLocaleString()}`);
  }

  /**
   * Get remaining budget
   * @returns {Object} { global: number, siteSpecific: Object }
   */
  async getRemainingBudget() {
    await this.checkDailyReset();

    return {
      global: Math.max(0, this.globalBudget - (this.todaysBudget?.used || 0)),
      date: this.todaysBudget?.date,
      used: this.todaysBudget?.used || 0,
      total: this.globalBudget
    };
  }

  /**
   * Check if site has budget available
   * @param {string} siteId
   * @returns {Promise<Object>}
   */
  async checkBudgetAvailable(siteId) {
    const remaining = await this.getRemainingBudget();
    
    // Get site-specific budget override if exists
    const blockedSites = await storage.get(STORAGE_KEYS.BLOCKED_SITES) || [];
    const site = blockedSites.find(s => s.id === siteId);
    const siteBudget = site?.customBudget;

    return {
      hasGlobalBudget: remaining.global > 0,
      globalRemaining: remaining.global,
      siteRemaining: siteBudget 
        ? Math.max(0, siteBudget - (this.todaysBudget.perSite[siteId] || 0))
        : null,
      canAccess: remaining.global > 0,
      total: remaining.total,
      used: remaining.used
    };
  }

  /**
   * Start a budget session for a site
   * @param {string} siteId
   * @param {number} tabId
   * @returns {Promise<Object>}
   */
  async startBudgetSession(siteId, tabId) {
    const budget = await this.checkBudgetAvailable(siteId);
    
    if (!budget.canAccess) {
      throw new Error('No budget remaining');
    }

    const session = {
      siteId,
      tabId,
      startTime: Date.now(),
      lastUpdate: Date.now(),
      minutesUsed: 0
    };

    this.activeSessions.set(tabId, session);
    
    // Start tracking
    this.startSessionTracking(tabId);

    logger.info(`Started budget session for tab ${tabId}`, { siteId });
    return session;
  }

  /**
   * Track active session and update budget
   * @param {number} tabId
   */
  startSessionTracking(tabId) {
    const intervalId = setInterval(async () => {
      const session = this.activeSessions.get(tabId);
      
      if (!session) {
        clearInterval(intervalId);
        return;
      }

      // Calculate time elapsed since last update
      const now = Date.now();
      const elapsed = now - session.lastUpdate;
      const minutes = elapsed / (60 * 1000);

      // Update session
      session.lastUpdate = now;
      session.minutesUsed += minutes;

      // Update budget
      await this.consumeBudget(session.siteId, minutes);

      // Check if budget exhausted
      const budget = await this.checkBudgetAvailable(session.siteId);
      if (!budget.canAccess) {
        // Budget exhausted - close tab or redirect back to blocked page
        logger.info(`Budget exhausted for tab ${tabId}`);
        await this.endBudgetSession(tabId, true);
        clearInterval(intervalId);
        return;
      }

      // Send warning notifications
      await this.checkBudgetWarnings();

    }, 10000); // Update every 10 seconds

    // Store interval ID
    this.activeSessions.get(tabId).intervalId = intervalId;
  }

  /**
   * End a budget session
   * @param {number} tabId
   * @param {boolean} budgetExhausted
   */
  async endBudgetSession(tabId, budgetExhausted = false) {
    const session = this.activeSessions.get(tabId);
    
    if (!session) return;

    // Clear interval
    if (session.intervalId) {
      clearInterval(session.intervalId);
    }

    // Final budget update
    const now = Date.now();
    const elapsed = now - session.lastUpdate;
    const minutes = elapsed / (60 * 1000);
    await this.consumeBudget(session.siteId, minutes);

    // Remove session
    this.activeSessions.delete(tabId);

    // Remove tab exemption from blocking (will re-enable blocking for this tab)
    // Import blockingManager dynamically to avoid circular dependency
    const { blockingManager } = await import('./blocking-manager.js');
    await blockingManager.removeExemptTab(tabId);

    logger.info(`Ended budget session for tab ${tabId}`, {
      minutesUsed: session.minutesUsed.toFixed(2),
      budgetExhausted
    });

    // If budget exhausted, redirect to blocked page
    if (budgetExhausted) {
      try {
        const blockedUrl = chrome.runtime.getURL('src/interstitial/blocked.html') +
          `?budgetExhausted=true&siteId=${session.siteId}`;
        await chrome.tabs.update(tabId, { url: blockedUrl });
      } catch (error) {
        logger.error('Failed to redirect exhausted tab:', error);
      }
    }
  }

  /**
   * Consume budget
   * @param {string} siteId
   * @param {number} minutes
   */
  async consumeBudget(siteId, minutes) {
    if (!this.todaysBudget) {
      await this.checkDailyReset();
    }

    // Update global budget
    this.todaysBudget.used += minutes;

    // Update per-site budget
    if (!this.todaysBudget.perSite[siteId]) {
      this.todaysBudget.perSite[siteId] = 0;
    }
    this.todaysBudget.perSite[siteId] += minutes;

    // Save (but not too frequently)
    await this.saveBudgetData();
  }

  /**
   * Check and send budget warning notifications
   */
  async checkBudgetWarnings() {
    const remaining = await this.getRemainingBudget();
    const percentRemaining = remaining.global / this.globalBudget;

    const settings = await storage.get(STORAGE_KEYS.SETTINGS);
    if (!settings?.notifications?.budgetWarnings) return;

    // Check thresholds and send notifications (avoid spam)
    if (percentRemaining <= BUDGET_THRESHOLDS.CRITICAL && !this.lastWarnings.has('critical')) {
      this.sendBudgetNotification('critical', remaining.global);
      this.lastWarnings.add('critical');
    } else if (percentRemaining <= BUDGET_THRESHOLDS.VERY_LOW && !this.lastWarnings.has('low')) {
      this.sendBudgetNotification('low', remaining.global);
      this.lastWarnings.add('low');
    }
  }

  /**
   * Send budget warning notification
   * @param {string} level - 'low' or 'critical'
   * @param {number} remaining - Minutes remaining
   */
  async sendBudgetNotification(level, remaining) {
    const messages = {
      low: `Time budget running low! ${Math.floor(remaining)} minutes remaining.`,
      critical: `⚠️ Only ${Math.floor(remaining)} minutes left in your budget!`
    };

    try {
      await chrome.notifications.create(`budgetWarning-${level}`, {
        type: 'basic',
        iconUrl: 'src/assets/icons/icon128.png',
        title: 'Focus Extension Budget Warning',
        message: messages[level],
        priority: level === 'critical' ? 2 : 1
      });
    } catch (error) {
      logger.warn('Failed to send budget notification:', error);
    }
  }

  /**
   * Update budget configuration
   * @param {Object} config
   */
  async updateBudgetConfig(config) {
    if (config.globalBudget !== undefined) {
      this.globalBudget = config.globalBudget;
    }

    if (config.resetTime !== undefined) {
      this.resetTime = config.resetTime;
      this.setupResetAlarm();
    }

    await this.saveBudgetData();
    logger.info('Budget config updated', config);
  }

  /**
   * Save budget data to storage
   */
  async saveBudgetData() {
    await storage.set(STORAGE_KEYS.TIME_BUDGET, {
      globalBudget: this.globalBudget,
      resetTime: this.resetTime,
      today: this.todaysBudget
    });
  }

  /**
   * Save budget data to history
   * @param {Object} dayData
   */
  async saveToHistory(dayData) {
    const stats = await storage.get(STORAGE_KEYS.STATISTICS) || { budgetHistory: [] };
    
    if (!stats.budgetHistory) {
      stats.budgetHistory = [];
    }

    stats.budgetHistory.push({
      date: dayData.date,
      used: dayData.used,
      total: this.globalBudget,
      perSite: dayData.perSite
    });

    // Keep only last 30 days
    if (stats.budgetHistory.length > 30) {
      stats.budgetHistory = stats.budgetHistory.slice(-30);
    }

    await storage.set(STORAGE_KEYS.STATISTICS, stats);
    logger.info('Saved budget history', { date: dayData.date, used: dayData.used.toFixed(2) });
  }

  /**
   * Get budget statistics
   * @param {number} days - Number of days to retrieve
   * @returns {Promise<Array>}
   */
  async getBudgetHistory(days = 7) {
    const stats = await storage.get(STORAGE_KEYS.STATISTICS) || {};
    const history = stats.budgetHistory || [];
    
    return history.slice(-days);
  }

  /**
   * Get active sessions info
   * @returns {Array}
   */
  getActiveSessions() {
    return Array.from(this.activeSessions.values()).map(session => ({
      siteId: session.siteId,
      tabId: session.tabId,
      minutesUsed: session.minutesUsed,
      startTime: session.startTime
    }));
  }

  /**
   * Check if a tab has an active budget session
   * @param {number} tabId
   * @returns {boolean}
   */
  hasActiveSession(tabId) {
    return this.activeSessions.has(tabId);
  }
}

// Singleton instance
export const budgetManager = new BudgetManager();
