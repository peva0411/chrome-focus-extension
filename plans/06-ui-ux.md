# Phase 6: Complete UI/UX Implementation

**Status:** Ready to Start  
**Estimated Time:** 6-7 days  
**Dependencies:** Phase 5 (Time Budget)

---

## Overview

This phase completes the user interface and experience by polishing all existing UI components, adding statistics and analytics, implementing notifications, and creating a cohesive design system across all extension pages.

---

## Objectives

1. Polish and complete all UI components
2. Implement statistics dashboard
3. Add proper notifications system
4. Create settings page
5. Implement dark mode
6. Add animations and transitions
7. Ensure responsive design
8. Complete onboarding flow

---

## Requirements

### Must Complete

- [ ] Complete statistics dashboard
- [ ] Proper notification system
- [ ] General settings page
- [ ] Dark mode support
- [ ] Responsive design for all pages
- [ ] Polished animations
- [ ] Onboarding/welcome screen
- [ ] Help documentation
- [ ] Accessibility improvements

### Nice to Have

- [ ] Keyboard shortcuts
- [ ] Custom themes
- [ ] Export statistics
- [ ] Social sharing of achievements

---

## Implementation Tasks

### 1. Statistics Dashboard

#### 1.1 Update src/options/options.html - Stats Tab

```html
<section id="tab-stats" class="tab-content">
  <div class="section-header">
    <h2>Statistics & Insights</h2>
    <p>Track your productivity and focus time</p>
  </div>

  <!-- Overview Cards -->
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-icon">🚫</div>
      <div class="stat-content">
        <div class="stat-value" id="total-blocks">0</div>
        <div class="stat-label">Sites Blocked Today</div>
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-icon">⏱️</div>
      <div class="stat-content">
        <div class="stat-value" id="focus-time">0h 0m</div>
        <div class="stat-label">Focus Time Today</div>
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-icon">🎯</div>
      <div class="stat-content">
        <div class="stat-value" id="streak-days">0</div>
        <div class="stat-label">Day Streak</div>
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-icon">📊</div>
      <div class="stat-content">
        <div class="stat-value" id="budget-saved">0%</div>
        <div class="stat-label">Budget Saved</div>
      </div>
    </div>
  </div>

  <!-- Most Blocked Sites -->
  <div class="card">
    <h3>Most Blocked Sites</h3>
    <div id="top-blocked-sites">
      <!-- Will be populated dynamically -->
    </div>
  </div>

  <!-- Time of Day Analysis -->
  <div class="card">
    <h3>Blocking Activity by Hour</h3>
    <canvas id="hourly-chart" width="400" height="200"></canvas>
  </div>

  <!-- Weekly Trends -->
  <div class="card">
    <h3>Weekly Trends</h3>
    <canvas id="weekly-chart" width="400" height="200"></canvas>
  </div>

  <!-- Export -->
  <div class="card">
    <h3>Export Data</h3>
    <p>Download your statistics and data for backup or analysis</p>
    <button id="export-stats-btn" class="btn btn-secondary">
      📥 Export All Statistics
    </button>
  </div>
</section>
```

#### 1.2 Create src/background/statistics-manager.js

