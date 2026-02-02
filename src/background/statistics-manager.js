import { storage } from '../common/storage.js';
import { STORAGE_KEYS } from '../common/constants.js';
import { Logger } from '../common/logger.js';
import { getCurrentDate } from '../common/utils.js';

const logger = new Logger('StatisticsManager');

/**
 * Manages statistics and analytics
 */
export class StatisticsManager {
  constructor() {
    this.stats = null;
  }

  /**
   * Initialize statistics
   */
  async initialize() {
    await this.loadStats();
    await this.checkDailyReset();
  }

  /**
   * Load statistics from storage
   */
  async loadStats() {
    this.stats = await storage.get(STORAGE_KEYS.STATISTICS) || {
      totalBlocks: 0,
      totalFocusTime: 0,
      streak: 0,
      lastActiveDate: null,
      daily: {},
      siteStats: {},
      hourlyActivity: {},
      budgetHistory: []
    };
  }

  /**
   * Check if we need to reset daily stats
   */
  async checkDailyReset() {
    const today = getCurrentDate();
    
    if (!this.stats.daily[today]) {
      this.stats.daily[today] = {
        blocks: 0,
        focusTime: 0,
        budgetUsed: 0,
        sites: {}
      };
      
      // Update streak
      await this.updateStreak(today);
      await this.saveStats();
    }
  }

  /**
   * Record a block event
   */
  async recordBlock(siteId, sitePattern) {
    // Ensure stats are loaded
    if (!this.stats) {
      await this.loadStats();
    }

    const today = getCurrentDate();
    const hour = new Date().getHours();

    // Ensure today exists
    if (!this.stats.daily[today]) {
      await this.checkDailyReset();
    }

    // Increment counters
    this.stats.totalBlocks++;
    this.stats.daily[today].blocks++;

    // Update site stats
    if (!this.stats.siteStats[sitePattern]) {
      this.stats.siteStats[sitePattern] = {
        blocks: 0,
        lastBlocked: null
      };
    }
    this.stats.siteStats[sitePattern].blocks++;
    this.stats.siteStats[sitePattern].lastBlocked = Date.now();

    // Update hourly activity
    if (!this.stats.hourlyActivity[hour]) {
      this.stats.hourlyActivity[hour] = 0;
    }
    this.stats.hourlyActivity[hour]++;

    await this.saveStats();
    logger.info('Block recorded', { site: sitePattern });
  }

  /**
   * Update focus time
   */
  async updateFocusTime(minutes) {
    // Ensure stats are loaded
    if (!this.stats) {
      await this.loadStats();
    }

    const today = getCurrentDate();

    if (!this.stats.daily[today]) {
      await this.checkDailyReset();
    }

    this.stats.totalFocusTime += minutes;
    this.stats.daily[today].focusTime += minutes;

    await this.saveStats();
  }

  /**
   * Update streak counter
   */
  async updateStreak(today) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (this.stats.lastActiveDate === yesterdayStr) {
      // Continuing streak
      this.stats.streak++;
    } else if (this.stats.lastActiveDate !== today) {
      // Streak broken or first day
      this.stats.streak = 1;
    }

    this.stats.lastActiveDate = today;
  }

  /**
   * Get today's statistics
   */
  async getTodayStats() {
    // Ensure stats are loaded
    if (!this.stats) {
      await this.loadStats();
    }

    const today = getCurrentDate();
    await this.checkDailyReset();

    return {
      blocks: this.stats.daily[today]?.blocks || 0,
      focusTime: this.stats.daily[today]?.focusTime || 0,
      budgetUsed: this.stats.daily[today]?.budgetUsed || 0,
      streak: this.stats.streak
    };
  }

  /**
   * Get top blocked sites
   */
  getTopBlockedSites(limit = 10) {
    const sites = Object.entries(this.stats.siteStats)
      .map(([pattern, data]) => ({
        pattern,
        blocks: data.blocks,
        lastBlocked: data.lastBlocked
      }))
      .sort((a, b) => b.blocks - a.blocks)
      .slice(0, limit);

    return sites;
  }

  /**
   * Get weekly data
   */
  getWeeklyData() {
    const days = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      days.push({
        date: dateStr,
        blocks: this.stats.daily[dateStr]?.blocks || 0,
        focusTime: this.stats.daily[dateStr]?.focusTime || 0
      });
    }

    return days;
  }

  /**
   * Get hourly activity data
   */
  getHourlyActivity() {
    const activity = [];
    for (let hour = 0; hour < 24; hour++) {
      activity.push({
        hour,
        blocks: this.stats.hourlyActivity[hour] || 0
      });
    }
    return activity;
  }

  /**
   * Export all statistics
   */
  async exportStats() {
    return {
      exportDate: new Date().toISOString(),
      version: '1.0',
      statistics: this.stats
    };
  }

  /**
   * Save statistics to storage
   */
  async saveStats() {
    await storage.set(STORAGE_KEYS.STATISTICS, this.stats);
  }
}

// Singleton
export const statisticsManager = new StatisticsManager();
