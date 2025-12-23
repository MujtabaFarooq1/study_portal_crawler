/**
 * TURNSTILE CHALLENGE HANDLER TEST
 *
 * This script specifically handles the "Click to verify" Turnstile challenge
 * and waits longer for it to process.
 *
 * Run with: node turnstile-test.js
 */

import { HardenedPlaywrightScraper } from './src/utils/hardenedPlaywright.js';

async function testTurnstile() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TURNSTILE CHALLENGE HANDLER TEST');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const scraper = new HardenedPlaywrightScraper({
    headless: false,  // MUST be false
    persistentContext: true,
    verbose: true,
    baseDelay: 5000,
    jitterRange: 3000,
    maxChallengeAttempts: 10 // Increase wait attempts
  });

  try {
    await scraper.init();
    const page = await scraper.newPage();

    const testUrl = 'https://www.mastersportal.com/search/master/united-kingdom?page=1';

    console.log(`Navigating to: ${testUrl}\n`);

    // Navigate
    await page.goto(testUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    // Wait for initial page load
    await page.waitForTimeout(3000);

    console.log('Checking for Turnstile challenge...\n');

    // Check for Turnstile iframe
    const hasTurnstile = await page.evaluate(() => {
      const iframe = document.querySelector('iframe[src*="challenges.cloudflare.com"]');
      return !!iframe;
    });

    if (hasTurnstile) {
      console.log('✅ Turnstile challenge detected\n');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.log('MANUAL INTERACTION REQUIRED:\n');
      console.log('1. You should see a checkbox that says "Verify you are human"');
      console.log('2. Click the checkbox');
      console.log('3. Wait for verification (may take 5-30 seconds)');
      console.log('4. Script will detect when challenge clears\n');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      // Wait for user to click and challenge to process
      let attempts = 0;
      const maxAttempts = 30; // 30 attempts = ~60 seconds
      let challengeCleared = false;

      while (attempts < maxAttempts && !challengeCleared) {
        attempts++;

        // Wait 2 seconds between checks
        await page.waitForTimeout(2000);

        // Check if challenge cleared
        const title = await page.title();
        const url = page.url();

        const stillHasChallenge = title.includes('Just a moment') ||
                                 title.includes('Verify you are human') ||
                                 url.includes('cdn-cgi/challenge');

        if (!stillHasChallenge) {
          challengeCleared = true;
          console.log(`\n✅ Challenge cleared after ${attempts * 2} seconds!\n`);
          break;
        }

        // Check for iframe still present
        const iframeStillPresent = await page.evaluate(() => {
          const iframe = document.querySelector('iframe[src*="challenges.cloudflare.com"]');
          return !!iframe;
        });

        if (!iframeStillPresent) {
          challengeCleared = true;
          console.log(`\n✅ Challenge iframe removed after ${attempts * 2} seconds!\n`);
          break;
        }

        // Progress indicator
        if (attempts % 5 === 0) {
          console.log(`  ⏳ Still waiting... (${attempts * 2}s elapsed)`);
        }

        // Check for reload loop
        if (attempts > 10) {
          const currentUrl = page.url();
          await page.waitForTimeout(2000);
          const newUrl = page.url();

          if (currentUrl !== newUrl && newUrl.includes('cdn-cgi/challenge')) {
            console.log('\n  ⚠️  WARNING: Page is reloading (possible detection loop)\n');
          }
        }
      }

      if (!challengeCleared) {
        console.log('\n❌ Challenge did not clear within timeout\n');
        console.log('This usually means:\n');
        console.log('  1. Fingerprint inconsistency detected during verification');
        console.log('  2. Browser is refreshing the challenge repeatedly');
        console.log('  3. Need to use CAPTCHA solving service (2captcha)\n');

        console.log('WORKAROUND OPTIONS:\n');
        console.log('  Option 1: Try from different network/IP');
        console.log('  Option 2: Use your existing CaptchaSolver.js with 2captcha');
        console.log('  Option 3: Slow down further (wait 5 minutes, try again)\n');

        // Take screenshot
        const timestamp = Date.now();
        await page.screenshot({
          path: `./test/turnstile-failed-${timestamp}.png`,
          fullPage: true
        });
        console.log(`📸 Screenshot: ./test/turnstile-failed-${timestamp}.png\n`);
      }

    } else {
      console.log('ℹ️  No Turnstile challenge detected (page loaded directly)\n');

      const title = await page.title();
      if (title.includes('Just a moment')) {
        console.log('⚠️  But page title suggests challenge...\n');
      } else {
        console.log('✅ Page appears to have loaded successfully!\n');
      }
    }

    // Final diagnostics
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('FINAL DIAGNOSTICS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const finalTitle = await page.title();
    const finalUrl = page.url();

    console.log(`Title: ${finalTitle}`);
    console.log(`URL: ${finalUrl}\n`);

    // Check for cf_clearance cookie
    const cookies = await page.context().cookies();
    const cfClearance = cookies.find(c => c.name === 'cf_clearance');

    if (cfClearance) {
      console.log('✅ cf_clearance cookie present!');
      console.log(`   Value: ${cfClearance.value.substring(0, 20)}...`);
      console.log(`   Expires: ${new Date(cfClearance.expires * 1000).toISOString()}\n`);

      console.log('🎉 SUCCESS! You can now scrape pages using this session.\n');

      // Save session
      await scraper.saveSession();
      console.log('💾 Session saved. Next run will reuse this cookie.\n');

    } else {
      console.log('❌ cf_clearance cookie NOT found\n');

      const hasChallenge = finalTitle.includes('Just a moment') ||
                          finalTitle.includes('Verify you are human');

      if (hasChallenge) {
        console.log('Challenge still active. See workaround options above.\n');
      }
    }

    // Take final screenshot
    const timestamp = Date.now();
    await page.screenshot({
      path: `./test/turnstile-final-${timestamp}.png`,
      fullPage: false
    });
    console.log(`📸 Final screenshot: ./test/turnstile-final-${timestamp}.png\n`);

    // Keep browser open for inspection
    console.log('Browser will stay open for 30 seconds for inspection...\n');
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await scraper.close();
    console.log('\n✅ Test complete\n');
  }
}

testTurnstile().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
