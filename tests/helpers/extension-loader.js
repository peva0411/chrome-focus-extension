/**
 * Extension Loader Helper for Puppeteer Integration Tests
 * Based on research recommendations for loading unpacked extensions
 */

import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Launch Chrome with the Focus Extension loaded
 * @param {Object} options - Launch options
 * @param {boolean} options.headless - Run in headless mode (extensions require headed)
 * @param {boolean} options.devtools - Open devtools automatically
 * @returns {Promise<{browser: Browser, extensionId: string, serviceWorker: Target}>}
 */
export async function loadExtension(options = {}) {
  const extensionPath = path.resolve(__dirname, '../../');
  
  const launchOptions = {
    headless: options.headless || false, // Extensions require headed mode
    devtools: options.devtools || false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  };

  const browser = await puppeteer.launch(launchOptions);

  // Wait for service worker target to be created
  const serviceWorkerTarget = await browser.waitForTarget(
    target => target.type() === 'service_worker',
    { timeout: 10000 }
  );

  // Extract extension ID from service worker URL
  const serviceWorkerUrl = serviceWorkerTarget.url() || '';
  const extensionId = serviceWorkerUrl.split('/')[2];

  console.log(`✓ Extension loaded with ID: ${extensionId}`);

  return {
    browser,
    extensionId,
    serviceWorker: serviceWorkerTarget
  };
}

/**
 * Get the service worker worker instance for code evaluation
 * @param {Target} serviceWorkerTarget - The service worker target
 * @returns {Promise<WebWorker>}
 */
export async function getServiceWorker(serviceWorkerTarget) {
  return await serviceWorkerTarget.worker();
}

/**
 * Open extension page (popup, options, etc.)
 * @param {Browser} browser - Puppeteer browser instance
 * @param {string} extensionId - Extension ID
 * @param {string} page - Page path (e.g., 'src/popup/popup.html')
 * @returns {Promise<Page>}
 */
export async function openExtensionPage(browser, extensionId, page) {
  const url = `chrome-extension://${extensionId}/${page}`;
  const newPage = await browser.newPage();
  await newPage.goto(url);
  return newPage;
}

/**
 * Wait for extension to be fully initialized
 * @param {WebWorker} worker - Service worker instance
 * @param {number} timeout - Timeout in ms
 */
export async function waitForExtensionReady(worker, timeout = 5000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const isReady = await worker.evaluate(() => {
        return typeof blockingManager !== 'undefined' && 
               typeof scheduleManager !== 'undefined' &&
               typeof budgetManager !== 'undefined';
      });
      
      if (isReady) {
        return true;
      }
    } catch (error) {
      // Worker might not be ready yet
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  throw new Error('Extension initialization timeout');
}

/**
 * Clear all extension data (storage, rules, etc.)
 * @param {WebWorker} worker - Service worker instance
 */
export async function clearExtensionData(worker) {
  await worker.evaluate(async () => {
    // Clear all storage
    await chrome.storage.local.clear();
    
    // Clear all DNR rules
    const rules = await chrome.declarativeNetRequest.getDynamicRules();
    const ruleIds = rules.map(r => r.id);
    if (ruleIds.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: ruleIds
      });
    }
    
    // Clear all alarms
    await chrome.alarms.clearAll();
  });
}

/**
 * Cleanup browser instance
 * @param {Browser} browser - Puppeteer browser instance
 */
export async function cleanup(browser) {
  if (browser) {
    await browser.close();
  }
}
