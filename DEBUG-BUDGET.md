# Budget Feature Debugging Guide

## Issue: "Continue" Button Not Working

### Step 1: Check Browser Console

1. **Open the blocked page**
2. **Press F12** to open DevTools
3. **Go to Console tab**
4. Look for any error messages

Expected logs when clicking "Continue":
```
[BlockedPage] Use budget button clicked
[BlockedPage] Starting budget countdown
[BlockedPage] Countdown: 4
[BlockedPage] Countdown: 3
[BlockedPage] Countdown: 2
[BlockedPage] Countdown: 1
[BlockedPage] Countdown: 0
[BlockedPage] Activating budget session for site: <site-id>
[BlockedPage] Budget session response: {...}
[BlockedPage] Redirecting to: <url>
```

### Step 2: Check Service Worker Console

1. **Go to** `chrome://extensions`
2. **Find** Focus Extension
3. **Click** "service worker" link (should say "Inspect views service worker")
4. **Check console** for messages

Expected logs:
```
[ServiceWorker] Message received: {type: 'START_BUDGET_SESSION', ...}
[ServiceWorker] Starting budget session for tab: <tab-id> site: <site-id>
```

### Step 3: Verify Budget Manager Initialization

In the **service worker console**, run:
```javascript
// Check if budget manager is initialized
budgetManager
```

You should see the BudgetManager object. If it's undefined, the manager didn't initialize.

### Step 4: Check Budget Status

In the **service worker console**, run:
```javascript
// Check current budget status
async function checkBudget() {
  const status = await budgetManager.getRemainingBudget();
  console.log('Budget Status:', status);
  return status;
}
checkBudget();
```

Expected output:
```javascript
{
  global: 30,      // or your configured amount
  date: "2026-01-14",
  used: 0,
  total: 30
}
```

### Step 5: Manual Budget Check

In the **service worker console**, test budget checking:
```javascript
// Replace 'your-site-id' with actual site ID
async function testBudgetCheck() {
  const result = await budgetManager.checkBudgetAvailable('your-site-id');
  console.log('Budget Check Result:', result);
  return result;
}
testBudgetCheck();
```

Expected output:
```javascript
{
  hasGlobalBudget: true,
  globalRemaining: 30,
  siteRemaining: null,
  canAccess: true,
  total: 30,
  used: 0
}
```

### Step 6: Check Button Element

In the **blocked page console**, run:
```javascript
// Check if button exists
document.getElementById('use-budget-btn')
```

Should return the button element, not null.

### Step 7: Check Site ID

In the **blocked page console**, run:
```javascript
// Check URL parameters
const params = new URLSearchParams(window.location.search);
console.log('URL:', params.get('url'));
console.log('Site ID:', params.get('id'));
```

Both should have values. If Site ID is null, that's the problem.

---

## Common Issues and Fixes

### Issue: Button element is null
**Cause:** HTML structure mismatch or element not found  
**Fix:** Check that blocked.html has `<button id="use-budget-btn">`

### Issue: Site ID is null
**Cause:** Blocking rule not passing site ID  
**Fix:** Check blocking-manager.js `createRule()` method

### Issue: Budget manager undefined
**Cause:** Service worker not initialized or import failed  
**Fix:** 
1. Reload extension
2. Check service-worker.js imports
3. Check for errors in service worker console on load

### Issue: "No budget remaining" even though budget exists
**Cause:** Budget data not initialized correctly  
**Fix:**
```javascript
// In service worker console, reset budget:
await budgetManager.resetDailyBudget();
```

### Issue: Countdown doesn't start
**Cause:** Event listener not attached  
**Fix:** Check browser console for "Use budget button not found" warning

### Issue: Nothing happens after countdown
**Cause:** Tab information not available or message failing  
**Fix:** Check service worker console for error messages

---

## Manual Test

### Quick Test Script (Service Worker Console)

```javascript
// Full budget system test
async function fullBudgetTest() {
  console.log('=== Budget System Test ===');
  
  // 1. Check initialization
  console.log('1. Budget Manager:', budgetManager ? '✓' : '✗');
  
  // 2. Check budget status
  try {
    const status = await budgetManager.getRemainingBudget();
    console.log('2. Budget Status:', status);
    console.log('   - Remaining:', status.global, 'minutes');
    console.log('   - Date:', status.date);
  } catch (e) {
    console.error('2. Budget Status: ✗', e);
  }
  
  // 3. Check budget config
  console.log('3. Global Budget:', budgetManager.globalBudget);
  console.log('   Reset Time:', budgetManager.resetTime);
  
  // 4. Check active sessions
  const sessions = budgetManager.getActiveSessions();
  console.log('4. Active Sessions:', sessions.length);
  
  // 5. Test budget check (use a real site ID from your blocked sites)
  try {
    const sites = await chrome.storage.local.get(['blockedSites']);
    if (sites.blockedSites && sites.blockedSites.length > 0) {
      const testSiteId = sites.blockedSites[0].id;
      console.log('5. Testing with site:', testSiteId);
      const check = await budgetManager.checkBudgetAvailable(testSiteId);
      console.log('   Can Access:', check.canAccess);
      console.log('   Remaining:', check.globalRemaining);
    }
  } catch (e) {
    console.error('5. Budget Check: ✗', e);
  }
  
  console.log('=== Test Complete ===');
}

fullBudgetTest();
```

---

## Reset Everything

If things are really broken, reset the budget system:

```javascript
// In service worker console
async function resetBudgetSystem() {
  console.log('Resetting budget system...');
  
  // Clear budget data
  await chrome.storage.local.remove(['timeBudget', 'statistics']);
  
  // Reinitialize
  await budgetManager.initialize();
  
  console.log('Budget system reset complete');
  
  // Check new status
  const status = await budgetManager.getRemainingBudget();
  console.log('New status:', status);
}

resetBudgetSystem();
```

---

## Still Not Working?

1. **Reload Extension:**
   - Go to chrome://extensions
   - Click reload button
   - Try again

2. **Check File Changes:**
   - Ensure all files saved
   - Check git status shows committed changes

3. **Clear Extension Storage:**
   ```javascript
   chrome.storage.local.clear(() => console.log('Storage cleared'));
   ```
   Then reload extension

4. **Check Manifest:**
   - Ensure permissions include "alarms"
   - Ensure storage permission exists

5. **Browser Console Errors:**
   - Look for any red errors in console
   - Take screenshot and share for help

---

## Next Steps

After getting logs from Step 1-2, you'll know exactly where the issue is. Share the console output and we can pinpoint the exact problem!
