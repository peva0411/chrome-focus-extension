/**
 * Utility functions used across the extension
 */

/**
 * Generate a UUID v4
 * @returns {string}
 */
export function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get current date in YYYY-MM-DD format
 * @returns {string}
 */
export function getCurrentDate() {
  const date = new Date();
  return date.toISOString().split('T')[0];
}

/**
 * Get current time in HH:MM format
 * @returns {string}
 */
export function getCurrentTime() {
  const date = new Date();
  return date.toTimeString().slice(0, 5);
}

/**
 * Parse time string to minutes since midnight
 * @param {string} timeString - Format: "HH:MM"
 * @returns {number}
 */
export function timeToMinutes(timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Convert minutes to HH:MM format
 * @param {number} minutes
 * @returns {string}
 */
export function minutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Format minutes to human readable time
 * @param {number} minutes
 * @returns {string} e.g., "1h 30m" or "45m"
 */
export function formatMinutes(minutes) {
  if (minutes < 1) return '< 1m';
  
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/**
 * Debounce function calls
 * @param {Function} func
 * @param {number} wait - Milliseconds
 * @returns {Function}
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function calls
 * @param {Function} func
 * @param {number} limit - Milliseconds
 * @returns {Function}
 */
export function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}
