/**
 * Assertion Helpers for Extension Testing
 * Custom assertions for common extension testing patterns
 */

/**
 * Assert that a URL is the blocked interstitial page
 * @param {string} url - URL to check
 * @param {string} originalUrl - Expected original blocked URL
 */
export function assertIsBlockedPage(url, originalUrl = null) {
  if (!url.includes('blocked.html')) {
    throw new Error(`Expected blocked page, got: ${url}`);
  }
  
  if (originalUrl) {
    const urlParams = new URLSearchParams(url.split('?')[1]);
    const blockedUrl = urlParams.get('url');
    if (!blockedUrl || !blockedUrl.includes(originalUrl)) {
      throw new Error(`Expected blocked URL to contain ${originalUrl}, got: ${blockedUrl}`);
    }
  }
}

/**
 * Assert that DNR rules exist with expected properties
 * @param {Array} rules - DNR rules from chrome.declarativeNetRequest.getDynamicRules()
 * @param {Object} expectations - Expected rule properties
 */
export function assertDNRRules(rules, expectations) {
  if (!Array.isArray(rules)) {
    throw new Error('Rules must be an array');
  }
  
  if (expectations.minCount !== undefined && rules.length < expectations.minCount) {
    throw new Error(`Expected at least ${expectations.minCount} rules, got ${rules.length}`);
  }
  
  if (expectations.exactCount !== undefined && rules.length !== expectations.exactCount) {
    throw new Error(`Expected exactly ${expectations.exactCount} rules, got ${rules.length}`);
  }
  
  if (expectations.actionType) {
    const matchingRules = rules.filter(r => r.action.type === expectations.actionType);
    if (matchingRules.length === 0) {
      throw new Error(`No rules found with action type: ${expectations.actionType}`);
    }
  }
  
  if (expectations.pattern) {
    const matchingRules = rules.filter(r => {
      const condition = r.condition;
      return condition.urlFilter && condition.urlFilter.includes(expectations.pattern);
    });
    if (matchingRules.length === 0) {
      throw new Error(`No rules found matching pattern: ${expectations.pattern}`);
    }
  }
}

/**
 * Assert that blocking is in expected state
 * @param {WebWorker} worker - Service worker instance
 * @param {boolean} expectedState - Expected blocking state
 */
export async function assertBlockingState(worker, expectedState) {
  const state = await worker.evaluate(async () => {
    // Check storage
    const stored = await chrome.storage.local.get('blockingEnabled');
    const storageState = stored.blockingEnabled;
    
    // Check actual DNR rules
    const rules = await chrome.declarativeNetRequest.getDynamicRules();
    const hasRules = rules.length > 0;
    
    return {
      storage: storageState,
      hasRules: hasRules,
      ruleCount: rules.length
    };
  });
  
  // Actual blocking state is whether rules exist
  const actualState = state.hasRules;
  
  if (actualState !== expectedState) {
    throw new Error(`Expected blocking to be ${expectedState}, got ${actualState}. Storage: ${state.storage}, Rules: ${state.ruleCount}`);
  }
}

/**
 * Assert that schedule is active/inactive
 * @param {WebWorker} worker - Service worker instance
 * @param {boolean} expectedActive - Expected schedule active state
 */
export async function assertScheduleActive(worker, expectedActive) {
  const isActive = await worker.evaluate(async () => {
    return await scheduleManager.shouldBlockNow();
  });
  
  if (isActive !== expectedActive) {
    throw new Error(`Expected schedule to be ${expectedActive ? 'active' : 'inactive'}, got ${isActive ? 'active' : 'inactive'}`);
  }
}

/**
 * Assert that an alarm exists
 * @param {WebWorker} worker - Service worker instance
 * @param {string} alarmName - Name of the alarm
 */
export async function assertAlarmExists(worker, alarmName) {
  const alarms = await worker.evaluate(async (name) => {
    const allAlarms = await chrome.alarms.getAll();
    return allAlarms.filter(a => a.name === name);
  }, alarmName);
  
  if (alarms.length === 0) {
    throw new Error(`Alarm "${alarmName}" not found`);
  }
}

/**
 * Assert that storage contains expected keys and values
 * @param {WebWorker} worker - Service worker instance
 * @param {string} key - Storage key
 * @param {Function|any} expectedValue - Expected value or validation function
 */
export async function assertStorageValue(worker, key, expectedValue) {
  const actual = await worker.evaluate(async (storageKey) => {
    const result = await chrome.storage.local.get(storageKey);
    return result[storageKey];
  }, key);
  
  if (typeof expectedValue === 'function') {
    if (!expectedValue(actual)) {
      throw new Error(`Storage validation failed for key "${key}"`);
    }
  } else {
    if (JSON.stringify(actual) !== JSON.stringify(expectedValue)) {
      throw new Error(
        `Storage mismatch for key "${key}":\n` +
        `Expected: ${JSON.stringify(expectedValue, null, 2)}\n` +
        `Actual: ${JSON.stringify(actual, null, 2)}`
      );
    }
  }
}

/**
 * Assert that a page element contains expected text
 * @param {Page} page - Puppeteer page instance
 * @param {string} selector - CSS selector
 * @param {string} expectedText - Expected text content
 */
export async function assertElementText(page, selector, expectedText) {
  try {
    await page.waitForSelector(selector, { timeout: 5000 });
    const text = await page.$eval(selector, el => el.textContent);
    
    if (!text.includes(expectedText)) {
      throw new Error(
        `Element "${selector}" text mismatch:\n` +
        `Expected to contain: "${expectedText}"\n` +
        `Actual: "${text}"`
      );
    }
  } catch (error) {
    throw new Error(`Failed to assert element text: ${error.message}`);
  }
}

/**
 * Assert that a page element is visible
 * @param {Page} page - Puppeteer page instance
 * @param {string} selector - CSS selector
 */
export async function assertElementVisible(page, selector) {
  try {
    await page.waitForSelector(selector, { visible: true, timeout: 5000 });
  } catch (error) {
    throw new Error(`Element "${selector}" not visible: ${error.message}`);
  }
}

/**
 * Custom expect-like assertions for better test readability
 */
export const expect = {
  /**
   * Assert value is truthy
   */
  toBeTruthy(value, message = '') {
    if (!value) {
      throw new Error(message || `Expected truthy value, got ${value}`);
    }
  },
  
  /**
   * Assert value is falsy
   */
  toBeFalsy(value, message = '') {
    if (value) {
      throw new Error(message || `Expected falsy value, got ${value}`);
    }
  },
  
  /**
   * Assert values are equal (deep comparison)
   */
  toEqual(actual, expected, message = '') {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(
        message || 
        `Values not equal:\nExpected: ${JSON.stringify(expected, null, 2)}\nActual: ${JSON.stringify(actual, null, 2)}`
      );
    }
  },
  
  /**
   * Assert number is greater than
   */
  toBeGreaterThan(actual, expected, message = '') {
    if (actual <= expected) {
      throw new Error(message || `Expected ${actual} to be greater than ${expected}`);
    }
  },
  
  /**
   * Assert array/string contains value
   */
  toContain(collection, value, message = '') {
    const contains = Array.isArray(collection) 
      ? collection.includes(value)
      : collection.includes(value);
      
    if (!contains) {
      throw new Error(message || `Expected collection to contain ${value}`);
    }
  }
};
