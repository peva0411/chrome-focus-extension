import { storage } from '../common/storage.js';
import { STORAGE_KEYS, DAYS_OF_WEEK } from '../common/constants.js';
import { Logger } from '../common/logger.js';
import { timeToMinutes, getCurrentTime, getCurrentDate } from '../common/utils.js';

const logger = new Logger('ScheduleManager');

// Will be set by setBlockingManager() to avoid circular dependency
let blockingManager = null;

// Icon update function - will be set from service worker
let updateExtensionIcon = null;

/**
 * Manages schedules and determines if blocking should be active
 */
export class ScheduleManager {
  constructor() {
    this.schedules = [];
    this.activeScheduleId = null;
    this.pausedUntil = null;
    this.ALARM_NAME = 'scheduleCheck';
  }

  /**
   * Initialize schedule manager
   */
  async initialize() {
    logger.info('Initializing schedule manager...');

    try {
      await this.loadSchedules();
      // Note: Don't start monitoring yet - wait for setBlockingManager()
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
   * Start monitoring schedule changes using Chrome alarms
   */
  startMonitoring() {
    logger.info('Starting schedule monitoring with alarms...');
    
    // Create alarm that fires every minute
    chrome.alarms.create(this.ALARM_NAME, {
      delayInMinutes: 1,
      periodInMinutes: 1
    });
    
    logger.info('Schedule alarm created - will check every minute');

    // Check immediately
    this.checkScheduleState();
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    logger.info('Stopping schedule monitoring...');
    chrome.alarms.clear(this.ALARM_NAME);
  }
  
  /**
   * Handle alarm trigger (called from service worker)
   */
  async handleAlarm(alarmName) {
    if (alarmName === this.ALARM_NAME) {
      logger.info('Schedule alarm triggered - checking state');
      await this.checkScheduleState();
    }
  }

  /**
   * Check if blocking should be active right now
   * @returns {boolean}
   */
  async checkScheduleState() {
    const shouldBlock = await this.shouldBlockNow();
    const isPaused = this.pausedUntil && Date.now() < this.pausedUntil;
    
    const now = new Date();
    logger.info(`Schedule check at ${now.toLocaleTimeString()}: shouldBlock = ${shouldBlock}`);
    
    // Directly update blocking manager if available
    if (blockingManager) {
      try {
        await blockingManager.setBlockingEnabled(shouldBlock);
        logger.info(`Blocking ${shouldBlock ? 'enabled' : 'disabled'} by schedule`);
      } catch (error) {
        logger.error('Failed to update blocking state:', error);
      }
    } else {
      logger.warn('Blocking manager not set - cannot update blocking state');
    }
    
    // Update extension icon based on state
    if (updateExtensionIcon) {
      const iconState = isPaused ? 'paused' : 'active';
      await updateExtensionIcon(iconState);
    }

    return shouldBlock;
  }

  /**
   * Determine if blocking should be active now
   * @returns {Promise<boolean>}
   */
  async shouldBlockNow() {
    // Check if manually paused
    if (this.pausedUntil) {
      const now = Date.now();
      logger.info(`🔍 Pause check: pausedUntil=${this.pausedUntil}, now=${now}, isPaused=${now < this.pausedUntil}`);
      if (now < this.pausedUntil) {
        logger.info('⏸️  PAUSED - blocking disabled');
        return false; // Paused
      } else {
        logger.info('⏰ Pause expired - clearing');
        this.pausedUntil = null; // Pause expired
      }
    }

    // Check if extension is enabled
    const settings = await storage.get(STORAGE_KEYS.SETTINGS);
    if (!settings || !settings.enabled) {
      logger.info('❌ Extension disabled');
      return false;
    }

    // If no active schedule, default to always block
    if (!this.activeScheduleId) {
      logger.info('✅ No schedule - always block');
      return true;
    }

    // Find active schedule
    const schedule = this.schedules.find(s => s.id === this.activeScheduleId);
    if (!schedule) {
      logger.info('✅ Schedule not found - default to block');
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
    
    logger.info(`⏰ Schedule check: ${dayName} at ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')} (${currentMinutes} mins)`);
    logger.info(`📅 Full date: ${now.toString()}`);
    logger.info(`🗓️ Day index: ${now.getDay()} -> dayName: ${dayName}`);
    logger.info(`📋 Schedule "${schedule.name}": ${JSON.stringify(schedule.days, null, 2)}`);
    logger.info(`🎯 Today's blocks for ${dayName}: ${JSON.stringify(todayBlocks)}`);

    // Check if current time is in any block for today
    for (const block of todayBlocks) {
      const startMinutes = timeToMinutes(block.start);
      const endMinutes = timeToMinutes(block.end);

      logger.info(`🔍 Checking block ${block.start}-${block.end}: ${currentMinutes} in [${startMinutes}, ${endMinutes}]?`);

      if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
        logger.info(`✅ Current time IS in schedule block ${block.start}-${block.end}`);
        return true;
      }
    }

    logger.info(`❌ Current time is NOT in any schedule block for ${dayName}`);
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
    logger.info(`⏸️  pauseBlocking called with ${minutes} minutes`);
    
    // Safety check: ensure blocking manager is set
    if (!blockingManager) {
      logger.error('⚠️  Blocking manager not set! Cannot pause.');
      throw new Error('Blocking manager not initialized');
    }
    
    if (minutes === -1) {
      // Pause until tomorrow at midnight
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      this.pausedUntil = tomorrow.getTime();
    } else {
      this.pausedUntil = Date.now() + minutes * 60 * 1000;
    }

    logger.info(`⏸️  Paused until ${new Date(this.pausedUntil)}`);
    logger.info(`⏸️  pausedUntil timestamp: ${this.pausedUntil}`);
    
    // Update icon to paused state
    if (updateExtensionIcon) {
      await updateExtensionIcon('paused');
    }
    
    // Trigger state check
    logger.info('⏸️  Calling checkScheduleState...');
    await this.checkScheduleState();
    logger.info('⏸️  checkScheduleState complete');
    
    return this.pausedUntil;
  }

  /**
   * Resume blocking immediately
   * @returns {Promise<boolean>}
   */
  async resumeBlocking() {
    this.pausedUntil = null;
    logger.info('Blocking resumed');
    
    // Update icon to active state
    if (updateExtensionIcon) {
      await updateExtensionIcon('active');
    }
    
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

  /**
   * Set blocking manager reference (called during initialization)
   * @param {Object} manager - BlockingManager instance
   * @param {boolean} startMonitoring - Whether to start alarm-based monitoring (default: true)
   */
  setBlockingManager(manager, startMonitoring = true) {
    blockingManager = manager;
    logger.info('Blocking manager reference set');
    
    // Only start monitoring if requested (tests may disable this to avoid race conditions)
    if (startMonitoring) {
      this.startMonitoring();
      logger.info('Schedule monitoring started');
    } else {
      logger.info('Schedule monitoring NOT started (disabled for testing)');
    }
  }
  
  /**
   * Set the icon update function (called by service worker)
   */
  setIconUpdateFunction(fn) {
    updateExtensionIcon = fn;
    logger.info('Icon update function set');
  }
}

// Singleton instance
export const scheduleManager = new ScheduleManager();
