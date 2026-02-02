# Phase 3: Dynamic Site Management

**Status:** Ready to Start  
**Estimated Time:** 4-5 days  
**Dependencies:** Phase 2 (Core Blocking)

---

## Overview

This phase builds the user interface for managing blocked websites. Users will be able to add, remove, enable/disable, and organize their blocked site lists through both the popup and options page.

---

## Objectives

1. Create comprehensive site management UI in options page
2. Implement quick-add from popup
3. Add import/export functionality
4. Create preset category lists
5. Add search and filter capabilities
6. Enable bulk operations

---

## Requirements

### Must Complete

- [ ] Options page displays all blocked sites in a list
- [ ] Add new sites via text input with validation
- [ ] Remove sites with confirmation
- [ ] Toggle individual sites enabled/disabled
- [ ] Quick-add current tab from popup
- [ ] Import/export block lists (JSON)
- [ ] Preset categories (Social Media, News, Gaming, etc.)
- [ ] Real-time search/filter
- [ ] Site statistics display (block count, added date)

### Nice to Have

- [ ] Bulk select and operations
- [ ] Drag-and-drop reordering
- [ ] Tags/categories for organization
- [ ] Site preview/favicon
- [ ] Undo delete functionality

---

## Implementation Tasks

### 1. Options Page - Blocked Sites Section

#### 1.1 Update src/options/options.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Focus Extension - Settings</title>
  <link rel="stylesheet" href="options.css">
</head>
<body>
  <div class="container">
    <header>
      <h1>⚡ Focus Extension</h1>
      <p class="subtitle">Manage your productivity settings</p>
    </header>

    <nav class="tabs">
      <button class="tab-btn active" data-tab="sites">Blocked Sites</button>
      <button class="tab-btn" data-tab="schedules">Schedules</button>
      <button class="tab-btn" data-tab="budget">Time Budget</button>
      <button class="tab-btn" data-tab="settings">Settings</button>
      <button class="tab-btn" data-tab="stats">Statistics</button>
    </nav>

    <main>
      <!-- BLOCKED SITES TAB -->
      <section id="tab-sites" class="tab-content active">
        <div class="section-header">
          <h2>Blocked Websites</h2>
          <p>Manage which sites are blocked during your focus time</p>
        </div>

        <!-- Add Site Form -->
        <div class="card">
          <h3>Add Website to Block</h3>
          <form id="add-site-form" class="form-inline">
            <input
              type="text"
              id="site-pattern-input"
              placeholder="e.g., twitter.com, *.reddit.com, youtube.com/watch"
              class="input"
            />
            <button type="submit" class="btn btn-primary">Add Site</button>
          </form>
          <div class="help-text">
            <strong>Pattern examples:</strong>
            <ul>
              <li><code>twitter.com</code> - Blocks entire domain and all subdomains</li>
              <li><code>*.reddit.com</code> - Blocks all Reddit subdomains</li>
              <li><code>youtube.com/watch</code> - Blocks only YouTube watch pages</li>
            </ul>
          </div>
        </div>

        <!-- Preset Categories -->
        <div class="card">
          <h3>Quick Add Categories</h3>
          <div class="category-buttons">
            <button class="btn btn-secondary category-btn" data-category="social">
              Social Media
            </button>
            <button class="btn btn-secondary category-btn" data-category="news">
              News Sites
            </button>
            <button class="btn btn-secondary category-btn" data-category="video">
              Video Streaming
            </button>
            <button class="btn btn-secondary category-btn" data-category="gaming">
              Gaming
            </button>
            <button class="btn btn-secondary category-btn" data-category="shopping">
              Shopping
            </button>
          </div>
        </div>

        <!-- Import/Export -->
        <div class="card">
          <h3>Import / Export</h3>
          <div class="import-export-controls">
            <button id="export-btn" class="btn btn-secondary">
              📥 Export Block List
            </button>
            <label class="btn btn-secondary" for="import-file-input">
              📤 Import Block List
            </label>
            <input type="file" id="import-file-input" accept=".json" style="display: none;">
          </div>
        </div>

        <!-- Search and Filter -->
        <div class="card">
          <div class="search-controls">
            <input
              type="text"
              id="search-sites-input"
              placeholder="Search blocked sites..."
              class="input"
            />
            <select id="filter-status" class="select">
              <option value="all">All Sites</option>
              <option value="enabled">Enabled Only</option>
              <option value="disabled">Disabled Only</option>
            </select>
          </div>
        </div>

        <!-- Blocked Sites List -->
        <div class="card">
          <div class="list-header">
            <h3>Your Blocked Sites (<span id="site-count">0</span>)</h3>
            <div class="bulk-actions">
              <button id="enable-all-btn" class="btn-text">Enable All</button>
              <button id="disable-all-btn" class="btn-text">Disable All</button>
              <button id="delete-all-btn" class="btn-text text-danger">Delete All</button>
            </div>
          </div>
          
          <div id="sites-list-container">
            <!-- Sites will be rendered here -->
          </div>

          <div id="empty-state" class="empty-state" style="display: none;">
            <p>No blocked sites yet.</p>
            <p>Add a site above or choose a category to get started.</p>
          </div>
        </div>
      </section>

      <!-- OTHER TABS (Placeholders for now) -->
      <section id="tab-schedules" class="tab-content">
        <h2>Schedules</h2>
        <p>Coming in Phase 4</p>
      </section>

      <section id="tab-budget" class="tab-content">
        <h2>Time Budget</h2>
        <p>Coming in Phase 5</p>
      </section>

      <section id="tab-settings" class="tab-content">
        <h2>General Settings</h2>
        <p>Coming in Phase 6</p>
      </section>

      <section id="tab-stats" class="tab-content">
        <h2>Statistics</h2>
        <p>Coming in Phase 6</p>
      </section>
    </main>
  </div>

  <script src="options.js" type="module"></script>
