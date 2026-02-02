import { storage } from '../common/storage.js';
import { blockingManager } from './blocking-manager.js';
import { scheduleManager } from './schedule-manager.js';
import { budgetManager } from './budget-manager.js';
import { statisticsManager } from './statistics-manager.js';
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
  } else {
    // On reload/enable, ensure managers are initialized
    await initializeExtension();
  }
});

chrome.runtime.onStartup.addListener(async () => {
  logger.info('Browser started, service worker activated');
  await initializeExtension();
});

// Initialize immediately when service worker starts
// This ensures managers are linked even if loaded via chrome.runtime.reload()
logger.info('Service worker loaded, initializing...');
initializeExtension();

/**
 * Handle first-time installation
 */
async function handleFirstInstall() {
  logger.info('First install detected');
  
  try {
    // Initialize storage with defaults
    await storage.initialize();
    
    // Run full initialization
    await initializeExtension();
    
    // Open welcome page
    chrome.tabs.create({ url: chrome.runtime.getURL('src/onboarding/welcome.html') });
    
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
    logger.info('🚀 Initializing extension...');
    
    // Ensure storage is initialized
    await storage.initialize();
    
    // Initialize blocking manager first
    await blockingManager.initialize();
    logger.info('✓ Blocking manager initialized');
    
    // Initialize schedule manager and link it to blocking manager
    scheduleManager.setBlockingManager(blockingManager);
    logger.info('✓ Blocking manager linked to schedule manager');
    
    await scheduleManager.initialize();
    logger.info('✓ Schedule manager initialized');
    
    // Check schedule state and update blocking accordingly
    const shouldBlock = await scheduleManager.shouldBlockNow();
    logger.info('Initial schedule check, should block:', shouldBlock);
    await blockingManager.setBlockingEnabled(shouldBlock);
    
    // Initialize budget manager
    await budgetManager.initialize();
    logger.info('✓ Budget manager initialized');
    
    // Initialize statistics manager
    await statisticsManager.initialize();
    logger.info('✓ Statistics manager initialized');
    
    logger.info('✅ Extension initialized successfully');
  } catch (error) {
    logger.error('❌ Extension initialization failed:', error);
  }
}

// Expose managers globally for testing
// This allows Puppeteer/Playwright tests to access managers via worker.evaluate()
if (typeof self !== 'undefined') {
  self.blockingManager = blockingManager;
  self.scheduleManager = scheduleManager;
  self.budgetManager = budgetManager;
  self.statisticsManager = statisticsManager;
  self.storage = storage;
}

