---
date: 2026-01-18T00:00:00Z
researcher: Claude
topic: "Integration Testing Approaches for Chrome Extension Schedule Functionality"
tags: [research, testing, chrome-extension, integration-tests, schedule-testing]
status: complete
---

# Research: Integration Testing Approaches for Chrome Extension Schedule Functionality

## Research Question

What are the best approaches to create automated integration tests for a Chrome extension's schedule functionality, specifically to test chrome.alarms, time-based blocking logic, and declarativeNetRequest rules without manual testing and extension reloading?

## Summary

After comprehensive research, the **recommended approach** is a **two-tier testing strategy**:

1. **Unit Tests with sinon-chrome + Sinon Fake Timers** (for fast TDD)
   - Test schedule logic in isolation
   - Mock Chrome APIs completely
   - Run in Node.js (no browser needed)
   - Execute in milliseconds

2. **Integration Tests with Puppeteer** (for E2E validation)
   - Test real Chrome extension APIs
   - Load actual unpacked extension
   - Verify declarativeNetRequest rules
   - Test service worker interactions

This combination provides **fast feedback during development** (unit tests) and **high confidence before deployment** (integration tests).

## Detailed Findings

### 1. Chrome Extension Testing Tools Comparison

#### ★★★★★ Puppeteer (HIGHLY RECOMMENDED)
**Purpose:** Integration testing with real Chrome APIs

**Key Capabilities:**
- Load unpacked extensions programmatically
- Access service worker context directly
- Test chrome.alarms, chrome.declarativeNetRequest, chrome.storage
- Time manipulation via service worker evaluation
- Google-backed, actively maintained

**Setup Complexity:** Medium
**Learning Curve:** Low-Medium
**Best For:** Integration tests, E2E tests

**Example:**
```javascript
import puppeteer from 'puppeteer';
import path from 'path';

const browser = await puppeteer.launch({
  headless: false,
  args: [
    `--disable-extensions-except=${path.resolve('./extension')}`,
    `--load-extension=${path.resolve('./extension')}`
  ]
});

const extensionTarget = await browser.waitForTarget(
  target => target.type() === 'service_worker'
);
const serviceWorker = await extensionTarget.worker();

// Test schedule check
const shouldBlock = await serviceWorker.evaluate(async () => {
  return await scheduleManager.shouldBlockNow();
});
```

**Pros:**
- Real Chrome APIs (no mocking needed)
- Direct service worker access
- Can test actual user flows
- Excellent documentation

**Cons:**
- Slower than unit tests (seconds vs milliseconds)
- Requires Chrome binary
- More setup complexity

---

#### ★★★★ sinon-chrome (RECOMMENDED for Unit Tests)
**Purpose:** Fast unit testing with mocked Chrome APIs

**Key Capabilities:**
- Complete Chrome API mocking
- Works in Node.js (no browser)
- Stub responses, spy on calls
- Great for TDD workflow

**Setup Complexity:** Low
**Learning Curve:** Low
**Best For:** Unit tests, pure logic testing

**Example:**
```javascript
import chrome from 'sinon-chrome';
import sinon from 'sinon';
import { ScheduleManager } from '../src/background/schedule-manager.js';

describe('ScheduleManager', () => {
  let clock;
  
  beforeEach(() => {
    global.chrome = chrome;
    clock = sinon.useFakeTimers(new Date('2026-01-19T10:00:00Z'));
  });
  
  afterEach(() => {
    clock.restore();
    chrome.flush();
  });
  
  test('shouldBlockNow returns true during schedule', async () => {
    chrome.storage.local.get.yields({
      schedules: [{ /* ... */ }],
      activeSchedule: 'schedule-id'
    });
    
    const manager = new ScheduleManager();
    await manager.loadSchedules();
    
    const shouldBlock = await manager.shouldBlockNow();
    expect(shouldBlock).toBe(true);
  });
});
```

