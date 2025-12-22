import axios from 'axios';
import fs from 'fs';
import { CAPTCHA_CONFIG } from '../config/captcha.config.js';

/**
 * Service for solving Cloudflare Turnstile captchas using 2captcha API
 */
export class CaptchaSolver {
  constructor() {
    this.apiKey = CAPTCHA_CONFIG.apiKey;
    this.enabled = CAPTCHA_CONFIG.enabled;
    this.verbose = CAPTCHA_CONFIG.verbose;
    this.timeout = CAPTCHA_CONFIG.timeout;
    this.pollingInterval = CAPTCHA_CONFIG.pollingInterval;
  }

  /**
   * Detects if a page contains a Cloudflare Turnstile captcha
   * @param {Page} page - Playwright page object
   * @returns {Promise<Object|null>} Object with sitekey and action if found, null otherwise
   */
  async detectTurnstileCaptcha(page) {
    try {
      // First check page title for Cloudflare indicators
      const pageTitle = await page.title();
      const pageContent = await page.content();

      const hasCloudflareIndicators =
        pageTitle.includes('Just a moment') ||
        pageTitle.includes('Attention Required') ||
        pageContent.includes('cf-browser-verification') ||
        pageContent.includes('cf-challenge-running');

      // Only wait and take screenshots if we detect Cloudflare indicators
      if (hasCloudflareIndicators) {
        if (this.verbose) {
          console.log('  ⏳ Cloudflare challenge detected, waiting for captcha to load (5 seconds)...');
        }
        await this.delay(5000);

        // Take a screenshot after waiting
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const screenshotPath = `/Users/mujtaba/Documents/Projects/course_options/master_portal_crawler/test/captcha-detection-${timestamp}.png`;
        await page.screenshot({ path: screenshotPath });

        // Save HTML after waiting
        const htmlPath = `/Users/mujtaba/Documents/Projects/course_options/master_portal_crawler/test/captcha-detection-${timestamp}.html`;
        const htmlContent = await page.content();
        await fs.promises.writeFile(htmlPath, htmlContent);

        if (this.verbose) {
          console.log(`  📸 Screenshot saved: ${screenshotPath}`);
          console.log(`  💾 HTML saved: ${htmlPath}`);
        }
      }

      // Check for Cloudflare Turnstile iframe or widget
      const turnstileElement = await page.locator('iframe[src*="challenges.cloudflare.com"]').first();
      const isVisible = await turnstileElement.isVisible().catch(() => false);

      // Also check for #cf-turnstile element
      const cfTurnstileById = await page.locator('#cf-turnstile').first();
      const cfTurnstileVisible = await cfTurnstileById.isVisible().catch(() => false);

      if (isVisible || cfTurnstileVisible) {
        if (this.verbose) {
          if (isVisible) {
            console.log('  🔍 Cloudflare Turnstile iframe detected');
          }
          if (cfTurnstileVisible) {
            console.log('  🔍 Cloudflare Turnstile element (#cf-turnstile) detected');
          }
        }

        // Extract sitekey from the parent element or data attributes
        const sitekey = await page.evaluate(() => {
          // Look for #cf-turnstile element first
          const cfTurnstileById = document.querySelector('#cf-turnstile');
          if (cfTurnstileById) {
            const sitekey = cfTurnstileById.getAttribute('data-sitekey');
            if (sitekey) return sitekey;
          }

          // Look for turnstile div with sitekey
          const turnstileDiv = document.querySelector('[data-sitekey]');
          if (turnstileDiv) {
            return turnstileDiv.getAttribute('data-sitekey');
          }

          // Look for cf-turnstile class
          const cfTurnstile = document.querySelector('.cf-turnstile');
          if (cfTurnstile) {
            return cfTurnstile.getAttribute('data-sitekey');
          }

          // Try to extract from iframe src
          const iframe = document.querySelector('iframe[src*="challenges.cloudflare.com"]');
          if (iframe && iframe.src) {
            const urlParams = new URLSearchParams(new URL(iframe.src).search);
            return urlParams.get('sitekey') || urlParams.get('k');
          }

          return null;
        });

        if (sitekey) {
          if (this.verbose) {
            console.log(`  🔑 Found Turnstile sitekey: ${sitekey}`);
          }
          return { sitekey, url: page.url() };
        } else {
          if (this.verbose) {
            console.log('  ⚠️  Turnstile detected but could not extract sitekey');
          }
        }
      }

      // If we already checked for Cloudflare indicators above and didn't find a visible Turnstile widget,
      // check for additional challenge patterns in the page content
      if (!hasCloudflareIndicators) {
        // No need to re-fetch page content, we already have it from the beginning
        // Just check for additional Turnstile-specific patterns
        const isTurnstileChallenge =
          pageContent.includes('cf_challenge_response') ||
          pageContent.includes('cf-turnstile') ||
          pageContent.includes('Verifying you are human') ||
          pageContent.includes('name="cf-turnstile-response"') ||
          pageContent.includes('id="cf-chl-widget-');

        if (!isTurnstileChallenge) {
          // No Turnstile found at all
          return null;
        }
      }

      // At this point we know there's a Cloudflare challenge
      // Try to extract sitekey from page content
      const sitekey = await page.evaluate(() => {
          // PRIORITY 1: Check for sitekey in script src URLs FIRST (most reliable)
          // Pattern: https://challenges.cloudflare.com/turnstile/v0/g/SITEKEY/api.js
          const scripts = document.querySelectorAll('script');
          for (const script of scripts) {
            const src = script.getAttribute('src');
            if (src && src.includes('challenges.cloudflare.com/turnstile')) {
              const urlMatch = src.match(/\/turnstile\/v[0-9]+\/g\/([a-zA-Z0-9_-]+)\//);
              if (urlMatch && urlMatch[1]) {
                return urlMatch[1];
              }
            }
          }

          // PRIORITY 2: Check #cf-turnstile element
          const cfTurnstileById = document.querySelector('#cf-turnstile');
          if (cfTurnstileById) {
            const sitekey = cfTurnstileById.getAttribute('data-sitekey');
            if (sitekey) return sitekey;
          }

          // PRIORITY 3: Check for data-sitekey attributes
          const turnstileDiv = document.querySelector('[data-sitekey]');
          if (turnstileDiv) {
            return turnstileDiv.getAttribute('data-sitekey');
          }
          const cfTurnstile = document.querySelector('.cf-turnstile');
          if (cfTurnstile) {
            return cfTurnstile.getAttribute('data-sitekey');
          }

          // PRIORITY 4: Check for hidden input field (cf-turnstile-response)
          const hiddenInput = document.querySelector('input[name="cf-turnstile-response"]');
          if (hiddenInput) {
            // The input is present, try to find sitekey in various places

            // 1. Check if sitekey is in window.turnstile object
            if (window.turnstile && window.turnstile.sitekey) {
              return window.turnstile.sitekey;
            }

            // 2. Check parent element for data-sitekey
            let parent = hiddenInput.parentElement;
            while (parent && parent !== document.body) {
              if (parent.getAttribute('data-sitekey')) {
                return parent.getAttribute('data-sitekey');
              }
              parent = parent.parentElement;
            }

            // 3. Try to find sitekey in script tags
            const scripts = document.querySelectorAll('script');
            for (const script of scripts) {
              const scriptText = script.textContent || script.innerText;
              // Look for patterns like: sitekey: "xxx", 'sitekey': 'xxx', "sitekey":"xxx"
              const sitekeyMatch = scriptText.match(/sitekey['":\s]+['"]([a-zA-Z0-9_-]{10,})['"]/i);
              if (sitekeyMatch && sitekeyMatch[1]) {
                return sitekeyMatch[1];
              }
            }

            // 4. Check for Cloudflare's turnstile render calls in scripts
            const scripts2 = document.querySelectorAll('script');
            for (const script of scripts2) {
              const scriptText = script.textContent || script.innerText;
              // Pattern: turnstile.render(..., { sitekey: 'xxx' })
              const renderMatch = scriptText.match(/turnstile\.render\([^)]*sitekey['":\s]+['"]([a-zA-Z0-9_-]{10,})['"]/i);
              if (renderMatch && renderMatch[1]) {
                return renderMatch[1];
              }
            }
          }

          return null;
        });

      if (sitekey) {
        if (this.verbose) {
          console.log('  🔍 Cloudflare challenge detected with Turnstile captcha');
          console.log(`  🔑 Sitekey: ${sitekey}`);
        }
        return { sitekey, url: page.url() };
      } else {
        if (this.verbose) {
          console.log('  ⚠️  Cloudflare challenge detected but no Turnstile sitekey found (might be auto-challenge)');
        }
      }

      return null;
    } catch (error) {
      if (this.verbose) {
        console.error('  ❌ Error detecting Turnstile captcha:', error.message);
      }
      return null;
    }
  }

  /**
   * Solves a Cloudflare Turnstile captcha using 2captcha API
   * @param {string} sitekey - The Turnstile sitekey
   * @param {string} pageUrl - The URL where the captcha is found
   * @param {string} action - Optional action parameter
   * @param {string} data - Optional data parameter
   * @returns {Promise<string>} The captcha solution token
   */
  async solveTurnstile(sitekey, pageUrl, action = null, data = null) {
    if (!this.enabled) {
      throw new Error('Captcha solving is disabled in configuration');
    }

    if (!sitekey) {
      throw new Error('Sitekey is required to solve Turnstile captcha');
    }

    if (!pageUrl) {
      throw new Error('Page URL is required to solve Turnstile captcha');
    }

    try {
      if (this.verbose) {
        console.log('  🔧 Submitting Turnstile captcha to 2captcha...');
        console.log(`     Sitekey: ${sitekey}`);
        console.log(`     URL: ${pageUrl}`);
      }

      // Step 1: Submit captcha to 2captcha API
      const submitParams = {
        key: this.apiKey,
        method: 'turnstile',
        sitekey: sitekey,
        pageurl: pageUrl,
        json: 1
      };

      if (action) {
        submitParams.action = action;
      }

      if (data) {
        submitParams.data = data;
      }

      if (this.verbose) {
        console.log('  📤 Request params:', JSON.stringify(submitParams, null, 2));
      }

      const submitResponse = await axios.post('https://2captcha.com/in.php', null, {
        params: submitParams
      });

      if (this.verbose) {
        console.log('  📥 Response:', JSON.stringify(submitResponse.data, null, 2));
      }

      if (submitResponse.data.status !== 1) {
        throw new Error(`Failed to submit captcha: ${submitResponse.data.request || 'Unknown error'}`);
      }

      const captchaId = submitResponse.data.request;

      if (this.verbose) {
        console.log(`  📋 Captcha submitted, ID: ${captchaId}`);
        console.log('  ⏳ Waiting for solution...');
      }

      // Step 2: Poll for solution
      const startTime = Date.now();
      while (Date.now() - startTime < this.timeout) {
        await this.delay(this.pollingInterval);

        const resultResponse = await axios.get('https://2captcha.com/res.php', {
          params: {
            key: this.apiKey,
            action: 'get',
            id: captchaId,
            json: 1
          }
        });

        if (resultResponse.data.status === 1) {
          // Captcha solved!
          const token = resultResponse.data.request;

          if (this.verbose) {
            console.log('  ✅ Captcha solved successfully!');
            console.log(`     Token: ${token.substring(0, 50)}...`);
          }

          return token;
        } else if (resultResponse.data.request === 'CAPCHA_NOT_READY') {
          // Still processing, continue polling
          if (this.verbose) {
            const elapsed = Math.round((Date.now() - startTime) / 1000);
            console.log(`  ⏳ Still processing... (${elapsed}s elapsed)`);
          }
        } else {
          // Error occurred
          throw new Error(`Captcha solving failed: ${resultResponse.data.request}`);
        }
      }

      throw new Error('Captcha solving timeout exceeded');

    } catch (error) {
      if (this.verbose) {
        console.error('  ❌ Error solving Turnstile captcha:', error.message);
      }
      throw new Error(`Failed to solve Turnstile captcha: ${error.message}`);
    }
  }

  /**
   * Delay helper function
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   */
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Submits the Turnstile solution token to the page
   * @param {Page} page - Playwright page object
   * @param {string} token - The solution token from 2captcha
   * @returns {Promise<boolean>} True if submission was successful
   */
  async submitTurnstileSolution(page, token) {
    try {
      if (this.verbose) {
        console.log('  📤 Submitting captcha solution to page...');
        console.log(`  🔑 Token: ${token.substring(0, 50)}...`);
      }

      // Step 1: Inject the token into the Turnstile response field
      const injected = await page.evaluate((solutionToken) => {
        // Find the Turnstile response input field (most common method)
        const responseInput = document.querySelector('input[name="cf-turnstile-response"]');
        if (responseInput) {
          responseInput.value = solutionToken;

          // Trigger input event to notify Turnstile
          const inputEvent = new Event('input', { bubbles: true });
          responseInput.dispatchEvent(inputEvent);

          const changeEvent = new Event('change', { bubbles: true });
          responseInput.dispatchEvent(changeEvent);

          return { success: true, method: 'input[name="cf-turnstile-response"]' };
        }

        // Try to find by id as fallback
        const responseById = document.getElementById('cf-turnstile-response');
        if (responseById) {
          responseById.value = solutionToken;

          const inputEvent = new Event('input', { bubbles: true });
          responseById.dispatchEvent(inputEvent);

          const changeEvent = new Event('change', { bubbles: true });
          responseById.dispatchEvent(changeEvent);

          return { success: true, method: 'id=cf-turnstile-response' };
        }

        return { success: false, method: 'none' };
      }, token);

      if (!injected.success) {
        if (this.verbose) {
          console.log('  ⚠️  Could not find cf-turnstile-response field');
        }
        return false;
      }

      if (this.verbose) {
        console.log(`  ✅ Token injected via ${injected.method}`);
      }

      // Step 2: Wait for page to process the token
      await page.waitForTimeout(3000);

      // Step 3: Try to trigger Turnstile callback if it exists
      await page.evaluate(() => {
        // Check if turnstile callback exists in window
        if (window.turnstile && typeof window.turnstile.getResponse === 'function') {
          try {
            const response = window.turnstile.getResponse();
            if (response) {
              console.log('Turnstile response retrieved:', response.substring(0, 50));
            }
          } catch (e) {
            console.log('Error getting turnstile response:', e.message);
          }
        }

        // Trigger any custom callback if defined
        if (window.onTurnstileCallback && typeof window.onTurnstileCallback === 'function') {
          try {
            window.onTurnstileCallback();
          } catch (e) {
            console.log('Error calling turnstile callback:', e.message);
          }
        }
      });

      // Step 4: Look for and click submit button if form exists
      const formSubmitted = await page.evaluate(() => {
        const form = document.querySelector('form');
        if (form) {
          const responseInput = document.querySelector('input[name="cf-turnstile-response"]');

          // Only submit if the response input is inside this form
          if (responseInput && responseInput.closest('form') === form) {
            const submitBtn = form.querySelector('button[type="submit"]') ||
                             form.querySelector('input[type="submit"]') ||
                             form.querySelector('button');

            if (submitBtn) {
              submitBtn.click();
              return { submitted: true, method: 'button click' };
            }

            // Try form.submit() as last resort
            form.submit();
            return { submitted: true, method: 'form.submit()' };
          }
        }
        return { submitted: false };
      });

      if (formSubmitted.submitted && this.verbose) {
        console.log(`  ✅ Form submitted via ${formSubmitted.method}`);
      }

      // Step 5: Wait for navigation or page update
      await page.waitForTimeout(5000);

      if (this.verbose) {
        console.log('  ✅ Solution submission complete');
      }

      return true;
    } catch (error) {
      if (this.verbose) {
        console.error('  ❌ Error submitting solution:', error.message);
      }
      return false;
    }
  }

  /**
   * Complete workflow: Detect, solve, and submit Turnstile captcha
   * @param {Page} page - Playwright page object
   * @returns {Promise<boolean>} True if captcha was solved and submitted successfully
   */
  async handleTurnstileCaptcha(page) {
    try {
      if (this.verbose) {
        console.log('  🔍 Starting Turnstile captcha resolution workflow...');
      }

      // Step 1: Detect the captcha
      const captchaInfo = await this.detectTurnstileCaptcha(page);

      if (!captchaInfo) {
        if (this.verbose) {
          console.log('  ℹ️  No Turnstile captcha detected');
        }
        return false;
      }

      if (this.verbose) {
        console.log(`  🔑 Detected Turnstile captcha`);
        console.log(`     Sitekey: ${captchaInfo.sitekey}`);
        console.log(`     Page URL: ${captchaInfo.url}`);
      }

      // Step 2: Solve the captcha using 2captcha API
      if (this.verbose) {
        console.log('  🧩 Sending captcha to 2captcha for solving...');
      }

      const token = await this.solveTurnstile(captchaInfo.sitekey, captchaInfo.url);

      if (this.verbose) {
        console.log('  ✅ Received solution token from 2captcha');
      }

      // Step 3: Submit the solution to the page
      const submitted = await this.submitTurnstileSolution(page, token);

      if (!submitted) {
        if (this.verbose) {
          console.log('  ❌ Failed to submit solution to page');
        }
        return false;
      }

      // Step 4: Wait for page to process the solution
      if (this.verbose) {
        console.log('  ⏳ Waiting for page to process solution...');
      }

      await page.waitForTimeout(5000);

      // Step 5: Verify the captcha is gone
      if (this.verbose) {
        console.log('  🔍 Verifying captcha was solved...');
      }

      // Check page title and content for Cloudflare indicators
      const pageTitle = await page.title();
      const pageContent = await page.content();

      const stillHasCloudflare =
        pageTitle.includes('Just a moment') ||
        pageTitle.includes('Attention Required') ||
        pageContent.includes('cf-browser-verification') ||
        pageContent.includes('cf-challenge-running');

      // Also check if Turnstile widget still exists
      const turnstileStillVisible = await page.locator('iframe[src*="challenges.cloudflare.com"]')
        .first()
        .isVisible()
        .catch(() => false);

      if (!stillHasCloudflare && !turnstileStillVisible) {
        if (this.verbose) {
          console.log('  🎉 Turnstile captcha bypassed successfully!');
          console.log(`  📄 New page title: ${pageTitle}`);
        }
        return true;
      } else {
        if (this.verbose) {
          console.log('  ⚠️  Captcha verification failed');
          console.log(`     Page title: ${pageTitle}`);
          console.log(`     Cloudflare indicators: ${stillHasCloudflare}`);
          console.log(`     Turnstile widget visible: ${turnstileStillVisible}`);
        }

        // Take a screenshot for debugging
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const screenshotPath = `/Users/mujtaba/Documents/Projects/course_options/master_portal_crawler/test/captcha-failed-${timestamp}.png`;
        await page.screenshot({ path: screenshotPath, fullPage: true });

        if (this.verbose) {
          console.log(`  📸 Debug screenshot saved: ${screenshotPath}`);
        }

        return false;
      }
    } catch (error) {
      if (this.verbose) {
        console.error('  ❌ Error handling Turnstile captcha:', error.message);
        console.error('     Stack:', error.stack);
      }
      return false;
    }
  }

  /**
   * Get the current balance from 2captcha account
   * @returns {Promise<number>} The account balance
   */
  async getBalance() {
    try {
      const response = await axios.get('https://2captcha.com/res.php', {
        params: {
          key: this.apiKey,
          action: 'getbalance',
          json: 1
        }
      });

      if (response.data.status === 1) {
        const balance = parseFloat(response.data.request);
        if (this.verbose) {
          console.log(`  💰 2captcha balance: $${balance}`);
        }
        return balance;
      } else {
        throw new Error(`Failed to get balance: ${response.data.request || 'Unknown error'}`);
      }
    } catch (error) {
      if (this.verbose) {
        console.error('  ❌ Error getting balance:', error.message);
      }
      throw error;
    }
  }
}
