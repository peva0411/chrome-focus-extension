# Phase 5: Time Budget System

**Status:** Ready to Start  
**Estimated Time:** 5-6 days  
**Dependencies:** Phase 4 (Scheduling)

---

## Overview

This phase implements the time budget feature - allowing users controlled access to blocked sites using a daily time allowance. When a user tries to visit a blocked site, they'll see an interstitial page where they can choose to "spend" time from their budget to access the site temporarily.

---

## Objectives

1. Implement time budget tracking system
2. Update interstitial page with budget UI
3. Create budget countdown mechanism
4. Add budget reset logic (daily at midnight)
5. Build budget configuration UI
6. Implement budget warnings/notifications
7. Track budget usage statistics

---

## Requirements

### Must Complete

- [ ] Configure global daily budget
- [ ] Configure per-site budget overrides
- [ ] Interstitial shows remaining budget
- [ ] "Continue with budget" button
- [ ] Real-time countdown while on budgeted site
- [ ] Hard block when budget exhausted
- [ ] Daily budget reset at midnight
- [ ] Budget usage tracking
- [ ] Warning notifications (50%, 75%, 90%)

### Nice to Have

- [ ] Budget history graphs
- [ ] Budget rollover to next day
- [ ] Emergency access (2x cost)
- [ ] Earn extra budget through focus time

---

## Implementation Tasks

### 1. Budget Manager

#### 1.1 Create src/background/budget-manager.js

```javascript
import { storage } from '../common/storage.js';
import { STORAGE_KEYS, TIME, BUDGET_THRESHOLDS } from '../common/constants.js';
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
      
      logger.info('Budget manager initialized');
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
    }
  }

  /**
   * Check if budget needs daily reset
   */
  async checkDailyReset() {
    const today = getCurrentDate();
    
    if (!this.todaysBudget || this.todaysBudget.date !== today) {
      logger.info('Resetting daily budget');
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

    await this.saveBudgetData();
    
    // Send notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'src/assets/icons/icon128.png',
      title: 'Focus Extension',
      message: `Your time budget has been reset! You have ${this.globalBudget} minutes today.`
    });
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

    logger.info(`Budget reset alarm set for ${resetTime}`);
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
      canAccess: remaining.global > 0
    };
  }

  /**
   * Start a budget session for a site
   * @param {string} siteId
   * @param {string} tabId
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

    logger.info(`Started budget session for tab ${tabId}`);
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
        await this.endBudgetSession(tabId, true);
        clearInterval(intervalId);
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

    logger.info(`Ended budget session for tab ${tabId}, used ${session.minutesUsed.toFixed(1)} minutes`);

    // If budget exhausted, redirect to blocked page
    if (budgetExhausted) {
      try {
        chrome.tabs.update(tabId, {
          url: chrome.runtime.getURL('src/interstitial/blocked.html?budgetExhausted=true')
        });
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

    // Save
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

    // Check thresholds and send notifications
    if (percentRemaining <= BUDGET_THRESHOLDS.CRITICAL) {
      this.sendBudgetNotification('critical', remaining.global);
    } else if (percentRemaining <= BUDGET_THRESHOLDS.VERY_LOW) {
      this.sendBudgetNotification('low', remaining.global);
    }
  }

  /**
   * Send budget warning notification
   * @param {string} level - 'low' or 'critical'
   * @param {number} remaining - Minutes remaining
   */
  sendBudgetNotification(level, remaining) {
    const messages = {
      low: `Time budget running low! ${Math.floor(remaining)} minutes remaining.`,
      critical: `⚠️ Only ${Math.floor(remaining)} minutes left in your budget!`
    };

    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'src/assets/icons/icon128.png',
      title: 'Focus Extension Budget Warning',
      message: messages[level]
    });
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
    logger.info('Budget config updated');
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
    return Array.from(this.activeSessions.values());
  }
}

// Singleton instance
export const budgetManager = new BudgetManager();
```

---

### 2. Update Interstitial Page for Budget

#### 2.1 Update src/interstitial/blocked.html

Replace the existing content with budget-aware version:

