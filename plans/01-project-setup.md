# Phase 1: Project Setup & Foundation

**Status:** ✅ COMPLETE  
**Estimated Time:** 2-3 days  
**Dependencies:** None  
**Completed:** January 14, 2026

---

## Overview

This phase establishes the foundation for the Focus Extension project. We'll set up the basic extension structure, configure Manifest V3, implement the service worker, and create the core storage layer.

---

## Objectives

1. Create a valid Manifest V3 extension that loads in Chrome
2. Implement basic storage abstraction layer
3. Set up service worker with proper lifecycle management
4. Create project structure for future phases
5. Establish development workflow and testing foundation

---

## Requirements

### Must Complete

- [x] Extension loads in Chrome without errors
- [x] Service worker activates and persists correctly
- [x] Storage layer can save/retrieve data
- [x] Extension icon appears in toolbar
- [x] Basic popup opens and displays content
- [x] Development environment documented

### Nice to Have

- [ ] Hot reload during development
- [ ] Automated build process
- [ ] Git hooks for code quality

---

## Technical Tasks

### 1. Project Initialization

#### 1.1 Directory Structure
Create the complete folder structure:

```
focus-ext/
├── manifest.json
├── README.md
├── .gitignore
├── src/
│   ├── background/
│   │   └── service-worker.js
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.js
│   │   └── popup.css
│   ├── options/
│   │   ├── options.html
│   │   ├── options.js
│   │   └── options.css
│   ├── interstitial/
│   │   ├── blocked.html
│   │   ├── blocked.js
│   │   └── blocked.css
│   ├── common/
│   │   ├── storage.js
│   │   ├── utils.js
│   │   ├── constants.js
│   │   └── logger.js
│   └── assets/
│       └── icons/
│           ├── icon16.png
│           ├── icon32.png
│           ├── icon48.png
│           └── icon128.png
├── tests/
│   ├── unit/
│   └── integration/
├── docs/
│   └── development.md
└── plans/
    └── [all plan files]
```

#### 1.2 Git Repository
```bash
git init
git add .
git commit -m "Initial project structure"
```

#### 1.3 .gitignore
```
# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo

# Dependencies (if added later)
node_modules/
package-lock.json

# Build artifacts (if needed later)
dist/
build/

# Testing
coverage/
.nyc_output/

# Misc
*.log
.env
```

---

### 2. Manifest Configuration

#### 2.1 Create manifest.json

```json
{
  "manifest_version": 3,
  "name": "Focus Extension",
  "version": "0.1.0",
  "description": "Block distracting websites with flexible schedules and time budgets",
  
  "icons": {
    "16": "src/assets/icons/icon16.png",
    "32": "src/assets/icons/icon32.png",
    "48": "src/assets/icons/icon48.png",
    "128": "src/assets/icons/icon128.png"
  },

  "permissions": [
    "storage",
    "alarms",
    "tabs",
    "notifications",
    "declarativeNetRequest"
  ],

  "host_permissions": [
    "<all_urls>"
  ],

  "background": {
    "service_worker": "src/background/service-worker.js",
    "type": "module"
  },

  "action": {
    "default_popup": "src/popup/popup.html",
    "default_icon": {
      "16": "src/assets/icons/icon16.png",
      "32": "src/assets/icons/icon32.png",
      "48": "src/assets/icons/icon48.png",
      "128": "src/assets/icons/icon128.png"
    },
    "default_title": "Focus Extension"
  },

  "options_page": "src/options/options.html",

  "minimum_chrome_version": "110"
}
```

**Key Points:**
- Manifest V3 required
- Service worker (not background page)
- All necessary permissions declared upfront
- Options page configured

---

### 3. Storage Layer Implementation

#### 3.1 Create src/common/constants.js

