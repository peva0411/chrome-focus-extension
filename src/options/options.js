import { Logger } from '../common/logger.js';
import { STORAGE_KEYS, SCHEDULE_TEMPLATES, DAYS_OF_WEEK } from '../common/constants.js';

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
    this.schedules = [];
    this.activeScheduleId = null;

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

    // Load schedules
    await this.loadSchedules();

    // Load budget information
    await this.loadBudgetInfo();

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

    // Schedule listeners
    const activeScheduleSelect = document.getElementById('active-schedule-select');
    if (activeScheduleSelect) {
      activeScheduleSelect.addEventListener('change', async (e) => {
        const scheduleId = e.target.value || null;
        await chrome.runtime.sendMessage({
          type: 'SET_ACTIVE_SCHEDULE',
          data: { scheduleId }
        });
        this.showNotification('Active schedule updated', 'success');
        await this.loadSchedules();
      });
    }

    // Template buttons
    document.querySelectorAll('.template-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const template = btn.dataset.template;
        await this.createFromTemplate(template);
      });
    });

    // Create schedule button
    const createScheduleBtn = document.getElementById('create-schedule-btn');
    if (createScheduleBtn) {
      createScheduleBtn.addEventListener('click', () => {
        this.showScheduleEditor(null);
      });
    }
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
    const hasExceptions = site.exceptions && site.exceptions.length > 0;

    return `
      <div class="site-item ${site.enabled ? '' : 'disabled'}" data-site-id="${site.id}">
        <div class="site-info">
          <div class="site-pattern">${this.escapeHtml(site.pattern)}</div>
          <div class="site-meta">
            <span>📅 Added ${addedDate}</span>
            <span>🚫 Blocked ${site.blockCount || 0} times</span>
            ${hasExceptions ? `<span>✓ ${site.exceptions.length} exception(s)</span>` : ''}
          </div>
          ${this.createExceptionsHTML(site)}
        </div>
        <div class="site-actions">
          <button class="btn-small" data-action="add-exception" title="Add exception">+ Exception</button>
          <div class="toggle-switch ${site.enabled ? 'active' : ''}" data-action="toggle"></div>
          <button class="btn-icon" data-action="delete" title="Delete">🗑️</button>
        </div>
      </div>
    `;
  }

  createExceptionsHTML(site) {
    if (!site.exceptions || site.exceptions.length === 0) {
      return '';
    }

    return `
      <div class="exceptions-list">
        <div class="exceptions-label">Allowed exceptions:</div>
        ${site.exceptions.map(exception => `
          <span class="exception-tag">
            ${this.escapeHtml(exception)}
            <button class="exception-remove" data-action="remove-exception" data-exception="${this.escapeHtml(exception)}" title="Remove exception">✕</button>
          </span>
        `).join('')}
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

      // Add exception button
      const addExceptionBtn = item.querySelector('[data-action="add-exception"]');
      addExceptionBtn.addEventListener('click', () => this.handleAddException(siteId));

      // Remove exception buttons
      const removeExceptionBtns = item.querySelectorAll('[data-action="remove-exception"]');
      removeExceptionBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const exception = btn.dataset.exception;
          this.handleRemoveException(siteId, exception);
        });
      });
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

  async handleAddException(siteId) {
    const site = this.blockedSites.find(s => s.id === siteId);
    if (!site) return;

    const exceptionPattern = prompt(
      `Add an exception to allow specific URLs while blocking "${site.pattern}":\n\n` +
      `Examples:\n` +
      `- For youtube.com, allow: music.youtube.com\n` +
      `- For reddit.com, allow: old.reddit.com\n` +
      `- For github.com, allow: gist.github.com\n\n` +
      `Enter the URL pattern to allow:`
    );

    if (!exceptionPattern || !exceptionPattern.trim()) return;

    try {
      await chrome.runtime.sendMessage({
        type: 'ADD_EXCEPTION',
        data: { siteId, exceptionPattern: exceptionPattern.trim() }
      });

      await this.loadBlockedSites();
      this.renderSitesList();
      this.showNotification('Exception added', 'success');
    } catch (error) {
      logger.error('Failed to add exception:', error);
      this.showNotification(error.message || 'Failed to add exception', 'error');
    }
  }

  async handleRemoveException(siteId, exceptionPattern) {
    const site = this.blockedSites.find(s => s.id === siteId);
    if (!site) return;

    const confirmed = confirm(`Remove exception "${exceptionPattern}"?`);
    if (!confirmed) return;

    try {
      await chrome.runtime.sendMessage({
        type: 'REMOVE_EXCEPTION',
        data: { siteId, exceptionPattern }
      });

      await this.loadBlockedSites();
      this.renderSitesList();
      this.showNotification('Exception removed', 'success');
    } catch (error) {
      logger.error('Failed to remove exception:', error);
      this.showNotification('Failed to remove exception', 'error');
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

  // ========== SCHEDULE METHODS ==========

  async loadSchedules() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_SCHEDULES'
      });

      this.schedules = response.schedules || [];
      
      const status = await chrome.runtime.sendMessage({
        type: 'GET_SCHEDULE_STATUS'
      });
      
      this.activeScheduleId = status.activeSchedule?.id || null;
      
      this.renderSchedules();
      
      logger.info(`Loaded ${this.schedules.length} schedules`);
    } catch (error) {
      logger.error('Failed to load schedules:', error);
    }
  }

  renderSchedules() {
    // Update active schedule dropdown
    const activeSelect = document.getElementById('active-schedule-select');
    if (!activeSelect) return;

    activeSelect.innerHTML = '<option value="">Always Active (No Schedule)</option>';
    
    this.schedules.forEach(schedule => {
      const option = document.createElement('option');
      option.value = schedule.id;
      option.textContent = schedule.name;
      option.selected = schedule.id === this.activeScheduleId;
      activeSelect.appendChild(option);
    });

    // Update schedule count
    const scheduleCount = document.getElementById('schedule-count');
    if (scheduleCount) {
      scheduleCount.textContent = this.schedules.length;
    }

    // Render schedules list
    const container = document.getElementById('schedules-list-container');
    if (!container) return;

    if (this.schedules.length === 0) {
      container.innerHTML = '<p class="empty-state">No schedules created yet.</p>';
      return;
    }

    container.innerHTML = this.schedules
      .map(schedule => this.createScheduleItemHTML(schedule))
      .join('');

    this.attachScheduleListeners();
  }

  createScheduleItemHTML(schedule) {
    const isActive = schedule.id === this.activeScheduleId;
    
    return `
      <div class="site-item ${isActive ? 'active-schedule' : ''}" data-schedule-id="${schedule.id}">
        <div class="site-info">
          <div class="site-pattern">
            ${this.escapeHtml(schedule.name)}
            ${isActive ? '<span class="badge">Active</span>' : ''}
          </div>
          <div class="site-meta">
            ${this.getScheduleSummary(schedule)}
          </div>
        </div>
        <div class="site-actions">
          <button class="btn-icon" data-action="edit" title="Edit">✏️</button>
          <button class="btn-icon" data-action="delete" title="Delete">🗑️</button>
        </div>
      </div>
    `;
  }

  getScheduleSummary(schedule) {
    const activeDays = DAYS_OF_WEEK.filter(day => 
      schedule.days[day] && schedule.days[day].length > 0
    );
    
    return `📅 ${activeDays.length} days configured`;
  }

  attachScheduleListeners() {
    const container = document.getElementById('schedules-list-container');
    if (!container) return;

    container.addEventListener('click', async (e) => {
      const btn = e.target.closest('.btn-icon');
      if (!btn) return;

      const scheduleItem = btn.closest('[data-schedule-id]');
      if (!scheduleItem) return;

      const scheduleId = scheduleItem.dataset.scheduleId;
      const action = btn.dataset.action;

      if (action === 'edit') {
        await this.handleEditSchedule(scheduleId);
      } else if (action === 'delete') {
        await this.handleDeleteSchedule(scheduleId);
      }
    });
  }

  async createFromTemplate(templateName) {
    const template = SCHEDULE_TEMPLATES[templateName];
    if (!template) return;

    const name = prompt(`Name for this schedule:`, template.name);
    if (!name) return;

    try {
      await chrome.runtime.sendMessage({
        type: 'CREATE_SCHEDULE',
        data: {
          name,
          days: template.schedule
        }
      });

      await this.loadSchedules();
      this.showNotification('Schedule created', 'success');
    } catch (error) {
      logger.error('Failed to create schedule:', error);
      this.showNotification('Failed to create schedule', 'error');
    }
  }

  showScheduleEditor(scheduleId) {
    // Simplified for now - full editor would be more complex
    const name = prompt('Schedule name:');
    if (!name) return;

    this.createFromTemplate('WORKDAY'); // Default to workday for now
  }

  async handleEditSchedule(scheduleId) {
    const schedule = this.schedules.find(s => s.id === scheduleId);
    if (!schedule) return;

    const newName = prompt('Schedule name:', schedule.name);
    if (!newName || newName === schedule.name) return;

    try {
      await chrome.runtime.sendMessage({
        type: 'UPDATE_SCHEDULE',
        data: {
          scheduleId,
          updates: { name: newName }
        }
      });

      await this.loadSchedules();
      this.showNotification('Schedule updated', 'success');
    } catch (error) {
      logger.error('Failed to update schedule:', error);
      this.showNotification('Failed to update schedule', 'error');
    }
  }

  async handleDeleteSchedule(scheduleId) {
    const schedule = this.schedules.find(s => s.id === scheduleId);
    if (!schedule) return;

    const confirmed = confirm(`Delete schedule "${schedule.name}"?`);
    if (!confirmed) return;

    try {
      await chrome.runtime.sendMessage({
        type: 'DELETE_SCHEDULE',
        data: { scheduleId }
      });

      await this.loadSchedules();
      this.showNotification('Schedule deleted', 'success');
    } catch (error) {
      logger.error('Failed to delete schedule:', error);
      this.showNotification('Failed to delete schedule', 'error');
    }
  }

  // ============================================================================
  // BUDGET TAB METHODS
  // ============================================================================

  async loadBudgetInfo() {
    try {
      // Get current budget status
      const statusResponse = await chrome.runtime.sendMessage({
        type: 'GET_BUDGET_STATUS'
      });

      // Get active sessions
      const sessionsResponse = await chrome.runtime.sendMessage({
        type: 'GET_ACTIVE_SESSIONS'
      });

      // Get budget history
      const historyResponse = await chrome.runtime.sendMessage({
        type: 'GET_BUDGET_HISTORY',
        data: { days: 7 }
      });

      // Update UI
      this.updateBudgetDisplay(statusResponse, sessionsResponse.sessions || []);
      this.renderBudgetHistory(historyResponse.history || []);

      // Load budget settings into form
      await this.loadBudgetSettings();

      logger.info('Budget info loaded');
    } catch (error) {
      logger.error('Failed to load budget info:', error);
    }
  }

  async loadBudgetSettings() {
    try {
      // Get current budget configuration from storage
      const budgetData = await chrome.storage.local.get(['timeBudget']);
      const budget = budgetData.timeBudget || { globalBudget: 30, resetTime: '00:00' };

      // Update form fields
      const globalBudgetInput = document.getElementById('global-budget');
      const resetTimeInput = document.getElementById('reset-time');

      if (globalBudgetInput) {
        globalBudgetInput.value = budget.globalBudget;
      }

      if (resetTimeInput) {
        resetTimeInput.value = budget.resetTime;
      }

      // Add save button listener
      const saveBudgetBtn = document.getElementById('save-budget-btn');
      if (saveBudgetBtn) {
        saveBudgetBtn.addEventListener('click', () => this.saveBudgetSettings());
      }
    } catch (error) {
      logger.error('Failed to load budget settings:', error);
    }
  }

  async saveBudgetSettings() {
    try {
      const globalBudgetInput = document.getElementById('global-budget');
      const resetTimeInput = document.getElementById('reset-time');
      const statusEl = document.getElementById('budget-save-status');

      const globalBudget = parseInt(globalBudgetInput.value);
      const resetTime = resetTimeInput.value;

      // Validate
      if (isNaN(globalBudget) || globalBudget < 5 || globalBudget > 480) {
        this.showNotification('Budget must be between 5 and 480 minutes', 'error');
        return;
      }

      if (!resetTime) {
        this.showNotification('Please select a reset time', 'error');
        return;
      }

      // Update budget configuration
      await chrome.runtime.sendMessage({
        type: 'UPDATE_BUDGET_CONFIG',
        data: { globalBudget, resetTime }
      });

      // Show success
      if (statusEl) {
        statusEl.textContent = '✓ Saved';
        statusEl.className = 'save-status success';
        setTimeout(() => {
          statusEl.textContent = '';
          statusEl.className = 'save-status';
        }, 2000);
      }

      this.showNotification('Budget settings saved', 'success');

      // Reload budget info
      await this.loadBudgetInfo();
    } catch (error) {
      logger.error('Failed to save budget settings:', error);
      this.showNotification('Failed to save budget settings', 'error');
    }
  }

  updateBudgetDisplay(status, sessions) {
    // Update today's status
    const remainingEl = document.getElementById('today-remaining');
    const usedEl = document.getElementById('today-used');
    const totalEl = document.getElementById('today-total');
    const dateEl = document.getElementById('today-date');
    const sessionsEl = document.getElementById('active-sessions');

    if (remainingEl) {
      remainingEl.textContent = Math.floor(status.global);
    }

    if (usedEl) {
      usedEl.textContent = `${Math.floor(status.used)} min`;
    }

    if (totalEl) {
      totalEl.textContent = `${status.total} min`;
    }

    if (dateEl) {
      dateEl.textContent = status.date || '--';
    }

    if (sessionsEl) {
      sessionsEl.textContent = sessions.length;
    }
  }

  renderBudgetHistory(history) {
    const chartContainer = document.getElementById('budget-chart');
    const tableContainer = document.getElementById('budget-history-table');

    if (!chartContainer || !tableContainer) return;

    // Render simple bar chart
    chartContainer.innerHTML = '';
    
    if (history.length === 0) {
      chartContainer.innerHTML = '<p class="empty-message">No budget history yet</p>';
      tableContainer.innerHTML = '';
      return;
    }

    // Create bars for each day
    const maxValue = Math.max(...history.map(h => h.total));
    
    history.forEach(day => {
      const barGroup = document.createElement('div');
      barGroup.className = 'chart-bar-group';

      const usedPercent = (day.used / maxValue) * 100;
      const totalPercent = (day.total / maxValue) * 100;

      barGroup.innerHTML = `
        <div class="chart-bar-container">
          <div class="chart-bar chart-bar-total" style="height: ${totalPercent}%"></div>
          <div class="chart-bar chart-bar-used" style="height: ${usedPercent}%"></div>
        </div>
        <div class="chart-label">${this.formatDate(day.date)}</div>
      `;

      chartContainer.appendChild(barGroup);
    });

    // Render table
    let tableHTML = `
      <table class="budget-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Used</th>
            <th>Total</th>
            <th>Percent</th>
          </tr>
        </thead>
        <tbody>
    `;

    history.forEach(day => {
      const percent = ((day.used / day.total) * 100).toFixed(1);
      tableHTML += `
        <tr>
          <td>${day.date}</td>
          <td>${Math.floor(day.used)} min</td>
          <td>${day.total} min</td>
          <td>${percent}%</td>
        </tr>
      `;
    });

    tableHTML += '</tbody></table>';
    tableContainer.innerHTML = tableHTML;
  }

  formatDate(dateStr) {
    // Format YYYY-MM-DD to short format
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}/${day}`;
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new OptionsController();
});