```html
<!-- Add after the blocked URL section -->
<div class="budget-section" id="budget-section">
  <h3>⏱️ Time Budget Available</h3>
  
  <div class="budget-display">
    <div class="budget-item">
      <span class="budget-label">Remaining Today:</span>
      <span class="budget-value" id="budget-remaining">-- minutes</span>
    </div>
    <div class="budget-progress">
      <div class="budget-progress-bar" id="budget-progress-bar"></div>
    </div>
  </div>

  <div class="budget-warning" id="budget-warning" style="display: none;">
    ⚠️ Low budget remaining!
  </div>

  <div class="budget-exhausted" id="budget-exhausted" style="display: none;">
    ❌ Your time budget is exhausted for today. Try again tomorrow!
  </div>
</div>

<!-- Update actions section -->
<div class="actions">
  <button id="go-back-btn" class="btn btn-secondary">
    ← Go Back
  </button>
  
  <button id="use-budget-btn" class="btn btn-primary" style="display: none;">
    Continue (Use Time Budget)
  </button>
</div>

<div class="countdown-notice" id="countdown-notice" style="display: none;">
  <p>⏱️ This site will use your time budget.</p>
  <p>Continuing in <span id="countdown">5</span> seconds...</p>
</div>
```

#### 2.2 Update src/interstitial/blocked.css

Add budget styles:

```css
.budget-section {
  background: #eff6ff;
  border: 2px solid #667eea;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 24px;
}

.budget-section h3 {
  font-size: 16px;
  color: #1e40af;
  margin-bottom: 16px;
}

.budget-display {
  margin-bottom: 16px;
}

.budget-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
  font-size: 15px;
}

.budget-label {
  color: #64748b;
  font-weight: 500;
}

.budget-value {
  color: #667eea;
  font-weight: 700;
  font-size: 18px;
}

.budget-progress {
  height: 12px;
  background: #e2e8f0;
  border-radius: 6px;
  overflow: hidden;
}

.budget-progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #667eea, #764ba2);
  transition: width 0.3s ease;
}

.budget-warning {
  background: #fef3c7;
  border-left: 4px solid #f59e0b;
  padding: 12px;
  border-radius: 6px;
  color: #92400e;
  margin-top: 16px;
}

.budget-exhausted {
  background: #fee2e2;
  border-left: 4px solid #ef4444;
  padding: 12px;
  border-radius: 6px;
  color: #991b1b;
  margin-top: 16px;
}

.countdown-notice {
  background: #f8fafc;
  padding: 16px;
  border-radius: 8px;
  text-align: center;
  margin-top: 16px;
  border: 2px dashed #cbd5e1;
}

.countdown-notice p {
  margin-bottom: 4px;
  color: #64748b;
}

.countdown-notice span {
  font-weight: 700;
  font-size: 20px;
  color: #667eea;
}
```

#### 2.3 Update src/interstitial/blocked.js

```javascript
// Add to BlockedPageController class:

async init() {
  logger.info('Blocked page loaded', { url: this.blockedUrl });
  
  this.elements.blockedUrlText.textContent = this.blockedUrl || 'Unknown';
  
  // Load budget information
  await this.loadBudgetInfo();
  
  this.setupListeners();
  this.loadRandomQuote();
  this.recordBlock();
}

async loadBudgetInfo() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'CHECK_BUDGET',
      data: { siteId: this.siteId }
    });

    if (response.canAccess) {
      this.showBudgetAvailable(response);
    } else {
      this.showBudgetExhausted();
    }
  } catch (error) {
    logger.error('Failed to load budget:', error);
    // Hide budget section on error
    document.getElementById('budget-section').style.display = 'none';
  }
}

showBudgetAvailable(budgetInfo) {
  const section = document.getElementById('budget-section');
  const useBudgetBtn = document.getElementById('use-budget-btn');
  const remainingEl = document.getElementById('budget-remaining');
  const progressBar = document.getElementById('budget-progress-bar');
  const warning = document.getElementById('budget-warning');

  // Show remaining budget
  remainingEl.textContent = `${Math.floor(budgetInfo.globalRemaining)} minutes`;

  // Update progress bar
  const percentRemaining = (budgetInfo.globalRemaining / budgetInfo.total) * 100;
  progressBar.style.width = `${percentRemaining}%`;

  // Show warning if low
  if (percentRemaining < 25) {
    warning.style.display = 'block';
  }

  // Show use budget button
  useBudgetBtn.style.display = 'inline-block';
}

showBudgetExhausted() {
  const section = document.getElementById('budget-section');
  const exhausted = document.getElementById('budget-exhausted');
  const useBudgetBtn = document.getElementById('use-budget-btn');

  exhausted.style.display = 'block';
  useBudgetBtn.style.display = 'none';
}

setupListeners() {
  // ... existing listeners ...

  // Use budget button
  document.getElementById('use-budget-btn').addEventListener('click', () => {
    this.startBudgetCountdown();
  });
}

async startBudgetCountdown() {
  const countdownNotice = document.getElementById('countdown-notice');
  const countdownEl = document.getElementById('countdown');
  const useBudgetBtn = document.getElementById('use-budget-btn');

  // Hide button, show countdown
  useBudgetBtn.style.display = 'none';
  countdownNotice.style.display = 'block';

  let seconds = 5;
  const interval = setInterval(() => {
    seconds--;
    countdownEl.textContent = seconds;

    if (seconds <= 0) {
      clearInterval(interval);
      this.activateBudget();
    }
  }, 1000);
}

async activateBudget() {
  try {
    // Start budget session
    await chrome.runtime.sendMessage({
      type: 'START_BUDGET_SESSION',
      data: { siteId: this.siteId }
    });

    // Redirect to actual site
    window.location.href = this.blockedUrl;
  } catch (error) {
    logger.error('Failed to start budget session:', error);
    alert('Failed to access site with budget');
  }
}
```