```javascript
// Storage Keys
export const STORAGE_KEYS = {
  BLOCKED_SITES: 'blockedSites',
  SCHEDULES: 'schedules',
  ACTIVE_SCHEDULE: 'activeSchedule',
  TIME_BUDGET: 'timeBudget',
  SETTINGS: 'settings',
  STATISTICS: 'statistics'
};

// Default Values
export const DEFAULTS = {
  settings: {
    version: '0.1.0',
    enabled: true,
    notifications: {
      budgetWarnings: true,
      lowBudget: true,
      budgetExhausted: true
    },
    theme: 'light',
    interstitialDelay: 5,
    showMotivationalQuotes: true
  },
  
  timeBudget: {
    globalBudget: 30, // minutes
    resetTime: '00:00',
    today: null // will be initialized on first run
  },
  
  blockedSites: [],
  schedules: [],
  activeSchedule: null
};

// Extension States
export const EXTENSION_STATE = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  DISABLED: 'disabled'
};

// Time constants
export const TIME = {
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000
};

// Budget warning thresholds
export const BUDGET_THRESHOLDS = {
  LOW: 0.5,      // 50%
  VERY_LOW: 0.25, // 25%
  CRITICAL: 0.1   // 10%
};
```

#### 3.2 Create src/common/storage.js

```javascript
import { STORAGE_KEYS, DEFAULTS } from './constants.js';
import { Logger } from './logger.js';

const logger = new Logger('Storage');

/**
 * Storage abstraction layer for Chrome Storage API
 * Handles both local and sync storage with fallbacks
 */
export class StorageManager {
  constructor() {
    this.local = chrome.storage.local;
    this.sync = chrome.storage.sync;
  }

  /**
   * Initialize storage with default values if empty
   */
  async initialize() {
    logger.info('Initializing storage...');
    
    try {
      // Check if already initialized
      const settings = await this.get(STORAGE_KEYS.SETTINGS);
      
      if (!settings) {
        // First run - set defaults
        await this.setMultiple({
          [STORAGE_KEYS.SETTINGS]: DEFAULTS.settings,
          [STORAGE_KEYS.TIME_BUDGET]: DEFAULTS.timeBudget,
          [STORAGE_KEYS.BLOCKED_SITES]: DEFAULTS.blockedSites,
          [STORAGE_KEYS.SCHEDULES]: DEFAULTS.schedules,
          [STORAGE_KEYS.ACTIVE_SCHEDULE]: DEFAULTS.activeSchedule
        });
        
        logger.info('Storage initialized with defaults');
      } else {
        logger.info('Storage already initialized');
      }
      
      return true;
    } catch (error) {
      logger.error('Failed to initialize storage:', error);
      throw error;
    }
  }

  /**
   * Get a single value from storage
   * @param {string} key - Storage key
   * @param {boolean} useSync - Use sync storage (default: local)
   * @returns {Promise<any>}
   */
  async get(key, useSync = false) {
    const storage = useSync ? this.sync : this.local;
    
    try {
      const result = await storage.get(key);
      return result[key];
    } catch (error) {
      logger.error(`Failed to get ${key}:`, error);
      return null;
    }
  }

  /**
   * Get multiple values from storage
   * @param {string[]} keys - Array of storage keys
   * @param {boolean} useSync - Use sync storage
   * @returns {Promise<Object>}
   */
  async getMultiple(keys, useSync = false) {
    const storage = useSync ? this.sync : this.local;
    
    try {
      return await storage.get(keys);
    } catch (error) {
      logger.error('Failed to get multiple keys:', error);
      return {};
    }
  }

  /**
   * Set a single value in storage
   * @param {string} key - Storage key
   * @param {any} value - Value to store
   * @param {boolean} useSync - Use sync storage
   * @returns {Promise<boolean>}
   */
  async set(key, value, useSync = false) {
    const storage = useSync ? this.sync : this.local;
    
    try {
      await storage.set({ [key]: value });
      logger.debug(`Saved ${key}`);
      return true;
    } catch (error) {
      logger.error(`Failed to set ${key}:`, error);
      return false;
    }
  }

  /**
   * Set multiple values in storage
   * @param {Object} items - Key-value pairs to store
   * @param {boolean} useSync - Use sync storage
   * @returns {Promise<boolean>}
   */
  async setMultiple(items, useSync = false) {
    const storage = useSync ? this.sync : this.local;
    
    try {
      await storage.set(items);
      logger.debug(`Saved ${Object.keys(items).length} items`);
      return true;
    } catch (error) {
      logger.error('Failed to set multiple items:', error);
      return false;
    }
  }

  /**
   * Remove a key from storage
   * @param {string} key - Storage key
   * @param {boolean} useSync - Use sync storage
   * @returns {Promise<boolean>}
   */
  async remove(key, useSync = false) {
    const storage = useSync ? this.sync : this.local;
    
    try {
      await storage.remove(key);
      logger.debug(`Removed ${key}`);
      return true;
    } catch (error) {
      logger.error(`Failed to remove ${key}:`, error);
      return false;
    }
  }

  /**
   * Clear all storage (use with caution)
   * @param {boolean} useSync - Clear sync storage
   * @returns {Promise<boolean>}
   */
  async clear(useSync = false) {
    const storage = useSync ? this.sync : this.local;
    
    try {
      await storage.clear();
      logger.warn('Storage cleared');
      return true;
    } catch (error) {
      logger.error('Failed to clear storage:', error);
      return false;
    }
  }

  /**
   * Listen for storage changes
   * @param {Function} callback - Called when storage changes
   * @returns {Function} Unsubscribe function
   */
  onChange(callback) {
    const listener = (changes, areaName) => {
      callback(changes, areaName);
    };
    
    chrome.storage.onChanged.addListener(listener);
    
    // Return unsubscribe function
    return () => {
      chrome.storage.onChanged.removeListener(listener);
    };
  }
}

// Singleton instance
export const storage = new StorageManager();
```