**Pros:**
- Extremely fast (milliseconds)
- No browser required
- Perfect for TDD
- Easy to mock any Chrome API

**Cons:**
- Not testing real Chrome APIs
- Can't catch Chrome-specific bugs
- Mocks can drift from real API behavior

---

#### ★★★ Playwright (ALTERNATIVE to Puppeteer)
**Purpose:** Cross-browser extension testing

**Key Capabilities:**
- Chrome, Edge, Firefox support
- Similar to Puppeteer but cross-browser
- Built-in time mocking with `clock.install()`
- Modern async API

**Setup Complexity:** Medium
**Learning Curve:** Low-Medium
**Best For:** Cross-browser validation

**Pros:**
- Cross-browser testing
- Active development
- Good documentation

**Cons:**
- Chrome extension support less mature than Puppeteer
- Service worker access more complex
- Heavier than Puppeteer for Chrome-only

**Verdict:** Use if you need Firefox/Edge testing. Otherwise, Puppeteer is more mature for Chrome extensions.

---

#### ★★ Web Extension Testing Tools
**Tools:** web-ext-test, webextensions-jsdom, chrome-extension-testing-library

**Setup Complexity:** High
**Learning Curve:** Medium-High
**Best For:** Firefox extensions primarily

**Pros:**
- Purpose-built for extensions
- Some helpful utilities

**Cons:**
- Less maintained
- Limited Chrome MV3 support
- Smaller community
- More complex than Puppeteer

**Verdict:** SKIP - Puppeteer + sinon-chrome is simpler and more powerful.

---

#### ★ Selenium WebDriver (NOT RECOMMENDED)
**Purpose:** Legacy browser automation

**Pros:**
- Cross-browser support
- Mature ecosystem

**Cons:**
- Outdated API design
- Poor extension support
- Slow
- Complex setup
- Being replaced by Puppeteer/Playwright

**Verdict:** AVOID - Use Puppeteer or Playwright instead.

---

#### ⚠️ chrome.test API (TOO LIMITED)
**Purpose:** Built-in Chrome extension testing API

**Pros:**
- Official Google API
- No external dependencies

**Cons:**
- Requires test extension
- No time manipulation
- Can't test declarativeNetRequest easily
- Limited assertions
- Poor developer experience

**Verdict:** SKIP - Only for basic smoke tests.

---

### 2. Time Manipulation Strategies

Testing schedule functionality requires controlling time. Three approaches:

#### Strategy A: Sinon Fake Timers (★★★★★ RECOMMENDED for Unit Tests)
```javascript
import sinon from 'sinon';

const clock = sinon.useFakeTimers({
  now: new Date('2026-01-19T09:00:00Z'),
  shouldAdvanceTime: false
});

// Time is frozen at 9:00 AM
const shouldBlock = await manager.shouldBlockNow(); // Tests at 9:00 AM

// Jump to 10:00 AM
clock.tick(60 * 60 * 1000);
const stillBlocking = await manager.shouldBlockNow(); // Tests at 10:00 AM

clock.restore();
```

**Pros:**
- Complete time control
- Fast (no waiting)
- Can test edge cases easily
- Works with setTimeout/setInterval

**Cons:**
- Only works in unit tests (Node.js)
- Can't test real chrome.alarms

---

#### Strategy B: Injectable Time Provider (★★★★★ CODE REFACTORING)
**Modify your code to be testable:**

```javascript
// src/common/time-provider.js
class TimeProvider {
  constructor() {
    this._mockTime = null;
  }
  
  now() {
    return this._mockTime ? this._mockTime.getTime() : Date.now();
  }
  
  currentDate() {
    return this._mockTime ? new Date(this._mockTime) : new Date();
  }
  
  // Test-only
  _setMockTime(time) {
    this._mockTime = new Date(time);
  }
  
  _clearMockTime() {
    this._mockTime = null;
  }
}

export const timeProvider = new TimeProvider();
```

