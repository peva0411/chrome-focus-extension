# Phase 2: Core Blocking Implementation

**Status:** Ready to Start  
**Estimated Time:** 3-4 days  
**Dependencies:** Phase 1 (Project Setup)

---

## Overview

This phase implements the fundamental blocking mechanism using Chrome's `declarativeNetRequest` API. We'll create the core blocking engine that intercepts navigation to blocked sites and redirects to an interstitial page.

---

## Objectives

1. Implement URL pattern matching and blocking
2. Create declarative rules for site blocking
3. Build interstitial "blocked" page
4. Handle rule updates dynamically
5. Integrate with storage layer

---

## Requirements

### Must Complete

- [ ] Block sites based on URL patterns
- [ ] Redirect blocked sites to interstitial page
- [ ] Support domain-level blocking (e.g., `*.facebook.com`)
- [ ] Support path-specific blocking (e.g., `reddit.com/r/all`)
- [ ] Update blocking rules without restart
- [ ] Interstitial page displays blocked URL
- [ ] "Go back" functionality on interstitial
- [ ] Prevent blocking of essential Chrome URLs

### Nice to Have

- [ ] Block counter statistics
- [ ] Animated interstitial page
- [ ] Custom block messages per site

---

## Technical Overview

### Chrome declarativeNetRequest API

Manifest V3 uses `declarativeNetRequest` instead of the older `webRequest` API. Key benefits:
- Better performance (rules processed in browser engine)
- No content script injection needed
- More privacy-friendly

**API Limits:**
- Maximum enabled rules: 5,000
- Maximum regex rules: 1,000
- Rule ID must be unique integer

### Blocking Strategy

1. **Dynamic Rules** - Rules added/removed at runtime
2. **Redirect Action** - Send blocked URLs to interstitial page
3. **Rule Priority** - Ensure block rules override other rules

---

## Implementation Tasks

### 1. Update Permissions

#### 1.1 Update manifest.json

Add declarativeNetRequest permissions and blocked page:

```json
{
  "permissions": [
    "storage",
    "alarms",
    "tabs",
    "notifications",
    "declarativeNetRequest",
    "declarativeNetRequestWithHostAccess"
  ],

  "host_permissions": [
    "<all_urls>"
  ],

  "web_accessible_resources": [
    {
      "resources": ["src/interstitial/blocked.html"],
      "matches": ["<all_urls>"]
    }
  ]
}
```

**Key additions:**
- `declarativeNetRequestWithHostAccess` - Allows blocking with host permissions
- `web_accessible_resources` - Makes blocked.html accessible

---

### 2. Blocking Rule Manager

#### 2.1 Create src/background/blocking-manager.js

```javascript
import { storage } from '../common/storage.js';
import { STORAGE_KEYS } from '../common/constants.js';
import { Logger } from '../common/logger.js';

const logger = new Logger('BlockingManager');

/**
 * Manages declarativeNetRequest rules for blocking websites
 */
export class BlockingManager {
  constructor() {
    this.RULE_ID_START = 1000; // Start IDs from 1000 to avoid conflicts
    this.blockedPageUrl = chrome.runtime.getURL('src/interstitial/blocked.html');
  }

  /**
   * Initialize blocking rules from storage
   */
  async initialize() {
    logger.info('Initializing blocking manager...');
    
    try {
      const blockedSites = await storage.get(STORAGE_KEYS.BLOCKED_SITES) || [];
      await this.updateBlockingRules(blockedSites);
      
      logger.info(`Initialized with ${blockedSites.length} blocked sites`);
    } catch (error) {
      logger.error('Failed to initialize blocking:', error);
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
    
    return {
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
      
      // Create new rules
      const newRules = enabledSites.map((site, index) => this.createRule(site, index));
      
      // Update rules atomically
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: currentRuleIds,
        addRules: newRules
      });
      
      logger.info(`Updated blocking rules: ${newRules.length} active`);
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
}

// Singleton instance
export const blockingManager = new BlockingManager();
```

---

### 3. Interstitial Blocked Page

#### 3.1 Create src/interstitial/blocked.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Site Blocked - Focus Extension</title>
  <link rel="stylesheet" href="blocked.css">
</head>
<body>
  <div class="container">
    <div class="content">
      <div class="icon">
        🔒
      </div>
      
      <h1>This site is blocked</h1>
      <p class="subtitle">Focus Extension is helping you stay productive</p>
      
      <div class="blocked-url">
        <strong>Blocked URL:</strong>
        <span id="blocked-url-text">Loading...</span>
      </div>
      
      <div class="info-box">
        <h3>Why is this blocked?</h3>
        <p>You added this site to your block list to minimize distractions during focus time.</p>
      </div>
      
      <div class="actions">
        <button id="go-back-btn" class="btn btn-primary">
          ← Go Back
        </button>
        
        <button id="remove-block-btn" class="btn btn-secondary">
          Remove from Block List
        </button>
      </div>
      
      <div class="quote" id="quote-container">
        <p id="quote-text">"The successful warrior is the average man, with laser-like focus."</p>
        <p class="quote-author">— Bruce Lee</p>
      </div>
      
      <div class="footer">
        <p>Time budget feature coming soon!</p>
        <a href="#" id="settings-link">Open Settings</a>
      </div>
    </div>
  </div>

  <script src="blocked.js" type="module"></script>
