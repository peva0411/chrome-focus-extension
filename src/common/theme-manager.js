import { storage } from './storage.js';
import { STORAGE_KEYS } from './constants.js';

export class ThemeManager {
  constructor() {
    this.currentTheme = 'light';
    this.mediaQuery = null;
  }

  async initialize() {
    const settings = await storage.get(STORAGE_KEYS.SETTINGS);
    const theme = settings?.theme || 'light';
    this.applyTheme(theme);
    
    // Listen for system theme changes if auto is selected
    if (theme === 'auto') {
      this.setupAutoThemeListener();
    }
  }

  applyTheme(theme) {
    let actualTheme = theme;
    
    if (theme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      actualTheme = prefersDark ? 'dark' : 'light';
    }

    document.documentElement.setAttribute('data-theme', actualTheme);
    this.currentTheme = actualTheme;
  }

  setupAutoThemeListener() {
    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this.mediaQuery.addEventListener('change', (e) => {
      const theme = e.matches ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', theme);
      this.currentTheme = theme;
    });
  }

  async setTheme(theme) {
    this.applyTheme(theme);
    
    const settings = await storage.get(STORAGE_KEYS.SETTINGS);
    settings.theme = theme;
    await storage.set(STORAGE_KEYS.SETTINGS, settings);
    
    // Setup or remove auto listener
    if (theme === 'auto') {
      this.setupAutoThemeListener();
    } else if (this.mediaQuery) {
      this.mediaQuery.removeEventListener('change', this.handleMediaQueryChange);
    }
  }

  getTheme() {
    return this.currentTheme;
  }
}

export const themeManager = new ThemeManager();