// =============================================================================
// STATISTICS TAB FUNCTIONALITY
// =============================================================================

/**
 * Initialize statistics tab
 */
async function initializeStatisticsTab() {
  try {
    // Get statistics from background
    const response = await chrome.runtime.sendMessage({ 
      action: 'getStatistics' 
    });
    
    if (response && response.stats) {
      renderStatistics(response.stats);
    }

    // Setup export button
    document.getElementById('export-stats-btn')?.addEventListener('click', async () => {
      const response = await chrome.runtime.sendMessage({ 
        action: 'exportStatistics' 
      });
      
      if (response && response.data) {
        downloadJSON(response.data, 'focus-extension-statistics.json');
      }
    });
  } catch (error) {
    logger.error('Failed to initialize statistics tab:', error);
  }
}

/**
 * Render statistics data
 */
function renderStatistics(stats) {
  // Update overview cards
  document.getElementById('total-blocks').textContent = stats.blocks || 0;
  
  const hours = Math.floor((stats.focusTime || 0) / 60);
  const minutes = (stats.focusTime || 0) % 60;
  document.getElementById('focus-time').textContent = `${hours}h ${minutes}m`;
  
  document.getElementById('streak-days').textContent = stats.streak || 0;
  
  const budgetSaved = stats.budgetSaved || 0;
  document.getElementById('budget-saved').textContent = `${budgetSaved}%`;

  // Render top blocked sites
  renderTopBlockedSites(stats.topSites || []);
  
  // Render charts (simplified without external library)
  renderHourlyChart(stats.hourlyActivity || []);
  renderWeeklyChart(stats.weeklyData || []);
}

