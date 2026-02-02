/**
 * Quick test to verify schedule functionality
 * Run this in the browser console after loading the extension
 */

async function testScheduleFunctionality() {
  console.log('='.repeat(60));
  console.log('SCHEDULE FUNCTIONALITY TEST');
  console.log('='.repeat(60));
  
  try {
    // Test 1: Get current schedule status
    console.log('\n1. Checking schedule status...');
    const status = await chrome.runtime.sendMessage({ type: 'GET_SCHEDULE_STATUS' });
    console.log('✓ Schedule Status:', {
      shouldBlock: status.shouldBlock,
      isPaused: status.isPaused,
      activeSchedule: status.activeSchedule?.name || 'None'
    });
    
    // Test 2: Get all schedules
    console.log('\n2. Getting schedules...');
    const schedules = await chrome.runtime.sendMessage({ type: 'GET_SCHEDULES' });
    console.log(`✓ Found ${schedules.schedules.length} schedule(s)`);
    schedules.schedules.forEach(s => {
      console.log(`  - ${s.name} (ID: ${s.id})`);
    });
    
    // Test 3: Get blocked sites
    console.log('\n3. Getting blocked sites...');
    const sites = await chrome.runtime.sendMessage({ type: 'GET_BLOCKED_SITES' });
    console.log(`✓ Found ${sites.sites.length} blocked site(s)`);
    const enabledSites = sites.sites.filter(s => s.enabled);
    console.log(`  - ${enabledSites.length} enabled`);
    
    // Test 4: Check active rules
    console.log('\n4. Checking declarativeNetRequest rules...');
    const rules = await chrome.declarativeNetRequest.getDynamicRules();
    console.log(`✓ Active blocking rules: ${rules.length}`);
    
    // Test 5: Verify consistency
    console.log('\n5. Verifying consistency...');
    if (status.shouldBlock) {
      if (rules.length === 0) {
        console.error('❌ PROBLEM: Should block but no rules active!');
      } else {
        console.log('✓ Blocking active and rules present');
      }
    } else {
      if (rules.length > 0) {
        console.error('❌ PROBLEM: Should NOT block but rules are active!');
      } else {
        console.log('✓ Blocking inactive and no rules present');
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Schedule Active: ${status.activeSchedule ? 'YES' : 'NO'}`);
    console.log(`Should Block Now: ${status.shouldBlock ? 'YES' : 'NO'}`);
    console.log(`Rules Active: ${rules.length}`);
    console.log(`Blocked Sites: ${enabledSites.length}`);
    
    if (status.shouldBlock && rules.length > 0) {
      console.log('\n✅ BLOCKING IS ACTIVE');
    } else if (!status.shouldBlock && rules.length === 0) {
      console.log('\n✅ BLOCKING IS DISABLED (outside schedule)');
    } else {
      console.log('\n⚠️  INCONSISTENT STATE - Check logs');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Auto-run
console.log('Schedule functionality test loaded. Running...\n');
testScheduleFunctionality();
