# Schedule Fix Instructions

## The Problem
The HTML diagnostic page doesn't work when opened as a file because Chrome extension APIs only work within the extension context.

## Solution: Use Console Script

### Step 1: Open Browser Console
1. Press **F12** (or right-click → Inspect)
2. Go to the **Console** tab

### Step 2: Run Diagnostic Script

**Option A: Copy from file**
1. Open: `diagnostic.js`
2. Select all (Ctrl+A)
3. Copy (Ctrl+C)
4. Paste into console (Ctrl+V)
5. Press Enter

**Option B: Quick one-liner**
Paste this into the console:
```javascript
fetch('file:///C:/projects/focus-ext/diagnostic.js').then(r=>r.text()).then(eval)
```

### Step 3: Review Results

The diagnostic will show:
- ✅ What's working
- ❌ What's broken
- 🔧 How to fix it

### Step 4: Use Fix Commands

After the diagnostic runs, you can use these commands:

**If sites are blocked when they shouldn't be:**
```javascript
fixNow()
```

**To check if the schedule alarm is running:**
```javascript
checkAlarms()
```

**To see your schedule configuration:**
```javascript
viewSchedule()
```

**To reload the extension with the fixes:**
```javascript
reloadExtension()
```

## Quick Fix Right Now

If you just want to unblock sites immediately, paste this:

```javascript
chrome.declarativeNetRequest.getDynamicRules(rules => {
  chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: rules.map(r => r.id),
    addRules: []
  });
  console.log('✅ UNBLOCKED! Refresh your pages.');
});
```

## After Applying Fixes

1. **Reload the extension**: Go to `chrome://extensions/` and click Reload
2. **Run the diagnostic again** to verify everything is working
3. **Check the service worker console** to see schedule checks happening every minute

Look for logs like:
```
Schedule alarm created - will check every minute
Schedule check at [time]: shouldBlock = false
Blocking disabled by schedule
```

---

**Start by running the diagnostic script in your browser console!**
