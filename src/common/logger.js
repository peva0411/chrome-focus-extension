/**
 * Simple logger with levels
 */
export class Logger {
  constructor(context = 'FocusExt') {
    this.context = context;
    this.enabled = true;
  }

  _log(level, ...args) {
    if (!this.enabled) return;
    
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${this.context}] [${level}]`;
    
    console[level === 'ERROR' ? 'error' : 'log'](prefix, ...args);
  }

  debug(...args) {
    this._log('DEBUG', ...args);
  }

  info(...args) {
    this._log('INFO', ...args);
  }

  warn(...args) {
    this._log('WARN', ...args);
  }

  error(...args) {
    this._log('ERROR', ...args);
  }
}