#### 3.3 Create src/common/logger.js

```javascript
/**
 * Simple logger with levels
 */
export class Logger {
  constructor(context = 'FocusExt') {
    this.context = context;
    this.enabled = true;
  }

  _log(level, ...args) {
    if (!this.enabled) return;
    
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${this.context}] [${level}]`;
    
    console[level === 'ERROR' ? 'error' : 'log'](prefix, ...args);
  }

  debug(...args) {
    this._log('DEBUG', ...args);
  }

  info(...args) {
    this._log('INFO', ...args);
  }

  warn(...args) {
    this._log('WARN', ...args);
  }

  error(...args) {
    this._log('ERROR', ...args);
  }
}
```

#### 3.4 Create src/common/utils.js

```javascript
/**
 * Utility functions used across the extension
 */

/**
 * Generate a UUID v4
 * @returns {string}
 */
export function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get current date in YYYY-MM-DD format
 * @returns {string}
 */
export function getCurrentDate() {
  const date = new Date();
  return date.toISOString().split('T')[0];
}

/**
 * Get current time in HH:MM format
 * @returns {string}
 */
export function getCurrentTime() {
  const date = new Date();
  return date.toTimeString().slice(0, 5);
}

/**
 * Parse time string to minutes since midnight
 * @param {string} timeString - Format: "HH:MM"
 * @returns {number}
 */
