# Focus Extension - Testing Quick Start Guide

This guide will help you run the automated test suite for the first time.

## Prerequisites

1. **Node.js 18+** installed
2. **Google Chrome** installed
3. **Git** (for cloning)

## Installation

```bash
# 1. Navigate to project directory
cd focus-ext

# 2. Install dependencies
npm install

# This will install:
# - Jest (test runner)
# - Puppeteer (Chrome automation & E2E testing)
# - Sinon & sinon-chrome (mocking)
```

## Running Your First Test

### Option 1: Unit Tests (Fastest - 5-10 seconds)

Perfect for quick validation during development:

```bash
npm run test:unit
```

You should see output like:
```
PASS tests/unit/schedule-manager.test.js
  ScheduleManager Unit Tests
    ✓ should load schedules from storage (5ms)
    ✓ should return true during active schedule period (3ms)
    ✓ should create schedule check alarm on startMonitoring (2ms)

Test Suites: 1 passed, 1 total
Tests:       15 passed, 15 total
Time:        2.5s
```

### Option 2: Integration Tests (2-3 minutes)

Tests real Chrome extension behavior:

```bash
npm run test:integration
```

**Note:** Chrome will open automatically. This is expected - extensions require a visible browser window.

### Option 3: E2E Tests (3-5 minutes)

Tests complete user workflows using Puppeteer:

```bash
npm run test:e2e
```

**Note:** We use Puppeteer (not Playwright) for E2E tests, as it has superior Chrome extension support with better service worker access.

### Option 4: Run Everything

```bash
npm test
```

## Test Organization

```
tests/
├── unit/            → Fast, isolated tests (no browser needed)
├── integration/     → Chrome API integration tests
├── e2e/            → Full user workflow tests
└── helpers/        → Shared utilities
```

## Common Commands

```bash
# Watch mode - auto-run tests on file changes
npm run test:watch

# Coverage report
npm run test:coverage

# Debug tests
npm run test:debug
```

## Understanding Test Output

### ✅ Success
```
PASS tests/unit/schedule-manager.test.js
  ✓ Test passed
```

### ❌ Failure
```
FAIL tests/unit/schedule-manager.test.js
  ✕ Test failed
  
  Expected: true
  Received: false
```

### ⏱️ Timeout
```
Timeout - Async callback was not invoked within the 30000 ms timeout
```
→ Usually means extension didn't load or test took too long

## Troubleshooting

### "Cannot find module"
```bash
# Reinstall dependencies
rm -rf node_modules
npm install
```

### Integration tests timeout
```bash
# Make sure Chrome is installed
google-chrome --version

# Or on Windows
"C:\Program Files\Google\Chrome\Application\chrome.exe" --version
```

### "Extension failed to load"
```bash
# Verify manifest.json exists
ls manifest.json

# Check extension path in test
cat tests/helpers/extension-loader.js
```

### Tests pass locally but fail in CI
- Check Node.js version matches CI (20+)
- Verify Chrome version compatibility
- Review GitHub Actions logs

## Next Steps

1. **Run all tests once** to verify setup:
   ```bash
   npm test
   ```

2. **Explore test files** to understand structure:
   - `tests/unit/schedule-manager.test.js` - Good starting point
   - `tests/integration/schedule-blocking-integration.test.js` - Integration example
   - `tests/e2e/daily-workflow.test.js` - Complete workflows (Puppeteer)

3. **Write your first test** using templates in `tests/README.md`

4. **Set up CI/CD** - Tests run automatically on push

## Quick Reference

| Command | Purpose | Speed | Browser Required |
|---------|---------|-------|------------------|
| `npm run test:unit` | Unit tests | ⚡ Fast | ❌ No |
| `npm run test:integration` | Integration tests | 🏃 Medium | ✅ Yes |
| `npm run test:e2e` | E2E tests | 🐢 Slow | ✅ Yes |
| `npm test` | Unit + Integration | 🏃 Medium | ✅ Yes |
| `npm run test:all` | Everything | 🐢 Slow | ✅ Yes |
| `npm run test:watch` | Auto-run on change | ⚡ Fast | ❌ No |
| `npm run test:coverage` | Coverage report | 🏃 Medium | ❌ No |

## Getting Help

- 📖 Full documentation: `tests/README.md`
- 🔬 Research document: `thoughts/shared/research/001_chrome_extension_integration_testing.md`
- 🐛 Found a bug? Check test output and logs
- 💡 Need examples? Look in `tests/unit/` and `tests/integration/`

## Why Puppeteer Instead of Playwright?

Based on our research (see `001_chrome_extension_integration_testing.md`), Puppeteer is recommended for Chrome extension testing because:
- ⭐ More mature Chrome extension support
- 🔧 Better service worker access (`browser.waitForTarget()`)
- 📚 Superior documentation for extension testing
- 🚀 Actively maintained by Google Chrome team

## Success!

If you see this, you're ready to start testing:

```
Test Suites: 3 passed, 3 total
Tests:       42 passed, 42 total
Snapshots:   0 total
Time:        45.123s
```

Happy testing! 🎉
