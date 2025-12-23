/**
 * PRODUCTION-READY HARDENED PLAYWRIGHT TEMPLATE
 *
 * This is a complete, battle-tested implementation that addresses all major
 * Cloudflare detection vectors. Use this as a drop-in replacement for your
 * existing Playwright setup.
 *
 * SUCCESS CRITERIA:
 * - Cloudflare challenge stops reloading
 * - cf_clearance cookie appears
 * - Page transitions to real content
 * - Works consistently with residential IPs
 *
 * USAGE:
 *   const scraper = new HardenedPlaywrightScraper({
 *     headless: false,
 *     persistentContext: true
 *   });
 *   await scraper.init();
 *   const page = await scraper.newPage();
 *   await scraper.navigateWithEvasion(page, 'https://example.com');
 *   await scraper.close();
 */

import { HardenedBrowser } from './hardenedBrowser.js';
import { HumanBehavior } from './humanBehavior.js';
import { CloudflareDetector } from './cloudflareDetector.js';
import path from 'path';

export class HardenedPlaywrightScraper {
  constructor(options = {}) {
    this.options = {
      // Browser settings
      headless: options.headless !== undefined ? options.headless : false,
      persistentContext: options.persistentContext !== undefined ? options.persistentContext : true,
      userDataDir: options.userDataDir || path.join(process.cwd(), '.browser-data'),

      // Proxy settings (optional)
      proxy: options.proxy || null, // { server, username, password }

      // Rate limiting
      baseDelay: options.baseDelay || 3000,
      jitterRange: options.jitterRange || 2000,

      // Cloudflare handling
      detectCloudflare: options.detectCloudflare !== undefined ? options.detectCloudflare : true,
      waitForCloudflare: options.waitForCloudflare !== undefined ? options.waitForCloudflare : true,
      maxChallengeAttempts: options.maxChallengeAttempts || 5,

      // Logging
      verbose: options.verbose !== undefined ? options.verbose : true,

      ...options
    };

    this.browser = new HardenedBrowser({
      headless: this.options.headless,
      persistentContext: this.options.persistentContext,
      userDataDir: this.options.userDataDir,
      proxy: this.options.proxy,
      verbose: this.options.verbose
    });

    this.humanBehavior = new HumanBehavior({
      baseDelay: this.options.baseDelay,
      jitterRange: this.options.jitterRange,
      verbose: this.options.verbose
    });

    this.detector = new CloudflareDetector({
      verbose: this.options.verbose
    });

    this.context = null;
    this.initialized = false;
  }

  /**
   * Initialize the browser
   */
  async init() {
    if (this.initialized) {
      if (this.options.verbose) {
        console.log('⚠️  Browser already initialized');
      }
      return;
    }

    this.context = await this.browser.launch();
    this.initialized = true;

    if (this.options.verbose) {
      console.log('✅ Hardened Playwright scraper initialized\n');
    }
  }

  /**
   * Create a new page with full hardening
   */
  async newPage() {
    if (!this.initialized) {
      throw new Error('Scraper not initialized. Call init() first.');
    }

    const page = await this.browser.newPage();

    // Set default navigation timeout
    page.setDefaultNavigationTimeout(60000);
    page.setDefaultTimeout(30000);

    return page;
  }

  /**
   * Navigate with full evasion and Cloudflare handling
   * @param {Page} page - Playwright page object
   * @param {string} url - URL to navigate to
   * @param {Object} options - Navigation options
   */
  async navigateWithEvasion(page, url, options = {}) {
    const {
      waitForSelector = null,
      waitForFunction = null,
      detectChallenge = this.options.detectCloudflare,
      maxRetries = 3
    } = options;

    let attempt = 0;
    let lastError = null;

    while (attempt < maxRetries) {
      try {
        if (this.options.verbose && attempt > 0) {
          console.log(`\n🔄 Retry attempt ${attempt + 1}/${maxRetries}\n`);
        }

        // Navigate with human behavior
        await this.humanBehavior.navigate(page, url, {
          waitForSelector,
          waitForFunction,
          simulateHuman: true
        });

        // Wait for initial page stability
        await this.humanBehavior.waitForStability(page);

        // Detect and handle Cloudflare if enabled
        if (detectChallenge) {
          const challengeResult = await this.detector.detectChallenge(page);

          if (challengeResult.detected) {
            if (this.options.verbose) {
              console.log(`  🔐 Cloudflare ${challengeResult.type} detected!`);
            }

            if (challengeResult.type === 'blocked') {
              throw new Error('IP or fingerprint is blocked by Cloudflare. Change IP or increase delays.');
            }

            // Wait for challenge to clear with human simulation
            if (this.options.waitForCloudflare) {
              const cleared = await this.humanBehavior.waitForCloudflareChallenge(
                page,
                this.options.maxChallengeAttempts
              );

              if (!cleared) {
                throw new Error('Cloudflare challenge did not clear within timeout');
              }

              // Verify challenge is truly cleared
              const finalCheck = await this.detector.detectChallenge(page);
              if (finalCheck.detected) {
                throw new Error('Cloudflare challenge reappeared after clearing');
              }

              if (this.options.verbose) {
                console.log('  ✅ Successfully bypassed Cloudflare challenge\n');
              }
            }
          } else {
            if (this.options.verbose) {
              console.log('  ✅ No Cloudflare challenge detected\n');
            }
          }
        }

        // Final wait for content to fully load
        await this.humanBehavior.wait(2000, 'Final content load');

        // Success!
        return page;

      } catch (error) {
        lastError = error;

        if (this.options.verbose) {
          console.error(`  ❌ Navigation failed: ${error.message}`);
        }

        attempt++;

        if (attempt < maxRetries) {
          // Exponential backoff
          const backoffDelay = Math.min(30000, 5000 * Math.pow(2, attempt));
          if (this.options.verbose) {
            console.log(`  ⏳ Waiting ${backoffDelay}ms before retry...\n`);
          }
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
        }
      }
    }

    // All retries failed
    throw new Error(`Navigation failed after ${maxRetries} attempts: ${lastError?.message}`);
  }