export function timeToMinutes(timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Convert minutes to HH:MM format
 * @param {number} minutes
 * @returns {string}
 */
export function minutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Format minutes to human readable time
 * @param {number} minutes
 * @returns {string} e.g., "1h 30m" or "45m"
 */
export function formatMinutes(minutes) {
  if (minutes < 1) return '< 1m';
  
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/**
 * Debounce function calls
 * @param {Function} func
 * @param {number} wait - Milliseconds
 * @returns {Function}
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function calls
 * @param {Function} func
 * @param {number} limit - Milliseconds
 * @returns {Function}
 */
export function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}
```

---

### 4. Service Worker Implementation

#### 4.1 Create src/background/service-worker.js

```javascript
import { storage } from '../common/storage.js';
import { Logger } from '../common/logger.js';

const logger = new Logger('ServiceWorker');

/**
 * Service Worker - Main background script for the extension
 * Handles extension lifecycle, storage initialization, and coordination
 */

// Service worker lifecycle
chrome.runtime.onInstalled.addListener(async (details) => {
  logger.info('Extension installed:', details.reason);
  
  if (details.reason === 'install') {
    await handleFirstInstall();
  } else if (details.reason === 'update') {
    await handleUpdate(details.previousVersion);
  }
});

chrome.runtime.onStartup.addListener(async () => {
  logger.info('Browser started, service worker activated');
  await initializeExtension();
});

/**
 * Handle first-time installation
 */
async function handleFirstInstall() {
  logger.info('First install detected');
  
  try {
    // Initialize storage with defaults
    await storage.initialize();
    
    // Open welcome page (future enhancement)
    // chrome.tabs.create({ url: 'src/options/options.html?welcome=true' });
    
    logger.info('First install setup complete');
  } catch (error) {
    logger.error('First install setup failed:', error);
  }
}

/**
 * Handle extension updates
 */
async function handleUpdate(previousVersion) {
  logger.info(`Updated from ${previousVersion}`);
  
  // Migration logic will go here in future updates
  // For now, just ensure storage is initialized
  await storage.initialize();
}

/**
 * Initialize extension on startup
 */
async function initializeExtension() {
  try {
    // Ensure storage is initialized
    await storage.initialize();
    
    // Additional initialization will be added in later phases:
    // - Set up alarms for budget reset
    // - Initialize blocking rules
    // - Restore schedules
    
    logger.info('Extension initialized successfully');
  } catch (error) {
    logger.error('Extension initialization failed:', error);
  }
}

/**
 * Handle messages from other parts of the extension
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  logger.debug('Message received:', message);
  
  // Message handling will be expanded in later phases
  handleMessage(message, sender)
    .then(sendResponse)
    .catch(error => {
      logger.error('Message handling error:', error);
      sendResponse({ error: error.message });
    });
  
  // Return true to indicate we'll send response asynchronously
  return true;
});

/**
 * Route messages to appropriate handlers
 */
async function handleMessage(message, sender) {
  const { type, data } = message;
  
  switch (type) {
    case 'PING':
      return { status: 'ok' };
    
    case 'GET_STATUS':
      // Will be implemented in later phases
      return { enabled: true, state: 'active' };
    
    default:
      logger.warn('Unknown message type:', type);
      return { error: 'Unknown message type' };
  }
}

// Keep service worker alive (Manifest V3 requirement)
// Service workers can be terminated by Chrome, so we need to ensure
// critical operations complete
let keepAliveInterval;

function keepAlive() {
  if (keepAliveInterval) return;
  
  keepAliveInterval = setInterval(() => {
    chrome.runtime.getPlatformInfo(() => {
      // Just a ping to keep alive
    });
  }, 20000); // Every 20 seconds
}

// Start keep-alive
keepAlive();

logger.info('Service worker loaded');
```

---

### 5. Basic UI Setup

#### 5.1 Create src/popup/popup.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Focus Extension</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="container">
    <header>
      <h1>Focus Extension</h1>
      <div id="status-indicator" class="status-active">
        <span class="status-dot"></span>
        <span id="status-text">Active</span>
      </div>
    </header>

    <main>
      <section class="quick-stats">
        <div class="stat">
          <span class="stat-label">Sites Blocked</span>
          <span class="stat-value" id="sites-blocked">0</span>
        </div>
        <div class="stat">
          <span class="stat-label">Time Remaining</span>
          <span class="stat-value" id="time-remaining">30m</span>
        </div>
      </section>

      <section class="quick-actions">
        <button id="pause-btn" class="btn btn-secondary">
          Pause for 15min
        </button>
        <button id="add-site-btn" class="btn btn-primary">
          Block Current Site
        </button>
      </section>
    </main>

    <footer>
      <a href="#" id="settings-link">Settings</a>
      <a href="#" id="stats-link">Statistics</a>
    </footer>
  </div>

  <script src="popup.js" type="module"></script>
</body>
</html>
```

#### 5.2 Create src/popup/popup.css

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  width: 320px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
    Ubuntu, Cantarell, sans-serif;
  font-size: 14px;
  color: #333;
  background: #f5f5f5;
}

.container {
  background: white;
}

header {
  padding: 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

h1 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 8px;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #4ade80;
}

.status-active .status-dot {
  background: #4ade80;
  animation: pulse 2s infinite;
}

.status-paused .status-dot {
  background: #fbbf24;
}

.status-disabled .status-dot {
  background: #94a3b8;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

main {
  padding: 16px;
}

.quick-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 16px;
}

