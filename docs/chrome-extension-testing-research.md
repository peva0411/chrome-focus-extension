---
date: 2026-01-18T00:00:00Z
researcher: Claude
topic: "Chrome Extension Integration Testing: Tools and Approaches"
tags: [research, testing, chrome-extensions, integration-testing, automation]
status: complete
focus: schedule-based website blocking extension
---

# Research: Chrome Extension Integration Testing Tools and Approaches

## Research Question

What are the best tools and approaches for integration testing a Chrome extension that uses chrome.alarms, chrome.declarativeNetRequest, and service workers for schedule-based website blocking?

## Executive Summary

After analyzing the Focus Extension's architecture and researching modern Chrome extension testing tools, the recommended approach is:

**Primary Recommendation: Puppeteer + Custom Test Harness**
- Load unpacked extensions programmatically
- Test service workers and alarms with time manipulation via Sinon fake timers
- Verify declarativeNetRequest rules through actual navigation
- Mature tooling with active community support

**Supplementary: Playwright** for cross-browser testing (Chrome, Edge, Firefox)

**Avoid:** Selenium (outdated for modern extensions), chrome.test API (limited to Chrome Web Store extensions)

---

## Extension Architecture Context

Based on analysis of the Focus Extension codebase:

**Key Components to Test:**
- Service Worker ([src/background/service-worker.js](../src/background/service-worker.js)) - Coordinates all managers
- Schedule Manager ([src/background/schedule-manager.js](../src/background/schedule-manager.js)) - Uses chrome.alarms for periodic checks
- Blocking Manager ([src/background/blocking-manager.js](../src/background/blocking-manager.js)) - Manages declarativeNetRequest rules
- Budget Manager - Time-based session tracking
- Storage API usage throughout

**Critical Test Scenarios:**
1. Time-based schedule activation/deactivation
2. chrome.alarms triggering every minute
3. declarativeNetRequest rule updates
4. Service worker lifecycle (startup, install, update)
5. Multi-tab coordination
6. Storage persistence and migration

---

## Tool Analysis

### 1. Puppeteer (★★★★★ RECOMMENDED)

**Overview:**
Node.js library for controlling headless Chrome via DevTools Protocol. Excellent support for loading Chrome extensions.

**Setup Complexity:** ⭐⭐ (Moderate - requires learning DevTools Protocol patterns)

**What It Can Test:**
✅ Service workers (full access)
✅ chrome.alarms (with mocking)
✅ chrome.declarativeNetRequest (actual rule application)
✅ chrome.storage (real storage API)
✅ Popup UI
✅ Options page
✅ Content scripts
✅ Web-accessible resources

**Time Manipulation:** ⭐⭐⭐⭐⭐ Excellent
- Mock `Date.now()` and `new Date()` in service worker context
- Use Sinon fake timers injected into extension context
- Control chrome.alarms.create via service worker manipulation

**Community & Maintenance:**
- ⭐⭐⭐⭐⭐ Very active (Google-backed)
- 88k+ GitHub stars
- Regular updates
- Extensive documentation

**Example Code:**