</body>
</html>
```

#### 1.2 Create src/options/options.css

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
    Ubuntu, Cantarell, sans-serif;
  background: #f1f5f9;
  color: #1e293b;
  line-height: 1.6;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 40px 20px;
}

/* Header */
header {
  text-align: center;
  margin-bottom: 40px;
}

header h1 {
  font-size: 36px;
  font-weight: 700;
  color: #667eea;
  margin-bottom: 8px;
}

.subtitle {
  color: #64748b;
  font-size: 16px;
}

/* Tabs Navigation */
.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 32px;
  background: white;
  padding: 8px;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow-x: auto;
}

.tab-btn {
  flex: 1;
  padding: 12px 24px;
  border: none;
  background: transparent;
  color: #64748b;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s;
  white-space: nowrap;
}

.tab-btn:hover {
  background: #f8fafc;
  color: #667eea;
}

.tab-btn.active {
  background: #667eea;
  color: white;
}

/* Tab Content */
.tab-content {
  display: none;
}

.tab-content.active {
  display: block;
}

.section-header {
  margin-bottom: 24px;
}

.section-header h2 {
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 8px;
}

.section-header p {
  color: #64748b;
}

/* Cards */
.card {
  background: white;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  margin-bottom: 24px;
}

.card h3 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 16px;
  color: #1e293b;
}

/* Forms */
.form-inline {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.input {
  flex: 1;
  padding: 10px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.select {
  padding: 10px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  background: white;
  cursor: pointer;
}

/* Buttons */
.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.btn:active {
  transform: translateY(0);
}

.btn-primary {
  background: #667eea;
  color: white;
}

.btn-primary:hover {
  background: #5568d3;
}

.btn-secondary {
  background: #f8fafc;
  color: #667eea;
  border: 1px solid #e2e8f0;
}

.btn-secondary:hover {
  background: #e2e8f0;
}

.btn-text {
  background: none;
  border: none;
  color: #667eea;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  padding: 4px 8px;
}

.btn-text:hover {
  text-decoration: underline;
}

.text-danger {
  color: #ef4444;
}

/* Help Text */
.help-text {
  font-size: 13px;
  color: #64748b;
  background: #f8fafc;
  padding: 12px;
  border-radius: 6px;
  border-left: 3px solid #667eea;
}

.help-text ul {
  margin-top: 8px;
  margin-left: 20px;
}

.help-text code {
  background: #e2e8f0;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
}

/* Category Buttons */
.category-buttons {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.category-btn {
  flex: 1;
  min-width: 150px;
}

/* Import/Export */
.import-export-controls {
  display: flex;
  gap: 12px;
}

/* Search Controls */
.search-controls {
  display: flex;
  gap: 12px;
}

.search-controls .input {
  flex: 2;
}

.search-controls .select {
  flex: 1;
}

/* List Header */
.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.bulk-actions {
  display: flex;
  gap: 16px;
}

/* Sites List */
#sites-list-container {
  max-height: 600px;
  overflow-y: auto;
}

.site-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  margin-bottom: 8px;
  transition: all 0.2s;
}

.site-item:hover {
  border-color: #667eea;
  background: #f8fafc;
}

.site-item.disabled {
  opacity: 0.5;
}

.site-info {
  flex: 1;
  min-width: 0;
}

.site-pattern {
  font-weight: 600;
  font-size: 15px;
  color: #1e293b;
  margin-bottom: 4px;
  word-break: break-all;
}

.site-meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #64748b;
}

.site-meta span {
  display: flex;
  align-items: center;
  gap: 4px;
}

.site-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.toggle-switch {
  position: relative;
  width: 44px;
  height: 24px;
  background: #cbd5e1;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.2s;
}

.toggle-switch.active {
  background: #667eea;
}

.toggle-switch::after {
  content: '';
  position: absolute;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: white;
  top: 2px;
  left: 2px;
  transition: transform 0.2s;
}

.toggle-switch.active::after {
  transform: translateX(20px);
}

.btn-icon {
  padding: 8px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 18px;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.btn-icon:hover {
  opacity: 1;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 48px 24px;
  color: #94a3b8;
}

.empty-state p {
  margin-bottom: 8px;
}

/* Responsive */
@media (max-width: 768px) {
  .container {
    padding: 20px 12px;
  }

  .tabs {
    overflow-x: scroll;
  }

  .form-inline {
    flex-direction: column;
  }

  .category-buttons {
    flex-direction: column;
  }

  .import-export-controls {
    flex-direction: column;
  }

  .search-controls {
    flex-direction: column;
  }

  .site-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .site-actions {
    width: 100%;
    justify-content: flex-end;
  }
}
```

