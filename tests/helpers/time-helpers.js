/**
 * Time Manipulation Helpers for Testing Time-Based Features
 * Based on research recommendations for testing schedules and alarms
 */

/**
 * Install fake Date in service worker context
 * Allows controlling time for schedule-based tests
 * @param {WebWorker} worker - Service worker instance
 * @param {string|Date} fakeTime - Time to set (ISO string or Date object)
 */
export async function installFakeTime(worker, fakeTime) {
  await worker.evaluate((timeString) => {
    const OriginalDate = Date;
    let currentFakeTime = new OriginalDate(timeString);
    
    // Use self for service worker context (globalThis also works)
    const globalScope = typeof self !== 'undefined' ? self : globalThis;
    
    // Store original for restoration
    if (!globalScope.__originalDate) {
      globalScope.__originalDate = OriginalDate;
    }
    
    // Mock Date constructor and static methods
    globalScope.Date = class extends OriginalDate {
      constructor(...args) {
        if (args.length === 0) {
          super(currentFakeTime);
        } else {
          super(...args);
        }
      }
      
      static now() {
        return currentFakeTime.getTime();
      }
    };
    
    // Also update global Date
    Date = globalScope.Date;
    
    // Expose function to advance time in tests
    globalScope.__setTestTime = (newTime) => {
      currentFakeTime = new OriginalDate(newTime);
    };
    
    // Expose function to advance time by duration
    globalScope.__advanceTime = (milliseconds) => {
      currentFakeTime = new OriginalDate(currentFakeTime.getTime() + milliseconds);
    };
  }, typeof fakeTime === 'string' ? fakeTime : fakeTime.toISOString());
}

/**
 * Set time to specific moment
 * @param {WebWorker} worker - Service worker instance
 * @param {string|Date} time - Time to set
 */
export async function setTime(worker, time) {
  await worker.evaluate((timeString) => {
    const globalScope = typeof self !== 'undefined' ? self : globalThis;
    if (globalScope.__setTestTime) {
      globalScope.__setTestTime(timeString);
    }
  }, typeof time === 'string' ? time : time.toISOString());
}

/**
 * Advance time by specified duration
 * @param {WebWorker} worker - Service worker instance
 * @param {number} milliseconds - Duration to advance in ms
 */
export async function advanceTime(worker, milliseconds) {
  await worker.evaluate((ms) => {
    const globalScope = typeof self !== 'undefined' ? self : globalThis;
    if (globalScope.__advanceTime) {
      globalScope.__advanceTime(ms);
    }
  }, milliseconds);
}

/**
 * Restore original Date implementation
 * @param {WebWorker} worker - Service worker instance
 */
export async function restoreTime(worker) {
  await worker.evaluate(() => {
    const globalScope = typeof self !== 'undefined' ? self : globalThis;
    if (globalScope.__originalDate) {
      globalScope.Date = globalScope.__originalDate;
      Date = globalScope.__originalDate;
      delete globalScope.__originalDate;
      delete globalScope.__setTestTime;
      delete globalScope.__advanceTime;
    }
  });
}

/**
 * Common test times for schedule testing
 * Note: These times are in LOCAL timezone (no Z suffix) to match the schedule manager's use of local time
 */
export const TEST_TIMES = {
  // Monday 9:00 AM - typical work schedule start
  MONDAY_9AM: '2026-01-19T09:00:00',
  
  // Monday 10:00 AM - during work hours
  MONDAY_10AM: '2026-01-19T10:00:00',
  
  // Monday 5:00 PM - typical work schedule end
  MONDAY_5PM: '2026-01-19T17:00:00',
  
  // Monday 8:00 AM - before work hours
  MONDAY_8AM: '2026-01-19T08:00:00',
  
  // Monday 6:00 PM - after work hours
  MONDAY_6PM: '2026-01-19T18:00:00',
  
  // Saturday 10:00 AM - weekend
  SATURDAY_10AM: '2026-01-24T10:00:00',
  
  // Tuesday 2:00 PM - mid-week afternoon
  TUESDAY_2PM: '2026-01-20T14:00:00',
  
  // Friday 4:30 PM - near end of work week
  FRIDAY_430PM: '2026-01-23T16:30:00'
};

/**
 * Create a date in the current week
 * @param {number} dayOfWeek - 0=Sunday, 1=Monday, etc.
 * @param {string} time - Time in HH:MM format
 * @returns {Date}
 */
export function createTestDate(dayOfWeek, time) {
  const now = new Date();
  const currentDay = now.getDay();
  const diff = dayOfWeek - currentDay;
  
  const targetDate = new Date(now);
  targetDate.setDate(now.getDate() + diff);
  
  const [hours, minutes] = time.split(':').map(Number);
  targetDate.setHours(hours, minutes, 0, 0);
  
  return targetDate;
}

/**
 * Wait for time-based condition with timeout
 * @param {Function} condition - Async function that returns boolean
 * @param {Object} options - Options
 * @param {number} options.timeout - Timeout in ms (default: 5000)
 * @param {number} options.interval - Check interval in ms (default: 100)
 * @returns {Promise<boolean>}
 */
export async function waitForCondition(condition, options = {}) {
  const timeout = options.timeout || 5000;
  const interval = options.interval || 100;
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error('Condition timeout exceeded');
}