.stat {
  display: flex;
  flex-direction: column;
  padding: 12px;
  background: #f8fafc;
  border-radius: 8px;
  text-align: center;
}

.stat-label {
  font-size: 12px;
  color: #64748b;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 20px;
  font-weight: 700;
  color: #667eea;
}

.quick-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.btn {
  padding: 10px 16px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
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
  border: 1px solid #667eea;
}

.btn-secondary:hover {
  background: #f8fafc;
}

footer {
  display: flex;
  justify-content: space-around;
  padding: 12px 16px;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
}

footer a {
  color: #667eea;
  text-decoration: none;
  font-size: 13px;
  font-weight: 500;
}

footer a:hover {
  text-decoration: underline;
}
```

#### 5.3 Create src/popup/popup.js

```javascript
import { storage } from '../common/storage.js';
import { STORAGE_KEYS } from '../common/constants.js';
import { Logger } from '../common/logger.js';

const logger = new Logger('Popup');

/**
 * Popup UI Controller
 */
class PopupController {
  constructor() {
    this.elements = {
      statusIndicator: document.getElementById('status-indicator'),
      statusText: document.getElementById('status-text'),
      sitesBlocked: document.getElementById('sites-blocked'),
      timeRemaining: document.getElementById('time-remaining'),
      pauseBtn: document.getElementById('pause-btn'),
      addSiteBtn: document.getElementById('add-site-btn'),
      settingsLink: document.getElementById('settings-link'),
      statsLink: document.getElementById('stats-link')
    };
    
    this.init();
  }

  async init() {
    logger.info('Popup initialized');
    
    // Load current state
    await this.loadState();
    
    // Set up event listeners
    this.setupListeners();
  }

  async loadState() {
    try {
      // Load settings
      const settings = await storage.get(STORAGE_KEYS.SETTINGS);
      
      // Update UI
      if (settings && settings.enabled) {
        this.updateStatus('active');
      } else {
        this.updateStatus('disabled');
      }
      
      // Load blocked sites count
      const blockedSites = await storage.get(STORAGE_KEYS.BLOCKED_SITES) || [];
      this.elements.sitesBlocked.textContent = blockedSites.length;
      
      // Load time budget
      const timeBudget = await storage.get(STORAGE_KEYS.TIME_BUDGET);
      if (timeBudget) {
        const remaining = timeBudget.globalBudget - (timeBudget.today?.used || 0);
        this.elements.timeRemaining.textContent = `${remaining}m`;
      }
      
    } catch (error) {
      logger.error('Failed to load state:', error);
    }
  }

  updateStatus(status) {
    this.elements.statusIndicator.className = `status-${status}`;
    
    const statusTexts = {
      active: 'Active',
      paused: 'Paused',
      disabled: 'Disabled'
    };
    
    this.elements.statusText.textContent = statusTexts[status] || 'Unknown';
  }

  setupListeners() {
    // Pause button
    this.elements.pauseBtn.addEventListener('click', () => {
      logger.info('Pause button clicked');
      // Will be implemented in later phases
      alert('Pause feature coming in Phase 4!');
    });

    // Add site button
    this.elements.addSiteBtn.addEventListener('click', async () => {
      logger.info('Add site button clicked');
      // Will be implemented in Phase 3
      alert('Add site feature coming in Phase 3!');
    });

    // Settings link
    this.elements.settingsLink.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
      window.close();
    });

    // Stats link (placeholder)
    this.elements.statsLink.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
      window.close();
    });
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});
```

---

### 6. Placeholder Icon Assets

Create simple placeholder icons (you can replace these with proper designs later):

**Note:** For Phase 1, you can use simple colored squares or generate icons using online tools. Here are specifications:

- **icon16.png** - 16x16px
- **icon32.png** - 32x32px
- **icon48.png** - 48x48px
- **icon128.png** - 128x128px

Suggested colors: Purple/blue gradient matching the popup header (#667eea to #764ba2)

---

### 7. Testing & Validation

#### 7.1 Manual Testing Checklist

- [ ] Extension loads in Chrome without errors
- [ ] Check `chrome://extensions` - no errors shown
- [ ] Service worker status shows "active"
- [ ] Click extension icon - popup appears
- [ ] Popup displays correctly
- [ ] Open Options page - loads without error
- [ ] Check Chrome DevTools console - no errors
- [ ] Storage initialized correctly (check via DevTools > Application > Storage)