```javascript
const puppeteer = require('puppeteer');
const path = require('path');

describe('Focus Extension Integration Tests', () => {
  let browser, extensionId, serviceWorkerTarget;

  beforeAll(async () => {
    // Launch Chrome with extension loaded
    browser = await puppeteer.launch({
      headless: false, // Extensions require headed mode
      args: [
        `--disable-extensions-except=${path.resolve(__dirname, '../')}`,
        `--load-extension=${path.resolve(__dirname, '../')}`,
        '--no-sandbox'
      ]
    });

    // Get extension ID from chrome://extensions
    const extensionTarget = await browser.waitForTarget(
      target => target.type() === 'service_worker'
    );
    
    const partialExtensionUrl = extensionTarget.url() || '';
    [extensionId] = partialExtensionUrl.split('/').slice(2, 3);
    
    serviceWorkerTarget = extensionTarget;
    
    console.log('Extension loaded with ID:', extensionId);
  });

  afterAll(async () => {
    await browser.close();
  });

  test('Service worker initializes correctly', async () => {
    const worker = await serviceWorkerTarget.worker();
    
    // Execute code in service worker context
    const result = await worker.evaluate(() => {
      return {
        initialized: typeof blockingManager !== 'undefined',
        scheduleManagerExists: typeof scheduleManager !== 'undefined'
      };
    });
    
    expect(result.initialized).toBe(true);
    expect(result.scheduleManagerExists).toBe(true);
  });

  test('Schedule activates blocking at specified time', async () => {
    const worker = await serviceWorkerTarget.worker();
    
    // Install fake timers in service worker context
    await worker.evaluate(() => {
      // Mock Date to specific time: Monday 9:00 AM
      const fakeDate = new Date('2026-01-19T09:00:00Z');
      window.originalDate = Date;
      Date = class extends Date {
        constructor(...args) {
          if (args.length === 0) {
            super(fakeDate);
          } else {
            super(...args);
          }
        }
        static now() {
          return fakeDate.getTime();
        }
      };
    });
    
    // Create a test schedule
    await worker.evaluate(async () => {
      const testSchedule = {
        id: 'test-schedule-1',
        name: 'Workday Schedule',
        enabled: true,
        days: [1], // Monday
        startTime: '09:00',
        endTime: '17:00'
      };
      
      await storage.set('schedules', [testSchedule]);
      await storage.set('activeSchedule', 'test-schedule-1');
      
      // Trigger schedule check
      await scheduleManager.checkScheduleState();
    });
    
    // Verify blocking is enabled
    const blockingState = await worker.evaluate(async () => {
      return await storage.get('blockingEnabled');
    });
    
    expect(blockingState).toBe(true);
  });

  test('Blocked site redirects to interstitial', async () => {
    const worker = await serviceWorkerTarget.worker();
    
    // Add blocked site
    await worker.evaluate(async () => {
      await storage.set('blockedSites', [
        { id: '1', pattern: 'facebook.com', enabled: true }
      ]);
      await blockingManager.initialize();
    });
    
    // Open a new page and try to navigate to blocked site
    const page = await browser.newPage();
    await page.goto('https://facebook.com', { waitUntil: 'networkidle0' });
    
    // Should be redirected to blocked page
    const url = page.url();
    expect(url).toContain('blocked.html');
    expect(url).toContain(`url=${encodeURIComponent('https://facebook.com/')}`);
    
    await page.close();
  });

  test('chrome.alarms triggers schedule checks', async () => {
    const worker = await serviceWorkerTarget.worker();
    
    // Set up alarm listener spy
    const alarmsFired = await worker.evaluate(() => {
      return new Promise((resolve) => {
        let count = 0;
        const originalCheckState = scheduleManager.checkScheduleState;
        
        scheduleManager.checkScheduleState = async function() {
          count++;
          if (count >= 2) {
            resolve(count);
          }
          return originalCheckState.call(this);
        };
        
        // Start monitoring
        scheduleManager.startMonitoring();
        
        // Fast-forward time (if using fake timers)
        // Or wait for actual alarms in real-time testing
      });
    });
    
    expect(alarmsFired).toBeGreaterThanOrEqual(2);
  });

  test('declarativeNetRequest rules are applied', async () => {
    const worker = await serviceWorkerTarget.worker();
    
    // Get current DNR rules
    const rules = await worker.evaluate(async () => {
      return await chrome.declarativeNetRequest.getDynamicRules();
    });
    
    // Should have rules for blocked sites
    expect(rules.length).toBeGreaterThan(0);
    expect(rules[0].action.type).toBe('redirect');
    expect(rules[0].condition.resourceTypes).toContain('main_frame');
  });
});
```

**Pros:**
- ✅ Official Google support
- ✅ Excellent documentation and examples
- ✅ Can test actual Chrome behaviors (not mocked)
- ✅ Full access to service worker and extension contexts
- ✅ Works with real chrome.* APIs
- ✅ Can test UI interactions (popup, options)
- ✅ Fast execution
- ✅ Integration with Jest/Mocha/Jasmine

**Cons:**
- ❌ Requires headed mode (no true headless)
- ❌ Chrome-only (no Firefox/Safari)
- ❌ Learning curve for DevTools Protocol
- ❌ Time manipulation requires custom mocking
- ❌ Must manage extension lifecycle manually

**Best For:** Deep integration testing of Chrome-specific APIs and behaviors

---

### 2. Playwright (★★★★ HIGHLY RECOMMENDED for cross-browser)

**Overview:**
Modern browser automation framework with extension support added in recent versions. Better cross-browser support than Puppeteer.

**Setup Complexity:** ⭐⭐ (Moderate)

