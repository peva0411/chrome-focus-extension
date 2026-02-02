# Phase 4: Scheduled Access Windows

**Status:** Ready to Start  
**Estimated Time:** 5-6 days  
**Dependencies:** Phase 3 (Site Management)

---

## Overview

This phase implements time-based scheduling that automatically enables or disables website blocking based on user-defined schedules. Users can create multiple schedule profiles (workday, weekend, study time) and have blocking activate/deactivate automatically.

---

## Objectives

1. Create schedule management UI
2. Implement schedule data structures
3. Build schedule evaluation engine
4. Add pause/resume functionality
5. Integrate with blocking manager
6. Create visual schedule editor

---

## Requirements

### Must Complete

- [ ] Create/edit/delete schedule profiles
- [ ] Define blocking hours by day of week
- [ ] Multiple time blocks per day
- [ ] Active schedule selection
- [ ] Manual pause for X minutes
- [ ] Schedule status indicator
- [ ] Automatic blocking based on schedule
- [ ] Countdown to schedule changes

### Nice to Have

- [ ] Visual timeline editor
- [ ] Schedule templates (9-5 workday, etc.)
- [ ] Holiday exceptions
- [ ] Different block lists per schedule

---

## Implementation Tasks

### 1. Schedule Data Structures

#### 1.1 Update src/common/constants.js

Add schedule-related constants:

```javascript
// Schedule constants
export const SCHEDULE_TEMPLATES = {
  WORKDAY: {
    name: '9-5 Workday',
    description: 'Block during standard work hours, Monday-Friday',
    schedule: {
      monday: [{ start: '09:00', end: '17:00' }],
      tuesday: [{ start: '09:00', end: '17:00' }],
      wednesday: [{ start: '09:00', end: '17:00' }],
      thursday: [{ start: '09:00', end: '17:00' }],
      friday: [{ start: '09:00', end: '17:00' }],
      saturday: [],
      sunday: []
    }
  },
  STUDY_EVENING: {
    name: 'Evening Study',
    description: 'Block 7pm-11pm every night',
    schedule: {
      monday: [{ start: '19:00', end: '23:00' }],
      tuesday: [{ start: '19:00', end: '23:00' }],
      wednesday: [{ start: '19:00', end: '23:00' }],
      thursday: [{ start: '19:00', end: '23:00' }],
      friday: [{ start: '19:00', end: '23:00' }],
      saturday: [{ start: '19:00', end: '23:00' }],
      sunday: [{ start: '19:00', end: '23:00' }]
    }
  },
  DEEP_FOCUS: {
    name: 'Deep Focus Blocks',
    description: 'Morning and afternoon focus blocks with lunch break',
    schedule: {
      monday: [
        { start: '09:00', end: '12:00' },
        { start: '14:00', end: '17:00' }
      ],
      tuesday: [
        { start: '09:00', end: '12:00' },
        { start: '14:00', end: '17:00' }
      ],
      wednesday: [
        { start: '09:00', end: '12:00' },
        { start: '14:00', end: '17:00' }
      ],
      thursday: [
        { start: '09:00', end: '12:00' },
        { start: '14:00', end: '17:00' }
      ],
      friday: [
        { start: '09:00', end: '12:00' },
        { start: '14:00', end: '17:00' }
      ],
      saturday: [],
      sunday: []
    }
  },
  ALWAYS_ON: {
    name: 'Always Active',
    description: 'Block 24/7',
    schedule: {
      monday: [{ start: '00:00', end: '23:59' }],
      tuesday: [{ start: '00:00', end: '23:59' }],
      wednesday: [{ start: '00:00', end: '23:59' }],
      thursday: [{ start: '00:00', end: '23:59' }],
      friday: [{ start: '00:00', end: '23:59' }],
      saturday: [{ start: '00:00', end: '23:59' }],
      sunday: [{ start: '00:00', end: '23:59' }]
    }
  }
};

export const DAYS_OF_WEEK = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday'
];

export const PAUSE_DURATIONS = [
  { label: '15 minutes', minutes: 15 },
  { label: '30 minutes', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '2 hours', minutes: 120 },
  { label: 'Until tomorrow', minutes: -1 }
];
```

#### 1.2 Create src/background/schedule-manager.js

