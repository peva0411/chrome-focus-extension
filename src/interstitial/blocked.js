import { Logger } from '../common/logger.js';

const logger = new Logger('BlockedPage');

/**
 * Blocked Page Controller
 */
class BlockedPageController {
  constructor() {
    this.params = new URLSearchParams(window.location.search);
    this.blockedUrl = this.params.get('url');
    this.siteId = this.params.get('id');
    this.budgetExhausted = this.params.get('budgetExhausted') === 'true';
    this.countdownTimer = null;
    
    this.elements = {
      blockedUrlText: document.getElementById('blocked-url-text'),
      goBackBtn: document.getElementById('go-back-btn'),
      removeBlockBtn: document.getElementById('remove-block-btn'),
      settingsLink: document.getElementById('settings-link'),
      quoteText: document.getElementById('quote-text'),
      budgetSection: document.getElementById('budget-section'),
      budgetRemaining: document.getElementById('budget-remaining'),
      budgetProgressBar: document.getElementById('budget-progress-bar'),
      budgetWarning: document.getElementById('budget-warning'),
      budgetExhausted: document.getElementById('budget-exhausted'),
      useBudgetBtn: document.getElementById('use-budget-btn'),
      countdownNotice: document.getElementById('countdown-notice'),
      countdown: document.getElementById('countdown')
    };
    
    // Verify critical elements exist
    logger.info('Elements found:', {
      useBudgetBtn: !!this.elements.useBudgetBtn,
      budgetSection: !!this.elements.budgetSection,
      countdownNotice: !!this.elements.countdownNotice
    });
    
    this.init();
  }

  async init() {
    logger.info('Blocked page loaded', { url: this.blockedUrl, siteId: this.siteId });
    
    // Apply theme first
    await this.applyTheme();
    
    // Display blocked URL
    this.elements.blockedUrlText.textContent = this.blockedUrl || 'Unknown';
    
    // Set up event listeners FIRST (before loading budget info)
    this.setupListeners();
    
    // Load budget information
    await this.loadBudgetInfo();
    
    // Load random quote
    this.loadRandomQuote();
    
    // Increment block counter
    this.recordBlock();
  }

