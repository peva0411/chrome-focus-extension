import { Logger } from '../common/logger.js';

const logger = new Logger('Welcome');

let currentStep = 1;
const totalSteps = 5;

/**
 * Initialize welcome screen
 */
function initialize() {
  // Setup next buttons
  const nextButtons = document.querySelectorAll('.next-btn');
  nextButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      nextStep();
    });
  });

  // Setup finish button
  document.getElementById('finish-btn')?.addEventListener('click', () => {
    finishOnboarding(true);
  });

  // Setup skip button
  document.getElementById('skip-btn')?.addEventListener('click', () => {
    finishOnboarding(false);
  });

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && currentStep < totalSteps) {
      nextStep();
    } else if (e.key === 'Escape') {
      finishOnboarding(false);
    }
  });

  logger.info('Welcome screen initialized');
}

/**
 * Move to next step
 */
function nextStep() {
  if (currentStep >= totalSteps) return;

  // Hide current screen
  const currentScreen = document.querySelector(`.welcome-screen[data-step="${currentStep}"]`);
  if (currentScreen) {
    currentScreen.classList.remove('active');
  }

  // Update progress dots
  const currentDot = document.querySelectorAll('.dot')[currentStep - 1];
  if (currentDot) {
    currentDot.classList.remove('active');
  }

  // Move to next
  currentStep++;

  // Show next screen
  const nextScreen = document.querySelector(`.welcome-screen[data-step="${currentStep}"]`);
  if (nextScreen) {
    nextScreen.classList.add('active');
  }

  // Update progress dots
  const nextDot = document.querySelectorAll('.dot')[currentStep - 1];
  if (nextDot) {
    nextDot.classList.add('active');
  }

  logger.info(`Moved to step ${currentStep}`);
}

/**
 * Finish onboarding
 */
async function finishOnboarding(openSettings) {
  try {
    // Mark onboarding as complete
    await chrome.storage.local.set({ onboardingComplete: true });

    if (openSettings) {
      // Open settings page
      chrome.tabs.create({ url: chrome.runtime.getURL('src/options/options.html') });
    }

    // Close welcome page
    window.close();
  } catch (error) {
    logger.error('Failed to finish onboarding:', error);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initialize);
