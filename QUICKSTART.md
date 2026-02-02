# Quick Start Guide

## Installation (5 minutes)

### Step 1: Load Extension in Chrome

1. Open Google Chrome
2. Navigate to `chrome://extensions`
3. Enable **Developer mode** (toggle switch in top-right corner)
4. Click **"Load unpacked"** button
5. Navigate to and select: `c:\projects\focus-ext`
6. Click **"Select Folder"**

### Step 2: Verify Installation

✅ You should see "Focus Extension" appear in your extensions list
✅ Extension icon should appear in your Chrome toolbar (purple/blue circle)
✅ Status should show "Service Worker (Active)"

If you see any errors, check the troubleshooting section below.

## Testing (5 minutes)

### Test 1: Popup UI
1. Click the Focus Extension icon in your toolbar
2. Popup should open showing:
   - "Focus Extension" header with purple gradient
   - Status: "Active" with green pulsing dot
   - Sites Blocked: 0
   - Time Remaining: 30m
   - Two buttons: "Pause for 15min" and "Block Current Site"
   - Footer links: Settings and Statistics

### Test 2: Options Page
1. In the popup, click "Settings" link
2. Options page should open in a new tab
3. Should show "Options Page Coming Soon" placeholder

### Test 3: Service Worker
1. Go to `chrome://extensions`
2. Find Focus Extension
3. Click "Inspect views: service worker"
4. DevTools console should open
5. You should see log messages like:
   ```
   [timestamp] [ServiceWorker] [INFO] Service worker loaded
   [timestamp] [Storage] [INFO] Storage already initialized
   ```

### Test 4: Storage Verification
In the service worker console (from Test 3), run:
```javascript
chrome.storage.local.get(null, (data) => console.log(data));
```

Expected output:
```javascript
{
  settings: { version: "0.1.0", enabled: true, ... },
  timeBudget: { globalBudget: 30, resetTime: "00:00", ... },
  blockedSites: [],
  schedules: [],
  activeSchedule: null
}
```

### Test 5: Messaging
In the service worker console, run:
```javascript
chrome.runtime.sendMessage({ type: 'PING' }, response => {
  console.log('Response:', response);
});
```

Expected output: `Response: { status: 'ok' }`

## Troubleshooting

### Extension Won't Load
**Error:** "Manifest file is invalid"
- **Solution:** Check that `manifest.json` is valid JSON
- Verify file paths in manifest point to existing files

**Error:** "Service worker failed to start"
- **Solution:** Open service worker inspector and check console for errors
- Verify all imports in `service-worker.js` use correct paths

### Popup Won't Open
- **Solution:** Check popup console (right-click icon → Inspect)
- Verify `popup.html`, `popup.js`, and `popup.css` exist
- Check for JavaScript errors in console

### Icons Not Showing
- **Solution:** SVG icons should work, but if not:
  - Run `src/assets/icons/create-icons.ps1` to generate PNG versions
  - Or convert SVG to PNG using online tools
  - Update manifest.json to use .png extension

### Storage Not Initialized
In service worker console, manually initialize:
```javascript
const module = await import('./src/common/storage.js');
await module.storage.initialize();
```

## What Works Now (Phase 1)

✅ Extension loads and activates
✅ Popup UI displays
✅ Service worker runs
✅ Storage layer functional
✅ Options page opens
✅ Basic messaging works

## What Doesn't Work Yet

❌ No sites are actually blocked (Phase 2)
❌ "Pause" button shows placeholder alert
❌ "Block Current Site" button shows placeholder alert
❌ No schedule management (Phase 4)
❌ No time budget tracking (Phase 5)
❌ No statistics (Phase 6)

## Next Development Phase

Ready to implement **Phase 2: Core Blocking**?

See [plans/02-core-blocking.md](plans/02-core-blocking.md) for the next implementation steps.

Phase 2 adds:
- Actual website blocking using declarativeNetRequest
- Domain matching and validation
- Blocked site interstitial page
- Enable/disable toggle functionality

---

**Need Help?**
- Check [docs/development.md](docs/development.md) for detailed development guide
- Review [plans/00-implementation-overview.md](plans/00-implementation-overview.md) for architecture details
