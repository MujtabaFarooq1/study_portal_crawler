/**
 * TEST SCRIPT FOR HARDENED PLAYWRIGHT SCRAPER
 *
 * This script demonstrates the complete hardened setup and verifies
 * that it successfully bypasses Cloudflare challenges.
 *
 * Run with: node test-hardened-scraper.js
 */

import { HardenedPlaywrightScraper } from './src/utils/hardenedPlaywright.js';
import path from 'path';
import fs from 'fs/promises';

async function testBasicNavigation() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 1: Basic Navigation Test');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const scraper = new HardenedPlaywrightScraper({
    headless: false, // Set to true for production
    persistentContext: true,
    verbose: true,
    baseDelay: 3000,
    jitterRange: 2000
  });

  try {
    await scraper.init();
    const page = await scraper.newPage();

    // Test URL - replace with your actual target
    const testUrl = 'https://www.mastersportal.com/search/master/united-kingdom?page=1';

    console.log(`\nNavigating to: ${testUrl}\n`);

    await scraper.navigateWithEvasion(page, testUrl, {
      detectChallenge: true,
      maxRetries: 3
    });

    // Get diagnostics
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Running Diagnostics...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const diagnostics = await scraper.diagnose(page);

    // Check for cf_clearance cookie
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('SUCCESS CRITERIA CHECK');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const hasCfClearance = diagnostics.cookies.cfClearance !== undefined;
    const noChallenge = !diagnostics.challenge.detected;
    const correctTitle = !diagnostics.title.includes('Just a moment');

    console.log(`✓ cf_clearance cookie: ${hasCfClearance ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`✓ No active challenge: ${noChallenge ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`✓ Real page title: ${correctTitle ? '✅ PASS' : '❌ FAIL'}`);

    if (hasCfClearance && noChallenge && correctTitle) {
      console.log('\n🎉 SUCCESS! All criteria met.\n');
    } else {
      console.log('\n⚠️  WARNING: Some criteria not met. Check logs above.\n');
    }

    // Extract some content
    const html = await scraper.extractContent(page);
    console.log(`📄 Page HTML length: ${html.length} characters`);

    // Save session for reuse
    await scraper.saveSession();

    // Take screenshot
    const screenshotDir = path.join(process.cwd(), 'test');
    await fs.mkdir(screenshotDir, { recursive: true });
    const screenshotPath = path.join(screenshotDir, `success-${Date.now()}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 Screenshot saved: ${screenshotPath}\n`);

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await scraper.close();
  }
}

async function testSessionReuse() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 2: Session Reuse Test');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const scraper = new HardenedPlaywrightScraper({
    headless: false,
    persistentContext: true,
    verbose: true
  });

  try {
    await scraper.init();

    // Load previous session
    const sessionLoaded = await scraper.loadSession();

    if (!sessionLoaded) {
      console.log('⚠️  No previous session found. Run test 1 first.');
      return;
    }

    console.log('✅ Previous session loaded\n');

    const page = await scraper.newPage();
    const testUrl = 'https://www.mastersportal.com/search/master/united-kingdom?page=2';

    console.log(`Navigating to: ${testUrl}\n`);

    await scraper.navigateWithEvasion(page, testUrl);

    const diagnostics = await scraper.diagnose(page);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Session Reuse Check');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const cookieStillValid = diagnostics.cookies.cfClearance !== undefined;
    const noNewChallenge = !diagnostics.challenge.detected;

    console.log(`✓ cf_clearance still valid: ${cookieStillValid ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`✓ No new challenge: ${noNewChallenge ? '✅ PASS' : '❌ FAIL'}`);

    if (cookieStillValid && noNewChallenge) {
      console.log('\n🎉 SUCCESS! Session reuse working.\n');
    } else {
      console.log('\n⚠️  Session may have expired or been invalidated.\n');
    }

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
  } finally {
    await scraper.close();
  }
}

async function testChallengeLoop() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 3: Challenge Loop Detection');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const scraper = new HardenedPlaywrightScraper({
    headless: false,
    persistentContext: true,
    verbose: true,
    maxChallengeAttempts: 10
  });

  try {
    await scraper.init();
    const page = await scraper.newPage();

    const testUrl = 'https://www.mastersportal.com/search/master/united-kingdom?page=17';

    await scraper.navigateWithEvasion(page, testUrl);

    // Use detector to check for loops
    const loopResult = await scraper.detector.detectChallengeLoop(page, 5);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Loop Detection Results');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log(`Loop detected: ${loopResult.loopDetected ? '❌ YES' : '✅ NO'}`);
    console.log(`Total checks: ${loopResult.attempts}`);
    console.log(`Final status: ${loopResult.lastStatus.type}\n`);

    if (!loopResult.loopDetected && loopResult.lastStatus.type === 'none') {
      console.log('🎉 SUCCESS! No challenge loop detected.\n');
    } else if (loopResult.loopDetected) {
      console.log('❌ FAILURE: Challenge loop detected. This indicates fingerprint is still detectable.\n');
      console.log('Recommendations:');
      console.log('  1. Ensure headless: false');
      console.log('  2. Use residential proxy');
      console.log('  3. Increase request delays');
      console.log('  4. Check for IP ban\n');
    }

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
  } finally {
    await scraper.close();
  }
}

async function runAllTests() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║   HARDENED PLAYWRIGHT SCRAPER - TEST SUITE           ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log('\n');

  try {
    // Test 1: Basic navigation
    await testBasicNavigation();

    // Wait between tests
    console.log('⏳ Waiting 5 seconds before next test...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Test 2: Session reuse
    await testSessionReuse();

    // Wait between tests
    console.log('⏳ Waiting 5 seconds before next test...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Test 3: Challenge loop detection
    await testChallengeLoop();

    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║   ALL TESTS COMPLETE                                  ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log('\n');

  } catch (error) {
    console.error('Test suite failed:', error);
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
