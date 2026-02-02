// Debug script to check blocking rules
// Run this in the extension's service worker console (chrome://extensions -> Focus Extension -> service worker -> Console)

console.log('=== DEBUGGING EXCEPTION RULES ===\n');

// Check storage
chrome.storage.local.get(['blockedSites'], (data) => {
  console.log('📦 Blocked sites in storage:');
  if (data.blockedSites) {
    data.blockedSites.forEach(site => {
      console.log(`  - ${site.pattern} (enabled: ${site.enabled})`);
      if (site.exceptions && site.exceptions.length > 0) {
        console.log(`    Exceptions: ${site.exceptions.join(', ')}`);
      }
    });
  }
  console.log('');
});

// Check actual rules
chrome.declarativeNetRequest.getDynamicRules((rules) => {
  console.log(`📋 Total dynamic rules: ${rules.length}\n`);
  
  const blockRules = rules.filter(r => r.action.type === 'redirect');
  const allowRules = rules.filter(r => r.action.type === 'allow');
  
  console.log(`🚫 Block rules: ${blockRules.length}`);
  blockRules.forEach(rule => {
    console.log('  Rule ID:', rule.id);
    console.log('  Priority:', rule.priority);
    console.log('  Condition:', rule.condition);
    if (rule.condition.excludedRequestDomains) {
      console.log('  Excluded domains:', rule.condition.excludedRequestDomains);
    }
    console.log('');
  });
  
  console.log(`✅ Allow rules: ${allowRules.length}`);
  allowRules.forEach(rule => {
    console.log('  Rule ID:', rule.id);
    console.log('  Priority:', rule.priority);
    console.log('  Condition:', rule.condition);
    console.log('');
  });
});

// Test URL matching
console.log('🧪 Testing URL matching:');
console.log('  Visit music.youtube.com and see which rule triggers');
