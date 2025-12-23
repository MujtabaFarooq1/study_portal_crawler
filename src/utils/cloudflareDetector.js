/**
 * Cloudflare Challenge Detection Utility
 *
 * This module provides comprehensive detection and diagnostics for Cloudflare challenges.
 * It helps identify whether a browser is stuck in a challenge loop and provides
 * actionable diagnostics.
 */

export class CloudflareDetector {
  constructor(options = {}) {
    this.verbose = options.verbose !== undefined ? options.verbose : true;
    this.maxDetectionAttempts = options.maxDetectionAttempts || 10;
    this.detectionInterval = options.detectionInterval || 1000; // ms
  }

  /**
   * Detects if the page is showing a Cloudflare challenge
   * @param {Page} page - Playwright page object
   * @returns {Promise<Object>} Detection result with type and details
   */
  async detectChallenge(page) {
    try {
      const url = page.url();
      const title = await page.title();
      const content = await page.content();

      // Check URL patterns
      const isChallengePlatform = url.includes('/cdn-cgi/challenge-platform/');
      const isTurnstileChallenge = url.includes('/cdn-cgi/challenge-platform/h/g/');

      // Check title patterns
      const hasBlockedTitle =
        title.includes('Just a moment') ||
        title.includes('Attention Required') ||
        title.includes('Please Wait') ||
        title.includes('Checking your browser');

      // Check content patterns
      const hasChallengeContent =
        content.includes('cf-browser-verification') ||
        content.includes('cf_challenge_response') ||
        content.includes('cf-challenge-running') ||
        content.includes('cf-chl-widget') ||
        content.includes('challenges.cloudflare.com/turnstile');

      const hasAccessDenied =
        content.includes('Access denied') ||
        content.includes('blocked') ||
        content.includes('Sorry, you have been blocked') ||
        content.includes('Ray ID:') && content.includes('Cloudflare');

      // Check for cookies
      const cookies = await page.context().cookies();
      const cfClearance = cookies.find(c => c.name === 'cf_clearance');

      // Determine challenge type
      let challengeType = 'none';
      let details = {};

      if (hasAccessDenied) {
        challengeType = 'blocked';
        details.message = 'IP or fingerprint blocked by Cloudflare';
        details.suggestion = 'Change IP, increase delays, run non-headless';
      } else if (isChallengePlatform || isTurnstileChallenge || hasChallengeContent) {
        challengeType = 'challenge';
        details.isTurnstile = content.includes('turnstile') || content.includes('cf-turnstile');
        details.isJSChallenge = content.includes('cf-browser-verification');
        details.hasClearanceCookie = !!cfClearance;

        if (cfClearance) {
          details.clearanceExpiry = new Date(cfClearance.expires * 1000).toISOString();
        }
      } else if (hasBlockedTitle) {
        challengeType = 'challenge';
        details.message = 'Challenge detected by page title';
      }

      // Extract Ray ID for debugging
      const rayIdMatch = content.match(/Ray ID: <code>([a-f0-9]+)<\/code>/);
      if (rayIdMatch) {
        details.rayId = rayIdMatch[1];
      }

      return {
        detected: challengeType !== 'none',
        type: challengeType,
        url,
        title,
        details,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      if (this.verbose) {
        console.error('  ❌ Error detecting Cloudflare challenge:', error.message);
      }
      return {
        detected: false,
        type: 'error',
        error: error.message
      };
    }
  }

  /**
   * Monitors page for challenge loop (repeated redirects to challenge page)
   * @param {Page} page - Playwright page object
   * @param {number} maxAttempts - Maximum detection attempts
   * @returns {Promise<Object>} Loop detection result
   */
  async detectChallengeLoop(page, maxAttempts = 10) {
    const attempts = [];
    let loopDetected = false;

    if (this.verbose) {
      console.log('  🔍 Monitoring for Cloudflare challenge loop...');
    }

    for (let i = 0; i < maxAttempts; i++) {
      const result = await this.detectChallenge(page);
      attempts.push(result);

      if (!result.detected) {
        if (this.verbose) {
          console.log(`  ✅ Challenge cleared after ${i + 1} checks`);
        }
        break;
      }

      if (this.verbose) {
        console.log(`  ⏳ Challenge still active (check ${i + 1}/${maxAttempts})`);
        console.log(`     Type: ${result.type}`);
        console.log(`     URL: ${result.url.substring(0, 80)}...`);
      }

      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, this.detectionInterval));

      // Check if URL changed back to challenge after being cleared
      if (i > 0 && attempts[i - 1].type === 'none' && result.type === 'challenge') {
        loopDetected = true;
        if (this.verbose) {
          console.log('  🔄 Challenge loop detected! Page redirected back to challenge.');
        }
        break;
      }
    }