**What It Can Test:**
✅ Service workers
✅ chrome.alarms (with mocking)
✅ chrome.storage
✅ Popup UI
✅ Options page
✅ Content scripts
⚠️ chrome.declarativeNetRequest (limited - better in Chromium)

**Time Manipulation:** ⭐⭐⭐⭐ Very Good
- Built-in clock mocking via `page.clock.install()`
- Can manipulate time in page contexts
- Service worker time manipulation requires custom approach

**Community & Maintenance:**
- ⭐⭐⭐⭐⭐ Very active (Microsoft-backed)
- 60k+ GitHub stars
- Rapid development
- Growing extension support

**Example Code:**

```javascript
const { chromium } = require('playwright');
const path = require('path');

describe('Focus Extension - Playwright Tests', () => {
  let browser, context, extensionId;

  beforeAll(async () => {
    // Launch browser with extension
    browser = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${path.resolve(__dirname, '../')}`,
        `--load-extension=${path.resolve(__dirname, '../')}`
      ]
    });

    // Get extension ID
    let [background] = browser.serviceWorkers();
    if (!background) {
      background = await browser.waitForEvent('serviceworker');
    }

    const extensionUrl = background.url();
    extensionId = extensionUrl.split('/')[2];
    
    console.log('Extension ID:', extensionId);
  });

  afterAll(async () => {
    await browser.close();
  });

  test('Schedule manager checks blocking at specific times', async () => {
    const [background] = browser.serviceWorkers();
    
    // Evaluate in service worker context
    const result = await background.evaluate(async () => {
      // Create schedule: Mon-Fri 9am-5pm
      const schedule = {
        id: 'work-schedule',
        name: 'Work Hours',
        enabled: true,
        days: [1, 2, 3, 4, 5],
        startTime: '09:00',
        endTime: '17:00'
      };
      
      await storage.set('schedules', [schedule]);
      await storage.set('activeSchedule', 'work-schedule');
      
      // Mock current time to Monday 10:00 AM
      const originalDate = Date;
      global.Date = class extends originalDate {
        constructor(...args) {
          if (args.length === 0) {
            return new originalDate('2026-01-19T10:00:00Z');
          }
          return new originalDate(...args);
        }
        static now() {
          return new originalDate('2026-01-19T10:00:00Z').getTime();
        }
      };
      
      // Check if should block
      const shouldBlock = await scheduleManager.shouldBlockNow();
      
      return { shouldBlock };
    });
    
    expect(result.shouldBlock).toBe(true);
  });

  test('Popup displays correct blocking status', async () => {
    const page = await browser.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);
    
    // Wait for popup to load
    await page.waitForSelector('.status');
    
    const statusText = await page.textContent('.status');
    expect(statusText).toContain('Blocking Active');
    
    await page.close();
  });

  test('Options page saves configuration', async () => {
    const page = await browser.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/options/options.html`);
    
    // Add a blocked site
    await page.fill('#site-pattern', 'twitter.com');
    await page.click('#add-site-button');
    
    // Wait for site to appear in list
    await page.waitForSelector('.site-item');
    
    const siteText = await page.textContent('.site-item');
    expect(siteText).toContain('twitter.com');
    
    await page.close();
  });
});
```

**Pros:**
- ✅ Cross-browser support (Chrome, Firefox, WebKit)
- ✅ Built-in time mocking
- ✅ Modern async/await API
- ✅ Excellent debugging tools
- ✅ Auto-waiting for elements
- ✅ Better timeout handling than Puppeteer
- ✅ Screenshot and video recording

**Cons:**
- ❌ Extension support still maturing
- ❌ Fewer examples for extension testing
- ❌ chrome.declarativeNetRequest harder to test
- ❌ Requires persistent context (more resource-intensive)

**Best For:** Cross-browser extension testing, UI-heavy tests

---

### 3. Selenium WebDriver (★★ NOT RECOMMENDED)

**Overview:**
Oldest browser automation framework. Extension support exists but is clunky.

**Setup Complexity:** ⭐⭐⭐⭐ (High - verbose API, brittle)

**What It Can Test:**
⚠️ Popup UI (limited)
⚠️ Content scripts (limited)
❌ Service workers (very difficult)
❌ chrome.alarms (no direct access)
❌ Modern Manifest V3 features

**Time Manipulation:** ⭐ Poor
- No built-in time mocking
- Must use custom JavaScript injection

**Community & Maintenance:**
- ⭐⭐⭐ Stable but declining for modern web apps
- Large community but outdated practices
- Few modern extension examples

**Example Code:**

```javascript
const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const path = require('path');

describe('Focus Extension - Selenium (NOT RECOMMENDED)', () => {
  let driver;

  beforeAll(async () => {
    const options = new chrome.Options();
    options.addArguments(
      `--load-extension=${path.resolve(__dirname, '../')}`
    );

    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .build();
  });

  afterAll(async () => {
    await driver.quit();
  });

  test('Can load extension (but hard to test internals)', async () => {
    // Very limited - can't easily access service worker
    // Can only test by navigating to extension pages
    await driver.get('chrome://extensions');
    
    // Selenium can't interact with chrome:// pages easily
    // This is where it breaks down for extension testing
  });
});
```

**Pros:**
- ✅ Cross-browser support
- ✅ Mature ecosystem
- ✅ Wide language support (Java, Python, C#, etc.)

**Cons:**
- ❌ Poor extension support
- ❌ Verbose API
- ❌ No service worker access
- ❌ Outdated for modern extensions
- ❌ Brittle tests
- ❌ Slow execution

**Verdict:** Avoid for modern Chrome extension testing. Use Puppeteer or Playwright instead.

---

### 4. chrome.test API (★★ LIMITED USE CASE)

**Overview:**
Built-in Chrome testing API, but only available for extensions published to Chrome Web Store or loaded with special flags.

**Setup Complexity:** ⭐⭐⭐ (Moderate to High)

**What It Can Test:**
✅ Chrome API contracts
✅ Extension permissions
✅ Message passing
⚠️ Service workers (limited)
❌ Time-based behaviors
❌ UI interactions

**Time Manipulation:** ⭐ Poor
- No time mocking capabilities
- Must use real delays

**Community & Maintenance:**
- ⭐⭐⭐ Google-maintained but niche
- Limited documentation
- Mainly for Chrome team internal use

**Example Code:**

```javascript
// tests/chrome-test-suite.js
// Must be loaded via manifest.json in test mode

chrome.test.runTests([
  function testStorageAPI() {
    chrome.storage.local.set({ test: 'value' }, () => {
      chrome.storage.local.get('test', (result) => {
        chrome.test.assertEq('value', result.test);
        chrome.test.succeed();
      });
    });
  },

  function testBlockingManager() {
    // Limited - can't easily mock time or test scheduling
    chrome.test.assertEq(
      typeof blockingManager !== 'undefined',
      true,
      'Blocking manager should exist'
    );
    chrome.test.succeed();
  }
]);
```

**Pros:**
- ✅ Official Chrome API
- ✅ No external dependencies
- ✅ Tests real Chrome behaviors

**Cons:**
- ❌ Requires special extension setup
- ❌ Limited to basic API testing
- ❌ No time manipulation
- ❌ Poor developer experience
- ❌ Can't test scheduling or alarms effectively
- ❌ Not suitable for integration tests

**Best For:** API contract testing only, not integration tests

---

### 5. sinon-chrome (★★★★ EXCELLENT for UNIT TESTS)

**Overview:**
Stubs/mocks for all Chrome extension APIs. Perfect for unit testing in Node.js without a browser.

**Setup Complexity:** ⭐ (Easy)

**What It Can Test:**
✅ Unit tests for extension logic
✅ Chrome API call verification
✅ Message passing logic
✅ Storage interactions (mocked)
✅ Alarm creation (mocked)
❌ Actual browser behavior
❌ declarativeNetRequest rule application
❌ Real service worker lifecycle

**Time Manipulation:** ⭐⭐⭐⭐⭐ Excellent (via Sinon fake timers)

**Community & Maintenance:**
- ⭐⭐⭐⭐ Active, well-maintained
- 500+ stars on GitHub
- Regular updates

**Example Code:**

```javascript
const sinon = require('sinon');
const chrome = require('sinon-chrome');
const { ScheduleManager } = require('../src/background/schedule-manager');

describe('ScheduleManager Unit Tests', () => {
  let clock;
  
  beforeEach(() => {
    global.chrome = chrome;
    clock = sinon.useFakeTimers(new Date('2026-01-19T10:00:00Z'));
  });

  afterEach(() => {
    chrome.flush();
    clock.restore();
  });

  test('startMonitoring creates alarm', () => {
    const manager = new ScheduleManager();
    manager.startMonitoring();
    
    expect(chrome.alarms.create.calledOnce).toBe(true);
    expect(chrome.alarms.create.firstCall.args[0]).toBe('scheduleCheck');
    expect(chrome.alarms.create.firstCall.args[1]).toEqual({
      delayInMinutes: 1,
      periodInMinutes: 1
    });
  });

  test('shouldBlockNow returns true during active schedule', async () => {
    chrome.storage.local.get.yields({
      schedules: [{
        id: 'work',
        enabled: true,
        days: [1], // Monday
        startTime: '09:00',
        endTime: '17:00'
      }],
      activeSchedule: 'work'
    });
    
    const manager = new ScheduleManager();
    await manager.loadSchedules();
    
    // Current time is Monday 10:00 AM (in active period)
    const shouldBlock = await manager.shouldBlockNow();
    
    expect(shouldBlock).toBe(true);
  });

  test('shouldBlockNow returns false outside schedule', async () => {
    chrome.storage.local.get.yields({
      schedules: [{
        id: 'work',
        enabled: true,
        days: [1], // Monday
        startTime: '09:00',
        endTime: '17:00'
      }],
      activeSchedule: 'work'
    });
    
    // Change time to Monday 8:00 AM (before start time)
    clock.restore();
    clock = sinon.useFakeTimers(new Date('2026-01-19T08:00:00Z'));
    
    const manager = new ScheduleManager();
    await manager.loadSchedules();
    
    const shouldBlock = await manager.shouldBlockNow();
    
    expect(shouldBlock).toBe(false);
  });

  test('alarm handler calls checkScheduleState', async () => {
    const manager = new ScheduleManager();
    const checkSpy = sinon.spy(manager, 'checkScheduleState');
    
    await manager.handleAlarm('scheduleCheck');
    
    expect(checkSpy.calledOnce).toBe(true);
  });
});
```

**Pros:**
- ✅ Fast unit tests in Node.js
- ✅ Complete Chrome API mocking
- ✅ Great for TDD
- ✅ Excellent time manipulation via Sinon
- ✅ No browser required
- ✅ Perfect for CI/CD

**Cons:**
- ❌ Mocked APIs (not real Chrome behavior)
- ❌ Can't test actual blocking
- ❌ No UI testing
- ❌ Must separately verify with integration tests

**Best For:** Fast unit tests of business logic, TDD workflow

---

### 6. web-ext-test (★★ LIMITED - Firefox-focused)

**Overview:**
Testing utilities from Mozilla for WebExtensions, primarily Firefox-focused.

**Setup Complexity:** ⭐⭐ (Moderate)

**What It Can Test:**
✅ Firefox extensions
✅ Cross-browser WebExtension APIs
⚠️ Chrome-specific APIs (limited)
❌ chrome.declarativeNetRequest (not available)
❌ Manifest V3 features

**Community & Maintenance:**
- ⭐⭐⭐ Mozilla-maintained
- Firefox ecosystem focus
- Not ideal for Chrome-specific features

**Verdict:** Not suitable for Chrome-specific testing (declarativeNetRequest, Manifest V3)

---

### 7. @playwright/test + Custom Extension Helpers (★★★★ EMERGING APPROACH)

**Overview:**
Combine Playwright's testing framework with custom helpers for extension testing.

**Setup Complexity:** ⭐⭐⭐ (Moderate - requires custom setup)

**Example Code:**

```javascript
// test-helpers/extension-loader.js
const { chromium } = require('@playwright/test');
const path = require('path');

async function loadExtension() {
  const pathToExtension = path.resolve(__dirname, '../');
  
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`
    ]
  });

  const [background] = context.serviceWorkers();
  const extensionId = background.url().split('/')[2];

  return { context, background, extensionId };
}

