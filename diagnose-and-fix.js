/**
 * CRITICAL DIAGNOSTIC AND FIX SCRIPT
 *
 * This script will:
 * 1. Check what Cloudflare is detecting
 * 2. Apply additional fixes if needed
 * 3. Provide specific recommendations
 *
 * Run with: node diagnose-and-fix.js
 */

import { chromium } from 'playwright';
import { HardenedPlaywrightScraper } from './src/utils/hardenedPlaywright.js';

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('CLOUDFLARE DETECTION DIAGNOSTIC');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Test URL - the one you're having trouble with
const testUrl = 'https://www.mastersportal.com/search/master/united-kingdom?page=17';

async function testVanillaPlaywright() {
  console.log('TEST 1: Vanilla Playwright (baseline)\n');

  const browser = await chromium.launch({
    headless: false
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);

    const title = await page.title();
    const webdriver = await page.evaluate(() => navigator.webdriver);
    const userAgent = await page.evaluate(() => navigator.userAgent);

    console.log('Results:');
    console.log(`  Page title: ${title}`);
    console.log(`  Webdriver: ${webdriver}`);
    console.log(`  User-Agent: ${userAgent.substring(0, 80)}...\n`);

    const hasChallenge = title.includes('Just a moment') || title.includes('Please unblock');

    console.log(`  Challenge detected: ${hasChallenge ? '❌ YES (FAILED)' : '✅ NO (PASSED)'}\n`);

    if (hasChallenge) {
      console.log('❌ BASELINE FAILED - Vanilla Playwright is detected\n');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

async function testHardenedBrowser() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('TEST 2: Hardened Browser\n');

  const scraper = new HardenedPlaywrightScraper({
    headless: false,
    persistentContext: true,
    verbose: true,
    baseDelay: 5000, // Slower for testing
    jitterRange: 3000
  });

  try {
    await scraper.init();

    const page = await scraper.newPage();

    console.log('\n📋 Pre-navigation checks:\n');

    // Check webdriver BEFORE navigation
    const webdriver = await page.evaluate(() => navigator.webdriver);
    const hasWebdriverProp = await page.evaluate(() => 'webdriver' in navigator);
    const chromeExists = await page.evaluate(() => !!window.chrome);
    const permissionsExists = await page.evaluate(() => !!navigator.permissions);

    console.log(`  navigator.webdriver: ${webdriver}`);
    console.log(`  'webdriver' in navigator: ${hasWebdriverProp}`);
    console.log(`  window.chrome exists: ${chromeExists}`);
    console.log(`  navigator.permissions exists: ${permissionsExists}`);

    console.log('\n🌐 Navigating to test URL...\n');

    await scraper.navigateWithEvasion(page, testUrl, {
      maxRetries: 1 // Only 1 try for diagnostic
    });

    console.log('\n📊 Post-navigation diagnostics:\n');

    const diagnostics = await scraper.diagnose(page);

    console.log('Results:');
    console.log(`  Page title: ${diagnostics.title}`);
    console.log(`  Challenge detected: ${diagnostics.challenge.detected ? '⚠️  YES' : '✅ NO'}`);
    console.log(`  Challenge type: ${diagnostics.challenge.type}`);
    console.log(`  cf_clearance cookie: ${diagnostics.cookies.cfClearance ? '✅ Present' : '❌ Missing'}`);

    if (diagnostics.challenge.details.rayId) {
      console.log(`  Ray ID: ${diagnostics.challenge.details.rayId}`);
    }

    console.log('\n🔍 Browser fingerprint:\n');
    console.log(`  Webdriver: ${diagnostics.fingerprint.webdriver}`);
    console.log(`  Platform: ${diagnostics.fingerprint.platform}`);
    console.log(`  Languages: ${diagnostics.fingerprint.languages}`);
    console.log(`  Hardware Concurrency: ${diagnostics.fingerprint.hardwareConcurrency}`);
    console.log(`  Chrome object: ${diagnostics.fingerprint.hasChrome ? '✅' : '❌'}`);
    console.log(`  Permissions API: ${diagnostics.fingerprint.hasPermissions ? '✅' : '❌'}`);

    // Additional detection checks
    console.log('\n🔬 Advanced detection checks:\n');

    const advancedChecks = await page.evaluate(() => {
      const checks = {};

      // Check for automation indicators
      checks.automationControlled = window.navigator.webdriver;
      checks.chromeRuntime = !!window.chrome?.runtime;
      checks.permissionsQuery = !!navigator.permissions?.query;

      // Check for Playwright-specific properties
      checks.playwrightGlobals = {
        __playwright: typeof window.__playwright !== 'undefined',
        __pw_manual: typeof window.__pw_manual !== 'undefined',
        __PW_inspect: typeof window.__PW_inspect !== 'undefined'
      };

      // Check plugins
      checks.pluginCount = navigator.plugins.length;

      // Check for inconsistencies
      checks.screenConsistency = {
        screen: `${screen.width}x${screen.height}`,
        window: `${window.innerWidth}x${window.innerHeight}`,
        outer: `${window.outerWidth}x${window.outerHeight}`
      };

      return checks;
    });

    console.log('  Automation controlled:', advancedChecks.automationControlled);
    console.log('  Chrome runtime:', advancedChecks.chromeRuntime);
    console.log('  Permissions query:', advancedChecks.permissionsQuery);
    console.log('  Playwright globals:', JSON.stringify(advancedChecks.playwrightGlobals));
    console.log('  Plugin count:', advancedChecks.pluginCount);
    console.log('  Screen consistency:', JSON.stringify(advancedChecks.screenConsistency));

    // Take screenshot for manual inspection
    const timestamp = Date.now();
    await page.screenshot({
      path: `./test/diagnostic-${timestamp}.png`,
      fullPage: true
    });
    console.log(`\n📸 Screenshot saved: ./test/diagnostic-${timestamp}.png`);

    // Save HTML for inspection
    const html = await page.content();
    const fs = await import('fs');
    await fs.promises.writeFile(`./test/diagnostic-${timestamp}.html`, html);
    console.log(`💾 HTML saved: ./test/diagnostic-${timestamp}.html`);

    // Final assessment
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('ASSESSMENT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const passing = !diagnostics.challenge.detected && diagnostics.cookies.cfClearance;

    if (passing) {
      console.log('✅ SUCCESS! Cloudflare bypass working correctly.\n');
      console.log('Your setup is good. If you still see issues, it might be:');
      console.log('  1. IP reputation (try residential proxy)');
      console.log('  2. Request rate (slow down delays)');
      console.log('  3. Session expired (cf_clearance cookie expired)\n');
    } else {
      console.log('❌ FAILED! Cloudflare is still detecting automation.\n');

      console.log('DIAGNOSIS:\n');

      if (advancedChecks.automationControlled !== undefined) {
        console.log('  ❌ CRITICAL: navigator.webdriver not properly removed!');
        console.log('     Fix: Check that evasion script is loading correctly\n');
      }

      if (!advancedChecks.chromeRuntime) {
        console.log('  ⚠️  WARNING: window.chrome.runtime missing');
        console.log('     Fix: Chrome runtime object not properly injected\n');
      }

      if (advancedChecks.playwrightGlobals.__playwright ||
          advancedChecks.playwrightGlobals.__pw_manual ||
          advancedChecks.playwrightGlobals.__PW_inspect) {
        console.log('  ❌ CRITICAL: Playwright-specific globals detected!');
        console.log('     Fix: Evasion script should delete these\n');
      }

      if (advancedChecks.pluginCount === 0) {
        console.log('  ⚠️  WARNING: No plugins detected');
        console.log('     This can indicate automation\n');
      }

      if (diagnostics.challenge.type === 'blocked') {
        console.log('  ❌ CRITICAL: IP is BLOCKED');
        console.log('     Solutions:');
        console.log('       1. Change IP address');
        console.log('       2. Use residential proxy');
        console.log('       3. Wait 24 hours');
        console.log('       4. Reduce request frequency\n');
      }

      console.log('RECOMMENDED ACTIONS:\n');
      console.log('  1. Run in headful mode (headless: false) ✓ Already set');
      console.log('  2. Use residential proxy (not datacenter IP)');
      console.log('  3. Increase delays to 5-10 seconds between requests');
      console.log('  4. Check screenshot/HTML files for clues');
      console.log('  5. Try from different network/IP\n');
    }

  } catch (error) {
    console.error('\n❌ ERROR during testing:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await scraper.close();
  }
}

async function runDiagnostics() {
  try {
    // Test 1: Vanilla Playwright (baseline)
    await testVanillaPlaywright();

    // Wait between tests
    console.log('⏳ Waiting 5 seconds before next test...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Test 2: Hardened browser
    await testHardenedBrowser();

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('DIAGNOSTICS COMPLETE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('Next steps:');
    console.log('  1. Review the screenshot and HTML files in ./test/');
    console.log('  2. If IP is blocked, change IP or use proxy');
    console.log('  3. If webdriver is detected, check evasion script');
    console.log('  4. Try with slower delays (10+ seconds)\n');

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run diagnostics
runDiagnostics().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