/**
 * Handle messages from other parts of the extension
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  logger.debug('Message received:', message);
  
  // Handle message asynchronously
  handleMessage(message, sender)
    .then(response => {
      logger.debug('Sending response:', response);
      sendResponse(response);
    })
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
  const { type, action, data } = message;
  const messageType = type || action; // Support both 'type' and 'action' for backwards compatibility
  
  switch (messageType) {
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
    
    case 'ADD_EXCEPTION':
      return await blockingManager.addException(data.siteId, data.exceptionPattern);
    
    case 'REMOVE_EXCEPTION':
      return await blockingManager.removeException(data.siteId, data.exceptionPattern);
    
    case 'GET_BLOCKED_SITES':
      const sites = await blockingManager.getBlockedSites();
      return { sites };
    
    case 'RECORD_BLOCK':
      await blockingManager.incrementBlockCount(data.siteId);
      return { success: true };
    
    case 'CREATE_SCHEDULE':
      return await scheduleManager.createSchedule(data);
    
    case 'UPDATE_SCHEDULE':
      return await scheduleManager.updateSchedule(data.scheduleId, data.updates);
    
    case 'DELETE_SCHEDULE':
      await scheduleManager.deleteSchedule(data.scheduleId);
      return { success: true };
    
    case 'GET_SCHEDULES':
      return { schedules: scheduleManager.getSchedules() };
    
    case 'SET_ACTIVE_SCHEDULE':
      await scheduleManager.setActiveSchedule(data.scheduleId);
      return { success: true };
    
    case 'PAUSE_BLOCKING':
      const pausedUntil = await scheduleManager.pauseBlocking(data.minutes);
      return { pausedUntil };
    
    case 'RESUME_BLOCKING':
      await scheduleManager.resumeBlocking();
      return { success: true };
    
    case 'GET_SCHEDULE_STATUS':
      return await scheduleManager.getStatus();
    
    // Budget management
    case 'CHECK_BUDGET':
      logger.debug('Checking budget for site:', data.siteId);
      return await budgetManager.checkBudgetAvailable(data.siteId);
    
    case 'START_BUDGET_SESSION':
      const tab = sender.tab;
      logger.info('START_BUDGET_SESSION received');
      logger.info('Sender tab info:', { id: tab?.id, url: tab?.url });
      logger.info('Data received:', data);
      
      if (!tab || !tab.id) {
        logger.error('No tab information in START_BUDGET_SESSION');
        return { error: 'No tab information available' };
      }
      logger.info('Starting budget session for tab:', tab.id, 'site:', data.siteId);
      try {
        const session = await budgetManager.startBudgetSession(data.siteId, tab.id);
        logger.info('Budget session created:', session);
        
        // Construct target URL from pattern
        const pattern = data.pattern || 'https://example.com';
        let targetUrl = pattern;
        
        // Remove wildcards and add protocol if needed
        if (!pattern.startsWith('http://') && !pattern.startsWith('https://')) {
          targetUrl = 'https://' + pattern.replace(/^\*\./, '');
        }
        
        // Exempt this tab from blocking during the budget session
        await blockingManager.addExemptTab(tab.id, pattern);
        logger.info('Tab exempted from blocking with session rule');
        
        logger.info('Target URL for redirect:', targetUrl);
        logger.info('About to call chrome.tabs.update with tab ID:', tab.id);
        
        // Perform the redirect from the service worker
        try {
          const result = await chrome.tabs.update(tab.id, { url: targetUrl });
          logger.info('chrome.tabs.update result:', result);
          logger.info('Tab updated successfully to:', targetUrl);
        } catch (updateError) {
          logger.error('chrome.tabs.update failed:', updateError);
          logger.error('Error details:', updateError.message, updateError.stack);
          // Remove exemption if redirect failed
          await blockingManager.removeExemptTab(tab.id);
          return { error: 'Failed to redirect: ' + updateError.message };
        }
        
        return { success: true, session, targetUrl, redirected: true };
      } catch (error) {
        logger.error('Failed to start budget session:', error);
        logger.error('Error stack:', error.stack);
        return { error: error.message };
      }
    
    case 'END_BUDGET_SESSION':
      await budgetManager.endBudgetSession(data.tabId);
      return { success: true };
    
    case 'GET_BUDGET_STATUS':
      return await budgetManager.getRemainingBudget();
    
    case 'UPDATE_BUDGET_CONFIG':
      await budgetManager.updateBudgetConfig(data);
      return { success: true };
    
    case 'GET_BUDGET_HISTORY':
      const history = await budgetManager.getBudgetHistory(data.days || 7);
      return { history };
    
    case 'GET_ACTIVE_SESSIONS':
      const sessions = budgetManager.getActiveSessions();
      return { sessions };
    
    // Statistics management
    case 'getStatistics':
      const todayStats = await statisticsManager.getTodayStats();
      const topSites = statisticsManager.getTopBlockedSites(10);
      const weeklyData = statisticsManager.getWeeklyData();
      const hourlyActivity = statisticsManager.getHourlyActivity();
      
      return {
        stats: {
          blocks: todayStats.blocks,
          focusTime: todayStats.focusTime,
          streak: todayStats.streak,
          budgetSaved: Math.round((1 - (todayStats.budgetUsed / 30)) * 100), // Simplified
          topSites,
          weeklyData,
          hourlyActivity
        }
      };
    
    case 'exportStatistics':
      const exportData = await statisticsManager.exportStats();
      return { data: exportData };
    
    case 'updateSettings':
      // Handle settings update (already stored by options page)
      return { success: true };
    
    default:
      logger.warn('Unknown message type:', messageType);
      return { error: 'Unknown message type' };
  }
}

// Listen for alarms
chrome.alarms.onAlarm.addListener(async (alarm) => {
  logger.info('Alarm triggered:', alarm.name);
  
  if (alarm.name === 'budgetReset') {
    await budgetManager.resetDailyBudget();
  } else if (alarm.name === 'scheduleCheck') {
    // Handle schedule check alarm
    await scheduleManager.handleAlarm(alarm.name);
  }
});

// Listen for tab close (end budget sessions)
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  if (budgetManager.hasActiveSession(tabId)) {
    logger.info('Tab closed with active budget session:', tabId);
    budgetManager.endBudgetSession(tabId);
  }
});

// Listen for tab navigation (end budget sessions if navigating away)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url && budgetManager.hasActiveSession(tabId)) {
    // Check if new URL is still a blocked site
    const isBlocked = await blockingManager.isUrlBlocked(changeInfo.url);
    if (!isBlocked) {
      logger.info('Tab navigated away from blocked site:', tabId);
      budgetManager.endBudgetSession(tabId);
    }
  }
});

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

// Log that service worker is ready
logger.info('Service worker loaded and ready');

// Expose functions for testing in console
self.testPing = async () => {
  try {
    const result = await handleMessage({ type: 'PING' }, {});
    console.log('Test PING result:', result);
    return result;
  } catch (error) {
    console.error('Test PING error:', error);
    return { error: error.message };
  }
};

self.testAddSite = async (pattern) => {
  try {
    const result = await handleMessage({ 
      type: 'ADD_BLOCKED_SITE', 
      data: { pattern } 
    }, {});
    console.log('Test ADD_BLOCKED_SITE result:', result);
    return result;
  } catch (error) {
    console.error('Test ADD_BLOCKED_SITE error:', error);
    return { error: error.message };
  }
};

self.testGetSites = async () => {
  try {
    const result = await handleMessage({ type: 'GET_BLOCKED_SITES' }, {});
    console.log('Test GET_BLOCKED_SITES result:', result);
    return result;
  } catch (error) {
    console.error('Test GET_BLOCKED_SITES error:', error);
    return { error: error.message };
  }
};

self.testGetRules = async () => {
  try {
    const rules = await chrome.declarativeNetRequest.getDynamicRules();
    console.log('Active blocking rules:', rules);
    return rules;
  } catch (error) {
    console.error('Test GET_RULES error:', error);
    return { error: error.message };
  }
};

// Catch any unhandled errors
self.addEventListener('error', (event) => {
  logger.error('Unhandled error in service worker:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  logger.error('Unhandled promise rejection in service worker:', event.reason);
});