module.exports = { loadExtension };

// tests/schedule.spec.js
const { test, expect } = require('@playwright/test');
const { loadExtension } = require('../test-helpers/extension-loader');

test.describe('Schedule Integration Tests', () => {
  let context, background, extensionId;

  test.beforeAll(async () => {
    ({ context, background, extensionId } = await loadExtension());
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('should enable blocking during active schedule period', async () => {
    // Set up test data in service worker
    await background.evaluate(async () => {
      // Mock current time to Monday 10:00 AM
      const originalDate = Date;
      Date = class extends originalDate {
        constructor(...args) {
          return args.length === 0 
            ? new originalDate('2026-01-19T10:00:00Z')
            : new originalDate(...args);
        }
        static now() {
          return new originalDate('2026-01-19T10:00:00Z').getTime();
        }
      };

      // Create active schedule
      await storage.set('schedules', [{
        id: 'test-schedule',
        enabled: true,
        days: [1], // Monday
        startTime: '09:00',
        endTime: '17:00'
      }]);
      await storage.set('activeSchedule', 'test-schedule');

      // Trigger schedule check
      await scheduleManager.checkScheduleState();
    });

    // Verify blocking is enabled
    const isBlocking = await background.evaluate(async () => {
      return await storage.get('blockingEnabled');
    });

    expect(isBlocking).toBe(true);
  });
});
```

**Pros:**
- ✅ Best of Playwright + custom extension logic
- ✅ Flexible and powerful
- ✅ Good for complex test scenarios

**Cons:**
- ❌ More setup required
- ❌ Must maintain custom helpers

---

## Time Manipulation Strategies

Critical for testing schedule-based features like the Focus Extension.

### Approach 1: Sinon Fake Timers in Service Worker

```javascript
// Inject into service worker context
await serviceWorker.evaluate(() => {
  // Install fake timers
  const clock = sinon.useFakeTimers({
    now: new Date('2026-01-19T09:00:00Z'),
    shouldAdvanceTime: true
  });

  // Now Date.now(), new Date(), setTimeout, setInterval are all fake
  
  // Advance time by 1 hour
  clock.tick(60 * 60 * 1000);
  
  // Or jump to specific time
  clock.setSystemTime(new Date('2026-01-19T17:00:00Z'));
});
```

### Approach 2: Mock Date Globally

```javascript
await serviceWorker.evaluate(() => {
  const OriginalDate = Date;
  let fakeTime = new OriginalDate('2026-01-19T09:00:00Z');
  
  global.Date = class extends OriginalDate {
    constructor(...args) {
      if (args.length === 0) {
        super(fakeTime);
      } else {
        super(...args);
      }
    }
    
    static now() {
      return fakeTime.getTime();
    }
  };
  
  // Function to advance time in tests
  global.setTestTime = (newTime) => {
    fakeTime = new OriginalDate(newTime);
  };
});

// In tests:
await serviceWorker.evaluate(() => {
  global.setTestTime('2026-01-19T17:00:00Z');
  // Now all Date calls return 5:00 PM
});
```

### Approach 3: Custom Test APIs

Add test-only functions to your extension:

```javascript
// In schedule-manager.js (wrapped in if statement)
if (process.env.NODE_ENV === 'test') {
  ScheduleManager.prototype._setTestTime = function(time) {
    this._testTime = new Date(time);
  };
  
  ScheduleManager.prototype._getTime = function() {
    return this._testTime || new Date();
  };
}

// Use _getTime() instead of new Date() throughout
```

---

## Testing chrome.alarms

### Strategy 1: Mock and Verify

```javascript
// Unit test approach
test('startMonitoring creates alarm', () => {
  chrome.alarms.create.resetHistory();
  
  scheduleManager.startMonitoring();
  
  expect(chrome.alarms.create.calledOnce).toBe(true);
  expect(chrome.alarms.create.firstCall.args).toEqual([
    'scheduleCheck',
    { delayInMinutes: 1, periodInMinutes: 1 }
  ]);
});
```

### Strategy 2: Fast-Forward Real Alarms

```javascript
// Integration test - wait for actual alarm
test('alarm triggers schedule check', async () => {
  let checkCount = 0;
  
  await serviceWorker.evaluate(() => {
    const original = scheduleManager.checkScheduleState;
    scheduleManager.checkScheduleState = async function() {
      window.__checkCount = (window.__checkCount || 0) + 1;
      return original.call(this);
    };
    
    scheduleManager.startMonitoring();
  });
  
  // Wait for 2 minutes in real time (or use time manipulation)
  await new Promise(resolve => setTimeout(resolve, 2 * 60 * 1000 + 500));
  
  checkCount = await serviceWorker.evaluate(() => window.__checkCount);
  
  expect(checkCount).toBeGreaterThanOrEqual(2);
}, 180000); // 3 minute timeout
```

### Strategy 3: Trigger Alarms Manually

```javascript
// Directly fire alarm listener
await serviceWorker.evaluate(async () => {
  await scheduleManager.handleAlarm('scheduleCheck');
  // Simulates alarm firing without waiting
});
```

---

## Testing chrome.declarativeNetRequest

### Strategy 1: Verify Rules Registered

```javascript
test('blocking sites creates DNR rules', async () => {
  await serviceWorker.evaluate(async () => {
    await storage.set('blockedSites', [
      { id: '1', pattern: 'facebook.com', enabled: true },
      { id: '2', pattern: 'twitter.com', enabled: true }
    ]);
    await blockingManager.initialize();
  });
  
  const rules = await serviceWorker.evaluate(() => {
    return chrome.declarativeNetRequest.getDynamicRules();
  });
  
  expect(rules.length).toBeGreaterThanOrEqual(2);
  expect(rules[0].action.type).toBe('redirect');
  expect(rules[0].action.redirect.url).toContain('blocked.html');
});
```

### Strategy 2: Test Actual Blocking

```javascript
test('blocked site redirects to interstitial', async () => {
  // Set up blocking
  await serviceWorker.evaluate(async () => {
    await storage.set('blockedSites', [
      { id: '1', pattern: 'example.com', enabled: true }
    ]);
    await storage.set('blockingEnabled', true);
    await blockingManager.initialize();
  });
  
  // Try to navigate to blocked site
  const page = await browser.newPage();
  await page.goto('https://example.com');
  
  // Should be on blocked page
  const url = page.url();
  expect(url).toContain('blocked.html');
  expect(url).toContain('url=https%3A%2F%2Fexample.com');
  
  await page.close();
});
```

---

## Recommended Test Structure for Focus Extension

```
tests/
├── unit/                                    # Fast, isolated unit tests
│   ├── schedule-manager.test.js             # Test schedule logic with sinon-chrome
│   ├── blocking-manager.test.js             # Test rule generation
│   ├── budget-manager.test.js               # Test budget calculations
│   └── utils.test.js                        # Test utility functions
│
├── integration/                             # Browser-based integration tests
│   ├── setup/
│   │   └── extension-loader.js              # Helper to load extension
│   ├── schedule-integration.test.js         # Test schedule + blocking integration
│   ├── budget-integration.test.js           # Test time budget tracking
│   ├── ui-integration.test.js               # Test popup + options pages
│   └── lifecycle-integration.test.js        # Test install, update, startup
│
├── e2e/                                     # Full end-to-end scenarios
│   ├── daily-workflow.test.js               # Test typical user day
│   ├── edge-cases.test.js                   # Test edge cases
│   └── performance.test.js                  # Test performance characteristics
│
└── helpers/
    ├── time-helpers.js                      # Time manipulation utilities
    ├── storage-helpers.js                   # Storage setup/teardown
    └── assertion-helpers.js                 # Custom assertions
```

---

## Specific Recommendations for Focus Extension

### Phase 1: Set Up Unit Tests (Week 1)
**Tool:** Jest + sinon-chrome
**Focus:** Business logic without browser

```bash
npm install --save-dev jest sinon sinon-chrome @types/chrome
```

Test files:
- `schedule-manager.test.js` - Schedule calculations, time comparisons
- `blocking-manager.test.js` - Pattern matching, rule generation
- `budget-manager.test.js` - Budget calculations
- `utils.test.js` - Helper functions

**Benefits:** Fast feedback, TDD workflow, runs in CI easily

### Phase 2: Set Up Integration Tests (Week 2)
**Tool:** Puppeteer + Jest
**Focus:** Service worker + Chrome APIs + actual blocking

```bash
npm install --save-dev puppeteer jest-puppeteer
```

Test files:
- `service-worker-lifecycle.test.js` - Install, startup, update
- `schedule-blocking-integration.test.js` - Schedule triggers blocking
- `alarm-integration.test.js` - Alarms fire correctly
- `dnr-integration.test.js` - Blocking rules work

**Benefits:** Tests real Chrome behavior, catches integration bugs

### Phase 3: Add E2E Tests (Week 3)
**Tool:** Playwright
**Focus:** User workflows across multiple tabs/windows

```bash
npm install --save-dev @playwright/test
```

Test files:
- `daily-workflow.spec.js` - Full day simulation
- `multi-tab.spec.js` - Multiple tabs coordinating
- `persistence.spec.js` - Data persists across restarts

**Benefits:** Catches UX issues, validates complete user journeys

---

## Example Package.json Scripts

```json
{
  "scripts": {
    "test": "npm run test:unit && npm run test:integration",
    "test:unit": "jest --testPathPattern=tests/unit",
    "test:integration": "jest --testPathPattern=tests/integration --runInBand",
    "test:e2e": "playwright test",
    "test:watch": "jest --watch --testPathPattern=tests/unit",
    "test:coverage": "jest --coverage",
    "test:debug": "node --inspect-brk node_modules/.bin/jest --runInBand"
  },
  "jest": {
    "testEnvironment": "node",
    "testMatch": [
      "**/tests/**/*.test.js"
    ],
    "coveragePathIgnorePatterns": [
      "/node_modules/",
      "/tests/"
    ]
  }
}
```

---

## Testing Anti-Patterns to Avoid

### ❌ Don't: Use real delays for time-based tests
```javascript
// BAD
test('schedule activates after 1 minute', async () => {
  scheduleManager.startMonitoring();
  await new Promise(resolve => setTimeout(resolve, 60000)); // Wait 1 minute
  // Test will take forever
});
```

### ✅ Do: Mock time
```javascript
// GOOD
test('schedule activates after 1 minute', async () => {
  const clock = sinon.useFakeTimers();
  scheduleManager.startMonitoring();
  clock.tick(60000); // Instant
  await testScheduleState();
  clock.restore();
});
```

### ❌ Don't: Test production extension directly
```javascript
// BAD
test('works in production', async () => {
  // Loading live extension from Chrome Web Store
  // Fragile, slow, can't control state
});
```

### ✅ Do: Load unpacked extension in test environment
```javascript
// GOOD
test('works correctly', async () => {
  const browser = await puppeteer.launch({
    args: [`--load-extension=${extensionPath}`]
  });
  // Full control, fast, repeatable
});
```

---

## Continuous Integration Setup

### GitHub Actions Example

```yaml
# .github/workflows/test.yml
name: Test Extension

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:unit

  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - name: Install Chrome
        run: |
          wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
          sudo sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list'
          sudo apt-get update
          sudo apt-get install google-chrome-stable
      - run: npm run test:integration
        env:
          HEADLESS: true

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
```

---

## Learning Resources

### Puppeteer + Extensions
- [Official Puppeteer docs](https://pptr.dev/)
- [Chrome Extensions Testing with Puppeteer](https://github.com/GoogleChrome/puppeteer/blob/main/docs/api.md#working-with-chrome-extensions)
- [Example: Testing Chrome Extension](https://github.com/checkly/puppeteer-examples/tree/master/chrome-extension)

### Playwright + Extensions
- [Playwright Chrome Extensions Guide](https://playwright.dev/docs/chrome-extensions)
- [Playwright Testing](https://playwright.dev/docs/intro)

### Chrome APIs Testing
- [Chrome Extension APIs](https://developer.chrome.com/docs/extensions/reference/)
- [declarativeNetRequest Testing](https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/)

### Time Manipulation
- [Sinon Fake Timers](https://sinonjs.org/releases/latest/fake-timers/)
- [Testing Async Code](https://jestjs.io/docs/asynchronous)

---

## Conclusion

### Recommended Stack for Focus Extension:

1. **Unit Tests:** Jest + sinon-chrome
   - Fast, focused tests of business logic
   - Run on every commit
   - Target: 80%+ coverage of managers

2. **Integration Tests:** Puppeteer + Jest
   - Test service worker + Chrome APIs
   - Test schedule + blocking integration
   - Test alarm triggering with time manipulation
   - Run on PRs and before releases

3. **E2E Tests:** Playwright (optional)
   - Full user workflows
   - Cross-browser validation (Chrome + Edge)
   - Run before major releases

### Implementation Priority:

1. ✅ **Week 1:** Set up Jest + sinon-chrome, write unit tests for ScheduleManager
2. ✅ **Week 2:** Add Puppeteer integration tests for schedule + blocking
3. ✅ **Week 3:** Test chrome.alarms with time manipulation
4. ✅ **Week 4:** Test declarativeNetRequest rule application
5. ⭐ **Week 5:** Add CI/CD pipeline with GitHub Actions

### Key Success Metrics:

- Unit tests run in < 10 seconds
- Integration tests run in < 2 minutes
- 80%+ code coverage
- All tests pass before merge
- Zero flaky tests

This approach provides comprehensive testing coverage while maintaining fast feedback loops and developer productivity.
