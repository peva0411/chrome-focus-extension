/**
 * Storage Helper Utilities for Testing
 * Provides utilities for setting up test data and verifying storage
 */

/**
 * Create a test schedule
 * @param {Object} overrides - Properties to override defaults
 * @returns {Object} Schedule object
 */
export function createTestSchedule(overrides = {}) {
  // Support both old and new format for backwards compatibility
  let days;
  if (overrides.days && typeof overrides.days === 'object' && !Array.isArray(overrides.days)) {
    // New format: days is an object with day names
    days = overrides.days;
  } else {
    // Convert old format (array) or create default
    const dayNumbers = Array.isArray(overrides.days) ? overrides.days : [1, 2, 3, 4, 5];
    const startTime = overrides.startTime || '09:00';
    const endTime = overrides.endTime || '17:00';
    
    days = {
      monday: dayNumbers.includes(1) ? [{ start: startTime, end: endTime }] : [],
      tuesday: dayNumbers.includes(2) ? [{ start: startTime, end: endTime }] : [],
      wednesday: dayNumbers.includes(3) ? [{ start: startTime, end: endTime }] : [],
      thursday: dayNumbers.includes(4) ? [{ start: startTime, end: endTime }] : [],
      friday: dayNumbers.includes(5) ? [{ start: startTime, end: endTime }] : [],
      saturday: dayNumbers.includes(6) ? [{ start: startTime, end: endTime }] : [],
      sunday: dayNumbers.includes(0) || dayNumbers.includes(7) ? [{ start: startTime, end: endTime }] : []
    };
  }
  
  return {
    id: overrides.id || 'test-schedule-1',
    name: overrides.name || 'Test Schedule',
    createdDate: overrides.createdDate || Date.now(),
    days: days
  };
}

/**
 * Create a test blocked site
 * @param {Object} overrides - Properties to override defaults
 * @returns {Object} Blocked site object
 */
export function createTestBlockedSite(overrides = {}) {
  return {
    id: overrides.id || String(Date.now()),
    pattern: overrides.pattern || 'example.com',
    enabled: overrides.enabled !== undefined ? overrides.enabled : true,
    category: overrides.category || 'social',
    ...overrides
  };
}

/**
 * Create test budget configuration
 * @param {Object} overrides - Properties to override defaults
 * @returns {Object} Budget config object
 */
export function createTestBudget(overrides = {}) {
  return {
    enabled: overrides.enabled !== undefined ? overrides.enabled : true,
    dailyLimit: overrides.dailyLimit || 60, // 60 minutes
    siteBudgets: overrides.siteBudgets || {},
    ...overrides
  };
}

/**
 * Create test settings
 * @param {Object} overrides - Properties to override defaults
 * @returns {Object} Settings object
 */
export function createTestSettings(overrides = {}) {
  return {
    version: overrides.version || '0.1.0',
    enabled: overrides.enabled !== undefined ? overrides.enabled : true,
    notifications: overrides.notifications || {
      budgetWarnings: true,
      lowBudget: true,
      budgetExhausted: true
    },
    theme: overrides.theme || 'light',
    interstitialDelay: overrides.interstitialDelay || 5,
    showMotivationalQuotes: overrides.showMotivationalQuotes !== undefined ? overrides.showMotivationalQuotes : true
  };
}

/**
 * Set up test storage in service worker
 * @param {WebWorker} worker - Service worker instance
 * @param {Object} data - Data to store
 */
export async function setupTestStorage(worker, data = {}) {
  await worker.evaluate((testData) => {
    const promises = Object.entries(testData).map(([key, value]) => {
      return chrome.storage.local.set({ [key]: value });
    });
    return Promise.all(promises);
  }, data);
}

/**
 * Get storage value from service worker
 * @param {WebWorker} worker - Service worker instance
 * @param {string} key - Storage key
 * @returns {Promise<any>}
 */
