# Phase 5: Time Budget System - Testing Plan

**Test Date:** _________  
**Tester:** _________  
**Version:** 0.1.0

---

## Pre-Testing Setup

- [ ] Extension loaded in Chrome
- [ ] At least 2-3 blocked sites configured
- [ ] Service worker console open (chrome://extensions > Details > service worker)
- [ ] Test with clean storage (optional: clear extension data first)

---

## Test Suite 1: Budget Configuration

### Test 1.1: Load Default Budget Settings
**Objective:** Verify default budget settings are loaded correctly

**Steps:**
1. Open options page
2. Navigate to "Time Budget" tab
3. Check "Daily Time Allowance" field
4. Check "Budget Reset Time" field

**Expected Results:**
- [ ] Default budget shows 30 minutes
- [ ] Default reset time shows 00:00 (midnight)
- [ ] Today's budget shows correct values
- [ ] No errors in console

---

### Test 1.2: Update Budget Settings
**Objective:** Verify budget settings can be updated

**Steps:**
1. Navigate to Time Budget tab
2. Change "Daily Time Allowance" to 60 minutes
3. Change "Budget Reset Time" to 08:00
4. Click "Save Budget Settings"
5. Refresh the page
6. Check if settings persisted

**Expected Results:**
- [ ] Success message displayed
- [ ] Settings persist after refresh
- [ ] Service worker logs show config update
- [ ] New alarm set for 08:00

**Validation:**
```javascript
// In service worker console:
chrome.alarms.getAll(alarms => console.log(alarms));
// Should show budgetReset alarm scheduled for 08:00
```

---

### Test 1.3: Validate Budget Input Ranges
**Objective:** Ensure budget validation works

**Steps:**
1. Try to save budget with value 0
2. Try to save budget with value 3
3. Try to save budget with value 500
4. Try to save budget with value 120 (valid)

**Expected Results:**
- [ ] Values < 5 show error
- [ ] Values > 480 show error
- [ ] Valid values (5-480) save successfully
- [ ] Error notifications are clear

---

## Test Suite 2: Budget Tracking and Sessions

### Test 2.1: Check Budget on Blocked Page
**Objective:** Verify budget info displays on interstitial

**Steps:**
1. Navigate to a blocked site
2. Observe the blocked page
3. Check for budget section

**Expected Results:**
- [ ] Budget section is visible
- [ ] Shows remaining time correctly
- [ ] Progress bar displays
- [ ] "Continue (Use Time Budget)" button visible
- [ ] Budget exhausted message NOT shown (if budget available)

---

### Test 2.2: Start Budget Session
**Objective:** Verify budget session can be started

**Steps:**
1. Navigate to blocked site
2. Click "Continue (Use Time Budget)"
3. Wait for 5-second countdown
4. Observe redirect

**Expected Results:**
- [ ] Countdown displays correctly (5, 4, 3, 2, 1)
- [ ] "Click anywhere to cancel" hint shown
- [ ] After countdown, redirects to actual site
- [ ] Site loads normally
- [ ] Service worker logs show session started

**Validation:**
```javascript
// In service worker console (while on site):
self.testGetActiveSessions = async () => {
  const response = await handleMessage({ type: 'GET_ACTIVE_SESSIONS' }, {});
  console.log('Active sessions:', response.sessions);
  return response;
};
testGetActiveSessions();
```

---

### Test 2.3: Budget Countdown Tracking
**Objective:** Verify budget decreases while browsing

**Steps:**
1. Start budget session (from Test 2.2)
2. Browse the site for ~1 minute
3. Check options page budget display
4. Wait another minute
5. Check again

**Expected Results:**
- [ ] Used budget increases over time
- [ ] Remaining budget decreases
- [ ] Updates occur every 10 seconds
- [ ] Display updates in real-time in options page (may need refresh)

---

### Test 2.4: Cancel Budget Countdown
**Objective:** Verify countdown can be cancelled

**Steps:**
1. Navigate to blocked site
2. Click "Continue (Use Time Budget)"
3. During countdown, click anywhere on the countdown notice
4. Observe behavior

**Expected Results:**
- [ ] Countdown stops immediately
- [ ] Returns to normal blocked state
- [ ] "Continue" button reappears
- [ ] No session started
- [ ] Budget not consumed

---

### Test 2.5: Budget Session Ends on Tab Close
**Objective:** Verify session cleanup on tab close

**Steps:**
1. Start a budget session
2. Note the tab ID from service worker console
3. Close the tab
4. Check active sessions in service worker

**Expected Results:**
- [ ] Session removed from active sessions
- [ ] Budget saved with final usage
- [ ] Service worker logs show session ended
- [ ] No memory leaks (interval cleared)

---

### Test 2.6: Budget Session Ends on Navigation
**Objective:** Verify session ends when navigating away

**Steps:**
1. Start a budget session on a blocked site
2. Navigate to a non-blocked site (e.g., google.com)
3. Check active sessions

**Expected Results:**
- [ ] Session ends automatically
- [ ] Budget saved correctly
- [ ] Service worker logs show navigation detected

---

## Test Suite 3: Budget Exhaustion

### Test 3.1: Exhaust Budget Manually
**Objective:** Test behavior when budget runs out

**Setup:**
1. Set budget to 1 minute (60 seconds)
2. Start budget session
3. Wait 70 seconds

**Expected Results:**
- [ ] After ~60 seconds, redirected to blocked page
- [ ] Blocked page shows "budget exhausted" message
- [ ] "Continue" button is hidden
- [ ] Progress bar at 0%
- [ ] Message says "Try again tomorrow"

---

### Test 3.2: Try to Access with Zero Budget
**Objective:** Verify blocked page when no budget available

**Setup:**
1. Exhaust budget completely
2. Try to access another blocked site

**Expected Results:**
- [ ] Budget section shows 0 minutes remaining
- [ ] Budget exhausted message displayed
- [ ] "Continue" button not shown
- [ ] Cannot bypass block

---

## Test Suite 4: Budget Warnings and Notifications

### Test 4.1: Low Budget Warning (25%)
**Objective:** Test low budget notification

**Setup:**
1. Set budget to 40 minutes
2. Manually set used budget to 30 minutes (75% used)
3. Start a session or trigger budget check

**Expected Results:**
- [ ] Warning notification appears
- [ ] Message says "Time budget running low!"
- [ ] Shows remaining minutes

**Manual Trigger (Service Worker Console):**
```javascript
// Manually trigger warning check
budgetManager.checkBudgetWarnings();
```

---

### Test 4.2: Critical Budget Warning (10%)
**Objective:** Test critical budget notification

**Setup:**
1. Set budget to 50 minutes
2. Use 45+ minutes
3. Continue using budget

**Expected Results:**
- [ ] Critical warning notification appears
- [ ] Message includes ⚠️ symbol
- [ ] Higher priority than low warning

---

### Test 4.3: No Duplicate Warnings
**Objective:** Ensure warnings don't spam

**Steps:**
1. Trigger low budget warning
2. Continue using budget (but stay above 10%)
3. Observe notifications

**Expected Results:**
- [ ] Warning shown only once
- [ ] No duplicate notifications
- [ ] Service worker tracks sent warnings

---

## Test Suite 5: Daily Budget Reset

### Test 5.1: Manual Daily Reset
**Objective:** Test daily reset functionality

**Steps:**
1. Use some budget (e.g., 10 minutes)
2. In service worker console, manually trigger reset:
   ```javascript
   budgetManager.resetDailyBudget();
   ```
3. Check budget status

**Expected Results:**
- [ ] Used budget resets to 0
- [ ] Full budget restored
- [ ] Previous day saved to history
- [ ] Reset notification appears
- [ ] Date updated to today

---

### Test 5.2: Automatic Reset at Midnight
**Objective:** Verify scheduled reset works

**Note:** This is a time-based test. Either:
- Option A: Wait until scheduled reset time
- Option B: Set reset time to 1-2 minutes in future

**Setup (Option B):**
1. Set reset time to current time + 2 minutes
2. Wait for alarm to trigger

**Expected Results:**
- [ ] Alarm triggers at correct time
- [ ] Budget resets automatically
- [ ] Notification appears
- [ ] Service worker logs reset event

**Validation:**
```javascript
// Check alarm schedule
chrome.alarms.get('budgetReset', alarm => console.log(alarm));
```

---

### Test 5.3: Budget Persists on Startup
**Objective:** Verify budget survives browser restart

**Steps:**
1. Use some budget (e.g., 15 minutes)
2. Close Chrome completely
3. Reopen Chrome
4. Check extension

**Expected Results:**
- [ ] Budget values restored correctly
- [ ] Today's date preserved
- [ ] Used amount correct
- [ ] Active sessions cleared (none active)

---

## Test Suite 6: Budget History and Statistics

### Test 6.1: View Budget History
**Objective:** Verify history display works

**Setup:**
1. Use budget for several days (or manually create history)
2. Open options page
3. Navigate to Time Budget tab
4. Scroll to "Budget History" section

**Expected Results:**
- [ ] Chart displays with bars for each day
- [ ] Table shows last 7 days
- [ ] Used vs Total shown correctly
- [ ] Percentages calculated correctly
- [ ] Dates formatted properly

---

### Test 6.2: History Saved on Reset
**Objective:** Ensure history is recorded

**Steps:**
1. Use some budget (e.g., 20 minutes)
2. Trigger daily reset (manual or automatic)
3. Check storage for statistics

**Expected Results:**
- [ ] Previous day saved to budgetHistory array
- [ ] Includes date, used, total, perSite
- [ ] New day initialized
- [ ] History limited to 30 days max

**Validation:**
```javascript
// Check storage
chrome.storage.local.get(['statistics'], result => {
  console.log('Budget history:', result.statistics?.budgetHistory);
});
```

---

### Test 6.3: Active Sessions Display
**Objective:** Verify active session count

**Steps:**
1. Start 2-3 budget sessions in different tabs
2. Check options page
3. Look at "Active Sessions" stat

**Expected Results:**
- [ ] Count matches number of open sessions
- [ ] Updates when sessions end
- [ ] Shows 0 when no active sessions

---

## Test Suite 7: Edge Cases and Error Handling

### Test 7.1: Multiple Tabs Same Site
**Objective:** Test multiple sessions on same blocked site

**Steps:**
1. Start budget session in Tab A
2. Open same blocked site in Tab B
3. Start budget session in Tab B
4. Observe both tabs

**Expected Results:**
- [ ] Both sessions track independently
- [ ] Budget consumed from both (cumulative)
- [ ] Closing one tab doesn't affect other
- [ ] Both end properly

---

### Test 7.2: Extension Reload During Session
**Objective:** Test session handling on extension reload

**Steps:**
1. Start budget session
2. Go to chrome://extensions
3. Click "Reload" on the extension
4. Check the tab with active session

**Expected Results:**
- [ ] Session ends (service worker reset)
- [ ] Budget saved up to reload point
- [ ] No errors in console
- [ ] User can start new session

---

### Test 7.3: Invalid Budget Values
**Objective:** Test error handling for invalid data

**Steps:**
1. Open browser DevTools
2. Try to save budget with invalid JSON:
   ```javascript
   chrome.storage.local.set({ 
     timeBudget: { globalBudget: 'invalid' } 
   });
   ```
3. Reload extension
4. Check behavior

**Expected Results:**
- [ ] Extension doesn't crash
- [ ] Falls back to defaults
- [ ] Logs error appropriately
- [ ] User can recover by setting valid budget

---

### Test 7.4: System Time Change
**Objective:** Test behavior if system time changes

**Steps:**
1. Use some budget
2. Change system time forward 1 day
3. Check budget status

**Expected Results:**
- [ ] Budget recognizes date change
- [ ] Resets budget appropriately
- [ ] No duplicate history entries
- [ ] Handles gracefully

---

## Test Suite 8: Integration Tests

### Test 8.1: Budget with Schedules
**Objective:** Verify budget works with schedule blocking

**Setup:**
1. Create a schedule (e.g., 9am-5pm weekdays)
2. Set budget to 30 minutes
3. During scheduled time, try to access blocked site

**Expected Results:**
- [ ] Budget option available during schedule
- [ ] Budget session starts correctly
- [ ] Both systems work together
- [ ] Outside schedule hours, site not blocked

---

### Test 8.2: Budget During Pause
**Objective:** Test budget when blocking is paused

**Steps:**
1. Pause blocking for 30 minutes
2. Access previously blocked site
3. Observe behavior

**Expected Results:**
- [ ] Site accessible without using budget
- [ ] Budget not consumed during pause
- [ ] After pause ends, budget system resumes

---

### Test 8.3: Remove Site During Active Session
**Objective:** Test edge case of removing blocked site

**Steps:**
1. Start budget session on a site
2. In options, remove that site from block list
3. Observe active tab

**Expected Results:**
- [ ] Session continues (or ends gracefully)
- [ ] No errors occur
- [ ] Site remains accessible
- [ ] Budget tracking stops

---

## Performance Tests

### Test P.1: Budget Tracking Overhead
**Objective:** Ensure tracking doesn't cause performance issues

**Steps:**
1. Start 5+ budget sessions across different tabs
2. Monitor CPU and memory in Task Manager
3. Let run for 5 minutes

**Expected Results:**
- [ ] CPU usage reasonable (<5% average)
- [ ] Memory stable (no leaks)
- [ ] No lag or freezing
- [ ] All sessions track accurately

---

### Test P.2: Storage Size Over Time
**Objective:** Verify history doesn't grow unbounded

**Steps:**
1. Simulate 60 days of history
2. Check storage size

**Expected Results:**
- [ ] History limited to 30 days
- [ ] Old entries pruned automatically
- [ ] Storage size remains reasonable (<1MB)

**Validation:**
```javascript
chrome.storage.local.getBytesInUse(['statistics'], bytes => {
  console.log('Statistics storage:', bytes, 'bytes');
});
```

---

## Accessibility Tests

### Test A.1: Keyboard Navigation
**Objective:** Ensure budget features keyboard accessible

**Steps:**
1. Navigate options page with Tab key
2. Try to interact with budget controls
3. Navigate interstitial with keyboard

**Expected Results:**
- [ ] All buttons focusable
- [ ] Focus visible
- [ ] Enter key works on buttons
- [ ] Tab order logical

---

### Test A.2: Screen Reader Compatibility
**Objective:** Verify labels and aria attributes

**Steps:**
1. Enable screen reader (NVDA/JAWS)
2. Navigate budget sections
3. Listen to announcements

**Expected Results:**
- [ ] Labels read correctly
- [ ] Values announced
- [ ] Notifications accessible
- [ ] Status changes announced

---

## Security Tests

### Test S.1: Storage Access
**Objective:** Ensure storage properly isolated

**Steps:**
1. Try to access extension storage from web page console
2. Try to send malicious messages to extension

**Expected Results:**
- [ ] Storage not accessible from web pages
- [ ] Message validation works
- [ ] No XSS vulnerabilities

---

## Documentation Tests

### Test D.1: User Guide Accuracy
**Objective:** Verify documentation matches implementation

**Steps:**
1. Follow Phase 5 documentation
2. Compare with actual implementation

**Expected Results:**
- [ ] All documented features implemented
- [ ] Screenshots/descriptions accurate
- [ ] No undocumented behavior

---

## Test Summary

| Category | Tests Planned | Tests Passed | Tests Failed | Pass Rate |
|----------|--------------|--------------|--------------|-----------|
| Configuration | 3 | ___ | ___ | ___% |
| Tracking | 6 | ___ | ___ | ___% |
| Exhaustion | 2 | ___ | ___ | ___% |
| Warnings | 3 | ___ | ___ | ___% |
| Reset | 3 | ___ | ___ | ___% |
| History | 3 | ___ | ___ | ___% |
| Edge Cases | 4 | ___ | ___ | ___% |
| Integration | 3 | ___ | ___ | ___% |
| Performance | 2 | ___ | ___ | ___% |
| Accessibility | 2 | ___ | ___ | ___% |
| Security | 1 | ___ | ___ | ___% |
| **TOTAL** | **32** | ___ | ___ | ___% |

---

## Critical Issues Found

| Issue # | Severity | Description | Status |
|---------|----------|-------------|--------|
| | | | |

---

## Notes and Observations

---

## Sign-off

**Tester:** ________________  
**Date:** ________________  
**Phase 5 Complete:** [ ] YES [ ] NO

---

## Automated Test Snippets

### Quick Budget Status Check
```javascript
// Run in service worker console
async function checkBudgetStatus() {
  const status = await budgetManager.getRemainingBudget();
  const sessions = budgetManager.getActiveSessions();
  
  console.log('=== Budget Status ===');
  console.log('Date:', status.date);
  console.log('Total:', status.total, 'minutes');
  console.log('Used:', status.used.toFixed(2), 'minutes');
  console.log('Remaining:', status.global.toFixed(2), 'minutes');
  console.log('Active Sessions:', sessions.length);
  console.log('Sessions:', sessions);
  
  return { status, sessions };
}

checkBudgetStatus();
```

### Force Budget Reset (Testing)
```javascript
// Run in service worker console
async function resetBudgetNow() {
  await budgetManager.resetDailyBudget();
  console.log('Budget reset complete');
  const status = await budgetManager.getRemainingBudget();
  console.log('New status:', status);
}

resetBudgetNow();
```

### Check Budget History
```javascript
// Run in service worker console
async function showBudgetHistory() {
  const history = await budgetManager.getBudgetHistory(30);
  console.table(history);
  return history;
}

showBudgetHistory();
```

### Simulate Budget Usage (Testing)
```javascript
// Run in service worker console
async function simulateBudgetUse(minutes) {
  if (!budgetManager.todaysBudget) {
    await budgetManager.checkDailyReset();
  }
  
  budgetManager.todaysBudget.used += minutes;
  await budgetManager.saveBudgetData();
  
  console.log(`Simulated ${minutes} minutes of usage`);
  const status = await budgetManager.getRemainingBudget();
  console.log('New remaining:', status.global.toFixed(2), 'minutes');
}

// Use 10 minutes
simulateBudgetUse(10);
```

---

## Next Steps After Testing

1. [ ] Fix any critical bugs found
2. [ ] Update documentation with actual behavior
3. [ ] Create user guide for budget feature
4. [ ] Update PHASE5-COMPLETE.md
5. [ ] Proceed to Phase 6: Complete UI/UX