/**
 * Render top blocked sites
 */
function renderTopBlockedSites(topSites) {
  const container = document.getElementById('top-blocked-sites');
  
  if (!topSites || topSites.length === 0) {
    container.innerHTML = '<p class="help-text">No blocks recorded yet</p>';
    return;
  }

  container.innerHTML = '';
  topSites.forEach(site => {
    const item = document.createElement('div');
    item.className = 'top-site-item';
    item.innerHTML = `
      <span class="top-site-pattern">${escapeHtml(site.pattern)}</span>
      <span class="top-site-count">${site.blocks}</span>
    `;
    container.appendChild(item);
  });
}

/**
 * Render hourly activity chart (simple canvas bars)
 */
function renderHourlyChart(hourlyData) {
  const canvas = document.getElementById('hourly-chart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  
  // Clear canvas
  ctx.clearRect(0, 0, width, height);
  
  if (!hourlyData || hourlyData.length === 0) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No data available', width / 2, height / 2);
    return;
  }

  // Find max value for scaling
  const maxBlocks = Math.max(...hourlyData.map(d => d.blocks), 1);
  
  // Draw bars
  const barWidth = width / 24;
  const padding = 2;

  hourlyData.forEach((data, index) => {
    const barHeight = (data.blocks / maxBlocks) * (height - 40);
    const x = index * barWidth + padding;
    const y = height - barHeight - 20;

    ctx.fillStyle = '#667eea';
    ctx.fillRect(x, y, barWidth - padding * 2, barHeight);

    // Draw hour label every 3 hours
    if (index % 3 === 0) {
      ctx.fillStyle = '#64748b';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(data.hour.toString(), x + barWidth / 2, height - 5);
    }
  });
}