```javascript
import { storage } from '../common/storage.js';
import { STORAGE_KEYS, DAYS_OF_WEEK } from '../common/constants.js';
import { Logger } from '../common/logger.js';
import { timeToMinutes, getCurrentTime, getCurrentDate } from '../common/utils.js';

const logger = new Logger('ScheduleManager');

/**
 * Manages schedules and determines if blocking should be active
 */
export class ScheduleManager {
  constructor() {
    this.schedules = [];
    this.activeScheduleId = null;
    this.pausedUntil = null;
    this.checkInterval = null;
  }

  /**
   * Initialize schedule manager
   */
  async initialize() {
    logger.info('Initializing schedule manager...');

    try {
      await this.loadSchedules();
      this.startMonitoring();
      logger.info('Schedule manager initialized');
    } catch (error) {
      logger.error('Failed to initialize schedule manager:', error);
    }
  }

  /**
   * Load schedules from storage
   */
  async loadSchedules() {
    this.schedules = (await storage.get(STORAGE_KEYS.SCHEDULES)) || [];
    this.activeScheduleId = await storage.get(STORAGE_KEYS.ACTIVE_SCHEDULE);
    
    logger.info(`Loaded ${this.schedules.length} schedules`);
  }

  /**
   * Start monitoring schedule changes
   */
  startMonitoring() {
    // Check every minute if blocking state should change
    this.checkInterval = setInterval(() => {
      this.checkScheduleState();
    }, 60000); // Every minute

    // Check immediately
    this.checkScheduleState();
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Check if blocking should be active right now
   * @returns {boolean}
   */
  async checkScheduleState() {
    const shouldBlock = await this.shouldBlockNow();
    
    // Notify if state changed (will be used by blocking manager)
    chrome.runtime.sendMessage({
      type: 'SCHEDULE_STATE_CHANGED',
      data: { shouldBlock }
    }).catch(() => {
      // Ignore errors if no listeners
    });

    return shouldBlock;
  }

  /**
   * Determine if blocking should be active now
   * @returns {Promise<boolean>}
   */
  async shouldBlockNow() {
    // Check if manually paused
    if (this.pausedUntil) {
      if (Date.now() < this.pausedUntil) {
        return false; // Paused
      } else {
        this.pausedUntil = null; // Pause expired
      }
    }

    // Check if extension is enabled
    const settings = await storage.get(STORAGE_KEYS.SETTINGS);
    if (!settings || !settings.enabled) {
      return false;
    }

    // If no active schedule, default to always block
    if (!this.activeScheduleId) {
      return true;
    }

    // Find active schedule
    const schedule = this.schedules.find(s => s.id === this.activeScheduleId);
    if (!schedule) {
      return true; // Default to blocking if schedule not found
    }

    // Check if current time matches schedule
    return this.isTimeInSchedule(schedule);
  }

  /**
   * Check if current time falls within schedule
   * @param {Object} schedule
   * @returns {boolean}
   */
  isTimeInSchedule(schedule) {
    const now = new Date();
    const dayName = DAYS_OF_WEEK[now.getDay() === 0 ? 6 : now.getDay() - 1]; // Convert to our format
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const todayBlocks = schedule.days[dayName] || [];

    // Check if current time is in any block for today
    for (const block of todayBlocks) {
      const startMinutes = timeToMinutes(block.start);
      const endMinutes = timeToMinutes(block.end);

      if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
        return true;
      }
    }

    return false;
  }

  /**
   * Create a new schedule
   * @param {Object} scheduleData
   * @returns {Promise<Object>}
   */
  async createSchedule(scheduleData) {
    const newSchedule = {
      id: crypto.randomUUID(),
      name: scheduleData.name || 'Untitled Schedule',
      createdDate: Date.now(),
      days: scheduleData.days || this.getEmptyScheduleDays()
    };

    this.schedules.push(newSchedule);
    await storage.set(STORAGE_KEYS.SCHEDULES, this.schedules);

    logger.info(`Created schedule: ${newSchedule.name}`);
    return newSchedule;
  }

  /**
   * Update an existing schedule
   * @param {string} scheduleId
   * @param {Object} updates
   * @returns {Promise<Object>}
   */
  async updateSchedule(scheduleId, updates) {
    const schedule = this.schedules.find(s => s.id === scheduleId);
    if (!schedule) {
      throw new Error('Schedule not found');
    }

    Object.assign(schedule, updates);
    await storage.set(STORAGE_KEYS.SCHEDULES, this.schedules);

    logger.info(`Updated schedule: ${scheduleId}`);
    return schedule;
  }

  /**
   * Delete a schedule
   * @param {string} scheduleId
   * @returns {Promise<boolean>}
   */
  async deleteSchedule(scheduleId) {
    this.schedules = this.schedules.filter(s => s.id !== scheduleId);
    await storage.set(STORAGE_KEYS.SCHEDULES, this.schedules);

    // If deleted schedule was active, clear active schedule
    if (this.activeScheduleId === scheduleId) {
      this.activeScheduleId = null;
      await storage.set(STORAGE_KEYS.ACTIVE_SCHEDULE, null);
    }

    logger.info(`Deleted schedule: ${scheduleId}`);
    return true;
  }

  /**
   * Set active schedule
   * @param {string} scheduleId
   * @returns {Promise<boolean>}
   */
  async setActiveSchedule(scheduleId) {
    if (scheduleId && !this.schedules.find(s => s.id === scheduleId)) {
      throw new Error('Schedule not found');
    }

    this.activeScheduleId = scheduleId;
    await storage.set(STORAGE_KEYS.ACTIVE_SCHEDULE, scheduleId);

    logger.info(`Set active schedule: ${scheduleId}`);
    
    // Trigger immediate state check
    await this.checkScheduleState();
    
    return true;
  }

  /**
   * Pause blocking for specified duration
   * @param {number} minutes - Minutes to pause (-1 for until tomorrow)
   * @returns {Promise<number>} Pause until timestamp
   */
  async pauseBlocking(minutes) {
    if (minutes === -1) {
      // Pause until tomorrow at midnight
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      this.pausedUntil = tomorrow.getTime();
    } else {
      this.pausedUntil = Date.now() + minutes * 60 * 1000;
    }

    logger.info(`Paused until ${new Date(this.pausedUntil)}`);
    
    // Trigger state check
    await this.checkScheduleState();
    
    return this.pausedUntil;
  }

  /**
   * Resume blocking immediately
   * @returns {Promise<boolean>}
   */
  async resumeBlocking() {
    this.pausedUntil = null;
    logger.info('Blocking resumed');
    
    await this.checkScheduleState();
    return true;
  }

  /**
   * Get current blocking status
   * @returns {Promise<Object>}
   */
  async getStatus() {
    const shouldBlock = await this.shouldBlockNow();
    const activeSchedule = this.schedules.find(s => s.id === this.activeScheduleId);

    return {
      shouldBlock,
      isPaused: this.pausedUntil && Date.now() < this.pausedUntil,
      pausedUntil: this.pausedUntil,
      activeSchedule: activeSchedule || null,
      nextChange: this.getNextScheduleChange(activeSchedule)
    };
  }

  /**
   * Get time until next schedule change
   * @param {Object} schedule
   * @returns {Object|null}
   */
  getNextScheduleChange(schedule) {
    if (!schedule) return null;

    // This is simplified - full implementation would calculate
    // exact time until next block starts/ends
    return {
      type: 'end', // or 'start'
      time: Date.now() + 3600000 // Placeholder: 1 hour from now
    };
  }

  /**
   * Get empty schedule days structure
   * @returns {Object}
   */
  getEmptyScheduleDays() {
    const days = {};
    DAYS_OF_WEEK.forEach(day => {
      days[day] = [];
    });
    return days;
  }

  /**
   * Get all schedules
   * @returns {Array}
   */
  getSchedules() {
    return this.schedules;
  }
}

// Singleton instance
export const scheduleManager = new ScheduleManager();
```