```javascript
import { storage } from '../common/storage.js';
import { STORAGE_KEYS } from '../common/constants.js';
import { Logger } from '../common/logger.js';
import { getCurrentDate } from '../common/utils.js';

const logger = new Logger('StatisticsManager');

/**
 * Manages statistics and analytics
 */
export class StatisticsManager {
  constructor() {
    this.stats = null;
  }

  /**
   * Initialize statistics
   */
  async initialize() {
    await this.loadStats();
    await this.checkDailyReset();
  }

  /**
   * Load statistics from storage
   */
  async loadStats() {
    this.stats = await storage.get(STORAGE_KEYS.STATISTICS) || {
      totalBlocks: 0,
      totalFocusTime: 0,
      streak: 0,
      lastActiveDate: null,
      daily: {},
      siteStats: {},
      hourlyActivity: {},
      budgetHistory: []
    };
  }

  /**
   * Check if we need to reset daily stats
   */
  async checkDailyReset() {
    const today = getCurrentDate();
    
    if (!this.stats.daily[today]) {
      this.stats.daily[today] = {
        blocks: 0,
        focusTime: 0,
        budgetUsed: 0,
        sites: {}
      };
      
      // Update streak
      await this.updateStreak(today);
      await this.saveStats();
    }
  }

  /**
   * Record a block event
   */
  async recordBlock(siteId, sitePattern) {
    const today = getCurrentDate();
    const hour = new Date().getHours();

    // Ensure today exists
    if (!this.stats.daily[today]) {
      await this.checkDailyReset();
    }

    // Increment counters
    this.stats.totalBlocks++;
    this.stats.daily[today].blocks++;

    // Update site stats
    if (!this.stats.siteStats[sitePattern]) {
      this.stats.siteStats[sitePattern] = {
        blocks: 0,
        lastBlocked: null
      };
    }
    this.stats.siteStats[sitePattern].blocks++;
    this.stats.siteStats[sitePattern].lastBlocked = Date.now();

    // Update hourly activity
    if (!this.stats.hourlyActivity[hour]) {
      this.stats.hourlyActivity[hour] = 0;
    }
    this.stats.hourlyActivity[hour]++;

    await this.saveStats();
    logger.info('Block recorded', { site: sitePattern });
  }

  /**
   * Update focus time
   */
  async updateFocusTime(minutes) {
    const today = getCurrentDate();

    if (!this.stats.daily[today]) {
      await this.checkDailyReset();
    }

    this.stats.totalFocusTime += minutes;
    this.stats.daily[today].focusTime += minutes;

    await this.saveStats();
  }

  /**
   * Update streak counter
   */
  async updateStreak(today) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (this.stats.lastActiveDate === yesterdayStr) {
      // Continuing streak
      this.stats.streak++;
    } else if (this.stats.lastActiveDate !== today) {
      // Streak broken or first day
      this.stats.streak = 1;
    }

    this.stats.lastActiveDate = today;
  }

  /**
   * Get today's statistics
   */
  async getTodayStats() {
    const today = getCurrentDate();
    await this.checkDailyReset();

    return {
      blocks: this.stats.daily[today]?.blocks || 0,
      focusTime: this.stats.daily[today]?.focusTime || 0,
      budgetUsed: this.stats.daily[today]?.budgetUsed || 0,
      streak: this.stats.streak
    };
  }

  /**
   * Get top blocked sites
   */
  getTopBlockedSites(limit = 10) {
    const sites = Object.entries(this.stats.siteStats)
      .map(([pattern, data]) => ({
        pattern,
        blocks: data.blocks,
        lastBlocked: data.lastBlocked
      }))
      .sort((a, b) => b.blocks - a.blocks)
      .slice(0, limit);

    return sites;
  }

  /**
   * Get weekly data
   */
  getWeeklyData() {
    const days = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      days.push({
        date: dateStr,
        blocks: this.stats.daily[dateStr]?.blocks || 0,
        focusTime: this.stats.daily[dateStr]?.focusTime || 0
      });
    }

    return days;
  }

  /**
   * Get hourly activity data
   */
  getHourlyActivity() {
    const activity = [];
    for (let hour = 0; hour < 24; hour++) {
      activity.push({
        hour,
        blocks: this.stats.hourlyActivity[hour] || 0
      });
    }
    return activity;
  }

  /**
   * Export all statistics
   */
  async exportStats() {
    return {
      exportDate: new Date().toISOString(),
      version: '1.0',
      statistics: this.stats
    };
  }

  /**
   * Save statistics to storage
   */
  async saveStats() {
    await storage.set(STORAGE_KEYS.STATISTICS, this.stats);
  }
}

// Singleton
export const statisticsManager = new StatisticsManager();
```

---

### 2. Settings Page

#### 2.1 Update src/options/options.html - Settings Tab

