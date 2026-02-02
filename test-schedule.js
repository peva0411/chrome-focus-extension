/**
 * Test script to verify schedule logic
 */

// Mock the current time for testing
function testScheduleLogic() {
  const DAYS_OF_WEEK = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday'
  ];

  function timeToMinutes(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  }

  function isTimeInSchedule(schedule, testDate) {
    const now = testDate || new Date();
    const dayName = DAYS_OF_WEEK[now.getDay() === 0 ? 6 : now.getDay() - 1];
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    console.log(`\nTesting: ${now.toLocaleString()}`);
    console.log(`Day index: ${now.getDay()}, Day name: ${dayName}`);
    console.log(`Current minutes: ${currentMinutes}`);

    const todayBlocks = schedule.days[dayName] || [];
    console.log(`Blocks for ${dayName}:`, todayBlocks);

    for (const block of todayBlocks) {
      const startMinutes = timeToMinutes(block.start);
      const endMinutes = timeToMinutes(block.end);

      console.log(`  Block: ${block.start}-${block.end} (${startMinutes}-${endMinutes})`);
      console.log(`  Check: ${currentMinutes} >= ${startMinutes} && ${currentMinutes} <= ${endMinutes}`);

      if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
        console.log(`  ✓ IN SCHEDULE - BLOCKING ACTIVE`);
        return true;
      } else {
        console.log(`  ✗ Outside schedule`);
      }
    }

    console.log(`Result: NOT IN SCHEDULE - BLOCKING INACTIVE`);
    return false;
  }

  // Example schedule: Block during work hours
  const testSchedule = {
    id: 'test-1',
    name: 'Work Hours',
    days: {
      monday: [{ start: '09:00', end: '17:00' }],
      tuesday: [{ start: '09:00', end: '17:00' }],
      wednesday: [{ start: '09:00', end: '17:00' }],
      thursday: [{ start: '09:00', end: '17:00' }],
      friday: [{ start: '09:00', end: '17:00' }],
      saturday: [],
      sunday: []
    }
  };

  console.log('='.repeat(60));
  console.log('SCHEDULE LOGIC TEST');
  console.log('='.repeat(60));
  console.log('Schedule:', JSON.stringify(testSchedule, null, 2));

  // Test various times
  const testTimes = [
    new Date('2026-01-15T08:30:00'), // Wednesday 8:30 AM - before schedule
    new Date('2026-01-15T09:00:00'), // Wednesday 9:00 AM - start of schedule
    new Date('2026-01-15T12:00:00'), // Wednesday 12:00 PM - during schedule
    new Date('2026-01-15T17:00:00'), // Wednesday 5:00 PM - end of schedule
    new Date('2026-01-15T17:01:00'), // Wednesday 5:01 PM - after schedule
    new Date('2026-01-15T18:00:00'), // Wednesday 6:00 PM - after schedule
    new Date('2026-01-18T12:00:00'), // Saturday 12:00 PM - weekend (no schedule)
  ];

  testTimes.forEach(time => {
    isTimeInSchedule(testSchedule, time);
  });

  console.log('\n' + '='.repeat(60));
}

// Run the test
testScheduleLogic();
