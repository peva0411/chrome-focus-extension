# Development Guide

## Chrome Extension Basics

### Manifest V3
This extension uses Manifest V3, which has some key differences from V2:
- Service workers instead of background pages
- declarativeNetRequest instead of webRequest
- Different permission model

### File Organization

- **manifest.json** - Extension configuration
- **src/background/** - Service worker (background logic)
- **src/popup/** - Extension popup UI
- **src/options/** - Settings page
- **src/common/** - Shared utilities and storage

## Development Tips

### Reloading Changes
After making changes:
1. Go to `chrome://extensions`
2. Find Focus Extension
3. Click the refresh icon

### Debugging Service Worker
1. Navigate to `chrome://extensions`
2. Find Focus Extension
3. Click "Inspect views: service worker"
4. Use Console tab for logs

### Testing Storage
```javascript
// In service worker console
chrome.storage.local.get(null, (data) => console.log(data));
```

### Common Patterns

#### Sending Messages
```javascript
chrome.runtime.sendMessage(
  { type: 'ACTION_NAME', data: {...} },
  response => console.log(response)
);
```

#### Listening for Messages
```javascript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle message
  sendResponse({ success: true });
  return true; // Required for async response
});
```

## Storage Layer

The extension uses a custom `StorageManager` class that wraps Chrome's storage API:

```javascript
import { storage } from '../common/storage.js';
import { STORAGE_KEYS } from '../common/constants.js';

// Get data
const settings = await storage.get(STORAGE_KEYS.SETTINGS);

// Set data
await storage.set(STORAGE_KEYS.SETTINGS, { enabled: true });

// Listen for changes
const unsubscribe = storage.onChange((changes, areaName) => {
  console.log('Storage changed:', changes);
});
```

## Utilities

### Logger
```javascript
import { Logger } from '../common/logger.js';

const logger = new Logger('MyComponent');
logger.info('Something happened');
logger.error('Error occurred', error);
```

### Time Utilities
```javascript
import { getCurrentDate, formatMinutes } from '../common/utils.js';

const today = getCurrentDate(); // "2026-01-14"
const formatted = formatMinutes(90); // "1h 30m"
```

## Testing

### Manual Testing Checklist

1. Extension loads without errors
2. Service worker is active
3. Popup opens and displays correctly
4. Options page loads
5. Storage is initialized properly
6. No console errors in any context

### Console Testing

```javascript
// Test service worker communication
chrome.runtime.sendMessage({ type: 'PING' }, response => {
  console.log('Service worker responded:', response);
});

// Check storage
const settings = await chrome.storage.local.get('settings');
console.log(settings);
```

## Icon Development

Current icons are SVG placeholders. To convert to PNG:

1. Use an online tool like CloudConvert
2. Or use the provided PowerShell script in `src/assets/icons/create-icons.ps1`
3. Update manifest.json to reference .png files

## Common Issues

### Service Worker Won't Start
- Check manifest.json syntax
- Verify file paths are correct
- Look for import errors in service-worker.js

### Storage Not Working
- Check permissions in manifest.json
- Verify storage.initialize() is called
- Check browser console for errors

### Popup Not Opening
- Verify popup.html path in manifest.json
- Check for JavaScript errors in popup.js
- Ensure all imports are using correct paths

## Next Steps

Proceed to [Phase 2: Core Blocking](../plans/02-core-blocking.md)