  /**
   * Extract page content with safety checks
   * @param {Page} page - Playwright page object
   * @param {string} selector - Selector to extract (optional)
   * @returns {Promise<string>} HTML content
   */
  async extractContent(page, selector = null) {
    // Additional wait before extraction
    await this.humanBehavior.wait(1000, 'Before extraction');

    // Simulate reading behavior
    await this.humanBehavior.scroll(page, { distance: 100 + Math.random() * 200 });

    if (selector) {
      try {
        await page.waitForSelector(selector, { timeout: 10000 });
        return await page.locator(selector).innerHTML();
      } catch (error) {
        if (this.options.verbose) {
          console.log(`  ⚠️  Selector not found: ${selector}`);
        }
        return await page.content();
      }
    }

    return await page.content();
  }

  /**
   * Save session state (cookies, storage) to file
   * @param {string} filePath - Path to save session state
   */
  async saveSession(filePath = null) {
    const sessionPath = filePath || path.join(this.options.userDataDir, 'session.json');

    if (!this.context) {
      throw new Error('No context available to save');
    }

    const state = await this.context.storageState();
    const fs = await import('fs');
    await fs.promises.writeFile(sessionPath, JSON.stringify(state, null, 2));

    if (this.options.verbose) {
      console.log(`💾 Session saved to: ${sessionPath}`);
    }

    return sessionPath;
  }

  /**
   * Load session state from file
   * @param {string} filePath - Path to session state file
   */
  async loadSession(filePath = null) {
    const sessionPath = filePath || path.join(this.options.userDataDir, 'session.json');

    try {
      const fs = await import('fs');
      const stateJson = await fs.promises.readFile(sessionPath, 'utf-8');
      const state = JSON.parse(stateJson);

      if (!this.context) {
        throw new Error('Context not initialized. Call init() first.');
      }

      // Add cookies and storage to context
      await this.context.addCookies(state.cookies);

      if (this.options.verbose) {
        console.log(`📂 Session loaded from: ${sessionPath}`);
        console.log(`   Cookies loaded: ${state.cookies.length}`);
      }

      return state;
    } catch (error) {
      if (this.options.verbose) {
        console.log(`⚠️  Could not load session: ${error.message}`);
      }
      return null;
    }
  }

  /**
   * Get diagnostic report
   * @param {Page} page - Playwright page object
   */
  async diagnose(page) {
    return await this.detector.performDiagnostics(page);
  }

  /**
   * Close browser and cleanup
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.initialized = false;

      if (this.options.verbose) {
        console.log('\n✅ Browser closed\n');
      }
    }
  }

  /**
   * Create delay helper
   */
  async delay(ms) {
    await this.humanBehavior.wait(ms, `Delay (${ms}ms)`);
  }
}

/**
 * EXAMPLE USAGE:
 *
 * // Basic usage
 * const scraper = new HardenedPlaywrightScraper({
 *   headless: false,
 *   persistentContext: true,
 *   verbose: true
 * });
 *
 * await scraper.init();
 * const page = await scraper.newPage();
 *
 * try {
 *   await scraper.navigateWithEvasion(page, 'https://www.mastersportal.com/search/master');
 *
 *   // Diagnose if needed
 *   await scraper.diagnose(page);
 *
 *   // Extract content
 *   const html = await scraper.extractContent(page);
 *   console.log('Page length:', html.length);
 *
 *   // Save session for reuse
 *   await scraper.saveSession();
 * } finally {
 *   await scraper.close();
 * }
 *
 *
 * // With proxy
 * const scraper = new HardenedPlaywrightScraper({
 *   headless: false,
 *   proxy: {
 *     server: 'http://proxy.example.com:8080',
 *     username: 'user',
 *     password: 'pass'
 *   }
 * });
 *
 *
 * // Load existing session
 * await scraper.init();
 * await scraper.loadSession(); // Reuses cf_clearance cookie
 * const page = await scraper.newPage();
 * await scraper.navigateWithEvasion(page, 'https://example.com');
 */

export default HardenedPlaywrightScraper;
