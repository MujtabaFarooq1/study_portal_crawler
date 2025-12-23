/**
 * TURNSTILE WITH 2CAPTCHA SOLVER
 *
 * This script combines the hardened browser with your existing
 * CaptchaSolver.js to automatically solve Turnstile challenges.
 *
 * Run with: node turnstile-with-solver.js
 */

import { HardenedPlaywrightScraper } from './src/utils/hardenedPlaywright.js';
import { CaptchaSolver } from './src/services/CaptchaSolver.js';

async function testWithSolver() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TURNSTILE WITH 2CAPTCHA SOLVER');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const scraper = new HardenedPlaywrightScraper({
    headless: false,
    persistentContext: true,
    verbose: true,
    baseDelay: 5000,
    jitterRange: 3000
  });

  const captchaSolver = new CaptchaSolver();

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

    // Wait for page to settle
    await page.waitForTimeout(5000);

    console.log('Checking for Turnstile challenge...\n');

    // Detect Turnstile
    const turnstileInfo = await captchaSolver.detectTurnstileCaptcha(page);

    if (turnstileInfo) {
      console.log('✅ Turnstile detected!\n');
      console.log(`   Sitekey: ${turnstileInfo.sitekey}`);
      console.log(`   URL: ${turnstileInfo.url}\n`);

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.log('ATTEMPTING AUTOMATIC SOLVE WITH 2CAPTCHA\n');
      console.log('This may take 30-120 seconds...\n');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      try {
        // Use your existing CaptchaSolver
        const solved = await captchaSolver.handleTurnstileCaptcha(page);

        if (solved) {
          console.log('\n✅ CAPTCHA SOLVED SUCCESSFULLY!\n');

          // Wait for page to process the solution
          await page.waitForTimeout(5000);

          // Check if we got through
          const finalTitle = await page.title();
          const cookies = await page.context().cookies();
          const cfClearance = cookies.find(c => c.name === 'cf_clearance');

          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('RESULTS');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

          console.log(`Final title: ${finalTitle}`);
          console.log(`cf_clearance: ${cfClearance ? '✅ Present' : '❌ Missing'}\n`);

          if (cfClearance) {
            console.log('🎉 SUCCESS! Full bypass achieved.\n');
            console.log('Your hardened browser + 2captcha combination works!\n');

            // Save session
            await scraper.saveSession();
            console.log('💾 Session saved for future use.\n');

          } else {
            console.log('⚠️  Captcha was solved but cf_clearance not set.\n');
            console.log('This can happen if:');
            console.log('  1. Solution was incorrect');
            console.log('  2. Page requires additional verification');
            console.log('  3. Token expired before submission\n');
          }

        } else {
          console.log('\n❌ Failed to solve captcha automatically.\n');
          console.log('Possible reasons:');
          console.log('  1. 2captcha API error');
          console.log('  2. Insufficient balance');
          console.log('  3. Sitekey extraction failed\n');
        }

      } catch (solverError) {
        console.error('\n❌ Solver error:', solverError.message);
        console.log('\nFalling back to manual solve...\n');

        console.log('MANUAL INSTRUCTIONS:');
        console.log('  1. Click the "Verify you are human" checkbox');
        console.log('  2. Wait for verification');
        console.log('  3. Script will continue automatically\n');

        // Wait for manual solve
        let attempts = 0;
        const maxAttempts = 30;
        let solved = false;

        while (attempts < maxAttempts && !solved) {
          attempts++;
          await page.waitForTimeout(2000);

          const title = await page.title();
          const hasChallenge = title.includes('Just a moment') ||
                              title.includes('Verify you are human');

          if (!hasChallenge) {
            solved = true;
            console.log(`\n✅ Manually solved after ${attempts * 2} seconds!\n`);
          }

          if (attempts % 5 === 0) {
            console.log(`  ⏳ Waiting... (${attempts * 2}s)`);
          }
        }

        if (!solved) {
          console.log('\n❌ Manual solve timed out.\n');
        }
      }

    } else {
      console.log('ℹ️  No Turnstile challenge detected.\n');

      const title = await page.title();
      const cookies = await page.context().cookies();
      const cfClearance = cookies.find(c => c.name === 'cf_clearance');

      if (cfClearance) {
        console.log('✅ Page loaded directly (no challenge needed)!\n');
        console.log('Your session or IP is trusted.\n');
      } else if (title.includes('Just a moment')) {
        console.log('⚠️  Different challenge type detected.\n');
        console.log('This may be a JS challenge (not Turnstile).\n');
      } else {
        console.log('✅ Page appears to have loaded successfully!\n');
      }
    }

    // Final diagnostics
    const diagnostics = await scraper.diagnose(page);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('FINAL DIAGNOSTICS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log(`Title: ${diagnostics.title}`);
    console.log(`Challenge: ${diagnostics.challenge.detected ? '⚠️  Active' : '✅ Clear'}`);
    console.log(`cf_clearance: ${diagnostics.cookies.cfClearance ? '✅ Present' : '❌ Missing'}\n`);

    // Screenshot
    const timestamp = Date.now();
    await page.screenshot({
      path: `./test/solver-test-${timestamp}.png`,
      fullPage: false
    });
    console.log(`📸 Screenshot: ./test/solver-test-${timestamp}.png\n`);

    // Keep open
    console.log('Browser stays open for 30s for inspection...\n');
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await scraper.close();
    console.log('\n✅ Test complete\n');
  }
}

testWithSolver().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