#### 1.3 Create src/options/options.js

```javascript
import { Logger } from '../common/logger.js';
import { STORAGE_KEYS } from '../common/constants.js';

const logger = new Logger('Options');

/**
 * Preset categories with common distracting sites
 */
const PRESET_CATEGORIES = {
  social: {
    name: 'Social Media',
    sites: [
      'facebook.com',
      '*.facebook.com',
      'twitter.com',
      'x.com',
      'instagram.com',
      'tiktok.com',
      'linkedin.com',
      'snapchat.com',
      'reddit.com'
    ]
  },
  news: {
    name: 'News Sites',
    sites: [
      'cnn.com',
      'bbc.com',
      'nytimes.com',
      'theguardian.com',
      'reuters.com',
      'foxnews.com',
      'news.ycombinator.com'
    ]
  },
  video: {
    name: 'Video Streaming',
    sites: [
      'youtube.com/watch',
      'netflix.com',
      'twitch.tv',
      'hulu.com',
      'disneyplus.com',
      'primevideo.com'
    ]
  },
  gaming: {
    name: 'Gaming',
    sites: [
      'steam.com',
      'epicgames.com',
      'twitch.tv',
      'ign.com',
      'gamespot.com',
      'kotaku.com'
    ]
  },
  shopping: {
    name: 'Shopping',
    sites: [
      'amazon.com',
      'ebay.com',
      'walmart.com',
      'target.com',
      'aliexpress.com',
      'etsy.com'
    ]
  }
};

/**
 * Options Page Controller
 */
class OptionsController {
  constructor() {
    this.blockedSites = [];
    this.filteredSites = [];
    this.currentFilter = 'all';
    this.searchQuery = '';

    this.elements = {
      // Tabs
      tabButtons: document.querySelectorAll('.tab-btn'),
      tabContents: document.querySelectorAll('.tab-content'),

      // Add site form
      addSiteForm: document.getElementById('add-site-form'),
      sitePatternInput: document.getElementById('site-pattern-input'),

      // Category buttons
      categoryButtons: document.querySelectorAll('.category-btn'),

      // Import/Export
      exportBtn: document.getElementById('export-btn'),
      importFileInput: document.getElementById('import-file-input'),

      // Search and filter
      searchInput: document.getElementById('search-sites-input'),
      filterStatus: document.getElementById('filter-status'),

      // List
      sitesListContainer: document.getElementById('sites-list-container'),
      siteCount: document.getElementById('site-count'),
      emptyState: document.getElementById('empty-state'),

      // Bulk actions
      enableAllBtn: document.getElementById('enable-all-btn'),
      disableAllBtn: document.getElementById('disable-all-btn'),
      deleteAllBtn: document.getElementById('delete-all-btn')
    };

    this.init();
  }

  async init() {
    logger.info('Options page initialized');

    // Set up tabs
    this.setupTabs();

    // Load blocked sites
    await this.loadBlockedSites();

    // Set up event listeners
    this.setupListeners();

    // Render sites list
    this.renderSitesList();
  }

  setupTabs() {
    this.elements.tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tabName = btn.dataset.tab;
        this.switchTab(tabName);
      });
    });
  }

  switchTab(tabName) {
    // Update buttons
    this.elements.tabButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update content
    this.elements.tabContents.forEach(content => {
      content.classList.toggle('active', content.id === `tab-${tabName}`);
    });
  }

  async loadBlockedSites() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_BLOCKED_SITES'
      });

      this.blockedSites = response.sites || [];
      this.applyFilters();
      
      logger.info(`Loaded ${this.blockedSites.length} blocked sites`);
    } catch (error) {
      logger.error('Failed to load blocked sites:', error);
      this.showNotification('Failed to load blocked sites', 'error');
    }
  }

  setupListeners() {
    // Add site form
    this.elements.addSiteForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleAddSite();
    });

    // Category buttons
    this.elements.categoryButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const category = btn.dataset.category;
        this.handleAddCategory(category);
      });
    });

    // Export button
    this.elements.exportBtn.addEventListener('click', () => {
      this.handleExport();
    });

    // Import file input
    this.elements.importFileInput.addEventListener('change', (e) => {
      this.handleImport(e.target.files[0]);
    });

    // Search input
    this.elements.searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase();
      this.applyFilters();
      this.renderSitesList();
    });

    // Filter dropdown
    this.elements.filterStatus.addEventListener('change', (e) => {
      this.currentFilter = e.target.value;
      this.applyFilters();
      this.renderSitesList();
    });

    // Bulk actions
    this.elements.enableAllBtn.addEventListener('click', () => {
      this.handleBulkToggle(true);
    });

    this.elements.disableAllBtn.addEventListener('click', () => {
      this.handleBulkToggle(false);
    });

    this.elements.deleteAllBtn.addEventListener('click', () => {
      this.handleDeleteAll();
    });
  }

  async handleAddSite() {
    const pattern = this.elements.sitePatternInput.value.trim();

    if (!pattern) {
      this.showNotification('Please enter a website pattern', 'error');
      return;
    }

    try {
      await chrome.runtime.sendMessage({
        type: 'ADD_BLOCKED_SITE',
        data: { pattern }
      });

      this.elements.sitePatternInput.value = '';
      await this.loadBlockedSites();
      this.renderSitesList();
      this.showNotification(`Added ${pattern} to block list`, 'success');
    } catch (error) {
      logger.error('Failed to add site:', error);
      this.showNotification(error.message || 'Failed to add site', 'error');
    }
  }

  async handleAddCategory(categoryName) {
    const category = PRESET_CATEGORIES[categoryName];
    if (!category) return;

    const confirmed = confirm(
      `Add ${category.sites.length} sites from "${category.name}" category?`
    );

    if (!confirmed) return;

    let added = 0;
    let skipped = 0;

    for (const pattern of category.sites) {
      try {
        await chrome.runtime.sendMessage({
          type: 'ADD_BLOCKED_SITE',
          data: { pattern }
        });
        added++;
      } catch (error) {
        logger.warn(`Skipped ${pattern}:`, error.message);
        skipped++;
      }
    }

    await this.loadBlockedSites();
    this.renderSitesList();
    this.showNotification(
      `Added ${added} sites (${skipped} skipped)`,
      'success'
    );
  }

  handleExport() {
    const dataStr = JSON.stringify(this.blockedSites, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `focus-extension-blocklist-${Date.now()}.json`;
    link.click();

    URL.revokeObjectURL(url);
    this.showNotification('Block list exported', 'success');
  }

  async handleImport(file) {
    if (!file) return;

    try {
      const text = await file.text();
      const importedSites = JSON.parse(text);

      if (!Array.isArray(importedSites)) {
        throw new Error('Invalid file format');
      }

      const confirmed = confirm(
        `Import ${importedSites.length} sites? This will add to your existing list.`
      );

      if (!confirmed) return;

      let added = 0;
      for (const site of importedSites) {
        try {
          await chrome.runtime.sendMessage({
            type: 'ADD_BLOCKED_SITE',
            data: { pattern: site.pattern }
          });
          added++;
        } catch (error) {
          logger.warn(`Skipped ${site.pattern}`);
        }
      }

      await this.loadBlockedSites();
      this.renderSitesList();
      this.showNotification(`Imported ${added} sites`, 'success');
    } catch (error) {
      logger.error('Import failed:', error);
      this.showNotification('Failed to import file', 'error');
    }

    // Reset file input
    this.elements.importFileInput.value = '';
  }

  applyFilters() {
    this.filteredSites = this.blockedSites.filter(site => {
      // Apply status filter
      if (this.currentFilter === 'enabled' && !site.enabled) return false;
      if (this.currentFilter === 'disabled' && site.enabled) return false;

      // Apply search filter
      if (this.searchQuery && !site.pattern.toLowerCase().includes(this.searchQuery)) {
        return false;
      }

      return true;
    });
  }

  renderSitesList() {
    this.elements.siteCount.textContent = this.blockedSites.length;

    if (this.filteredSites.length === 0) {
      this.elements.sitesListContainer.style.display = 'none';
      this.elements.emptyState.style.display = 'block';
      return;
    }

    this.elements.sitesListContainer.style.display = 'block';
    this.elements.emptyState.style.display = 'none';

    this.elements.sitesListContainer.innerHTML = this.filteredSites
      .map(site => this.createSiteItemHTML(site))
      .join('');

    // Attach event listeners to newly created elements
    this.attachSiteItemListeners();
  }

  createSiteItemHTML(site) {
    const addedDate = new Date(site.addedDate).toLocaleDateString();

    return `
      <div class="site-item ${site.enabled ? '' : 'disabled'}" data-site-id="${site.id}">
        <div class="site-info">
          <div class="site-pattern">${this.escapeHtml(site.pattern)}</div>
          <div class="site-meta">
            <span>📅 Added ${addedDate}</span>
            <span>🚫 Blocked ${site.blockCount || 0} times</span>
          </div>
        </div>
        <div class="site-actions">
          <div class="toggle-switch ${site.enabled ? 'active' : ''}" data-action="toggle"></div>
          <button class="btn-icon" data-action="delete" title="Delete">🗑️</button>
        </div>
      </div>
    `;
  }

  attachSiteItemListeners() {
    const siteItems = this.elements.sitesListContainer.querySelectorAll('.site-item');

    siteItems.forEach(item => {
      const siteId = item.dataset.siteId;

      // Toggle switch
      const toggle = item.querySelector('[data-action="toggle"]');
      toggle.addEventListener('click', () => this.handleToggleSite(siteId));

      // Delete button
      const deleteBtn = item.querySelector('[data-action="delete"]');
      deleteBtn.addEventListener('click', () => this.handleDeleteSite(siteId));
    });
  }

  async handleToggleSite(siteId) {
    const site = this.blockedSites.find(s => s.id === siteId);
    if (!site) return;

    try {
      await chrome.runtime.sendMessage({
        type: 'TOGGLE_SITE',
        data: { siteId, enabled: !site.enabled }
      });

      await this.loadBlockedSites();
      this.renderSitesList();
    } catch (error) {
      logger.error('Failed to toggle site:', error);
      this.showNotification('Failed to toggle site', 'error');
    }
  }

  async handleDeleteSite(siteId) {
    const site = this.blockedSites.find(s => s.id === siteId);
    if (!site) return;

    const confirmed = confirm(`Remove "${site.pattern}" from block list?`);
    if (!confirmed) return;

    try {
      await chrome.runtime.sendMessage({
        type: 'REMOVE_BLOCKED_SITE',
        data: { siteId }
      });

      await this.loadBlockedSites();
      this.renderSitesList();
      this.showNotification('Site removed', 'success');
    } catch (error) {
      logger.error('Failed to delete site:', error);
      this.showNotification('Failed to delete site', 'error');
    }
  }

  async handleBulkToggle(enabled) {
    const action = enabled ? 'enable' : 'disable';
    const confirmed = confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} all sites?`);
    if (!confirmed) return;

    try {
      for (const site of this.blockedSites) {
        await chrome.runtime.sendMessage({
          type: 'TOGGLE_SITE',
          data: { siteId: site.id, enabled }
        });
      }

      await this.loadBlockedSites();
      this.renderSitesList();
      this.showNotification(`All sites ${action}d`, 'success');
    } catch (error) {
      logger.error('Bulk toggle failed:', error);
      this.showNotification('Bulk operation failed', 'error');
    }
  }

  async handleDeleteAll() {
    const confirmed = confirm(
      'Delete ALL blocked sites? This cannot be undone.\n\nConsider exporting your list first.'
    );
    if (!confirmed) return;

    try {
      for (const site of this.blockedSites) {
        await chrome.runtime.sendMessage({
          type: 'REMOVE_BLOCKED_SITE',
          data: { siteId: site.id }
        });
      }

      await this.loadBlockedSites();
      this.renderSitesList();
      this.showNotification('All sites deleted', 'success');
    } catch (error) {
      logger.error('Delete all failed:', error);
      this.showNotification('Failed to delete sites', 'error');
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  showNotification(message, type = 'info') {
    // Simple notification - will be enhanced in Phase 6
    alert(message);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new OptionsController();
});
```

---

### 2. Update Popup for Quick-Add

#### 2.1 Update src/popup/popup.js

Add the quick-add functionality:

```javascript
// Add to setupListeners method:

// Add site button
this.elements.addSiteBtn.addEventListener('click', async () => {
  try {
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab.url) {
      alert('Cannot block this page');
      return;
    }

    // Extract domain from URL
    const url = new URL(tab.url);
    const domain = url.hostname.replace(/^www\./, '');

    // Confirm with user
    const confirmed = confirm(`Block ${domain}?`);
    if (!confirmed) return;

    // Add to block list
    await chrome.runtime.sendMessage({
      type: 'ADD_BLOCKED_SITE',
      data: { pattern: domain }
    });

    alert(`${domain} added to block list`);
    await this.loadState();
  } catch (error) {
    logger.error('Failed to add site:', error);
    alert(error.message || 'Failed to add site');
  }
});
```

---

## Testing

### Manual Testing Checklist

- [ ] Open options page
- [ ] Add a site manually - appears in list
- [ ] Toggle site enabled/disabled - state updates
- [ ] Delete a site - removed from list
- [ ] Add category - all sites added
- [ ] Export block list - JSON file downloads
- [ ] Import block list - sites loaded
- [ ] Search for sites - filters correctly
- [ ] Filter by status - shows correct sites
- [ ] Enable/disable all - bulk operation works
- [ ] Delete all - confirms and clears list
- [ ] Quick-add from popup - current site blocked

---

## Completion Checklist

- [ ] Options page fully functional
- [ ] All CRUD operations work
- [ ] Import/export working
- [ ] Category presets functional
- [ ] Search and filters working
- [ ] Bulk operations work
- [ ] Quick-add from popup works
- [ ] No console errors
- [ ] UI is responsive
- [ ] Data persists correctly

---

## Next Phase

Proceed to: **[Phase 4: Scheduling System](04-scheduling.md)**