---

### 3. Integrate with Service Worker

#### 3.1 Update src/background/service-worker.js

```javascript
import { budgetManager } from './budget-manager.js';

// In initializeExtension():
await budgetManager.initialize();

// In handleMessage(), add cases:
case 'CHECK_BUDGET':
  return await budgetManager.checkBudgetAvailable(data.siteId);

case 'START_BUDGET_SESSION':
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return await budgetManager.startBudgetSession(data.siteId, tab.id);

case 'END_BUDGET_SESSION':
  await budgetManager.endBudgetSession(data.tabId);
  return { success: true };

case 'GET_BUDGET_STATUS':
  return await budgetManager.getRemainingBudget();

case 'UPDATE_BUDGET_CONFIG':
  await budgetManager.updateBudgetConfig(data);
  return { success: true };

case 'GET_BUDGET_HISTORY':
  return { history: await budgetManager.getBudgetHistory(data.days) };

// Listen for alarm (budget reset)
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'budgetReset') {
    await budgetManager.resetDailyBudget();
  }
});

// Listen for tab close (end budget session)
chrome.tabs.onRemoved.addListener((tabId) => {
  budgetManager.endBudgetSession(tabId);
});
```

---

### 4. Budget Configuration UI

#### 4.1 Update src/options/options.html - Budget Tab

```html
<section id="tab-budget" class="tab-content">
  <div class="section-header">
    <h2>Time Budget</h2>
    <p>Control daily access time for blocked websites</p>
  </div>

  <!-- Budget Configuration -->
  <div class="card">
    <h3>Global Budget Settings</h3>
    
    <div class="form-group">
      <label for="global-budget">Daily Time Allowance (minutes):</label>
      <input type="number" id="global-budget" class="input" min="5" max="480" step="5" />
      <p class="help-text">Total minutes you can spend on blocked sites per day</p>
    </div>

    <div class="form-group">
      <label for="reset-time">Reset Time:</label>
      <input type="time" id="reset-time" class="input" />
      <p class="help-text">When your daily budget resets</p>
    </div>

    <button id="save-budget-btn" class="btn btn-primary">Save Settings</button>
  </div>

  <!-- Today's Budget -->
  <div class="card">
    <h3>Today's Usage</h3>
    <div class="budget-display-large">
      <div class="budget-circle">
        <span id="today-remaining">-- min</span>
        <span class="label">remaining</span>
      </div>
      <div class="budget-stats">
        <div class="stat-row">
          <span>Used:</span>
          <span id="today-used">-- min</span>
        </div>
        <div class="stat-row">
          <span>Total:</span>
          <span id="today-total">-- min</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Budget History -->
  <div class="card">
    <h3>Budget History (Last 7 Days)</h3>
    <div id="budget-chart-container">
      <!-- Chart will be rendered here -->
    </div>
  </div>
</section>
```

---

## Testing

### Manual Testing Checklist

- [ ] Configure global budget
- [ ] Access blocked site - see budget options
- [ ] Use budget - countdown works
- [ ] Site loads after countdown
- [ ] Budget decreases while browsing
- [ ] Budget exhausted - blocked again
- [ ] Budget resets at midnight
- [ ] Warnings shown at thresholds
- [ ] Budget history displays correctly

---

## Completion Checklist

- [ ] Budget tracking works accurately
- [ ] Budget sessions tracked per tab
- [ ] Budget exhaustion handled
- [ ] Daily reset works
- [ ] Interstitial shows budget info
- [ ] Configuration UI functional
- [ ] Notifications working
- [ ] History saved correctly

---

## Next Phase

Proceed to: **[Phase 6: Complete UI/UX](06-ui-ux.md)**
