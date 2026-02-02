/**
 * Enhanced Pause Test - Tests pause when blocking IS active
 * Run this in the service worker console
 */

(async function testPauseWithBlocking() {
  console.log('=== ENHANCED PAUSE TEST START ===\n');
  
  // Step 1: Check current state
  console.log('1️⃣ CURRENT STATE:');
  const settings = await chrome.storage.local.get('settings');
  console.log('   Extension enabled:', settings.settings?.enabled);
  const sites = await chrome.storage.local.get('blockedSites');
  console.log('   Blocked sites:', sites.blockedSites?.length || 0);
  const initialRules = await chrome.declarativeNetRequest.getDynamicRules();
  console.log('   Active DNR rules:', initialRules.length);
  
  // Step 2: Ensure we have blocked sites and extension is enabled
  if (!sites.blockedSites || sites.blockedSites.length === 0) {
    console.log('\n⚠️  No blocked sites configured!');
    console.log('   Please add some blocked sites first in the extension options.');
    console.log('   Then run this test again.');
    return;
  }
  
  // Step 3: Enable blocking (bypass schedule)
  console.log('\n2️⃣ ENABLING BLOCKING...');
  await blockingManager.setBlockingEnabled(true);
  const rulesAfterEnable = await chrome.declarativeNetRequest.getDynamicRules();
  console.log('   Active DNR rules after enable:', rulesAfterEnable.length);
  
  if (rulesAfterEnable.length === 0) {
    console.log('   ⚠️  No rules created! Check if sites are enabled.');
    return;
  }
  
  console.log('   ✅ Blocking is now ACTIVE with', rulesAfterEnable.length, 'rules');
  
  // Step 4: Test pause
  console.log('\n3️⃣ PAUSING FOR 30 MINUTES...');
  const pausedUntil = await scheduleManager.pauseBlocking(30);
  console.log('   Paused until:', new Date(pausedUntil));
  
  // Step 5: Check state after pause
  console.log('\n4️⃣ STATE AFTER PAUSE:');
  const pausedShouldBlock = await scheduleManager.shouldBlockNow();
  console.log('   shouldBlockNow():', pausedShouldBlock);
  const pausedRules = await chrome.declarativeNetRequest.getDynamicRules();
  console.log('   Active DNR rules:', pausedRules.length);
  
  // Step 6: Summary
  console.log('\n5️⃣ TEST RESULT:');
  if (pausedShouldBlock === false && pausedRules.length === 0) {
    console.log('   ✅✅✅ SUCCESS! Pause is working correctly!');
    console.log('   - Blocking was active (' + rulesAfterEnable.length + ' rules)');
    console.log('   - After pause: 0 rules (all removed)');
    console.log('   - Sites are now accessible during pause');
  } else {
    console.log('   ❌ FAIL: Pause did not work correctly');
    if (pausedShouldBlock !== false) {
      console.log('   - Problem: shouldBlockNow() returned', pausedShouldBlock);
    }
    if (pausedRules.length > 0) {
      console.log('   - Problem: Still have', pausedRules.length, 'active rules');
    }
  }
  
  // Step 7: Test resume
  console.log('\n6️⃣ TESTING RESUME...');
  await scheduleManager.resumeBlocking();
  await scheduleManager.checkScheduleState();
  
  // Wait a moment for state to update
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const resumedRules = await chrome.declarativeNetRequest.getDynamicRules();
  console.log('   Rules after resume:', resumedRules.length);
  
  if (resumedRules.length > 0) {
    console.log('   ✅ Resume works! Blocking re-enabled with', resumedRules.length, 'rules');
  } else {
    console.log('   ℹ️  No rules after resume (may be outside schedule window)');
  }
  
  console.log('\n=== ENHANCED PAUSE TEST COMPLETE ===');
})();