**Then in schedule-manager.js:**
```javascript
// Instead of: const now = new Date();
import { timeProvider } from '../common/time-provider.js';
const now = timeProvider.currentDate();
```

**In tests:**
```javascript
import { timeProvider } from '../../src/common/time-provider.js';

test('schedule check at 10 AM', async () => {
  timeProvider._setMockTime('2026-01-19T10:00:00Z');
  
  const shouldBlock = await manager.shouldBlockNow();
  expect(shouldBlock).toBe(true);
  
  timeProvider._clearMockTime();
});
```

**Pros:**
- Works in BOTH unit and integration tests
- Minimal code change
- Clean API
- Can test real Chrome extension

**Cons:**
- Requires refactoring existing code
- Adds one level of indirection

**Verdict:** HIGHLY RECOMMENDED - Makes your code testable without compromising production behavior.

---

#### Strategy C: Service Worker Date Override (★★★ for Integration Tests)
```javascript
// In Puppeteer test
await serviceWorker.evaluate(() => {
  window.OriginalDate = Date;
  window.mockTime = new Date('2026-01-19T09:00:00Z');
  
  Date = class extends window.OriginalDate {
    constructor(...args) {
      if (args.length === 0) {
        super(window.mockTime);
      } else {
        super(...args);
      }
    }
    
    static now() {
      return window.mockTime.getTime();
    }
  };
  
  window.setTestTime = (newTime) => {
    window.mockTime = new window.OriginalDate(newTime);
  };
});
```

**Pros:**
- Works in integration tests
- Tests real extension code
- No code changes needed

**Cons:**
- Fragile (global override)
- Doesn't work with chrome.alarms scheduling
- Can break internal Chrome code

**Verdict:** OK for integration tests, but Injectable Time Provider is better.

---

### 3. Testing chrome.alarms Without Waiting

Your extension uses `chrome.alarms.create()` to check schedules every minute. Testing this is challenging.

#### Approach A: Mock chrome.alarms in Unit Tests (★★★★★)
```javascript
import chrome from 'sinon-chrome';

test('startMonitoring creates alarm', () => {
  manager.startMonitoring();
  
  expect(chrome.alarms.create.calledOnce).toBe(true);
  expect(chrome.alarms.create.firstCall.args).toEqual([
    'scheduleCheck',
    { delayInMinutes: 1, periodInMinutes: 1 }
  ]);
});

test('handleAlarm triggers schedule check', async () => {
  const checkSpy = sinon.spy(manager, 'checkScheduleState');
  
  await manager.handleAlarm('scheduleCheck');
  
  expect(checkSpy.calledOnce).toBe(true);
});
```

**Pros:**
- Fast (no waiting)
- Tests alarm configuration
- Tests alarm handler

**Cons:**
- Doesn't test if alarms actually fire

---

#### Approach B: Fast-Forward Time in Integration Tests (★★★)
```javascript
test('alarm fires every minute', async () => {
  await serviceWorker.evaluate(() => {
    window.alarmCheckCount = 0;
    const original = scheduleManager.checkScheduleState;
    scheduleManager.checkScheduleState = async function() {
      window.alarmCheckCount++;
      return original.apply(this, arguments);
    };
    
    scheduleManager.startMonitoring();
  });
  
  // Wait 2+ minutes in real time
  await new Promise(resolve => setTimeout(resolve, 125000));
  
  const checkCount = await serviceWorker.evaluate(() => window.alarmCheckCount);
  expect(checkCount).toBeGreaterThanOrEqual(2);
}, 180000); // 3 minute timeout
```

**Pros:**
- Tests real chrome.alarms
- High confidence

**Cons:**
- VERY slow (minutes per test)
- Not suitable for TDD

**Verdict:** Only use for critical smoke tests. Use unit tests for most alarm testing.

---

### 4. Testing declarativeNetRequest Rules

