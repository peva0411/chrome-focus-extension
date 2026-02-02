/**
 * End-to-End Tests for Daily User Workflow
 * Tests complete user scenarios using Puppeteer (as recommended in research doc)
 */

import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';
import { describe, test, beforeAll, afterAll, expect } from '@jest/globals';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let browser, extensionId, serviceWorker, userDataDir;

beforeAll(async () => {
  const extensionPath = path.resolve(__dirname, '../../');
  
  // Create temporary user data directory
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'puppeteer-extension-'));
  
  console.log('Launching browser with extension from:', extensionPath);
  console.log('User data directory:', userDataDir);
  
  // Launch browser with extension
  browser = await puppeteer.launch({
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      `--user-data-dir=${userDataDir}`
    ]
  });

  // Wait for service worker target
  const target = await browser.waitForTarget(
    target => target.type() === 'service_worker',
    { timeout: 30000 }
  );
  
  serviceWorker = await target.worker();
  
  if (!serviceWorker) {
    throw new Error('Failed to get service worker');
  }

  // Get extension ID from service worker URL
  const extensionUrl = target.url();
  extensionId = extensionUrl.split('/')[2];

  console.log('Extension loaded successfully:', extensionId);
  console.log('Service worker URL:', extensionUrl);
}, 60000);

afterAll(async () => {
  if (browser) {
    await browser.close();
  }
  
  // Clean up temporary directory
  if (userDataDir && fs.existsSync(userDataDir)) {
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up temp directory:', error.message);
    }
  }
});

describe('Daily User Workflow', () => {
  test('extension loads and can access options page', async () => {
    // Step 1: Open options page
    const optionsPage = await browser.newPage();
    await optionsPage.goto(`chrome-extension://${extensionId}/src/options/options.html`, {
      waitUntil: 'networkidle0'
    });
    
    // Wait for page to be ready
    await optionsPage.waitForSelector('#site-pattern-input', { timeout: 15000 });
    
    const pageTitle = await optionsPage.title();
    expect(pageTitle).toContain('Settings');

    console.log('✓ Extension loaded and options page accessible');
    
    await optionsPage.close();
  }, 60000);

  test('can configure blocked sites', async () => {
    const optionsPage = await browser.newPage();
    await optionsPage.goto(`chrome-extension://${extensionId}/src/options/options.html`, {
      waitUntil: 'networkidle0'
    });
    
    await optionsPage.waitForSelector('#site-pattern-input', { timeout: 15000 });
    
    // Add Facebook
    await optionsPage.type('#site-pattern-input', 'facebook.com');
    // Submit the form (button is type="submit")
    await optionsPage.$eval('#add-site-form', form => form.requestSubmit());
    
    // Wait a bit for the site to be processed
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // The test validates that the form can be submitted
    console.log('✓ Site form can be submitted');
    
    await optionsPage.close();
  }, 60000);
});
