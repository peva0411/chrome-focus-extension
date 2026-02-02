// Emergency Schedule Fix - Run this in the browser console (F12)
// This will force an immediate schedule check and show detailed diagnostics

(async function emergencyScheduleCheck() {
  console.log('🔧 EMERGENCY SCHEDULE CHECK');
  console.log('='.repeat(70));
  
  try {
    // Get current time info
    const now = new Date();
    console.log(`Current Time: ${now.toLocaleString()}`);
    console.log(`Current Day: ${now.toLocaleDateString('en-US', { weekday: 'long' })}`);
    console.log(`Current Hour: ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`);
    console.log('');
    
    // Get schedule status
    console.log('📅 Getting schedule status...');
    const status = await chrome.runtime.sendMessage({ type: 'GET_SCHEDULE_STATUS' });
    console.log('Status:', JSON.stringify(status, null, 2));
    console.log('');
    
    // Get all schedules
    console.log('📋 Getting all schedules...');
    const { schedules } = await chrome.runtime.sendMessage({ type: 'GET_SCHEDULES' });
    console.log(`Found ${schedules.length} schedule(s)`);
    schedules.forEach(s => {
      console.log(`\nSchedule: ${s.name} (${s.id})`);
      console.log('Days:', JSON.stringify(s.days, null, 2));
    });
    console.log('');
    
    // Get active rules
    console.log('🚫 Checking active blocking rules...');
    const rules = await chrome.declarativeNetRequest.getDynamicRules();
    console.log(`Active Rules: ${rules.length}`);
    if (rules.length > 0) {
      console.log('First few rules:', rules.slice(0, 3));
    }
    console.log('');
    
    // Get blocked sites
    console.log('🌐 Getting blocked sites...');
    const { sites } = await chrome.runtime.sendMessage({ type: 'GET_BLOCKED_SITES' });
    const enabledSites = sites.filter(s => s.enabled);
    console.log(`Total Sites: ${sites.length} (${enabledSites.length} enabled)`);
    console.log('');
    
    // Diagnosis
    console.log('='.repeat(70));
    console.log('🔍 DIAGNOSIS');
    console.log('='.repeat(70));
    
    if (status.shouldBlock) {
      console.log('❌ PROBLEM: Schedule says blocking SHOULD be active');
      console.log('   This means the schedule check thinks we\'re still in blocking hours');
    } else {
      console.log('✅ Schedule says blocking should NOT be active');
    }
    
    if (rules.length > 0) {
      console.log('❌ PROBLEM: Blocking rules are ACTIVE');
      console.log(`   ${rules.length} rules are blocking sites`);
    } else {
      console.log('✅ No blocking rules active');
    }
    
    console.log('');
    console.log('='.repeat(70));
    console.log('🔧 ATTEMPTING MANUAL FIX...');
    console.log('='.repeat(70));
    
    // Try to manually disable blocking
    console.log('Removing all blocking rules...');
    const currentRules = await chrome.declarativeNetRequest.getDynamicRules();
    const ruleIds = currentRules.map(r => r.id);
    
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: ruleIds,
      addRules: []
    });
    
    console.log(`✅ REMOVED ${ruleIds.length} blocking rules`);
    console.log('');
    console.log('Sites should now be accessible!');
    console.log('Please refresh any blocked pages to test.');
    
  } catch (error) {
    console.error('❌ Emergency check failed:', error);
    console.error('Error details:', error.message, error.stack);
  }
})();