```html
<section id="tab-settings" class="tab-content">
  <div class="section-header">
    <h2>General Settings</h2>
    <p>Configure extension behavior and preferences</p>
  </div>

  <!-- Extension Control -->
  <div class="card">
    <h3>Extension Control</h3>
    
    <div class="setting-row">
      <div class="setting-info">
        <div class="setting-label">Enable Extension</div>
        <div class="setting-description">Turn blocking on/off globally</div>
      </div>
      <div class="toggle-switch" id="extension-enabled-toggle"></div>
    </div>
  </div>

  <!-- Notifications -->
  <div class="card">
    <h3>Notifications</h3>
    
    <div class="setting-row">
      <div class="setting-info">
        <div class="setting-label">Budget Warnings</div>
        <div class="setting-description">Notify when budget is running low</div>
      </div>
      <div class="toggle-switch" id="budget-warnings-toggle"></div>
    </div>

    <div class="setting-row">
      <div class="setting-info">
        <div class="setting-label">Budget Exhausted</div>
        <div class="setting-description">Notify when budget is completely used</div>
      </div>
      <div class="toggle-switch" id="budget-exhausted-toggle"></div>
    </div>

    <div class="setting-row">
      <div class="setting-info">
        <div class="setting-label">Daily Reset</div>
        <div class="setting-description">Notify when budget resets</div>
      </div>
      <div class="toggle-switch" id="daily-reset-toggle"></div>
    </div>
  </div>

  <!-- Appearance -->
  <div class="card">
    <h3>Appearance</h3>
    
    <div class="setting-row">
      <div class="setting-info">
        <div class="setting-label">Theme</div>
        <div class="setting-description">Choose your preferred color theme</div>
      </div>
      <select id="theme-select" class="select">
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="auto">Auto (System)</option>
      </select>
    </div>

    <div class="setting-row">
      <div class="setting-info">
        <div class="setting-label">Show Motivational Quotes</div>
        <div class="setting-description">Display quotes on blocked page</div>
      </div>
      <div class="toggle-switch" id="show-quotes-toggle"></div>
    </div>
  </div>

  <!-- Interstitial Settings -->
  <div class="card">
    <h3>Blocked Page Settings</h3>
    
    <div class="form-group">
      <label for="interstitial-delay">Countdown Delay (seconds):</label>
      <input type="number" id="interstitial-delay" class="input" min="0" max="30" />
      <p class="help-text">Time before "Continue" button activates</p>
    </div>
  </div>

  <!-- Data Management -->
  <div class="card">
    <h3>Data Management</h3>
    
    <div class="button-group">
      <button id="export-all-btn" class="btn btn-secondary">
        📥 Export All Data
      </button>
      <button id="import-all-btn" class="btn btn-secondary">
        📤 Import Data
      </button>
      <input type="file" id="import-all-file" accept=".json" style="display: none;">
    </div>

    <hr style="margin: 24px 0;">

    <button id="reset-settings-btn" class="btn btn-text text-danger">
      Reset All Settings to Default
    </button>
    
    <button id="clear-all-data-btn" class="btn btn-text text-danger">
      Clear All Extension Data
    </button>
  </div>

  <!-- About -->
  <div class="card">
    <h3>About Focus Extension</h3>
    <p>Version: 1.0.0</p>
    <p>
      <a href="#" id="privacy-link">Privacy Policy</a> | 
      <a href="#" id="help-link">Help & Documentation</a>
    </p>
  </div>
</section>
```

---

### 3. Dark Mode Implementation

#### 3.1 Add dark mode CSS variables

Create `src/common/themes.css`:

```css
:root {
  /* Light theme (default) */
  --bg-primary: #ffffff;
  --bg-secondary: #f8fafc;
  --bg-tertiary: #f1f5f9;
  
  --text-primary: #1e293b;
  --text-secondary: #64748b;
  --text-tertiary: #94a3b8;
  
  --border-color: #e2e8f0;
  
  --primary-color: #667eea;
  --primary-hover: #5568d3;
  
  --success-color: #10b981;
  --warning-color: #f59e0b;
  --error-color: #ef4444;
  
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.1);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.15);
  --shadow-lg: 0 20px 60px rgba(0, 0, 0, 0.3);
}

[data-theme="dark"] {
  --bg-primary: #1e293b;
  --bg-secondary: #334155;
  --bg-tertiary: #475569;
  
  --text-primary: #f8fafc;
  --text-secondary: #cbd5e1;
  --text-tertiary: #94a3b8;
  
  --border-color: #475569;
  
  --primary-color: #818cf8;
  --primary-hover: #6366f1;
  
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 20px 60px rgba(0, 0, 0, 0.6);
}

body {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.card {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
}

/* Update all color references to use variables */
```