    return {
      loopDetected,
      attempts: attempts.length,
      lastStatus: attempts[attempts.length - 1],
      history: attempts
    };
  }

  /**
   * Wait for Cloudflare challenge to clear
   * @param {Page} page - Playwright page object
   * @param {number} timeout - Maximum wait time in ms
   * @returns {Promise<boolean>} True if challenge cleared, false if timeout
   */
  async waitForChallengePass(page, timeout = 30000) {
    const startTime = Date.now();
    const checkInterval = 2000; // Check every 2 seconds

    if (this.verbose) {
      console.log('  ⏳ Waiting for Cloudflare challenge to clear...');
    }

    while (Date.now() - startTime < timeout) {
      const result = await this.detectChallenge(page);

      if (!result.detected) {
        if (this.verbose) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          console.log(`  ✅ Challenge cleared in ${elapsed}s`);
        }
        return true;
      }

      if (result.type === 'blocked') {
        if (this.verbose) {
          console.log('  ❌ IP/fingerprint is blocked - cannot proceed');
        }
        return false;
      }

      // Log progress
      if (this.verbose) {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const remaining = Math.floor((timeout - (Date.now() - startTime)) / 1000);
        console.log(`  ⏳ Still in challenge... (${elapsed}s elapsed, ${remaining}s remaining)`);
      }

      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    if (this.verbose) {
      console.log('  ⏱️  Challenge wait timeout exceeded');
    }
    return false;
  }

  /**
   * Perform comprehensive Cloudflare diagnostics
   * @param {Page} page - Playwright page object
   * @returns {Promise<Object>} Diagnostic report
   */
  async performDiagnostics(page) {
    if (this.verbose) {
      console.log('\n  🔬 Running Cloudflare diagnostics...\n');
    }

    const diagnostics = {
      timestamp: new Date().toISOString(),
      url: page.url(),
      title: await page.title(),
      cookies: {},
      headers: {},
      fingerprint: {},
      challenge: {}
    };

    // Check cookies
    const cookies = await page.context().cookies();
    const cfCookies = cookies.filter(c => c.name.startsWith('cf_') || c.name.startsWith('__cf'));

    diagnostics.cookies.total = cookies.length;
    diagnostics.cookies.cloudflare = cfCookies.length;
    diagnostics.cookies.cfClearance = cookies.find(c => c.name === 'cf_clearance');
    diagnostics.cookies.list = cfCookies.map(c => ({
      name: c.name,
      domain: c.domain,
      expires: c.expires ? new Date(c.expires * 1000).toISOString() : 'session'
    }));

    // Check browser fingerprint indicators
    diagnostics.fingerprint = await page.evaluate(() => {
      return {
        userAgent: navigator.userAgent,
        webdriver: navigator.webdriver,
        platform: navigator.platform,
        languages: navigator.languages,
        hardwareConcurrency: navigator.hardwareConcurrency,
        deviceMemory: navigator.deviceMemory,
        plugins: navigator.plugins.length,
        screenResolution: `${screen.width}x${screen.height}`,
        windowSize: `${window.innerWidth}x${window.innerHeight}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        hasChrome: !!window.chrome,
        hasPermissions: !!navigator.permissions
      };
    });

    // Check challenge status
    const challengeResult = await this.detectChallenge(page);
    diagnostics.challenge = challengeResult;

    // Print diagnostics
    if (this.verbose) {
      console.log('  📊 DIAGNOSTICS REPORT\n');
      console.log('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      console.log('  🍪 Cookies:');
      console.log(`     Total: ${diagnostics.cookies.total}`);
      console.log(`     Cloudflare: ${diagnostics.cookies.cloudflare}`);
      console.log(`     cf_clearance: ${diagnostics.cookies.cfClearance ? '✅ Present' : '❌ Missing'}`);
      if (diagnostics.cookies.cfClearance) {
        console.log(`     Expires: ${new Date(diagnostics.cookies.cfClearance.expires * 1000).toISOString()}`);
      }

      console.log('\n  🔍 Browser Fingerprint:');
      console.log(`     User-Agent: ${diagnostics.fingerprint.userAgent.substring(0, 60)}...`);
      console.log(`     Webdriver: ${diagnostics.fingerprint.webdriver}`);
      console.log(`     Platform: ${diagnostics.fingerprint.platform}`);
      console.log(`     Languages: ${diagnostics.fingerprint.languages}`);
      console.log(`     Hardware Concurrency: ${diagnostics.fingerprint.hardwareConcurrency}`);
      console.log(`     Device Memory: ${diagnostics.fingerprint.deviceMemory}`);
      console.log(`     Plugins: ${diagnostics.fingerprint.plugins}`);
      console.log(`     Screen: ${diagnostics.fingerprint.screenResolution}`);
      console.log(`     Window: ${diagnostics.fingerprint.windowSize}`);
      console.log(`     Chrome Object: ${diagnostics.fingerprint.hasChrome ? '✅' : '❌'}`);

      console.log('\n  🚨 Challenge Status:');
      console.log(`     Detected: ${challengeResult.detected ? '⚠️  YES' : '✅ NO'}`);
      console.log(`     Type: ${challengeResult.type}`);
      console.log(`     Title: ${diagnostics.title}`);
      if (challengeResult.details.rayId) {
        console.log(`     Ray ID: ${challengeResult.details.rayId}`);
      }

      console.log('\n  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    }

    return diagnostics;
  }
}
