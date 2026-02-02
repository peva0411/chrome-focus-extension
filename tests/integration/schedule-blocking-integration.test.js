/**
 * Integration Tests for Schedule + Blocking
 * Tests the full integration between ScheduleManager and BlockingManager
 * Uses Puppeteer to test in real Chrome environment
 */

import { describe, it, beforeAll, afterAll, beforeEach, expect } from '@jest/globals';
import {
  loadExtension,
  getServiceWorker,
  waitForExtensionReady,
  clearExtensionData,
  cleanup
} from '../helpers/extension-loader.js';
import {
  installFakeTime,
  setTime,
  restoreTime,
  TEST_TIMES
} from '../helpers/time-helpers.js';
import {
  setupTestScenario,
  STORAGE_KEYS,
  getStorageValue
} from '../helpers/storage-helpers.js';
import {
  assertBlockingState,
  assertScheduleActive,
  assertAlarmExists,
  assertDNRRules
} from '../helpers/assertion-helpers.js';

describe('Schedule + Blocking Integration Tests', () => {
  let browser;
  let extensionId;
  let serviceWorkerTarget;
  let worker;

  beforeAll(async () => {
    console.log('Loading extension...');
    const loaded = await loadExtension({ headless: false });
    browser = loaded.browser;
    extensionId = loaded.extensionId;
    serviceWorkerTarget = loaded.serviceWorker;
    worker = await getServiceWorker(serviceWorkerTarget);
    
    await waitForExtensionReady(worker);
    console.log('Extension ready for testing');
  }, 30000);

  afterAll(async () => {
    await cleanup(browser);
  });

  beforeEach(async () => {
    // Clear all data before each test
    await clearExtensionData(worker);
  });

  describe('Service Worker Initialization', () => {
    it('should initialize all managers correctly', async () => {
      const managers = await worker.evaluate(() => {
        return {
          blockingManager: typeof blockingManager !== 'undefined',
          scheduleManager: typeof scheduleManager !== 'undefined',
          budgetManager: typeof budgetManager !== 'undefined',
          statisticsManager: typeof statisticsManager !== 'undefined'
        };
      });

      expect(managers.blockingManager).toBe(true);
      expect(managers.scheduleManager).toBe(true);
      expect(managers.budgetManager).toBe(true);
      expect(managers.statisticsManager).toBe(true);
    });

    it('should have correct extension ID', () => {
      expect(extensionId).toMatch(/^[a-z]{32}$/);
    });
  });

  describe('Schedule-Based Blocking Activation', () => {
    it('should enable blocking during active schedule period', async () => {
      // Install fake time: Monday 10:00 AM
      await installFakeTime(worker, TEST_TIMES.MONDAY_10AM);

      // Set up test scenario
      await setupTestScenario(worker, {
        schedule: {
          days: [1, 2, 3, 4, 5], // Mon-Fri
          startTime: '09:00',
          endTime: '17:00'
        },
        blockedSites: [
          { pattern: 'facebook.com' },
          { pattern: 'twitter.com' }
        ]
      });

      // Trigger schedule check
      await worker.evaluate(async () => {
        await scheduleManager.checkScheduleState();
      });

      // Verify blocking is enabled
      await assertBlockingState(worker, true);
      await assertScheduleActive(worker, true);
    }, 30000);

    it('should disable blocking outside schedule hours', async () => {
      // Install fake time: Monday 8:00 AM (before 9am start)
      await installFakeTime(worker, TEST_TIMES.MONDAY_8AM);

      await setupTestScenario(worker, {
        schedule: {
          days: [1, 2, 3, 4, 5],
          startTime: '09:00',
          endTime: '17:00'
        }
      });

      await worker.evaluate(async () => {
        await scheduleManager.checkScheduleState();
      });

      // Verify blocking is disabled
      await assertBlockingState(worker, false);
      await assertScheduleActive(worker, false);
    });

    it('should disable blocking on non-scheduled days', async () => {
      // Install fake time: Saturday 10:00 AM
      await installFakeTime(worker, TEST_TIMES.SATURDAY_10AM);

      await setupTestScenario(worker, {
        schedule: {
          days: [1, 2, 3, 4, 5], // Mon-Fri only
          startTime: '09:00',
          endTime: '17:00'
        }
      });

      await worker.evaluate(async () => {
        await scheduleManager.checkScheduleState();
      });

      await assertBlockingState(worker, false);
      await assertScheduleActive(worker, false);
    });

    it('should transition from inactive to active when schedule starts', async () => {
      // Start at 8:59 AM (just before schedule)
      await installFakeTime(worker, '2026-01-19T08:59:00');

      await setupTestScenario(worker, {
        schedule: {
          days: [1],
          startTime: '09:00',
          endTime: '17:00'
        }
      });

      // Check state - should be inactive
      await worker.evaluate(async () => {
        await scheduleManager.checkScheduleState();
      });
      await assertBlockingState(worker, false);

      // Advance time to 9:01 AM (after schedule start)
      await setTime(worker, '2026-01-19T09:01:00');

      // Check state again - should now be active
      await worker.evaluate(async () => {
        await scheduleManager.checkScheduleState();
      });
      await assertBlockingState(worker, true);
    });

    it('should transition from active to inactive when schedule ends', async () => {
      // Start at 4:59 PM (just before end)
      await installFakeTime(worker, '2026-01-19T16:59:00');

      await setupTestScenario(worker, {
        schedule: {
          days: [1],
          startTime: '09:00',
          endTime: '17:00'
        }
      });

      // Check state - should be active
      await worker.evaluate(async () => {
        await scheduleManager.checkScheduleState();
      });
      await assertBlockingState(worker, true);

      // Advance time to 5:01 PM (after schedule end)
      await setTime(worker, '2026-01-19T17:01:00');

      // Check state again - should now be inactive
      await worker.evaluate(async () => {
        await scheduleManager.checkScheduleState();
      });
      await assertBlockingState(worker, false);
    });
  });

  describe('Alarm-Based Schedule Monitoring', () => {
    it('should create schedule check alarm on initialization', async () => {
      await worker.evaluate(async () => {
        await scheduleManager.startMonitoring();
      });

      await assertAlarmExists(worker, 'scheduleCheck');
    });

    it('should configure alarm to fire every minute', async () => {
      await worker.evaluate(async () => {
        await scheduleManager.startMonitoring();
      });

      const alarmConfig = await worker.evaluate(async () => {
        const alarm = await chrome.alarms.get('scheduleCheck');
        return {
          periodInMinutes: alarm.periodInMinutes,
          exists: !!alarm
        };
      });

      expect(alarmConfig.exists).toBe(true);
      expect(alarmConfig.periodInMinutes).toBe(1);
    });

    it('should handle alarm events and update blocking state', async () => {
      await installFakeTime(worker, TEST_TIMES.MONDAY_10AM);

      await setupTestScenario(worker, {
        schedule: {
          days: [1],
          startTime: '09:00',
          endTime: '17:00'
        }
      });

      // Manually trigger alarm handler
      await worker.evaluate(async () => {
        await scheduleManager.handleAlarm('scheduleCheck');
      });

      // Verify blocking state was updated
      const blockingEnabled = await getStorageValue(worker, STORAGE_KEYS.BLOCKING_ENABLED);
      expect(blockingEnabled).toBe(true);
    });
  });

  describe('DeclarativeNetRequest Rules', () => {
    it('should create DNR rules for blocked sites', async () => {
      await setupTestScenario(worker, {
        blockedSites: [
          { pattern: 'facebook.com' },
          { pattern: 'twitter.com' },
          { pattern: 'reddit.com' }
        ]
      });

      const rules = await worker.evaluate(async () => {
        return await chrome.declarativeNetRequest.getDynamicRules();
      });

      assertDNRRules(rules, { minCount: 3 });
    });

    it('should create redirect rules to blocked page', async () => {
      await setupTestScenario(worker, {
        blockedSites: [{ pattern: 'facebook.com' }]
      });

      const rules = await worker.evaluate(async () => {
        return await chrome.declarativeNetRequest.getDynamicRules();
      });

      expect(rules.length).toBeGreaterThan(0);
      expect(rules[0].action.type).toBe('redirect');
      expect(rules[0].action.redirect.url).toContain('blocked.html');
    });

    it('should update rules when blocking is enabled/disabled', async () => {
      await setupTestScenario(worker, {
        blockedSites: [{ pattern: 'example.com' }],
        blockingEnabled: false
      });

      // Initially should have no rules (blocking disabled)
      let rules = await worker.evaluate(async () => {
        return await chrome.declarativeNetRequest.getDynamicRules();
      });
      
      // Enable blocking
      await worker.evaluate(async () => {
        await chrome.storage.local.set({ blockingEnabled: true });
        await blockingManager.initialize();
      });

      // Should now have rules
      rules = await worker.evaluate(async () => {
        return await chrome.declarativeNetRequest.getDynamicRules();
      });

      expect(rules.length).toBeGreaterThan(0);
    });

    it('should handle URL patterns correctly', async () => {
      await setupTestScenario(worker, {
        blockedSites: [
          { pattern: 'facebook.com' },
          { pattern: 'www.youtube.com' },
          { pattern: 'reddit.com/r/all' }
        ]
      });

      const rules = await worker.evaluate(async () => {
        return await chrome.declarativeNetRequest.getDynamicRules();
      });

      // Verify rules contain correct patterns
      assertDNRRules(rules, { pattern: 'facebook.com' });
      assertDNRRules(rules, { pattern: 'youtube.com' });
      assertDNRRules(rules, { pattern: 'reddit.com' });
    });
  });

  describe('Pause Functionality', () => {
    it('should respect pause even during active schedule', async () => {
      await installFakeTime(worker, TEST_TIMES.MONDAY_10AM);

      await setupTestScenario(worker, {
        schedule: {
          days: [1],
          startTime: '09:00',
          endTime: '17:00'
        }
      });

      // Set pause until 2:00 PM (4 hours from now)
      await worker.evaluate(async () => {
        const pauseUntil = Date.now() + 4 * 60 * 60 * 1000; // 4 hours from now
        scheduleManager.pausedUntil = pauseUntil;
      });

      // Check if should block
      const shouldBlock = await worker.evaluate(async () => {
        return await scheduleManager.shouldBlockNow();
      });

      expect(shouldBlock).toBe(false);
    });

    it('should resume blocking after pause expires', async () => {
      await installFakeTime(worker, TEST_TIMES.MONDAY_10AM);

      await setupTestScenario(worker, {
        schedule: {
          days: [1],
          startTime: '09:00',
          endTime: '17:00'
        }
      });

      // Set pause to past time (1 second ago)
      await worker.evaluate(async () => {
        const pauseUntil = Date.now() - 1000;
        scheduleManager.pausedUntil = pauseUntil;
      });

      // Check if should block
      const shouldBlock = await worker.evaluate(async () => {
        return await scheduleManager.shouldBlockNow();
      });

      expect(shouldBlock).toBe(true);
    });
  });

  describe('Multiple Schedules', () => {
    it('should only apply active schedule', async () => {
      await installFakeTime(worker, TEST_TIMES.MONDAY_10AM);

      // Create two schedules with different times
      await worker.evaluate(async () => {
        const schedules = [
          {
            id: 'schedule-1',
            name: 'Morning',
            enabled: true,
            days: [1],
            startTime: '08:00',
            endTime: '12:00'
          },
          {
            id: 'schedule-2',
            name: 'Afternoon',
            enabled: true,
            days: [1],
            startTime: '13:00',
            endTime: '18:00'
          }
        ];

        await chrome.storage.local.set({
          schedules: schedules,
          activeSchedule: 'schedule-1' // Morning schedule
        });

        await scheduleManager.loadSchedules();
      });

      // At 10 AM, morning schedule should be active
      const shouldBlock = await worker.evaluate(async () => {
        return await scheduleManager.shouldBlockNow();
      });

      expect(shouldBlock).toBe(true);

      // Change time to 12:30 PM (after morning, before afternoon)
      await setTime(worker, '2026-01-19T12:30:00');

      const shouldBlockAfternoon = await worker.evaluate(async () => {
        return await scheduleManager.shouldBlockNow();
      });

      expect(shouldBlockAfternoon).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing schedule gracefully', async () => {
      await worker.evaluate(async () => {
        await chrome.storage.local.set({
          schedules: [],
          activeSchedule: 'non-existent-schedule'
        });
        await scheduleManager.loadSchedules();
      });

      // Should not throw and should return false
      const shouldBlock = await worker.evaluate(async () => {
        return await scheduleManager.shouldBlockNow();
      });

      expect(shouldBlock).toBe(false);
    });

    it('should handle disabled schedule', async () => {
      await installFakeTime(worker, TEST_TIMES.MONDAY_10AM);

      await setupTestScenario(worker, {
        schedule: {
          enabled: false, // Disabled
          days: [1],
          startTime: '09:00',
          endTime: '17:00'
        }
      });

      const shouldBlock = await worker.evaluate(async () => {
        return await scheduleManager.shouldBlockNow();
      });

      expect(shouldBlock).toBe(false);
    });
  });
});