#### 3.2 Theme Manager

Create `src/common/theme-manager.js`:

```javascript
import { storage } from './storage.js';
import { STORAGE_KEYS } from './constants.js';

export class ThemeManager {
  constructor() {
    this.currentTheme = 'light';
  }

  async initialize() {
    const settings = await storage.get(STORAGE_KEYS.SETTINGS);
    const theme = settings?.theme || 'light';
    this.applyTheme(theme);
  }

  applyTheme(theme) {
    if (theme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      theme = prefersDark ? 'dark' : 'light';
    }

    document.documentElement.setAttribute('data-theme', theme);
    this.currentTheme = theme;
  }

  async setTheme(theme) {
    this.applyTheme(theme);
    
    const settings = await storage.get(STORAGE_KEYS.SETTINGS);
    settings.theme = theme;
    await storage.set(STORAGE_KEYS.SETTINGS, settings);
  }
}

export const themeManager = new ThemeManager();
```

---

### 4. Onboarding Flow

#### 4.1 Create src/onboarding/welcome.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Focus Extension</title>
  <link rel="stylesheet" href="welcome.css">
</head>
<body>
  <div class="container">
    <div class="welcome-screen active" data-step="1">
      <div class="icon">⚡</div>
      <h1>Welcome to Focus Extension!</h1>
      <p>Take control of your productivity by blocking distracting websites during focus time.</p>
      <button class="btn btn-primary next-btn">Get Started</button>
    </div>

    <div class="welcome-screen" data-step="2">
      <div class="icon">🚫</div>
      <h2>Block Distracting Sites</h2>
      <p>Add websites that distract you. We'll help you stay focused by blocking access during your designated times.</p>
      <div class="example">
        <code>twitter.com</code>
        <code>reddit.com</code>
        <code>youtube.com</code>
      </div>
      <button class="btn btn-primary next-btn">Next</button>
    </div>

    <div class="welcome-screen" data-step="3">
      <div class="icon">📅</div>
      <h2>Set Your Schedule</h2>
      <p>Choose when blocking should be active. Work hours, study time, or custom schedules.</p>
      <button class="btn btn-primary next-btn">Next</button>
    </div>

    <div class="welcome-screen" data-step="4">
      <div class="icon">⏱️</div>
      <h2>Use Time Budgets</h2>
      <p>Need to check a blocked site? Use your daily time budget for controlled access.</p>
      <button class="btn btn-primary next-btn">Next</button>
    </div>

    <div class="welcome-screen" data-step="5">
      <div class="icon">🎯</div>
      <h2>You're All Set!</h2>
      <p>Ready to boost your productivity? Let's set up your first blocked site.</p>
      <button id="finish-btn" class="btn btn-primary">Open Settings</button>
      <button id="skip-btn" class="btn btn-secondary">Skip for Now</button>
    </div>

    <div class="progress-dots">
      <span class="dot active"></span>
      <span class="dot"></span>
      <span class="dot"></span>
      <span class="dot"></span>
      <span class="dot"></span>
    </div>
  </div>

  <script src="welcome.js" type="module"></script>
</body>
</html>
```

---

## Testing

### Manual Testing Checklist

- [ ] Statistics display correctly
- [ ] Charts render properly
- [ ] Settings save and persist
- [ ] Dark mode toggles correctly
- [ ] Notifications work
- [ ] Onboarding flow complete
- [ ] All pages responsive
- [ ] Accessibility (keyboard navigation)

---

## Completion Checklist

- [ ] All UI components polished
- [ ] Statistics fully functional
- [ ] Settings page complete
- [ ] Dark mode implemented
- [ ] Onboarding complete
- [ ] Responsive design verified
- [ ] Accessibility tested
- [ ] No console errors

---

## Next Phase

Proceed to: **[Phase 7: Testing & Launch](07-testing-launch.md)**