---

### 2. Integrate with Service Worker

#### 2.1 Update src/background/service-worker.js

```javascript
import { scheduleManager } from './schedule-manager.js';

// In initializeExtension():
async function initializeExtension() {
  try {
    await storage.initialize();
    await blockingManager.initialize();
    await scheduleManager.initialize(); // Add this
    
    logger.info('Extension initialized successfully');
  } catch (error) {
    logger.error('Extension initialization failed:', error);
  }
}

// In handleMessage(), add these cases:
case 'CREATE_SCHEDULE':
  return await scheduleManager.createSchedule(data);

case 'UPDATE_SCHEDULE':
  return await scheduleManager.updateSchedule(data.scheduleId, data.updates);

case 'DELETE_SCHEDULE':
  await scheduleManager.deleteSchedule(data.scheduleId);
  return { success: true };

case 'GET_SCHEDULES':
  return { schedules: scheduleManager.getSchedules() };

case 'SET_ACTIVE_SCHEDULE':
  await scheduleManager.setActiveSchedule(data.scheduleId);
  return { success: true };

case 'PAUSE_BLOCKING':
  const pausedUntil = await scheduleManager.pauseBlocking(data.minutes);
  return { pausedUntil };

case 'RESUME_BLOCKING':
  await scheduleManager.resumeBlocking();
  return { success: true };

case 'GET_SCHEDULE_STATUS':
  return await scheduleManager.getStatus();
```

---

### 3. Schedule UI in Options Page

#### 3.1 Update src/options/options.html

Replace the schedules tab placeholder:

