# Schedule Debugging Guide

## Changes Made

The schedule integration has been completely rewritten to fix the blocking issue:

### Before (Broken)
- Schedule manager sent messages that were often ignored
- Blocking manager never received schedule state changes
- Rules remained active even outside schedule

### After (Fixed)
- Schedule manager directly calls blocking manager
- No unreliable message passing
- Rules are added/removed based on schedule state

## How to Test

### 1. Reload the Extension

Go to `chrome://extensions/` and click the reload button for Focus Extension.

### 2. Open Browser Console

Press F12 and go to the Console tab to see logs.

### 3. Check Service Worker Logs

In `chrome://extensions/`, click "service worker" under the Focus extension to see background logs.

### 4. Test Schedule Functionality

#### Option A: Check Current Status

Open the browser console and run:
```javascript
chrome.runtime.sendMessage({ type: 'GET_SCHEDULE_STATUS' }, response => {
  console.log('Schedule Status:', response);
});
```

This will show:
- `shouldBlock`: Whether blocking is active now
- `activeSchedule`: Which schedule is active
- `isPaused`: If manually paused

#### Option B: View Active Schedules

```javascript
chrome.runtime.sendMessage({ type: 'GET_SCHEDULES' }, response => {
  console.log('All Schedules:', response.schedules);
});

chrome.runtime.sendMessage({ type: 'GET_BLOCKED_SITES' }, response => {
  console.log('Blocked Sites:', response.sites);
});
```

#### Option C: Check Active Rules

```javascript
chrome.declarativeNetRequest.getDynamicRules(rules => {
  console.log(`${rules.length} blocking rules active:`, rules);
});
```

If you're outside schedule hours, this should show **0 rules**.

### 5. Create Test Schedule

Create a schedule that ends in a few minutes:

1. Go to extension options
2. Create a new schedule
3. Set end time to be in 2-3 minutes
4. Make it active
5. Block a test site (e.g., `example.com`)
6. Wait for the end time

**Expected behavior:**
- Check the service worker console every minute
- You should see: "Blocking disabled by schedule"
- Rules count should go to 0
- Test site should become accessible

### 6. Watch the Logs

In the service worker console, look for these messages:

**Every minute:**
```
ScheduleManager: Checking schedule state...
ScheduleManager: Should block: true/false
BlockingManager: === setBlockingEnabled called: true/false ===
BlockingManager: ✓ Blocking rules enabled/disabled
```

## Common Issues

### Issue: No logs appearing
**Fix:** Click the "service worker" link in chrome://extensions to open the background console

### Issue: Schedule not changing
**Fix:** 
1. Check that a schedule is set as "active" in options
2. Verify the schedule times cover the current time
3. Remember: Schedule check runs every 60 seconds

### Issue: Sites still blocked after schedule ends
**Fix:**
1. Reload the extension
2. Check service worker console for errors
3. Run the diagnostic commands above

## Manual Toggle Test

You can manually test the blocking enable/disable:

```javascript
// Get blocking manager reference from service worker
// This only works if you run it in the service worker console

// Disable all blocking
await blockingManager.setBlockingEnabled(false);
console.log('Blocking disabled');

// Check rules (should be 0)
chrome.declarativeNetRequest.getDynamicRules(rules => {
  console.log(`Rules: ${rules.length}`);
});

// Re-enable blocking
await blockingManager.setBlockingEnabled(true);
console.log('Blocking enabled');

// Check rules (should be > 0)
chrome.declarativeNetRequest.getDynamicRules(rules => {
  console.log(`Rules: ${rules.length}`);
});
```

## Expected Log Sequence on Extension Load

```
ServiceWorker: Extension initialized successfully
ScheduleManager: Initializing schedule manager...
ScheduleManager: Loaded N schedules
ScheduleManager: Blocking manager reference set
BlockingManager: Initializing blocking manager...
ScheduleManager: Initial schedule check, should block: true/false
BlockingManager: === setBlockingEnabled called: true/false ===
BlockingManager: ✓ Blocking rules enabled/disabled
```