/**
 * Render weekly trends chart
 */
function renderWeeklyChart(weeklyData) {
  const canvas = document.getElementById('weekly-chart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  
  ctx.clearRect(0, 0, width, height);
  
  if (!weeklyData || weeklyData.length === 0) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No data available', width / 2, height / 2);
    return;
  }

  const maxBlocks = Math.max(...weeklyData.map(d => d.blocks), 1);
  const barWidth = width / 7;
  const padding = 4;

  weeklyData.forEach((data, index) => {
    const barHeight = (data.blocks / maxBlocks) * (height - 40);
    const x = index * barWidth + padding;
    const y = height - barHeight - 20;

    ctx.fillStyle = '#667eea';
    ctx.fillRect(x, y, barWidth - padding * 2, barHeight);

    // Draw day label
    const date = new Date(data.date);
    const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short' });
    ctx.fillStyle = '#64748b';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(dayLabel, x + barWidth / 2, height - 5);
  });
}

// =============================================================================
// SETTINGS TAB FUNCTIONALITY
// =============================================================================

/**
 * Initialize settings tab
 */
async function initializeSettingsTab() {
  try {
    // Load settings
    const data = await chrome.storage.local.get([STORAGE_KEYS.SETTINGS]);
    const settings = data[STORAGE_KEYS.SETTINGS] || {};

    // Extension enabled toggle
    const enabledToggle = document.getElementById('extension-enabled-toggle');
    if (enabledToggle) {
      enabledToggle.checked = settings.enabled !== false;
      enabledToggle.addEventListener('change', async (e) => {
        settings.enabled = e.target.checked;
        await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings });
        await chrome.runtime.sendMessage({ 
          action: 'updateSettings', 
          settings 
        });
      });
    }

    // Notification toggles
    const budgetWarningsToggle = document.getElementById('budget-warnings-toggle');
    if (budgetWarningsToggle) {
      budgetWarningsToggle.checked = settings.notifications?.budgetWarnings !== false;
      budgetWarningsToggle.addEventListener('change', async (e) => {
        if (!settings.notifications) settings.notifications = {};
        settings.notifications.budgetWarnings = e.target.checked;
        await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings });
      });
    }

    const budgetExhaustedToggle = document.getElementById('budget-exhausted-toggle');
    if (budgetExhaustedToggle) {
      budgetExhaustedToggle.checked = settings.notifications?.budgetExhausted !== false;
      budgetExhaustedToggle.addEventListener('change', async (e) => {
        if (!settings.notifications) settings.notifications = {};
        settings.notifications.budgetExhausted = e.target.checked;
        await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings });
      });
    }

    const dailyResetToggle = document.getElementById('daily-reset-toggle');
    if (dailyResetToggle) {
      dailyResetToggle.checked = settings.notifications?.dailyReset === true;
      dailyResetToggle.addEventListener('change', async (e) => {
        if (!settings.notifications) settings.notifications = {};
        settings.notifications.dailyReset = e.target.checked;
        await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings });
      });
    }

    // Theme selector
    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) {
      themeSelect.value = settings.theme || 'light';
      themeSelect.addEventListener('change', async (e) => {
        settings.theme = e.target.value;
        await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings });
        applyTheme(e.target.value);
      });
    }

    // Show quotes toggle
    const showQuotesToggle = document.getElementById('show-quotes-toggle');
    if (showQuotesToggle) {
      showQuotesToggle.checked = settings.showMotivationalQuotes !== false;
      showQuotesToggle.addEventListener('change', async (e) => {
        settings.showMotivationalQuotes = e.target.checked;
        await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings });
      });
    }

    // Interstitial delay
    const interstitialDelayInput = document.getElementById('interstitial-delay');
    if (interstitialDelayInput) {
      interstitialDelayInput.value = settings.interstitialDelay || 5;
      interstitialDelayInput.addEventListener('change', async (e) => {
        settings.interstitialDelay = parseInt(e.target.value) || 5;
        await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings });
      });
    }

    // Pause duration
    const pauseDurationSelect = document.getElementById('pause-duration');
    if (pauseDurationSelect) {
      pauseDurationSelect.value = settings.pauseDuration || 30;
      pauseDurationSelect.addEventListener('change', async (e) => {
        settings.pauseDuration = parseInt(e.target.value);
        await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings });
      });
    }

    // Data management buttons
    document.getElementById('export-all-btn')?.addEventListener('click', exportAllData);
    document.getElementById('import-all-btn')?.addEventListener('click', () => {
      document.getElementById('import-all-file').click();
    });
    document.getElementById('import-all-file')?.addEventListener('change', importAllData);
    document.getElementById('reset-settings-btn')?.addEventListener('click', resetSettings);
    document.getElementById('clear-all-data-btn')?.addEventListener('click', clearAllData);

    // Apply theme on load
    applyTheme(settings.theme || 'light');
  } catch (error) {
    logger.error('Failed to initialize settings tab:', error);
  }
}