  setupListeners() {
    // Go back button
    this.elements.goBackBtn.addEventListener('click', () => {
      window.history.back();
    });

    // Remove from block list
    this.elements.removeBlockBtn.addEventListener('click', async () => {
      if (confirm('Remove this site from your block list?')) {
        try {
          await chrome.runtime.sendMessage({
            type: 'REMOVE_BLOCKED_SITE',
            data: { siteId: this.siteId }
          });
          
          // Show success and redirect
          alert('Site removed from block list');
          window.location.href = this.blockedUrl;
        } catch (error) {
          logger.error('Failed to remove site:', error);
          alert('Failed to remove site');
        }
      }
    });

    // Settings link
    this.elements.settingsLink.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    });

    // Use budget button
    const useBudgetBtn = this.elements.useBudgetBtn;
    if (useBudgetBtn) {
      useBudgetBtn.addEventListener('click', () => {
        logger.info('Use budget button clicked');
        this.startBudgetCountdown();
      });
    } else {
      logger.warn('Use budget button not found');
    }

    // Click anywhere during countdown to cancel
    const countdownNotice = this.elements.countdownNotice;
    if (countdownNotice) {
      countdownNotice.addEventListener('click', () => {
        logger.info('Countdown cancelled by user click');
        this.cancelCountdown();
      });
    }
  }

  async loadBudgetInfo() {
    if (!this.siteId) {
      logger.warn('No site ID, skipping budget info');
      return;
    }

    logger.info('Loading budget info for site:', this.siteId);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'CHECK_BUDGET',
        data: { siteId: this.siteId }
      });

      logger.info('Budget check response:', response);

      // Show budget section
      this.elements.budgetSection.style.display = 'block';

      if (this.budgetExhausted || !response.canAccess) {
        this.showBudgetExhausted();
      } else {
        this.showBudgetAvailable(response);
      }
    } catch (error) {
      logger.error('Failed to load budget:', error);
      // Hide budget section on error
      this.elements.budgetSection.style.display = 'none';
    }
  }

  showBudgetAvailable(budgetInfo) {
    const remainingMinutes = Math.floor(budgetInfo.globalRemaining);
    
    logger.info('Showing budget available:', remainingMinutes, 'minutes');
    
    // Show remaining budget
    this.elements.budgetRemaining.textContent = `${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`;

    // Update progress bar
    const percentRemaining = (budgetInfo.globalRemaining / budgetInfo.total) * 100;
    this.elements.budgetProgressBar.style.width = `${percentRemaining}%`;

    // Show warning if low
    if (percentRemaining < 25) {
      this.elements.budgetWarning.style.display = 'block';
    }

    // Show use budget button
    this.elements.useBudgetBtn.style.display = 'inline-block';
    
    logger.info('Budget available', { remaining: remainingMinutes });
  }

  showBudgetExhausted() {
    this.elements.budgetExhausted.style.display = 'block';
    this.elements.useBudgetBtn.style.display = 'none';
    this.elements.budgetRemaining.textContent = '0 minutes';
    this.elements.budgetProgressBar.style.width = '0%';
    
    logger.info('Budget exhausted');
  }

  startBudgetCountdown() {
    logger.info('Starting budget countdown');
    
    // Hide button, show countdown
    this.elements.useBudgetBtn.style.display = 'none';
    this.elements.countdownNotice.style.display = 'block';

    let seconds = 5;
    this.elements.countdown.textContent = seconds;

    this.countdownTimer = setInterval(() => {
      seconds--;
      this.elements.countdown.textContent = seconds;
      logger.debug('Countdown:', seconds);

      if (seconds <= 0) {
        this.cancelCountdown();
        this.activateBudget();
      }
    }, 1000);
  }

  cancelCountdown() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
      this.elements.countdownNotice.style.display = 'none';
      this.elements.useBudgetBtn.style.display = 'inline-block';
      logger.info('Countdown cancelled');
    }
  }

  async activateBudget() {
    try {
      logger.info('Activating budget session for site:', this.siteId);
      logger.info('Pattern from URL param:', this.blockedUrl);
      
      // Start budget session - service worker will handle the redirect
      const response = await chrome.runtime.sendMessage({
        type: 'START_BUDGET_SESSION',
        data: { siteId: this.siteId, pattern: this.blockedUrl }
      });

      logger.info('Budget session response:', response);

      if (response.error) {
        throw new Error(response.error);
      }

      if (response.redirected) {
        logger.info('Service worker handled redirect to:', response.targetUrl);
        // Service worker already redirected the tab, nothing more to do
      } else {
        // Fallback: try to redirect from here
        const targetUrl = response.targetUrl || this.constructUrlFromPattern(this.blockedUrl);
        logger.info('Fallback redirect to:', targetUrl);
        window.location.href = targetUrl;
      }
    } catch (error) {
      logger.error('Failed to start budget session:', error);
      alert('Failed to access site with budget: ' + error.message);
      
      // Restore UI
      this.elements.countdownNotice.style.display = 'none';
      this.elements.useBudgetBtn.style.display = 'inline-block';
    }
  }

  /**
   * Construct a valid URL from a pattern
   * @param {string} pattern - Site pattern like "youtube.com"
   * @returns {string} - Full URL like "https://youtube.com"
   */
  constructUrlFromPattern(pattern) {
    // Remove any wildcards
    let domain = pattern.replace(/^\*\./, '');
    
    // Add protocol if missing
    if (!domain.startsWith('http://') && !domain.startsWith('https://')) {
      domain = 'https://' + domain;
    }
    
    return domain;
  }

  loadRandomQuote() {
    const quotes = [
      {
        text: "The successful warrior is the average man, with laser-like focus.",
        author: "Bruce Lee"
      },
      {
        text: "Concentration is the secret of strength.",
        author: "Ralph Waldo Emerson"
      },
      {
        text: "Focus is a matter of deciding what things you're not going to do.",
        author: "John Carmack"
      },
      {
        text: "The shorter way to do many things is to only do one thing at a time.",
        author: "Mozart"
      },
      {
        text: "It is during our darkest moments that we must focus to see the light.",
        author: "Aristotle"
      }
    ];
    
    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
    this.elements.quoteText.textContent = `"${randomQuote.text}"`;
    this.elements.quoteText.nextElementSibling.textContent = `— ${randomQuote.author}`;
  }

  async recordBlock() {
    if (!this.siteId) return;
    
    try {
      await chrome.runtime.sendMessage({
        type: 'RECORD_BLOCK',
        data: { siteId: this.siteId }
      });
    } catch (error) {
      logger.error('Failed to record block:', error);
    }
  }

  /**
   * Apply theme from settings
   */
  async applyTheme() {
    try {
      const data = await chrome.storage.local.get(['settings']);
      const settings = data.settings || {};
      let theme = settings.theme || 'light';
      
      if (theme === 'auto') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        theme = prefersDark ? 'dark' : 'light';
      }
      
      document.documentElement.setAttribute('data-theme', theme);
    } catch (error) {
      logger.error('Failed to apply theme:', error);
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new BlockedPageController();
});