```html
<section id="tab-schedules" class="tab-content">
  <div class="section-header">
    <h2>Schedule Management</h2>
    <p>Control when blocking is active with time-based schedules</p>
  </div>

  <!-- Active Schedule -->
  <div class="card">
    <h3>Active Schedule</h3>
    <select id="active-schedule-select" class="select">
      <option value="">Always Active (No Schedule)</option>
    </select>
    <p class="help-text">
      Select a schedule to automatically enable/disable blocking at specific times
    </p>
  </div>

  <!-- Schedule Templates -->
  <div class="card">
    <h3>Create from Template</h3>
    <div class="category-buttons">
      <button class="btn btn-secondary template-btn" data-template="WORKDAY">
        9-5 Workday
      </button>
      <button class="btn btn-secondary template-btn" data-template="STUDY_EVENING">
        Evening Study
      </button>
      <button class="btn btn-secondary template-btn" data-template="DEEP_FOCUS">
        Deep Focus
      </button>
      <button class="btn btn-secondary template-btn" data-template="ALWAYS_ON">
        Always On
      </button>
    </div>
  </div>

  <!-- Create Custom Schedule -->
  <div class="card">
    <h3>Create Custom Schedule</h3>
    <button id="create-schedule-btn" class="btn btn-primary">
      + Create New Schedule
    </button>
  </div>

  <!-- Schedules List -->
  <div class="card">
    <h3>Your Schedules (<span id="schedule-count">0</span>)</h3>
    <div id="schedules-list-container">
      <!-- Schedules will be rendered here -->
    </div>
  </div>
</section>
```

#### 3.2 Create schedule UI in src/options/options.js

Add to OptionsController class:

```javascript
// Add in init():
await this.loadSchedules();

// New methods:
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
  } catch (error) {
    logger.error('Failed to load schedules:', error);
  }
}

renderSchedules() {
  // Update active schedule dropdown
  const activeSelect = document.getElementById('active-schedule-select');
  activeSelect.innerHTML = '<option value="">Always Active (No Schedule)</option>';
  
  this.schedules.forEach(schedule => {
    const option = document.createElement('option');
    option.value = schedule.id;
    option.textContent = schedule.name;
    option.selected = schedule.id === this.activeScheduleId;
    activeSelect.appendChild(option);
  });

  // Update schedule count
  document.getElementById('schedule-count').textContent = this.schedules.length;

  // Render schedules list
  const container = document.getElementById('schedules-list-container');
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

// Event listeners for schedule tab in setupListeners():

// Active schedule dropdown
document.getElementById('active-schedule-select').addEventListener('change', async (e) => {
  const scheduleId = e.target.value || null;
  await chrome.runtime.sendMessage({
    type: 'SET_ACTIVE_SCHEDULE',
    data: { scheduleId }
  });
  this.showNotification('Active schedule updated', 'success');
  await this.loadSchedules();
});

// Template buttons
document.querySelectorAll('.template-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const template = btn.dataset.template;
    await this.createFromTemplate(template);
  });
});

// Create schedule button
document.getElementById('create-schedule-btn').addEventListener('click', () => {
  this.showScheduleEditor(null);
});

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
```

---

### 4. Update Popup for Pause Feature

#### 4.1 Update src/popup/popup.js

```javascript
// Update pauseBtn listener:
this.elements.pauseBtn.addEventListener('click', async () => {
  const minutes = prompt('Pause blocking for how many minutes? (15, 30, 60)');
  const duration = parseInt(minutes);
  
  if (isNaN(duration) || duration <= 0) {
    alert('Invalid duration');
    return;
  }

  try {
    await chrome.runtime.sendMessage({
      type: 'PAUSE_BLOCKING',
      data: { minutes: duration }
    });

    alert(`Blocking paused for ${duration} minutes`);
    await this.loadState();
  } catch (error) {
    logger.error('Failed to pause:', error);
    alert('Failed to pause blocking');
  }
});
```

---

## Testing

### Manual Testing Checklist

- [ ] Create schedule from template
- [ ] Create custom schedule
- [ ] Edit schedule times
- [ ] Delete schedule
- [ ] Set active schedule
- [ ] Verify blocking activates during scheduled times
- [ ] Verify blocking deactivates outside scheduled times
- [ ] Pause blocking manually
- [ ] Resume blocking
- [ ] Check status updates correctly

---

## Completion Checklist

- [ ] Schedule CRUD operations work
- [ ] Schedule evaluation engine works
- [ ] Blocking respects schedules
- [ ] Pause/resume functionality works
- [ ] UI shows correct schedule status
- [ ] Templates create correctly
- [ ] Active schedule persists

---

## Next Phase

Proceed to: **[Phase 5: Time Budget System](05-time-budget.md)**
