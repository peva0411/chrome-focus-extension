/**
 * SCHEDULE DIAGNOSTIC & FIX SCRIPT
 * 
 * Copy and paste this ENTIRE script into your browser console (F12)
 * It will diagnose and optionally fix schedule issues
 */

(async function scheduleDiagnostic() {
  console.clear();
  console.log('%c='.repeat(70), 'color: #667eea; font-weight: bold');
  console.log('%c🔧 SCHEDULE DIAGNOSTIC & FIX TOOL', 'color: #667eea; font-size: 18px; font-weight: bold');
  console.log('%c='.repeat(70), 'color: #667eea; font-weight: bold');
  console.log('');

  const log = (msg, color = '#68d391') => console.log(`%c${msg}`, `color: ${color}`);
  const error = (msg) => console.log(`%c❌ ${msg}`, 'color: #f56565; font-weight: bold');
  const success = (msg) => console.log(`%c✅ ${msg}`, 'color: #48bb78; font-weight: bold');
  const warn = (msg) => console.log(`%c⚠️  ${msg}`, 'color: #ed8936; font-weight: bold');
  
  let hasErrors = false;
  let diagnosis = {
    shouldBlock: null,
    ruleCount: null,
    scheduleAlarmExists: false,
    problems: []
  };

  try {
    // ====== SECTION 1: CURRENT TIME ======
    console.log('%c📅 CURRENT TIME', 'color: #a0aec0; font-weight: bold; font-size: 14px');
    const now = new Date();
    log(`  Time: ${now.toLocaleString()}`);
    log(`  Day: ${now.toLocaleDateString('en-US', { weekday: 'long' })}`);
    console.log('');

    // ====== SECTION 2: SCHEDULE STATUS ======
    console.log('%c🔍 SCHEDULE STATUS', 'color: #a0aec0; font-weight: bold; font-size: 14px');
    const status = await chrome.runtime.sendMessage({ type: 'GET_SCHEDULE_STATUS' });
    diagnosis.shouldBlock = status.shouldBlock;
    
    log(`  Should Block: ${status.shouldBlock ? '🔴 YES' : '🟢 NO'}`, status.shouldBlock ? '#f56565' : '#48bb78');
    log(`  Is Paused: ${status.isPaused ? 'YES' : 'NO'}`);
    log(`  Active Schedule: ${status.activeSchedule?.name || 'None'}`);
    
    if (status.activeSchedule) {
      console.log('');
      console.log('%c  📋 Schedule Details:', 'color: #a0aec0');
      const dayOfWeek = now.getDay();
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const today = dayNames[dayOfWeek];
      
      Object.entries(status.activeSchedule.days).forEach(([day, blocks]) => {
        if (blocks && blocks.length > 0) {
          const isToday = day === today;
          blocks.forEach(b => {
            log(`    ${day}${isToday ? ' (TODAY)' : ''}: ${b.start} - ${b.end}`, isToday ? '#68d391' : '#a0aec0');
          });
        }
      });
    }
    console.log('');

    // ====== SECTION 3: ALARMS ======
    console.log('%c⏰ CHROME ALARMS', 'color: #a0aec0; font-weight: bold; font-size: 14px');
    const alarms = await chrome.alarms.getAll();
    log(`  Found ${alarms.length} alarm(s)`);
    
    alarms.forEach(alarm => {
      const nextTrigger = new Date(alarm.scheduledTime);
      const secondsUntil = Math.round((alarm.scheduledTime - Date.now()) / 1000);
      log(`    • ${alarm.name}: Next in ${secondsUntil}s (at ${nextTrigger.toLocaleTimeString()})`, '#68d391');
      if (alarm.periodInMinutes) {
        log(`      Repeats every ${alarm.periodInMinutes} minute(s)`, '#a0aec0');
      }
    });
    
    const scheduleAlarm = alarms.find(a => a.name === 'scheduleCheck');
    diagnosis.scheduleAlarmExists = !!scheduleAlarm;
    
    if (!scheduleAlarm) {
      error('  Schedule alarm NOT FOUND!');
      diagnosis.problems.push('Schedule alarm is not running - schedule will not update automatically');
      hasErrors = true;
    }
    console.log('');

    // ====== SECTION 4: BLOCKING RULES ======
    console.log('%c🚫 BLOCKING RULES', 'color: #a0aec0; font-weight: bold; font-size: 14px');
    const rules = await chrome.declarativeNetRequest.getDynamicRules();
    diagnosis.ruleCount = rules.length;
    
    log(`  Active Rules: ${rules.length}`);
    if (rules.length > 0) {
      log(`  First 3 rules:`, '#a0aec0');
      rules.slice(0, 3).forEach(r => {
        log(`    Rule ${r.id}: ${r.action.type} - Priority ${r.priority}`, '#a0aec0');
      });
    }
    console.log('');

    // ====== SECTION 5: BLOCKED SITES ======
    console.log('%c🌐 BLOCKED SITES', 'color: #a0aec0; font-weight: bold; font-size: 14px');
    const { sites } = await chrome.runtime.sendMessage({ type: 'GET_BLOCKED_SITES' });
    const enabledSites = sites.filter(s => s.enabled);
    log(`  Total Sites: ${sites.length}`);
    log(`  Enabled: ${enabledSites.length}`);
    if (enabledSites.length > 0) {
      log(`  Sites:`, '#a0aec0');
      enabledSites.slice(0, 5).forEach(s => {
        log(`    • ${s.pattern}`, '#a0aec0');
      });
      if (enabledSites.length > 5) {
        log(`    ... and ${enabledSites.length - 5} more`, '#a0aec0');
      }
    }
    console.log('');

    // ====== SECTION 6: ANALYSIS ======
    console.log('%c='.repeat(70), 'color: #667eea; font-weight: bold');
    console.log('%c📊 ANALYSIS', 'color: #667eea; font-size: 16px; font-weight: bold');
    console.log('%c='.repeat(70), 'color: #667eea; font-weight: bold');
    console.log('');

    // Check 1: Alarm existence
    if (!scheduleAlarm) {
      error('CRITICAL: Schedule alarm is not running');
      error('→ The schedule will NEVER update automatically');
      error('→ FIX: Reload the extension');
      hasErrors = true;
    } else {
      success('Schedule alarm is running');
    }

    // Check 2: Rules vs schedule
    if (status.shouldBlock && rules.length === 0) {
      warn('Schedule says blocking should be active, but no rules exist');
      warn('→ This might be normal if you have no sites blocked');
    } else if (!status.shouldBlock && rules.length > 0) {
      error('PROBLEM: Schedule says blocking should be OFF, but rules are active');
      error(`→ ${rules.length} rules are blocking sites right now`);
      error('→ FIX: Run fixNow() to remove all rules');
      diagnosis.problems.push('Blocking rules are active when schedule says they should be disabled');
      hasErrors = true;
    } else if (status.shouldBlock && rules.length > 0) {
      success('Blocking is correctly active per schedule');
    } else {
      success('Blocking is correctly disabled per schedule');
    }

    console.log('');
    console.log('%c='.repeat(70), 'color: #667eea; font-weight: bold');
    
    if (hasErrors) {
      console.log('%c❌ PROBLEMS FOUND', 'color: #f56565; font-size: 16px; font-weight: bold');
      console.log('%c='.repeat(70), 'color: #667eea; font-weight: bold');
      console.log('');
      
      if (!scheduleAlarm) {
        console.log('%c🔧 To fix the alarm issue:', 'color: #ed8936; font-weight: bold');
        console.log('%c  1. Go to chrome://extensions/', 'color: #a0aec0');
        console.log('%c  2. Find "Focus Extension"', 'color: #a0aec0');
        console.log('%c  3. Click the reload button', 'color: #a0aec0');
        console.log('');
      }
      
      if (!status.shouldBlock && rules.length > 0) {
        console.log('%c🔧 To unblock sites NOW:', 'color: #ed8936; font-weight: bold');
        console.log('%c  Run: fixNow()', 'color: #68d391; font-weight: bold; font-size: 14px');
        console.log('');
      }
    } else {
      console.log('%c✅ EVERYTHING LOOKS GOOD!', 'color: #48bb78; font-size: 16px; font-weight: bold');
      console.log('%c='.repeat(70), 'color: #667eea; font-weight: bold');
      console.log('');
    }

    // ====== AVAILABLE COMMANDS ======
    console.log('%c📌 AVAILABLE COMMANDS:', 'color: #667eea; font-weight: bold; font-size: 14px');
    console.log('%c  fixNow()          ', 'color: #68d391; font-weight: bold', '- Remove all blocking rules immediately');
    console.log('%c  checkAlarms()     ', 'color: #68d391; font-weight: bold', '- View all active Chrome alarms');
    console.log('%c  forceCheck()      ', 'color: #68d391; font-weight: bold', '- Force schedule check right now');
    console.log('%c  viewSchedule()    ', 'color: #68d391; font-weight: bold', '- Show active schedule details');
    console.log('%c  reloadExtension() ', 'color: #68d391; font-weight: bold', '- Reload the Focus extension');
    console.log('');

  } catch (err) {
    error('DIAGNOSTIC FAILED: ' + err.message);
    console.error(err);
  }

  // ====== HELPER FUNCTIONS ======
  window.fixNow = async function() {
    console.log('%c🔧 Removing all blocking rules...', 'color: #ed8936; font-weight: bold');
    try {
      const rules = await chrome.declarativeNetRequest.getDynamicRules();
      const ruleIds = rules.map(r => r.id);
      
      if (ruleIds.length === 0) {
        console.log('%c  No rules to remove', 'color: #a0aec0');
        return;
      }
      
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: ruleIds,
        addRules: []
      });
      
      console.log(`%c✅ Success! Removed ${ruleIds.length} rules`, 'color: #48bb78; font-weight: bold');
      console.log('%c  Refresh any blocked pages to access them', 'color: #68d391');
    } catch (err) {
      console.error('Failed to remove rules:', err);
    }
  };

  window.checkAlarms = async function() {
    console.log('%c⏰ Checking alarms...', 'color: #a0aec0; font-weight: bold');
    const alarms = await chrome.alarms.getAll();
    console.table(alarms.map(a => ({
      name: a.name,
      scheduledTime: new Date(a.scheduledTime).toLocaleString(),
      periodInMinutes: a.periodInMinutes || 'once'
    })));
  };

  window.forceCheck = async function() {
    console.log('%c🔄 Forcing schedule check...', 'color: #a0aec0; font-weight: bold');
    try {
      const status = await chrome.runtime.sendMessage({ type: 'GET_SCHEDULE_STATUS' });
      console.log(`%c  Should Block: ${status.shouldBlock}`, 'color: #68d391');
      
      await new Promise(resolve => setTimeout(resolve, 500));
      const rules = await chrome.declarativeNetRequest.getDynamicRules();
      console.log(`%c  Active Rules: ${rules.length}`, 'color: #68d391');
      console.log('%c✅ Check complete', 'color: #48bb78');
    } catch (err) {
      console.error('Force check failed:', err);
    }
  };

  window.viewSchedule = async function() {
    const { schedules } = await chrome.runtime.sendMessage({ type: 'GET_SCHEDULES' });
    const activeSchedule = await chrome.runtime.sendMessage({ type: 'GET_SCHEDULE_STATUS' });
    
    console.log('%c📋 ALL SCHEDULES:', 'color: #667eea; font-weight: bold');
    schedules.forEach(s => {
      const isActive = s.id === activeSchedule.activeSchedule?.id;
      console.log(`\n%c${isActive ? '▶ ' : '  '}${s.name}${isActive ? ' (ACTIVE)' : ''}`, 
        isActive ? 'color: #48bb78; font-weight: bold' : 'color: #a0aec0');
      Object.entries(s.days).forEach(([day, blocks]) => {
        if (blocks && blocks.length > 0) {
          blocks.forEach(b => {
            console.log(`  ${day}: ${b.start} - ${b.end}`);
          });
        }
      });
    });
  };

  window.reloadExtension = async function() {
    if (!confirm('Reload the Focus extension?')) return;
    console.log('%c🔄 Reloading extension...', 'color: #a0aec0; font-weight: bold');
    try {
      await chrome.runtime.reload();
    } catch (err) {
      console.log('%c  Extension reload initiated', 'color: #68d391');
    }
  };

})();