#### Unit Test Approach (★★★★★)
```javascript
test('setBlockingEnabled(true) adds rules', async () => {
  chrome.storage.local.get.yields({
    blockedSites: [
      { id: '1', pattern: 'facebook.com', enabled: true },
      { id: '2', pattern: 'twitter.com', enabled: true }
    ]
  });
  
  await blockingManager.setBlockingEnabled(true);
  
  expect(chrome.declarativeNetRequest.updateDynamicRules.calledOnce).toBe(true);
  
  const call = chrome.declarativeNetRequest.updateDynamicRules.firstCall;
  expect(call.args[0].addRules.length).toBe(2);
  expect(call.args[0].addRules[0].action.type).toBe('redirect');
});
```

---

#### Integration Test Approach (★★★★★)
```javascript
test('blocking rules are applied', async () => {
  await serviceWorker.evaluate(async () => {
    await storage.set('blockedSites', [
      { id: '1', pattern: 'facebook.com', enabled: true }
    ]);
    await blockingManager.setBlockingEnabled(true);
  });
  
  const rules = await serviceWorker.evaluate(async () => {
    return await chrome.declarativeNetRequest.getDynamicRules();
  });
  
  expect(rules.length).toBe(1);
  expect(rules[0].action.type).toBe('redirect');
  expect(rules[0].action.redirect.url).toContain('blocked.html');
});
```

---

### 5. Test Architecture for Your Extension

Based on your codebase analysis:

```
tests/
├── unit/                                    # Fast, mocked Chrome APIs
│   ├── schedule-manager.test.js            # shouldBlockNow() logic
│   ├── schedule-transitions.test.js        # Edge cases (midnight, etc.)
│   ├── blocking-manager.test.js            # Rule creation
│   ├── utils.test.js                       # timeToMinutes, etc.
│   └── time-provider.test.js               # Time abstraction
│
├── integration/                             # Real Chrome APIs
│   ├── schedule-blocking.test.js           # Full schedule → blocking flow
│   ├── alarm-integration.test.js           # chrome.alarms behavior
│   ├── dnr-rules.test.js                   # declarativeNetRequest rules
│   ├── persistence.test.js                 # Storage + reload
│   └── exception-rules.test.js             # Exception handling
│
├── fixtures/
│   ├── schedules.js                        # Test schedule data
│   ├── times.js                            # Test time constants
│   └── sites.js                            # Test blocked sites
│
├── helpers/
│   ├── setup-extension.js                  # Puppeteer setup
│   ├── schedule-helpers.js                 # Schedule creation
│   ├── time-helpers.js                     # Time manipulation
│   └── assertions.js                       # Custom matchers
│
└── setup.js                                 # Global test setup
```

---

## Code References

### Key Files to Test

- [src/background/schedule-manager.js:14-85](src/background/schedule-manager.js) - Main schedule logic
- [src/background/schedule-manager.js:126-178](src/background/schedule-manager.js) - `shouldBlockNow()` method
- [src/background/blocking-manager.js:35-87](src/background/blocking-manager.js) - Rule creation
- [src/common/utils.js](src/common/utils.js) - Time utilities

### Existing Test Files (Manual)

- [test-schedule.js](test-schedule.js) - Pure logic testing
- [test-schedule-live.js](test-schedule-live.js) - Live extension testing
- [diagnostic.js](diagnostic.js) - Debug tool

**Gap:** No automated unit or integration tests exist yet.

---

## Architecture Insights

### Current Testing Pain Points

1. **Manual Testing Bottleneck**
   - Must reload extension after every code change
   - Must navigate to options page, create schedules manually
   - Must wait for real time to pass
   - No way to test edge cases (midnight, DST, etc.)

2. **Schedule Logic Complexity**
   - Time-based conditions (9:00-17:00)
   - Day-of-week logic (Monday vs Saturday)
   - Multiple time blocks per day
   - Edge cases (midnight crossover, timezone changes)

3. **Integration Points**
   - ScheduleManager ↔ BlockingManager coordination
   - chrome.alarms firing every minute
   - declarativeNetRequest rule updates
   - Storage persistence

