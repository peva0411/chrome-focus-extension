# Focus Extension - Testing Documentation

This directory contains comprehensive automated and manual tests for the Focus Extension.

---

## Test Architecture

Based on industry best practices for Chrome extension testing, our test suite consists of three layers:

### 1. **Unit Tests** (`tests/unit/`)
- **Tool:** Jest + sinon-chrome
- **Purpose:** Fast, isolated tests of business logic
- **Run Time:** < 10 seconds
- **Coverage Target:** 80%+

### 2. **Integration Tests** (`tests/integration/`)
- **Tool:** Puppeteer + Jest
- **Purpose:** Test service worker, Chrome APIs, and component integration
- **Run Time:** < 2 minutes
- **Key Tests:** Schedule activation, alarm triggering, DNR rules

### 3. **End-to-End Tests** (`tests/e2e/`)
- **Tool:** Puppeteer (recommended over Playwright for Chrome extensions)
- **Purpose:** Complete user workflows across UI and extension
- **Run Time:** < 5 minutes
- **Key Tests:** Daily workflows, multi-tab coordination, edge cases

---

## Test Structure

```
tests/
├── helpers/                          # Shared test utilities
│   ├── extension-loader.js           # Load extension in Puppeteer
│   ├── time-helpers.js               # Time manipulation for schedules
│   ├── storage-helpers.js            # Test data setup
│   └── assertion-helpers.js          # Custom assertions
│
├── unit/                             # Unit tests (Jest + sinon-chrome)
│   ├── schedule-manager.test.js      # Schedule logic tests
│   ├── blocking-manager.test.js      # Blocking rules tests
│   ├── budget-manager.test.js        # Budget calculations tests
│   └── utils.test.js                 # Utility function tests
│
├── integration/                      # Integration tests (Puppeteer)
│   ├── schedule-blocking-integration.test.js
│   ├── alarm-integration.test.js
│   ├── dnr-integration.test.js
│   └── test-budget.md                # Legacy manual test plan
│
└── e2e/                              # E2E tests (Puppeteer)
    └── daily-workflow.test.js        # Complete user scenarios
```

---

## Running Tests

### Prerequisites

```bash
# Install dependencies
npm install
```

### Quick Start

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit              # Unit tests only (fast)
npm run test:integration       # Integration tests (requires Chrome)
npm run test:e2e               # E2E tests (requires Chrome)

# Run all tests including E2E
npm run test:all

# Development mode
npm run test:watch             # Watch mode for unit tests
npm run test:debug             # Debug tests with inspector
```

### Unit Tests (Fast Feedback)

```bash
npm run test:unit
```

- Runs in Node.js without browser
- Uses sinon-chrome to mock Chrome APIs
- Perfect for TDD workflow
- Tests business logic in isolation

### Integration Tests (Real Chrome)

```bash
npm run test:integration
```

- Launches Chrome with extension loaded
- Tests service worker and Chrome APIs
- Verifies schedule + blocking integration
- Tests alarm triggering with time manipulation

**Note:** Integration tests require Chrome to be installed and run in headed mode.

### E2E Tests (User Workflows)

```bash
npm run test:e2e
```

- Tests complete user scenarios
- Verifies UI interactions
- Tests multi-tab coordination
- Validates data persistence

### Coverage Report

```bash
npm run test:coverage
```

Generates coverage report in `coverage/` directory. Open `coverage/lcov-report/index.html` to view.

---

## Test Helpers

### Extension Loader

```javascript
import { loadExtension, getServiceWorker } from '../helpers/extension-loader.js';

const { browser, extensionId, serviceWorker } = await loadExtension();
const worker = await getServiceWorker(serviceWorker);
```

### Time Manipulation

```javascript
import { installFakeTime, setTime, TEST_TIMES } from '../helpers/time-helpers.js';

// Set time to Monday 10:00 AM
await installFakeTime(worker, TEST_TIMES.MONDAY_10AM);

// Advance time
await setTime(worker, TEST_TIMES.MONDAY_5PM);
```

### Storage Setup

```javascript
import { setupTestScenario, createTestSchedule } from '../helpers/storage-helpers.js';

// Set up complete test scenario
await setupTestScenario(worker, {
  schedule: { startTime: '09:00', endTime: '17:00' },
  blockedSites: [{ pattern: 'facebook.com' }]
});
```

### Custom Assertions

```javascript
import { assertBlockingState, assertScheduleActive } from '../helpers/assertion-helpers.js';

// Assert blocking is enabled
await assertBlockingState(worker, true);

// Assert schedule is active
await assertScheduleActive(worker, true);
```

---

## Writing New Tests

### Unit Test Template

```javascript
import { describe, it, beforeEach, expect } from '@jest/globals';
import sinon from 'sinon';
import chrome from 'sinon-chrome';

global.chrome = chrome;

describe('MyComponent', () => {
  let clock;
  
  beforeEach(() => {
    chrome.flush();
    clock = sinon.useFakeTimers();
  });
  
  afterEach(() => {
    clock.restore();
  });
  
  it('should do something', () => {
    // Test implementation
  });
});
```

### Integration Test Template

```javascript
import { loadExtension, getServiceWorker } from '../helpers/extension-loader.js';

describe('My Integration Test', () => {
  let browser, worker;
  
  beforeAll(async () => {
    const loaded = await loadExtension();
    browser = loaded.browser;
    worker = await getServiceWorker(loaded.serviceWorker);
  });
  
  afterAll(async () => {
    await browser.close();
  });
  
  it('should integrate components', async () => {
    // Test implementation
  });
});
```

### E2E Test Template

```javascript
import puppeteer from 'puppeteer';
import { describe, test, beforeAll, afterAll, expect } from '@jest/globals';