#### 7.2 Testing Commands

```javascript
// In service worker console (DevTools > Extensions > Inspect views: service worker)

// Test storage
const { storage } = await import('./src/common/storage.js');
const settings = await storage.get('settings');
console.log('Settings:', settings);

// Test messaging
chrome.runtime.sendMessage({ type: 'PING' }, response => {
  console.log('Response:', response);
});
```

#### 7.3 Common Issues & Fixes

| Issue | Solution |
|-------|----------|
| Service worker won't start | Check manifest.json syntax, verify file paths |
| Storage not working | Check permissions in manifest.json |
| Popup not opening | Verify popup.html path in manifest.json |
| Import errors | Ensure type: "module" in manifest background |

---

### 8. Documentation

#### 8.1 Create README.md

```markdown
# Focus Extension

A Chrome browser extension to help maintain productivity by blocking distracting websites.

## Development Setup

### Prerequisites
- Chrome browser (version 110+)
- Text editor (VS Code recommended)
- Git

### Installation

1. Clone the repository:
   ```bash
   git clone [repository-url]
   cd focus-ext
   ```

2. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `focus-ext` directory

3. The extension should now appear in your toolbar

### Project Structure

See [plans/00-implementation-overview.md](plans/00-implementation-overview.md) for detailed architecture.

### Development Workflow

1. Make changes to source files
2. Go to `chrome://extensions`
3. Click the refresh icon on the Focus Extension card
4. Test your changes

### Debugging

- **Service Worker**: `chrome://extensions` → Click "Inspect views: service worker"
- **Popup**: Right-click extension icon → Inspect
- **Options Page**: Open options, right-click → Inspect

## Current Status

**Phase 1: Project Setup** ✅ COMPLETE
- Basic extension structure
- Service worker configured
- Storage layer implemented
- Basic popup UI

**Next Phase:** Phase 2 - Core Blocking Implementation

## Contributing

This is currently in active development. See implementation plans in `/plans` directory.

## License

TBD
```

#### 8.2 Create docs/development.md

```markdown
# Development Guide

## Chrome Extension Basics

### Manifest V3
This extension uses Manifest V3, which has some key differences from V2:
- Service workers instead of background pages
- declarativeNetRequest instead of webRequest
- Different permission model

### File Organization

- **manifest.json** - Extension configuration
- **src/background/** - Service worker (background logic)
- **src/popup/** - Extension popup UI
- **src/options/** - Settings page
- **src/common/** - Shared utilities and storage

## Development Tips

### Reloading Changes
After making changes:
1. Go to `chrome://extensions`
2. Find Focus Extension
3. Click the refresh icon

### Debugging Service Worker
1. Navigate to `chrome://extensions`
2. Find Focus Extension
3. Click "Inspect views: service worker"
4. Use Console tab for logs

### Testing Storage
```javascript
// In service worker console
chrome.storage.local.get(null, (data) => console.log(data));
```

### Common Patterns

#### Sending Messages
```javascript
chrome.runtime.sendMessage(
  { type: 'ACTION_NAME', data: {...} },
  response => console.log(response)
);
```

#### Listening for Messages
```javascript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle message
  sendResponse({ success: true });
  return true; // Required for async response
});
```

## Next Steps

Proceed to [Phase 2: Core Blocking](../plans/02-core-blocking.md)
```

---

## Completion Checklist

### Before Moving to Phase 2

- [ ] All files created and in correct locations
- [ ] Extension loads without errors in Chrome
- [ ] Service worker initializes successfully
- [ ] Storage layer tested and working
- [ ] Popup opens and displays correctly
- [ ] No console errors in any context
- [ ] Git repository initialized with initial commit
- [ ] README.md completed
- [ ] Development documentation written

---

## Next Phase

Once Phase 1 is complete and validated, proceed to:
**[Phase 2: Core Blocking Implementation](02-core-blocking.md)**

This will implement the basic site blocking mechanism using Chrome's declarativeNetRequest API.