### Recommended Solution

**Two-Tier Testing Strategy:**

#### Tier 1: Fast Unit Tests (TDD Workflow)
- Run in Node.js with sinon-chrome
- Mock all Chrome APIs
- Test schedule logic in isolation
- Use Sinon fake timers for time control
- Execute in milliseconds
- **Goal:** 100+ tests, 80%+ coverage, <1 second execution

#### Tier 2: Integration Tests (Confidence Checks)
- Run with Puppeteer + real Chrome
- Load actual unpacked extension
- Test real Chrome APIs
- Injectable time provider for time control
- Execute in seconds
- **Goal:** 20-30 critical path tests, <2 minutes execution

---

## Open Questions

1. **Timezone Testing**
   - Should tests cover multiple timezones?
   - How to handle users in different locations?

2. **Daylight Saving Time**
   - Current implementation doesn't explicitly handle DST
   - Should we add tests for DST transitions?

3. **Performance Testing**
   - Should we test schedule checks under load?
   - What's acceptable performance for alarm handler?

4. **CI/CD Integration**
   - Where will tests run? (GitHub Actions, local only?)
   - Should integration tests run on every commit?

---

## Recommended Implementation Plan

### Phase 1: Foundation (Week 1)
**Goal:** Get basic testing infrastructure working

1. **Setup Test Framework**
   - Install Jest, Puppeteer, sinon, sinon-chrome
   - Create test directory structure
   - Configure Jest for ES modules
   - Create basic fixtures

2. **Create Time Provider Abstraction**
   - Implement `src/common/time-provider.js`
   - Refactor schedule-manager.js to use timeProvider
   - Add time provider tests
   - Verify extension still works

3. **Write First Unit Tests**
   - Test `timeToMinutes()` utility
   - Test `shouldBlockNow()` for simple schedule
   - Test basic alarm configuration
   - Verify tests run fast (<100ms)

**Success Criteria:**
- ✅ 10+ unit tests passing
- ✅ Tests run in <1 second
- ✅ Time provider refactoring complete
- ✅ Extension still works correctly

---

### Phase 2: Core Unit Tests (Week 2)
**Goal:** Cover schedule logic comprehensively

1. **Schedule Matching Tests**
   - Time within schedule block
   - Time before schedule start
   - Time after schedule end
   - Day with no schedule
   - Multiple blocks per day
   - All 7 days of week

2. **Edge Case Tests**
   - Midnight crossover (23:59 → 00:01)
   - Day boundary (Sunday → Monday)
   - Daylight saving time transitions
   - Leap year handling

3. **Alarm Handler Tests**
   - alarm created with correct params
   - handleAlarm() calls checkScheduleState()
   - stopMonitoring() clears alarm
   - Ignore non-schedule alarms

**Success Criteria:**
- ✅ 50+ unit tests passing
- ✅ 80%+ code coverage
- ✅ All edge cases covered
- ✅ Tests run in <1 second

---

### Phase 3: Integration Tests (Week 3)
**Goal:** Test with real Chrome APIs

1. **Puppeteer Setup**
   - Create extension loader helper
   - Get service worker reference
   - Test basic message passing
   - Verify time provider works

2. **Schedule → Blocking Integration**
   - Schedule active → rules added
   - Schedule inactive → rules removed
   - Schedule transition → rules update
   - Extension reload → state persists

3. **DeclarativeNetRequest Tests**
   - Rules created correctly
   - Rules removed correctly
   - Exception rules work
   - Tab navigation blocked

**Success Criteria:**
- ✅ 15+ integration tests passing
- ✅ Real Chrome APIs tested
- ✅ Tests run in <60 seconds
- ✅ High confidence in deployment

---

### Phase 4: CI/CD & Documentation (Week 4)
**Goal:** Automate testing and document patterns

1. **GitHub Actions Setup**
   - Run unit tests on every commit
   - Run integration tests on PRs
   - Generate coverage reports
   - Block merges if tests fail