let browser, extensionId, serviceWorker;

beforeAll(async () => {
  browser = await puppeteer.launch({
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  });
  
  const target = await browser.waitForTarget(
    target => target.type() === 'service_worker',
    { timeout: 30000 }
  );
  
  serviceWorker = await target.worker();
  extensionId = target.url().split('/')[2];
}, 60000);

afterAll(async () => {
  if (browser) await browser.close();
});

describe('My Feature', () => {
  test('should work end-to-end', async () => {
    const page = await browser.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/options/options.html`);
    // Test implementation
    await page.close();
  });
});
```

---

## Continuous Integration

Tests run automatically on GitHub Actions for:
- Every push to `main` or `develop`
- Every pull request

### CI Pipeline

1. **Unit Tests** - Fast validation of business logic
2. **Integration Tests** - Chrome API integration validation
3. **E2E Tests** - Full user workflow validation
4. **Coverage Report** - Uploaded to Codecov

View results in GitHub Actions tab.

---

## Manual Testing

### Legacy Test Plans

- **[test-budget.md](integration/test-budget.md)** - Phase 5: Time Budget System
  - 32 comprehensive test cases
  - Manual testing procedures
  - Performance and accessibility tests

### Service Worker Console Testing

For quick manual verification:

1. Open `chrome://extensions`
2. Find Focus Extension
3. Click "service worker" link
4. Paste and run test scripts

**Example:**
```javascript
// Check schedule state
async function checkSchedule() {
  const shouldBlock = await scheduleManager.shouldBlockNow();
  console.log('Should block now:', shouldBlock);
}
checkSchedule();

// Check blocking rules
async function checkRules() {
  const rules = await chrome.declarativeNetRequest.getDynamicRules();
  console.log('Active rules:', rules.length);
  console.table(rules);
}
checkRules();
```

---

## Troubleshooting

### Tests Failing in CI

- Check Chrome version compatibility
- Verify extension loads correctly
- Review GitHub Actions logs for details

### Integration Tests Timing Out

- Increase timeout in test file: `jest.setTimeout(60000)`
- Check if Chrome is properly installed
- Verify extension path is correct

### E2E Tests Flaky

- Add explicit waits: `await page.waitForSelector()`
- Use `{ timeout: 10000 }` for slow operations
- Check for race conditions in multi-tab tests

### Time Manipulation Not Working

- Verify fake time is installed before test
- Restore time after test to avoid pollution
- Use `TEST_TIMES` constants for consistency

---

## Best Practices

1. **Keep Unit Tests Fast** - No I/O, no delays, use mocks
2. **Use Helpers** - DRY principle, reusable test utilities
3. **Time Manipulation** - Never use real delays, always mock time
4. **Clean Up** - Clear storage and restore state after each test
5. **Descriptive Names** - Test names should explain what and why
6. **One Assertion Per Test** - Tests should be focused
7. **Arrange-Act-Assert** - Follow AAA pattern
8. **Avoid Brittle Selectors** - Use semantic selectors, not classes

---

## Resources

- [Research Document](../thoughts/shared/research/001_chrome_extension_integration_testing.md) - Why Puppeteer > Playwright
- [Puppeteer Docs](https://pptr.dev/) - Puppeteer API reference (used for E2E)
- [Jest Docs](https://jestjs.io/) - Jest testing framework
- [sinon-chrome](https://github.com/acvetkov/sinon-chrome) - Chrome API mocking

---

## Success Metrics

- ✅ Unit tests run in < 10 seconds
- ✅ Integration tests run in < 2 minutes
- ✅ 80%+ code coverage
- ✅ All tests pass before merge
- ✅ Zero flaky tests

---

## Future Improvements

- [ ] Add visual regression tests
- [ ] Expand budget manager test coverage
- [ ] Add performance benchmarking
- [ ] Cross-browser testing (Firefox, Edge)
- [ ] Accessibility testing automation

---

## Test Coverage

### Phase 2: Core Blocking
- Status: Tested manually during development
- Formal test plan: TBD

### Phase 3: Site Management
- Status: Tested manually during development
- Formal test plan: TBD

### Phase 4: Scheduling
- Status: Tested manually during development
- Formal test plan: TBD

### Phase 5: Time Budget ✅
- Status: Comprehensive test plan created
- File: `integration/test-budget.md`
- Test Cases: 32
- Ready for execution

---

## Testing Best Practices

1. **Clean State**: Start with fresh extension data when possible
2. **Console Logging**: Keep service worker and page consoles open
3. **Documentation**: Record all issues with steps to reproduce
4. **Edge Cases**: Test boundary conditions and error scenarios
5. **Cross-Browser**: Test in Chrome and Edge (both support Manifest V3)

---

## Reporting Issues

When filing bugs:

1. **Title**: Clear, descriptive summary
2. **Steps**: Exact steps to reproduce
3. **Expected**: What should happen
4. **Actual**: What actually happened
5. **Logs**: Include relevant console output
6. **Environment**: Browser version, OS, extension version

---

## Future Testing

### Unit Tests (Planned)
- Jest or Mocha framework
- Test individual functions
- Mock Chrome APIs

### End-to-End Tests (Implemented)
- Puppeteer (recommended for Chrome extensions)
- Automated browser interactions  
- CI/CD ready

### Performance Tests
- Memory leak detection
- CPU usage monitoring
- Storage growth tracking

---

## Contributing

When adding new features:

1. Create corresponding test plan
2. Include both positive and negative test cases
3. Add edge case scenarios
4. Provide test automation scripts where possible
5. Update this README

---

## Questions?

See [QUICKSTART.md](../QUICKSTART.md) or project documentation in `/plans` directory.
