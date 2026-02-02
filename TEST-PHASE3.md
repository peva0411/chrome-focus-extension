# Phase 3 Testing Guide

## Quick Testing Instructions

### Step 1: Reload the Extension
1. Navigate to `chrome://extensions`
2. Click the reload button on the Focus Extension card
3. Verify no errors in the extension card

### Step 2: Test Options Page
1. Click "Details" on the Focus Extension
2. Click "Extension options" OR right-click extension icon → "Options"
3. Options page should open with the new UI

### Step 3: Test Adding Sites

#### Manual Add
1. In the "Add Website to Block" field, enter: `twitter.com`
2. Click "Add Site"
3. Site should appear in the list below
4. Add a few more: `reddit.com`, `youtube.com/watch`

#### Category Add
1. Click "Social Media" button
2. Confirm the prompt (adds 9 sites)
3. Sites should appear in the list

### Step 4: Test Site Management

#### Toggle Enable/Disable
1. Find a site in the list
2. Click the toggle switch
3. Site should become grayed out (disabled)
4. Click again to re-enable

#### Delete Site
1. Click the trash icon (🗑️) on a site
2. Confirm the deletion prompt
3. Site should be removed from list

#### Search
1. Type "youtube" in the search box
2. List should filter to only show matching sites
3. Clear search to show all sites

#### Filter by Status
1. Use the dropdown to select "Enabled Only"
2. Only enabled sites should show
3. Try "Disabled Only"
4. Try "All Sites" to reset

### Step 5: Test Bulk Operations

1. **Enable All**: Click "Enable All" → all sites should be enabled
2. **Disable All**: Click "Disable All" → all sites should be disabled  
3. **Delete All**: Click "Delete All" → confirm → all sites deleted

### Step 6: Test Import/Export

#### Export
1. Add a few test sites
2. Click "📥 Export Block List"
3. JSON file should download
4. Open file to verify it contains your sites

#### Import
1. Click "📤 Import Block List"
2. Select the JSON file you just exported
3. Confirm the import
4. Sites should be added (or message about duplicates)

### Step 7: Test Popup Quick-Add

1. Click the extension icon to open popup
2. Navigate to a website (e.g., `example.com`)
3. Click "Add Site" button in popup
4. Confirm the prompt
5. Should show "example.com added to block list"
6. Open options to verify site was added

### Step 8: Test Tab Navigation

1. In options page, click each tab:
   - Blocked Sites (should show your UI)
   - Schedules (placeholder)
   - Time Budget (placeholder)
   - Settings (placeholder)
   - Statistics (placeholder)

### Step 9: Test Blocking Still Works

1. Add `example.com` to your block list
2. Make sure it's enabled (toggle on)
3. Navigate to `https://example.com`
4. Should be redirected to blocked page
5. Blocked page should show the site pattern

### Step 10: Check Console

1. Right-click on options page → Inspect
2. Check Console tab for errors
3. Right-click on popup → Inspect
4. Check Console tab for errors

## Expected Results

✅ **All features work without errors**
✅ **Sites can be added, toggled, and deleted**
✅ **Categories add multiple sites**
✅ **Search and filter work correctly**
✅ **Import/export produces valid JSON**
✅ **Quick-add from popup works**
✅ **Blocking still functions with new UI**
✅ **No console errors**

## Common Issues & Solutions

### Issue: "Cannot read property of undefined"
- **Solution**: Reload the extension (chrome://extensions)

### Issue: Popup quick-add doesn't work
- **Solution**: Make sure you're on a valid website (not chrome:// pages)

### Issue: Import fails
- **Solution**: Ensure JSON file format is correct (array of site objects)

### Issue: Sites not blocking after adding
- **Solution**: Check that site is enabled (toggle should be blue)

### Issue: Options page won't open
- **Solution**: Check manifest.json has `"options_page": "src/options/options.html"`

## Responsive Design Testing

1. Open options page
2. Resize browser window to narrow width
3. Verify:
   - Tabs scroll horizontally
   - Forms stack vertically
   - Site items remain readable
   - Buttons don't overlap

## Performance Testing

1. Add 50+ sites to block list
2. Verify page remains responsive
3. Test search with large list
4. Test bulk operations with many sites

## Browser Console Commands

Test backend directly from console:

```javascript
// Get all sites
chrome.runtime.sendMessage({type: 'GET_BLOCKED_SITES'}, console.log)

// Add a site
chrome.runtime.sendMessage({type: 'ADD_BLOCKED_SITE', data: {pattern: 'test.com'}}, console.log)

// Check active rules
chrome.declarativeNetRequest.getDynamicRules().then(console.log)
```

## Ready for Next Phase?

Once all tests pass:
1. Commit changes: `git add . && git commit -m "Phase 3: Dynamic site management"`
2. Update PHASE3-COMPLETE.md with test results
3. Proceed to Phase 4: Scheduling System