export async function getStorageValue(worker, key) {
  return await worker.evaluate(async (storageKey) => {
    const result = await chrome.storage.local.get(storageKey);
    return result[storageKey];
  }, key);
}

/**
 * Clear all storage in service worker
 * @param {WebWorker} worker - Service worker instance
 */
export async function clearStorage(worker) {
  await worker.evaluate(async () => {
    await chrome.storage.local.clear();
  });
}

/**
 * Common storage keys (should match constants.js)
 */
export const STORAGE_KEYS = {
  SCHEDULES: 'schedules',
  ACTIVE_SCHEDULE: 'activeSchedule',
  BLOCKED_SITES: 'blockedSites',
  BLOCKING_ENABLED: 'blockingEnabled',
  BUDGET_CONFIG: 'budgetConfig',
  BUDGET_SESSIONS: 'budgetSessions',
  STATISTICS: 'statistics',
  PAUSED_UNTIL: 'pausedUntil',
  SETTINGS: 'settings'
};

/**
 * Set up a complete test scenario with schedule and blocked sites
 * @param {WebWorker} worker - Service worker instance
 * @param {Object} options - Configuration options
 */
export async function setupTestScenario(worker, options = {}) {
  const schedule = createTestSchedule(options.schedule || {});
  const blockedSites = options.blockedSites || [
    createTestBlockedSite({ pattern: 'facebook.com' }),
    createTestBlockedSite({ pattern: 'twitter.com' }),
    createTestBlockedSite({ pattern: 'youtube.com' })
  ];
  const budget = createTestBudget(options.budget || {});
  const settings = createTestSettings(options.settings || {});

  await setupTestStorage(worker, {
    [STORAGE_KEYS.SCHEDULES]: [schedule],
    [STORAGE_KEYS.ACTIVE_SCHEDULE]: schedule.id,
    [STORAGE_KEYS.BLOCKED_SITES]: blockedSites,
    [STORAGE_KEYS.BLOCKING_ENABLED]: options.blockingEnabled !== undefined ? options.blockingEnabled : false,
    [STORAGE_KEYS.BUDGET_CONFIG]: budget,
    [STORAGE_KEYS.SETTINGS]: settings
  });

  // Reload managers to pick up new data
  await worker.evaluate(async () => {
    // Load schedules first
    await scheduleManager.loadSchedules();
    
    // Load budget config if available
    if (typeof budgetManager !== 'undefined' && budgetManager.loadBudgetConfig) {
      await budgetManager.loadBudgetConfig();
    }
    
    // Always initialize blocking manager to load blocked sites
    // But don't create rules yet - let the schedule state determine that
    await blockingManager.initialize();
    
    // Link schedule manager to blocking manager (required for tests)
    // Disable startMonitoring to avoid alarm-based race conditions in tests
    scheduleManager.setBlockingManager(blockingManager, false);
    
    // Now check schedule state and apply blocking accordingly
    await scheduleManager.checkScheduleState();
  });

  return { schedule, blockedSites, budget, settings };
}

/**
 * Verify storage state matches expected values
 * @param {WebWorker} worker - Service worker instance
 * @param {Object} expected - Expected storage values
 */
export async function verifyStorage(worker, expected) {
  const actual = await worker.evaluate(async (keys) => {
    const result = {};
    for (const key of keys) {
      const data = await chrome.storage.local.get(key);
      result[key] = data[key];
    }
    return result;
  }, Object.keys(expected));

  const mismatches = [];
  for (const [key, expectedValue] of Object.entries(expected)) {
    const actualValue = actual[key];
    if (JSON.stringify(actualValue) !== JSON.stringify(expectedValue)) {
      mismatches.push({
        key,
        expected: expectedValue,
        actual: actualValue
      });
    }
  }

  if (mismatches.length > 0) {
    throw new Error(`Storage verification failed:\n${JSON.stringify(mismatches, null, 2)}`);
  }

  return true;
}
