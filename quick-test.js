/**
 * QUICK TEST - Simplest Possible Test
 *
 * This is the absolute minimum test to check if the hardened browser works.
 * Run with: node quick-test.js
 */

import { HardenedPlaywrightScraper } from './src/utils/hardenedPlaywright.js';

async function quickTest() {
  console.log('\n🚀 Quick Test Starting...\n');

  const scraper = new HardenedPlaywrightScraper({
    headless: false,  // MUST be false
    persistentContext: true,
    verbose: true,
    baseDelay: 5000,  // 5 seconds - very conservative
    jitterRange: 3000 // ±3 seconds
  });

  try {
    console.log('Initializing browser...\n');
    await scraper.init();

    console.log('Creating page...\n');
    const page = await scraper.newPage();

    // Test with a simple page first (not the problematic one)
    const testUrl = 'https://www.mastersportal.com/search/master';

    console.log(`Navigating to: ${testUrl}\n`);
    console.log('⏳ This may take 10-20 seconds...\n');

    await scraper.navigateWithEvasion(page, testUrl, {
      maxRetries: 2
    });

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Check results
    const title = await page.title();
    const url = page.url();

    console.log('RESULTS:\n');
    console.log(`  Page title: ${title}`);
    console.log(`  Current URL: ${url}\n`);

    // Quick check
    const hasChallenge = title.includes('Just a moment') ||
                        title.includes('Please unblock') ||
                        title.includes('Attention Required');

    if (hasChallenge) {
      console.log('❌ FAILED - Still seeing Cloudflare challenge\n');

      console.log('This usually means ONE of these issues:\n');
      console.log('  1. IP is BLOCKED by Cloudflare');
      console.log('     Solution: Change IP, use proxy, or wait 24 hours\n');

      console.log('  2. Datacenter IP (not residential)');
      console.log('     Solution: Use residential proxy\n');

      console.log('  3. Too many requests too fast');
      console.log('     Solution: Slow down (increase delays to 10+ seconds)\n');

      console.log('  4. Browser fingerprint still detectable (rare)');
      console.log('     Solution: Run diagnose-and-fix.js for details\n');

      console.log('IMMEDIATE ACTION:');
      console.log('  Try this from a different network (mobile hotspot, VPN, etc.)\n');

    } else {
      console.log('✅ SUCCESS!\n');

      console.log('Page loaded correctly. You can now:');
      console.log('  1. Use this for your scraping');
      console.log('  2. Session will be saved automatically');
      console.log('  3. Next run will reuse the cf_clearance cookie\n');

      // Get diagnostics
      const diagnostics = await scraper.diagnose(page);

      if (diagnostics.cookies.cfClearance) {
        console.log('✅ cf_clearance cookie present!');
        console.log(`   Expires: ${new Date(diagnostics.cookies.cfClearance.expires * 1000).toISOString()}\n`);
      }
    }

    // Take screenshot
    const timestamp = Date.now();
    await page.screenshot({
      path: `./test/quick-test-${timestamp}.png`,
      fullPage: false
    });
    console.log(`📸 Screenshot saved: ./test/quick-test-${timestamp}.png\n`);

    // Keep browser open for manual inspection
    console.log('Browser will stay open for 30 seconds for manual inspection...\n');
    await new Promise(resolve => setTimeout(resolve, 30000));

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);

    if (error.message.includes('blocked')) {
      console.log('\n💡 TIP: Your IP is likely blocked. Try:');
      console.log('   - Different network');
      console.log('   - Mobile hotspot');
      console.log('   - Residential proxy');
      console.log('   - Wait 24 hours\n');
    }

  } finally {
    await scraper.close();
    console.log('\n✅ Test complete\n');
  }
}

quickTest().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