</body>
</html>
```

#### 3.2 Create src/interstitial/blocked.css

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
    Ubuntu, Cantarell, sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.container {
  max-width: 600px;
  width: 100%;
}

.content {
  background: white;
  border-radius: 16px;
  padding: 48px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  text-align: center;
}

.icon {
  font-size: 64px;
  margin-bottom: 24px;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

h1 {
  font-size: 32px;
  color: #1e293b;
  margin-bottom: 8px;
  font-weight: 700;
}

.subtitle {
  font-size: 16px;
  color: #64748b;
  margin-bottom: 32px;
}

.blocked-url {
  background: #f8fafc;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 24px;
  text-align: left;
}

.blocked-url strong {
  display: block;
  color: #64748b;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

#blocked-url-text {
  color: #667eea;
  font-weight: 600;
  word-break: break-all;
}

.info-box {
  background: #eff6ff;
  border-left: 4px solid #667eea;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 32px;
  text-align: left;
}

.info-box h3 {
  font-size: 14px;
  color: #1e40af;
  margin-bottom: 8px;
  font-weight: 600;
}

.info-box p {
  font-size: 14px;
  color: #1e40af;
  line-height: 1.6;
}

.actions {
  display: flex;
  gap: 12px;
  margin-bottom: 32px;
  flex-wrap: wrap;
  justify-content: center;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  flex: 1;
  min-width: 150px;
}

.btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.btn:active {
  transform: translateY(0);
}

.btn-primary {
  background: #667eea;
  color: white;
}

.btn-primary:hover {
  background: #5568d3;
}

.btn-secondary {
  background: white;
  color: #667eea;
  border: 2px solid #667eea;
}

.btn-secondary:hover {
  background: #f8fafc;
}

.quote {
  padding: 24px;
  background: #fef3c7;
  border-radius: 8px;
  margin-bottom: 24px;
}

#quote-text {
  font-size: 16px;
  font-style: italic;
  color: #92400e;
  margin-bottom: 8px;
  line-height: 1.6;
}

.quote-author {
  font-size: 14px;
  color: #b45309;
  font-weight: 600;
}

.footer {
  padding-top: 24px;
  border-top: 1px solid #e2e8f0;
}

.footer p {
  font-size: 13px;
  color: #94a3b8;
  margin-bottom: 8px;
}

.footer a {
  color: #667eea;
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
}

.footer a:hover {
  text-decoration: underline;
}

/* Responsive */
@media (max-width: 600px) {
  .content {
    padding: 32px 24px;
  }
  
  h1 {
    font-size: 24px;
  }
  
  .actions {
    flex-direction: column;
  }
  
  .btn {
    width: 100%;
  }
}
```

#### 3.3 Create src/interstitial/blocked.js

```javascript
import { Logger } from '../common/logger.js';

const logger = new Logger('BlockedPage');

/**
 * Blocked Page Controller
 */
class BlockedPageController {
  constructor() {
    this.params = new URLSearchParams(window.location.search);
    this.blockedUrl = this.params.get('url');
    this.siteId = this.params.get('id');
    
    this.elements = {
      blockedUrlText: document.getElementById('blocked-url-text'),
      goBackBtn: document.getElementById('go-back-btn'),
      removeBlockBtn: document.getElementById('remove-block-btn'),
      settingsLink: document.getElementById('settings-link'),
      quoteText: document.getElementById('quote-text')
    };
    
    this.init();
  }

  init() {
    logger.info('Blocked page loaded', { url: this.blockedUrl });
    
    // Display blocked URL
    this.elements.blockedUrlText.textContent = this.blockedUrl || 'Unknown';
    
    // Set up event listeners
    this.setupListeners();
    
    // Load random quote
    this.loadRandomQuote();
    
    // Increment block counter
    this.recordBlock();
  }

  setupListeners() {
    // Go back button
    this.elements.goBackBtn.addEventListener('click', () => {
      window.history.back();
    });

    // Remove from block list
    this.elements.removeBlockBtn.addEventListener('click', async () => {
      if (confirm('Remove this site from your block list?')) {
        try {
          await chrome.runtime.sendMessage({
            type: 'REMOVE_BLOCKED_SITE',
            data: { siteId: this.siteId }
          });
          
          // Show success and redirect
          alert('Site removed from block list');
          window.location.href = this.blockedUrl;
        } catch (error) {
          logger.error('Failed to remove site:', error);
          alert('Failed to remove site');
        }
      }
    });

    // Settings link
    this.elements.settingsLink.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    });
  }

  loadRandomQuote() {
    const quotes = [
      {
        text: "The successful warrior is the average man, with laser-like focus.",
        author: "Bruce Lee"
      },
      {
        text: "Concentration is the secret of strength.",
        author: "Ralph Waldo Emerson"
      },
      {
        text: "Focus is a matter of deciding what things you're not going to do.",
        author: "John Carmack"
      },
      {
        text: "The shorter way to do many things is to only do one thing at a time.",
        author: "Mozart"
      },
      {
        text: "It is during our darkest moments that we must focus to see the light.",
        author: "Aristotle"
      }
    ];
    
    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
    this.elements.quoteText.textContent = `"${randomQuote.text}"`;
    this.elements.quoteText.nextElementSibling.textContent = `— ${randomQuote.author}`;
  }

  async recordBlock() {
    if (!this.siteId) return;
    
    try {
      await chrome.runtime.sendMessage({
        type: 'RECORD_BLOCK',
        data: { siteId: this.siteId }
      });
    } catch (error) {
      logger.error('Failed to record block:', error);
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new BlockedPageController();
});
```

