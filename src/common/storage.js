import { STORAGE_KEYS, DEFAULTS } from './constants.js';
import { Logger } from './logger.js';

const logger = new Logger('Storage');

/**
 * Storage abstraction layer for Chrome Storage API
 * Handles both local and sync storage with fallbacks
 */
export class StorageManager {
  constructor() {
    this.local = chrome.storage.local;
    this.sync = chrome.storage.sync;
  }

  /**
   * Initialize storage with default values if empty
   */
  async initialize() {
    logger.info('Initializing storage...');
    
    try {
      // Check if already initialized
      const settings = await this.get(STORAGE_KEYS.SETTINGS);
      
      if (!settings) {
        // First run - set defaults
        await this.setMultiple({
          [STORAGE_KEYS.SETTINGS]: DEFAULTS.settings,
          [STORAGE_KEYS.TIME_BUDGET]: DEFAULTS.timeBudget,
          [STORAGE_KEYS.BLOCKED_SITES]: DEFAULTS.blockedSites,
          [STORAGE_KEYS.SCHEDULES]: DEFAULTS.schedules,
          [STORAGE_KEYS.ACTIVE_SCHEDULE]: DEFAULTS.activeSchedule
        });
        
        logger.info('Storage initialized with defaults');
      } else {
        logger.info('Storage already initialized');
      }
      
      return true;
    } catch (error) {
      logger.error('Failed to initialize storage:', error);
      throw error;
    }
  }

  /**
   * Get a single value from storage
   * @param {string} key - Storage key
   * @param {boolean} useSync - Use sync storage (default: local)
   * @returns {Promise<any>}
   */
  async get(key, useSync = false) {
    const storage = useSync ? this.sync : this.local;
    
    try {
      const result = await storage.get(key);
      return result[key];
    } catch (error) {
      logger.error(`Failed to get ${key}:`, error);
      return null;
    }
  }

  /**
   * Get multiple values from storage
   * @param {string[]} keys - Array of storage keys
   * @param {boolean} useSync - Use sync storage
   * @returns {Promise<Object>}
   */
  async getMultiple(keys, useSync = false) {
    const storage = useSync ? this.sync : this.local;
    
    try {
      return await storage.get(keys);
    } catch (error) {
      logger.error('Failed to get multiple keys:', error);
      return {};
    }
  }

  /**
   * Set a single value in storage
   * @param {string} key - Storage key
   * @param {any} value - Value to store
   * @param {boolean} useSync - Use sync storage
   * @returns {Promise<boolean>}
   */
  async set(key, value, useSync = false) {
    const storage = useSync ? this.sync : this.local;
    
    try {
      await storage.set({ [key]: value });
      logger.debug(`Saved ${key}`);
      return true;
    } catch (error) {
      logger.error(`Failed to set ${key}:`, error);
      return false;
    }
  }

  /**
   * Set multiple values in storage
   * @param {Object} items - Key-value pairs to store
   * @param {boolean} useSync - Use sync storage
   * @returns {Promise<boolean>}
   */
  async setMultiple(items, useSync = false) {
    const storage = useSync ? this.sync : this.local;
    
    try {
      await storage.set(items);
      logger.debug(`Saved ${Object.keys(items).length} items`);
      return true;
    } catch (error) {
      logger.error('Failed to set multiple items:', error);
      return false;
    }
  }

  /**
   * Remove a key from storage
   * @param {string} key - Storage key
   * @param {boolean} useSync - Use sync storage
   * @returns {Promise<boolean>}
   */
  async remove(key, useSync = false) {
    const storage = useSync ? this.sync : this.local;
    
    try {
      await storage.remove(key);
      logger.debug(`Removed ${key}`);
      return true;
    } catch (error) {
      logger.error(`Failed to remove ${key}:`, error);
      return false;
    }
  }

  /**
   * Clear all storage (use with caution)
   * @param {boolean} useSync - Clear sync storage
   * @returns {Promise<boolean>}
   */
  async clear(useSync = false) {
    const storage = useSync ? this.sync : this.local;
    
    try {
      await storage.clear();
      logger.warn('Storage cleared');
      return true;
    } catch (error) {
      logger.error('Failed to clear storage:', error);
      return false;
    }
  }

  /**
   * Listen for storage changes
   * @param {Function} callback - Called when storage changes
   * @returns {Function} Unsubscribe function
   */
  onChange(callback) {
    const listener = (changes, areaName) => {
      callback(changes, areaName);
    };
    
    chrome.storage.onChanged.addListener(listener);
    
    // Return unsubscribe function
    return () => {
      chrome.storage.onChanged.removeListener(listener);
    };
  }
}

// Singleton instance
export const storage = new StorageManager();
