/**
 * Example Integration Test - Demonstrates Testing Patterns
 * 
 * This file showcases best practices for testing Chrome extensions:
 * - Time manipulation for schedule testing
 * - Storage setup and verification
 * - Chrome API interaction (alarms, DNR)
 * - Custom assertions
 * - Clean setup/teardown
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
  TEST_TIMES,
  advanceTime
} from '../helpers/time-helpers.js';
import {
  setupTestScenario,
  createTestSchedule,
  createTestBlockedSite,
  STORAGE_KEYS,
  getStorageValue,
  setupTestStorage
} from '../helpers/storage-helpers.js';
import {
  assertBlockingState,
  assertScheduleActive,
  assertAlarmExists,
  assertDNRRules,
  assertStorageValue
} from '../helpers/assertion-helpers.js';

describe('Example Integration Test - Testing Patterns', () => {
  let browser;
  let extensionId;
  let serviceWorkerTarget;
  let worker;

  // ============================================================================
  // SETUP & TEARDOWN
  // ============================================================================

  beforeAll(async () => {
    console.log('🚀 Loading extension for testing...');
    
    const loaded = await loadExtension({ 
      headless: false,  // Extensions require headed mode
      devtools: false   // Set to true for debugging
    });
    
    browser = loaded.browser;
    extensionId = loaded.extensionId;
    serviceWorkerTarget = loaded.serviceWorker;
    worker = await getServiceWorker(serviceWorkerTarget);
    
    await waitForExtensionReady(worker);
    console.log('✓ Extension ready with ID:', extensionId);
  }, 30000);

  afterAll(async () => {
    console.log('🧹 Cleaning up browser...');
    await cleanup(browser);
  });

  beforeEach(async () => {
    // Clean slate for each test
    await clearExtensionData(worker);
    console.log('✓ Test data cleared');
  });

  // ============================================================================
  // PATTERN 1: Testing Time-Based Schedule Logic
  // ============================================================================

  describe('Pattern: Time-Based Schedule Testing', () => {
    it('demonstrates time manipulation for schedule testing', async () => {
      // STEP 1: Install fake time - Monday 10:00 AM
      await installFakeTime(worker, TEST_TIMES.MONDAY_10AM);
      console.log('✓ Fake time installed: Monday 10:00 AM');

      // STEP 2: Set up test scenario with helpers
      await setupTestScenario(worker, {
        schedule: {
          days: [1, 2, 3, 4, 5], // Mon-Fri
          startTime: '09:00',
          endTime: '17:00'
        },
        blockedSites: [
          createTestBlockedSite({ pattern: 'facebook.com' })
        ]
      });
      console.log('✓ Test scenario configured');

      // STEP 3: Trigger schedule check
      await worker.evaluate(async () => {
        await scheduleManager.checkScheduleState();
      });

      // STEP 4: Verify blocking is active
      await assertBlockingState(worker, true);
      await assertScheduleActive(worker, true);
      console.log('✓ Blocking active during work hours');

      // STEP 5: Change time to after hours
      await setTime(worker, TEST_TIMES.MONDAY_6PM);
      console.log('✓ Time changed to 6:00 PM');

      // STEP 6: Check schedule again
      await worker.evaluate(async () => {
        await scheduleManager.checkScheduleState();
      });

      // STEP 7: Verify blocking is now inactive
      await assertBlockingState(worker, false);
      console.log('✓ Blocking disabled after work hours');

      // STEP 8: Clean up - restore real time
      await restoreTime(worker);
    });

    it('demonstrates advancing time incrementally', async () => {
      await installFakeTime(worker, '2026-01-19T08:55:00'); // 8:55 AM

      await setupTestScenario(worker, {
        schedule: createTestSchedule({
          startTime: '09:00',
          endTime: '17:00',
          days: [1] // Monday only
        })
      });

      // Before schedule start
      await worker.evaluate(async () => {
        await scheduleManager.checkScheduleState();
      });
      await assertBlockingState(worker, false);
      console.log('✓ 8:55 AM: Blocking inactive');

      // Advance 6 minutes (now 9:01 AM)
      await advanceTime(worker, 6 * 60 * 1000);
      await worker.evaluate(async () => {
        await scheduleManager.checkScheduleState();
      });
      await assertBlockingState(worker, true);
      console.log('✓ 9:01 AM: Blocking active');

      await restoreTime(worker);
    });
  });

  // ============================================================================
  // PATTERN 2: Testing Chrome APIs
  // ============================================================================

  describe('Pattern: Chrome API Testing', () => {
    it('demonstrates testing chrome.alarms', async () => {
      // Start monitoring (creates alarm)
      await worker.evaluate(async () => {
        await scheduleManager.startMonitoring();
      });

      // Verify alarm exists
      await assertAlarmExists(worker, 'scheduleCheck');
      console.log('✓ Schedule check alarm created');

      // Get alarm details
      const alarmInfo = await worker.evaluate(async () => {
        const alarm = await chrome.alarms.get('scheduleCheck');
        return {
          name: alarm.name,
          periodInMinutes: alarm.periodInMinutes,
          when: alarm.when
        };
      });

      expect(alarmInfo.periodInMinutes).toBe(1);
      console.log('✓ Alarm configured to fire every minute');

      // Manually trigger alarm handler
      await worker.evaluate(async () => {
        await scheduleManager.handleAlarm('scheduleCheck');
      });
      console.log('✓ Alarm handler executed');
    });

    it('demonstrates testing chrome.declarativeNetRequest', async () => {
      // Set up blocked sites
      const blockedSites = [
        createTestBlockedSite({ pattern: 'facebook.com', id: '1' }),
        createTestBlockedSite({ pattern: 'twitter.com', id: '2' }),
        createTestBlockedSite({ pattern: 'reddit.com', id: '3' })
      ];

      await setupTestStorage(worker, {
        [STORAGE_KEYS.BLOCKED_SITES]: blockedSites,
        [STORAGE_KEYS.BLOCKING_ENABLED]: true
      });

      // Reinitialize blocking manager
      await worker.evaluate(async () => {
        await blockingManager.initialize();
      });

      // Get dynamic rules
      const rules = await worker.evaluate(async () => {
        return await chrome.declarativeNetRequest.getDynamicRules();
      });

      // Verify rules were created
      assertDNRRules(rules, { minCount: 3 });
      console.log(`✓ Created ${rules.length} DNR rules`);

      // Verify rule structure
      expect(rules[0].action.type).toBe('redirect');
      expect(rules[0].action.redirect.url).toContain('blocked.html');
      expect(rules[0].condition.resourceTypes).toContain('main_frame');
      console.log('✓ Rules have correct structure');

      // Verify specific pattern
      assertDNRRules(rules, { pattern: 'facebook.com' });
      console.log('✓ Rules contain expected patterns');
    });

    it('demonstrates testing chrome.storage', async () => {
      // Set test data
      const testSchedule = createTestSchedule({
        id: 'test-schedule',
        name: 'My Schedule'
      });

      await setupTestStorage(worker, {
        [STORAGE_KEYS.SCHEDULES]: [testSchedule],
        [STORAGE_KEYS.ACTIVE_SCHEDULE]: 'test-schedule'
      });

      // Verify storage
      await assertStorageValue(
        worker,
        STORAGE_KEYS.SCHEDULES,
        [testSchedule]
      );
      console.log('✓ Storage contains expected data');

      // Read storage
      const activeSchedule = await getStorageValue(
        worker,
        STORAGE_KEYS.ACTIVE_SCHEDULE
      );
      expect(activeSchedule).toBe('test-schedule');
      console.log('✓ Can read from storage');

      // Update storage
      await worker.evaluate(async (key, value) => {
        await chrome.storage.local.set({ [key]: value });
      }, STORAGE_KEYS.BLOCKING_ENABLED, true);

      const blockingEnabled = await getStorageValue(
        worker,
        STORAGE_KEYS.BLOCKING_ENABLED
      );
      expect(blockingEnabled).toBe(true);
      console.log('✓ Can update storage');
    });
  });

  // ============================================================================
  // PATTERN 3: Testing Complex Workflows
  // ============================================================================

  describe('Pattern: Complex Workflow Testing', () => {
    it('demonstrates testing pause functionality', async () => {
      // Set up active schedule
      await installFakeTime(worker, TEST_TIMES.MONDAY_10AM);
      
      await setupTestScenario(worker, {
        schedule: {
          days: [1],
          startTime: '09:00',
          endTime: '17:00'
        }
      });

      // Verify blocking is active
      await worker.evaluate(async () => {
        await scheduleManager.checkScheduleState();
      });
      await assertBlockingState(worker, true);
      console.log('✓ Step 1: Blocking active');

      // Pause for 30 minutes
      await worker.evaluate(async () => {
        const pauseUntil = Date.now() + 30 * 60 * 1000;
        scheduleManager.pausedUntil = pauseUntil;
      });
      console.log('✓ Step 2: Paused for 30 minutes');

      // Verify blocking is paused
      const shouldBlockDuringPause = await worker.evaluate(async () => {
        return await scheduleManager.shouldBlockNow();
      });
      expect(shouldBlockDuringPause).toBe(false);
      console.log('✓ Step 3: Blocking inactive during pause');

      // Advance time past pause
      await advanceTime(worker, 31 * 60 * 1000); // 31 minutes
      console.log('✓ Step 4: Time advanced past pause');

      // Verify blocking resumed
      const shouldBlockAfterPause = await worker.evaluate(async () => {
        return await scheduleManager.shouldBlockNow();
      });
      expect(shouldBlockAfterPause).toBe(true);
      console.log('✓ Step 5: Blocking resumed after pause');

      await restoreTime(worker);
    });

    it('demonstrates testing schedule transitions', async () => {
      // Create schedule: 9 AM - 5 PM
      await setupTestScenario(worker, {
        schedule: {
          days: [1],
          startTime: '09:00',
          endTime: '17:00'
        }
      });

      // Test sequence of times
      const timeTests = [
        { time: TEST_TIMES.MONDAY_8AM, shouldBlock: false, label: '8 AM' },
        { time: TEST_TIMES.MONDAY_9AM, shouldBlock: true, label: '9 AM' },
        { time: TEST_TIMES.MONDAY_10AM, shouldBlock: true, label: '10 AM' },
        { time: TEST_TIMES.MONDAY_5PM, shouldBlock: false, label: '5 PM' },
        { time: TEST_TIMES.MONDAY_6PM, shouldBlock: false, label: '6 PM' }
      ];

      for (const test of timeTests) {
        await installFakeTime(worker, test.time);
        
        await worker.evaluate(async () => {
          await scheduleManager.checkScheduleState();
        });

        const isActive = await worker.evaluate(async () => {
          return await scheduleManager.shouldBlockNow();
        });

        expect(isActive).toBe(test.shouldBlock);
        console.log(
          `✓ ${test.label}: ${test.shouldBlock ? 'Blocking' : 'Not blocking'}`
        );
      }

      await restoreTime(worker);
    });
  });

  // ============================================================================
  // PATTERN 4: Testing Error Conditions
  // ============================================================================

  describe('Pattern: Error Handling', () => {
    it('demonstrates testing with invalid data', async () => {
      // Set up invalid schedule (no active schedule set)
      await setupTestStorage(worker, {
        [STORAGE_KEYS.SCHEDULES]: [createTestSchedule()],
        [STORAGE_KEYS.ACTIVE_SCHEDULE]: null // Invalid
      });

      await worker.evaluate(async () => {
        await scheduleManager.loadSchedules();
      });

      // Should not throw error
      const shouldBlock = await worker.evaluate(async () => {
        return await scheduleManager.shouldBlockNow();
      });

      expect(shouldBlock).toBe(false);
      console.log('✓ Handles missing active schedule gracefully');
    });

    it('demonstrates testing with disabled components', async () => {
      await setupTestScenario(worker, {
        schedule: {
          enabled: false, // Disabled
          days: [1],
          startTime: '09:00',
          endTime: '17:00'
        }
      });

      await installFakeTime(worker, TEST_TIMES.MONDAY_10AM);

      const shouldBlock = await worker.evaluate(async () => {
        return await scheduleManager.shouldBlockNow();
      });

      expect(shouldBlock).toBe(false);
      console.log('✓ Respects disabled schedule');

      await restoreTime(worker);
    });
  });

  // ============================================================================
  // PATTERN 5: Custom Evaluations
  // ============================================================================

  describe('Pattern: Custom Service Worker Evaluations', () => {
    it('demonstrates executing custom code in service worker', async () => {
      // Execute custom logic
      const result = await worker.evaluate(async () => {
        // Access extension globals
        const hasManagers = {
          blocking: typeof blockingManager !== 'undefined',
          schedule: typeof scheduleManager !== 'undefined',
          budget: typeof budgetManager !== 'undefined'
        };

        // Call extension functions
        const schedules = await chrome.storage.local.get('schedules');
        
        // Return custom object
        return {
          managers: hasManagers,
          schedulesCount: schedules.schedules?.length || 0,
          extensionReady: true
        };
      });

      expect(result.managers.blocking).toBe(true);
      expect(result.managers.schedule).toBe(true);
      expect(result.extensionReady).toBe(true);
      console.log('✓ Custom evaluation successful:', result);
    });

    it('demonstrates passing arguments to service worker', async () => {
      // Pass arguments to worker.evaluate
      const result = await worker.evaluate(
        async (pattern, enabled) => {
          // Arguments are available inside evaluation
          const site = {
            id: Date.now().toString(),
            pattern: pattern,
            enabled: enabled
          };

          await chrome.storage.local.set({
            testSite: site
          });

          return site;
        },
        'example.com',  // First argument
        true            // Second argument
      );

      expect(result.pattern).toBe('example.com');
      expect(result.enabled).toBe(true);
      console.log('✓ Arguments passed correctly:', result);
    });
  });
});
