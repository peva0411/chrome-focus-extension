// Storage Keys
export const STORAGE_KEYS = {
  BLOCKED_SITES: 'blockedSites',
  SCHEDULES: 'schedules',
  ACTIVE_SCHEDULE: 'activeSchedule',
  TIME_BUDGET: 'timeBudget',
  SETTINGS: 'settings',
  STATISTICS: 'statistics'
};

// Default Values
export const DEFAULTS = {
  settings: {
    version: '0.1.0',
    enabled: true,
    notifications: {
      budgetWarnings: true,
      lowBudget: true,
      budgetExhausted: true
    },
    theme: 'light',
    interstitialDelay: 5,
    showMotivationalQuotes: true,
    pauseDuration: 30 // Default pause duration in minutes
  },
  
  timeBudget: {
    globalBudget: 30, // minutes
    resetTime: '00:00',
    today: null // will be initialized on first run
  },
  
  blockedSites: [],
  schedules: [],
  activeSchedule: null
};

// Extension States
export const EXTENSION_STATE = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  DISABLED: 'disabled'
};

// Time constants
export const TIME = {
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000
};

// Budget warning thresholds
export const BUDGET_THRESHOLDS = {
  LOW: 0.5,      // 50%
  VERY_LOW: 0.25, // 25%
  CRITICAL: 0.1   // 10%
};

// Days of week
export const DAYS_OF_WEEK = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday'
];

// Pause durations
export const PAUSE_DURATIONS = [
  { label: '15 minutes', minutes: 15 },
  { label: '30 minutes', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '2 hours', minutes: 120 },
  { label: 'Until tomorrow', minutes: -1 }
];

// Schedule templates
export const SCHEDULE_TEMPLATES = {
  WORKDAY: {
    name: '9-5 Workday',
    description: 'Block during standard work hours, Monday-Friday',
    schedule: {
      monday: [{ start: '09:00', end: '17:00' }],
      tuesday: [{ start: '09:00', end: '17:00' }],
      wednesday: [{ start: '09:00', end: '17:00' }],
      thursday: [{ start: '09:00', end: '17:00' }],
      friday: [{ start: '09:00', end: '17:00' }],
      saturday: [],
      sunday: []
    }
  },
  STUDY_EVENING: {
    name: 'Evening Study',
    description: 'Block 7pm-11pm every night',
    schedule: {
      monday: [{ start: '19:00', end: '23:00' }],
      tuesday: [{ start: '19:00', end: '23:00' }],
      wednesday: [{ start: '19:00', end: '23:00' }],
      thursday: [{ start: '19:00', end: '23:00' }],
      friday: [{ start: '19:00', end: '23:00' }],
      saturday: [{ start: '19:00', end: '23:00' }],
      sunday: [{ start: '19:00', end: '23:00' }]
    }
  },
  DEEP_FOCUS: {
    name: 'Deep Focus Blocks',
    description: 'Morning and afternoon focus blocks with lunch break',
    schedule: {
      monday: [
        { start: '09:00', end: '12:00' },
        { start: '14:00', end: '17:00' }
      ],
      tuesday: [
        { start: '09:00', end: '12:00' },
        { start: '14:00', end: '17:00' }
      ],
      wednesday: [
        { start: '09:00', end: '12:00' },
        { start: '14:00', end: '17:00' }
      ],
      thursday: [
        { start: '09:00', end: '12:00' },
        { start: '14:00', end: '17:00' }
      ],
      friday: [
        { start: '09:00', end: '12:00' },
        { start: '14:00', end: '17:00' }
      ],
      saturday: [],
      sunday: []
    }
  },
  ALWAYS_ON: {
    name: 'Always Active',
    description: 'Block 24/7',
    schedule: {
      monday: [{ start: '00:00', end: '23:59' }],
      tuesday: [{ start: '00:00', end: '23:59' }],
      wednesday: [{ start: '00:00', end: '23:59' }],
      thursday: [{ start: '00:00', end: '23:59' }],
      friday: [{ start: '00:00', end: '23:59' }],
      saturday: [{ start: '00:00', end: '23:59' }],
      sunday: [{ start: '00:00', end: '23:59' }]
    }
  }
};
