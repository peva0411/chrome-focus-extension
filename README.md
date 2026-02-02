# Focus Extension

A Chrome browser extension to help maintain productivity by blocking distracting websites.

## Development Setup

### Prerequisites
- Chrome browser (version 110+)
- Text editor (VS Code recommended)
- Git

### Installation

1. Clone the repository:
   ```bash
   git clone [repository-url]
   cd focus-ext
   ```

2. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `focus-ext` directory

3. The extension should now appear in your toolbar

### Project Structure

```
focus-ext/
├── manifest.json          # Extension configuration
├── src/
│   ├── background/        # Service worker (background logic)
│   ├── popup/            # Extension popup UI
│   ├── options/          # Settings page
│   ├── interstitial/     # Blocked site page
│   ├── common/           # Shared utilities and storage
│   └── assets/           # Icons and images
├── tests/                # Unit and integration tests
├── docs/                 # Documentation
└── plans/                # Implementation plans
```

See [plans/00-implementation-overview.md](plans/00-implementation-overview.md) for detailed architecture.

### Development Workflow

1. Make changes to source files
2. Go to `chrome://extensions`
3. Click the refresh icon on the Focus Extension card
4. Test your changes

### Debugging

- **Service Worker**: `chrome://extensions` → Click "Inspect views: service worker"
- **Popup**: Right-click extension icon → Inspect
- **Options Page**: Open options, right-click → Inspect

## Current Status

**Phase 1: Project Setup** ✅ COMPLETE
- Basic extension structure
- Service worker configured
- Storage layer implemented
- Basic popup UI

**Next Phase:** Phase 2 - Core Blocking Implementation

## Features (Planned)

- 🚫 Block distracting websites
- ⏰ Flexible scheduling system
- ⏱️ Time budgets for controlled access
- 📊 Usage statistics
- 🎨 Clean, modern UI

## Contributing

This is currently in active development. See implementation plans in `/plans` directory.

## License

TBD