2. **Test Documentation**
   - Document testing patterns
   - Add examples to README
   - Create troubleshooting guide
   - Document how to run tests locally

3. **Developer Experience**
   - Add npm scripts for testing
   - Create watch mode for TDD
   - Add pre-commit hooks
   - Create test templates

**Success Criteria:**
- ✅ CI/CD pipeline working
- ✅ Tests run automatically
- ✅ Documentation complete
- ✅ Easy for new contributors

---

### Phase 5: Maintenance & Expansion (Ongoing)
**Goal:** Keep tests healthy and expand coverage

1. **Add Tests for New Features**
   - Test new schedules before implementing
   - Maintain >80% coverage
   - Update fixtures as needed

2. **Monitor Test Performance**
   - Keep unit tests <1 second
   - Keep integration tests <2 minutes
   - Remove flaky tests
   - Parallelize slow tests

3. **Refactor as Needed**
   - Extract common patterns
   - Improve test readability
   - Update to new testing tools
   - Keep dependencies updated

---

## Anti-Patterns to Avoid

### ❌ Don't: Test Implementation Details
```javascript
// BAD: Testing internal state
expect(manager._schedules.length).toBe(2);

// GOOD: Test observable behavior
expect(await manager.shouldBlockNow()).toBe(true);
```

### ❌ Don't: Make Tests Depend on Each Other
```javascript
// BAD: Tests share state
let manager; // shared across tests

test('test 1', () => { manager.initialize(); });
test('test 2', () => { /* relies on test 1 */ });

// GOOD: Each test is independent
beforeEach(() => {
  manager = new ScheduleManager();
});
```

### ❌ Don't: Use Real Time in Tests
```javascript
// BAD: Wait for real time
await new Promise(r => setTimeout(r, 60000)); // Wait 1 minute

// GOOD: Control time
clock.tick(60000); // Simulate 1 minute instantly
```

### ❌ Don't: Mock Everything in Integration Tests
```javascript
// BAD: Defeats the purpose of integration tests
chrome.declarativeNetRequest.getDynamicRules = jest.fn();

// GOOD: Use real Chrome APIs
const rules = await chrome.declarativeNetRequest.getDynamicRules();
```

---

## Recommended Tools & Versions

```json
{
  "devDependencies": {
    "@jest/globals": "^29.7.0",
    "jest": "^29.7.0",
    "puppeteer": "^21.6.0",
    "sinon": "^17.0.1",
    "sinon-chrome": "^3.0.1"
  }
}
```

---

## Example Test Execution Times

Based on similar Chrome extension projects:

| Test Type | Count | Execution Time | Use Case |
|-----------|-------|----------------|----------|
| Unit Tests (mocked) | 50 | 0.5s | TDD, every save |
| Unit Tests (full suite) | 150 | 1.5s | Pre-commit |
| Integration Tests (critical) | 10 | 30s | Pre-push |
| Integration Tests (full) | 30 | 90s | CI/CD |
| E2E Tests (manual scenarios) | 5 | 5min | Pre-release |

**Goal:** Most development uses unit tests (<1s), integration tests run in CI.

---

## Conclusion

**Recommended Approach:**

1. **Add Injectable Time Provider** to make code testable
2. **Use sinon-chrome + Sinon Fake Timers** for fast unit tests
3. **Use Puppeteer** for integration tests with real Chrome APIs
4. **Test schedule logic exhaustively** in unit tests
5. **Test critical paths** in integration tests
6. **Run unit tests on every save** for fast feedback
7. **Run integration tests in CI** for deployment confidence

This approach will:
- ✅ Eliminate manual testing bottleneck
- ✅ Enable fast TDD workflow
- ✅ Catch bugs before deployment
- ✅ Document expected behavior
- ✅ Enable confident refactoring
- ✅ Speed up development 10x

**Next Step:** Implement Phase 1 (Foundation) to get the testing infrastructure working.