---

### 4. Update Service Worker

#### 4.1 Update src/background/service-worker.js

Add blocking manager integration:

```javascript
import { storage } from '../common/storage.js';
import { blockingManager } from './blocking-manager.js';
import { Logger } from '../common/logger.js';

const logger = new Logger('ServiceWorker');

// ... (keep existing lifecycle handlers)

/**
 * Initialize extension on startup
 */
async function initializeExtension() {
  try {
    // Ensure storage is initialized
    await storage.initialize();
    
    // Initialize blocking manager
    await blockingManager.initialize();
    
    logger.info('Extension initialized successfully');
  } catch (error) {
    logger.error('Extension initialization failed:', error);
  }
}

/**
 * Route messages to appropriate handlers
 */
async function handleMessage(message, sender) {
  const { type, data } = message;
  
  switch (type) {
    case 'PING':
      return { status: 'ok' };
    
    case 'GET_STATUS':
      return { enabled: true, state: 'active' };
    
    case 'ADD_BLOCKED_SITE':
      return await blockingManager.addBlockedSite(data.pattern);
    
    case 'REMOVE_BLOCKED_SITE':
      await blockingManager.removeBlockedSite(data.siteId);
      return { success: true };
    
    case 'TOGGLE_SITE':
      await blockingManager.toggleSite(data.siteId, data.enabled);
      return { success: true };
    
    case 'GET_BLOCKED_SITES':
      const sites = await blockingManager.getBlockedSites();
      return { sites };
    
    case 'RECORD_BLOCK':
      await blockingManager.incrementBlockCount(data.siteId);
      return { success: true };
    
    default:
      logger.warn('Unknown message type:', type);
      return { error: 'Unknown message type' };
  }
}

// ... (keep rest of the file)
```

---

### 5. Testing

#### 5.1 Manual Testing Checklist

- [ ] Add a site to block list (e.g., `twitter.com`)
- [ ] Navigate to blocked site - should redirect to blocked page
- [ ] Verify blocked URL is displayed correctly
- [ ] Click "Go Back" - should go to previous page
- [ ] Click "Remove from Block List" - site should be unblocked
- [ ] Try accessing site again - should work now
- [ ] Test wildcard patterns (`*.reddit.com`)
- [ ] Test path-specific patterns (`youtube.com/watch`)
- [ ] Verify essential URLs cannot be blocked
- [ ] Check declarativeNetRequest rules in DevTools

#### 5.2 Test Commands

```javascript
// In service worker console

// Add a test site
chrome.runtime.sendMessage(
  { type: 'ADD_BLOCKED_SITE', data: { pattern: 'twitter.com' } },
  response => console.log(response)
);

// Get all blocked sites
chrome.runtime.sendMessage(
  { type: 'GET_BLOCKED_SITES' },
  response => console.log(response)
);

// Check active rules
const rules = await chrome.declarativeNetRequest.getDynamicRules();
console.log('Active rules:', rules);
```

---

## Completion Checklist

### Before Moving to Phase 3

- [ ] Blocking mechanism working for simple domains
- [ ] Blocking mechanism working for wildcards
- [ ] Blocking mechanism working for paths
- [ ] Interstitial page displays correctly
- [ ] Go back functionality works
- [ ] Remove from block list works
- [ ] Essential URLs are protected
- [ ] No console errors
- [ ] Block statistics are recorded
- [ ] Rules persist across browser restarts

---

## Next Phase

Once Phase 2 is complete, proceed to:
**[Phase 3: Dynamic Site Management](03-site-management.md)**

This will add the UI for managing blocked sites, including adding, removing, and organizing sites.
