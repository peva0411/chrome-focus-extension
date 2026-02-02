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
    
    // Apply theme
    await this.applyTheme();
    
    // Load current state
    await this.loadState();
    
    // Set up event listeners
    this.setupListeners();
  }

  async loadState() {
    try {
      // Load settings
      const settings = await storage.get(STORAGE_KEYS.SETTINGS);
      
      // Check schedule status to determine if paused
      const scheduleStatus = await chrome.runtime.sendMessage({
        type: 'GET_SCHEDULE_STATUS'
      });
      
      // Update UI based on pause state first, then enabled state
      if (scheduleStatus && scheduleStatus.isPaused) {
        this.updateStatus('paused');
      } else if (settings && settings.enabled) {
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
        this.elements.timeRemaining.textContent = `${Math.floor(remaining)}m`;
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
    this.elements.pauseBtn.addEventListener('click', async () => {
      logger.info('Pause button clicked');
      
      try {
        // Get pause duration from settings
        const settings = await storage.get(STORAGE_KEYS.SETTINGS);
        const duration = settings?.pauseDuration || 30; // Default to 30 minutes
        
        await chrome.runtime.sendMessage({
          type: 'PAUSE_BLOCKING',
          data: { minutes: duration }
        });

        if (duration === -1) {
          alert('Blocking paused until tomorrow');
        } else {
          alert(`Blocking paused for ${duration} minutes`);
        }
        
        await this.loadState();
      } catch (error) {
        logger.error('Failed to pause:', error);
        alert('Failed to pause blocking');
      }
    });

    // Add site button
    this.elements.addSiteBtn.addEventListener('click', async () => {
      try {
        // Get current tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab.url) {
          alert('Cannot block this page');
          return;
        }

        // Extract domain from URL
        const url = new URL(tab.url);
        const domain = url.hostname.replace(/^www\./, '');

        // Confirm with user
        const confirmed = confirm(`Block ${domain}?`);
        if (!confirmed) return;

        // Add to block list
        await chrome.runtime.sendMessage({
          type: 'ADD_BLOCKED_SITE',
          data: { pattern: domain }
        });

        alert(`${domain} added to block list`);
        await this.loadState();
      } catch (error) {
        logger.error('Failed to add site:', error);
        alert(error.message || 'Failed to add site');
      }
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

  /**
   * Apply theme from settings
   */
  async applyTheme() {
    try {
      const settings = await storage.get(STORAGE_KEYS.SETTINGS);
      let theme = settings?.theme || 'light';
      
      if (theme === 'auto') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        theme = prefersDark ? 'dark' : 'light';
      }
      
      document.documentElement.setAttribute('data-theme', theme);
    } catch (error) {
      logger.error('Failed to apply theme:', error);
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});
