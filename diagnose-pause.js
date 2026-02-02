/**
 * Pause Diagnostic Script
 * Run this in the service worker console to diagnose pause issues
 * 
 * Open Chrome DevTools for service worker:
 * chrome://extensions -> Focus Extension -> "service worker" link
 * 
 * Then paste this entire script into the console
 */

(async function diagnosePause() {
  console.log('=== PAUSE DIAGNOSTIC START ===\n');
  
  // Step 1: Check initial state
  console.log('1️⃣ INITIAL STATE:');
  console.log('   pausedUntil:', scheduleManager.pausedUntil);
  const initialShouldBlock = await scheduleManager.shouldBlockNow();
  console.log('   shouldBlockNow():', initialShouldBlock);
  const initialRules = await chrome.declarativeNetRequest.getDynamicRules();
  console.log('   Active DNR rules:', initialRules.length);
  console.log('   Rules:', initialRules.map(r => ({ id: r.id, url: r.condition.urlFilter })));
  
  // Step 2: Trigger pause
  console.log('\n2️⃣ PAUSING FOR 30 MINUTES...');
  const pausedUntil = await scheduleManager.pauseBlocking(30);
  console.log('   Pause completed, pausedUntil:', pausedUntil);
  console.log('   Pause time:', new Date(pausedUntil));
  
  // Step 3: Check state after pause
  console.log('\n3️⃣ STATE AFTER PAUSE:');
  console.log('   pausedUntil:', scheduleManager.pausedUntil);
  const pausedShouldBlock = await scheduleManager.shouldBlockNow();
  console.log('   shouldBlockNow():', pausedShouldBlock);
  const pausedRules = await chrome.declarativeNetRequest.getDynamicRules();
  console.log('   Active DNR rules:', pausedRules.length);
  console.log('   Rules:', pausedRules.map(r => ({ id: r.id, url: r.condition.urlFilter })));
  
  // Step 4: Summary
  console.log('\n4️⃣ DIAGNOSIS SUMMARY:');
  if (pausedShouldBlock === false && pausedRules.length === 0) {
    console.log('   ✅ PASS: Pause is working correctly!');
    console.log('   - shouldBlockNow() returns false');
    console.log('   - All DNR rules removed');
  } else {
    console.log('   ❌ FAIL: Pause is not working!');
    if (pausedShouldBlock !== false) {
      console.log('   - Problem: shouldBlockNow() is', pausedShouldBlock, 'but should be false');
    }
    if (pausedRules.length > 0) {
      console.log('   - Problem: DNR rules still active:', pausedRules.length);
    }
  }
  
  console.log('\n=== PAUSE DIAGNOSTIC END ===');
})();
