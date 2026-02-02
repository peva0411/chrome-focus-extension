# Testing Core Blocking Implementation

## ⚠️ IMPORTANT: Where to Run Test Commands

### ✅ CORRECT: Service Worker Console
1. Go to `chrome://extensions/`
2. Click **"service worker"** link on Focus Extension card
3. Run commands in THIS console

### ❌ WRONG: Regular Tab Console
- Do NOT open DevTools on a regular webpage (like google.com)
- Regular pages can't communicate with the extension
- You'll get "Receiving end does not exist" error

---

## Testing Method 1: Direct Function Calls (Recommended)

Use these in the **Service Worker console**:

```javascript
// Test 1: Ping
await testPing();

// Test 2: Add a blocked site
await testAddSite('twitter.com');

// Test 3: Get all blocked sites
await testGetSites();

// Test 4: Check blocking rules
await testGetRules();
```

## Testing Method 2: Message System

**Only works from Service Worker console or extension pages (popup/options):**

```javascript
chrome.runtime.sendMessage(
  { type: 'GET_BLOCKED_SITES' },
  response => console.log('Sites:', response.sites)
);
```

## Step 6: Test Blocking

1. Open a new tab
2. Navigate to `twitter.com`
3. You should be redirected to the blocked page

---

## ✅ Full Test Sequence (Copy & Paste)

**In Service Worker Console:**

```javascript
// 1. Add twitter to block list
await testAddSite('twitter.com');

// 2. Verify it was added
await testGetSites();

// 3. Check the blocking rule was created
await testGetRules();

// 4. Now open a new tab and go to twitter.com - should be blocked!
```

**To remove the site:**

```javascript
// Get the site ID from testGetSites() output
const sites = await testGetSites();
const twitterSite = sites.sites.find(s => s.pattern === 'twitter.com');

// Remove it (replace SITE_ID with actual ID)
chrome.runtime.sendMessage(
  { type: 'REMOVE_BLOCKED_SITE', data: { siteId: twitterSite.id } },
  response => console.log(response)
);
```

---

### Issue: "Receiving end does not exist"
**Cause:** Service worker crashed or not loaded  
**Solution:** 
- Check for errors in service worker console
- Reload extension
- Check if all imports are working

### Issue: No rules showing
**Cause:** Storage not initialized or blocking manager failed  
**Solution:**
```javascript
// Force initialize
chrome.runtime.sendMessage({ type: 'GET_BLOCKED_SITES' }, response => {
  console.log('Blocked sites:', response);
});
```

### Issue: Import errors
**Cause:** Module paths incorrect  
**Solution:** Check manifest.json has `"type": "module"` in background section

## Debug Commands

### Get all blocked sites:
```javascript
chrome.runtime.sendMessage(
  { type: 'GET_BLOCKED_SITES' },
  response => console.log('Sites:', response.sites)
);
```

### Remove a site:
```javascript
chrome.runtime.sendMessage(
  { 
    type: 'REMOVE_BLOCKED_SITE', 
    data: { siteId: 'SITE_ID_HERE' } 
  },
  response => console.log('Remove response:', response)
);
```

### Check storage directly:
```javascript
chrome.storage.local.get('blockedSites', data => {
  console.log('Blocked sites in storage:', data.blockedSites);
});
```

## Expected Behavior

✅ Service worker console shows no errors  
✅ PING message returns `{ status: 'ok' }`  
✅ Adding site returns site object with ID  
✅ Rules are created in declarativeNetRequest  
✅ Navigating to blocked site shows interstitial page  
✅ Block counter increments  
✅ "Go Back" button works  
✅ "Remove from Block List" removes site and redirects  