/**
 * Apply theme to the page
 */
function applyTheme(theme) {
  if (theme === 'auto') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    theme = prefersDark ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', theme);
}

/**
 * Export all extension data
 */
async function exportAllData() {
  try {
    const data = await chrome.storage.local.get(null);
    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      data: data
    };
    downloadJSON(exportData, 'focus-extension-backup.json');
  } catch (error) {
    logger.error('Failed to export data:', error);
    alert('Failed to export data. Check console for details.');
  }
}

/**
 * Import extension data
 */
async function importAllData(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const importData = JSON.parse(text);
    
    if (!importData.data) {
      throw new Error('Invalid backup file format');
    }

    if (confirm('This will overwrite all current data. Continue?')) {
      await chrome.storage.local.set(importData.data);
      alert('Data imported successfully! Please reload the page.');
      location.reload();
    }
  } catch (error) {
    logger.error('Failed to import data:', error);
    alert('Failed to import data. Make sure the file is valid.');
  }
}

/**
 * Reset settings to default
 */
async function resetSettings() {
  if (!confirm('Reset all settings to default values?')) return;

  try {
    const { DEFAULTS } = await import('../common/constants.js');
    await chrome.storage.local.set({ 
      [STORAGE_KEYS.SETTINGS]: DEFAULTS.settings 
    });
    alert('Settings reset successfully! Reloading page...');
    location.reload();
  } catch (error) {
    logger.error('Failed to reset settings:', error);
    alert('Failed to reset settings.');
  }
}

/**
 * Clear all extension data
 */
async function clearAllData() {
  if (!confirm('This will delete ALL extension data including blocked sites, schedules, and statistics. This cannot be undone!')) {
    return;
  }

  if (!confirm('Are you absolutely sure? This action is irreversible!')) {
    return;
  }

  try {
    await chrome.storage.local.clear();
    alert('All data cleared. Reloading page...');
    location.reload();
  } catch (error) {
    logger.error('Failed to clear data:', error);
    alert('Failed to clear data.');
  }
}

/**
 * Helper function to download JSON data
 */
function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize statistics and settings tabs when their tabs are activated
document.addEventListener('DOMContentLoaded', () => {
  const tabButtons = document.querySelectorAll('.tab-btn');
  
  tabButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const tab = btn.dataset.tab;
      
      if (tab === 'stats') {
        await initializeStatisticsTab();
      } else if (tab === 'settings') {
        await initializeSettingsTab();
      }
    });
  });

  // Initialize settings tab on load (for theme)
  initializeSettingsTab();
});
