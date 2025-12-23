/**
 * IP BLOCK STATUS CHECKER
 *
 * This script checks if your IP is blocked by Cloudflare
 * WITHOUT using any evasion techniques (to see raw status)
 *
 * Run with: node check-ip-status.js
 */

import { chromium } from 'playwright';

async function checkIPStatus() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('CLOUDFLARE IP BLOCK STATUS CHECK');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const testUrl = 'https://www.mastersportal.com/search/master';

  console.log(`Testing URL: ${testUrl}\n`);
  console.log('Opening browser in headful mode...\n');

  const browser = await chromium.launch({
    headless: false,
    args: ['--window-size=1920,1080']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  try {
    console.log('Navigating (this may take 10-30 seconds)...\n');

    await page.goto(testUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    // Wait for initial load
    await page.waitForTimeout(5000);

    const title = await page.title();
    const url = page.url();
    const content = await page.content();

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('RESULTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log(`Title: ${title}`);
    console.log(`URL: ${url}\n`);

    // Analyze the response
    const hasJustAMoment = title.includes('Just a moment');
    const hasAttentionRequired = title.includes('Attention Required');
    const hasPleaseUnblock = title.includes('Please unblock');
    const hasAccessDenied = content.includes('Access denied') || content.includes('blocked');
    const hasRayID = content.includes('Ray ID:');

    console.log('Detection Analysis:\n');
    console.log(`  "Just a moment" in title: ${hasJustAMoment ? '⚠️  YES' : '✅ NO'}`);
    console.log(`  "Attention Required" in title: ${hasAttentionRequired ? '⚠️  YES' : '✅ NO'}`);
    console.log(`  "Please unblock" in title: ${hasPleaseUnblock ? '❌ YES (IP BLOCKED!)' : '✅ NO'}`);
    console.log(`  "Access denied" in content: ${hasAccessDenied ? '❌ YES (IP BLOCKED!)' : '✅ NO'}`);
    console.log(`  Cloudflare Ray ID present: ${hasRayID ? '⚠️  YES' : '✅ NO'}\n`);

    // Extract Ray ID if present
    const rayIdMatch = content.match(/Ray ID: <code>([a-f0-9]+)<\/code>/);
    if (rayIdMatch) {
      console.log(`  Ray ID: ${rayIdMatch[1]}\n`);
    }

    // Get current IP
    console.log('Checking your IP address...\n');

    try {
      const ipPage = await context.newPage();
      await ipPage.goto('https://api.ipify.org?format=json', { timeout: 10000 });
      const ipData = await ipPage.evaluate(() => document.body.textContent);
      const ip = JSON.parse(ipData).ip;
      console.log(`  Your IP: ${ip}\n`);
      await ipPage.close();
    } catch (e) {
      console.log('  Could not determine IP\n');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('DIAGNOSIS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (hasPleaseUnblock || hasAccessDenied) {
      console.log('❌ CRITICAL: YOUR IP IS BLOCKED!\n');

      console.log('This is a HARD BLOCK, not a challenge.\n');

      console.log('Why this happens:');
      console.log('  - Too many requests from this IP');
      console.log('  - Datacenter/VPS IP (not residential)');
      console.log('  - IP flagged from previous violations');
      console.log('  - Using common VPN/proxy IP\n');

      console.log('SOLUTIONS:\n');

      console.log('  OPTION 1: Wait (Easiest)');
      console.log('    - Wait 24-48 hours');
      console.log('    - Block usually clears automatically\n');

      console.log('  OPTION 2: Change Network (Quick)');
      console.log('    - Mobile hotspot');
      console.log('    - Different WiFi network');
      console.log('    - VPN (but quality VPN only)\n');

      console.log('  OPTION 3: Use Residential Proxy (Best for Production)');
      console.log('    - Services: BrightData, Oxylabs, Smartproxy');
      console.log('    - Avoid datacenter proxies (also get blocked)\n');

      console.log('  OPTION 4: Slow Down (Prevention)');
      console.log('    - When unblocked, use 10+ second delays');
      console.log('    - Max 100-200 requests per day per IP\n');

    } else if (hasJustAMoment || hasAttentionRequired) {
      console.log('⚠️  MODERATE: Cloudflare Challenge Detected\n');

      console.log('This is a CHALLENGE, not a hard block.\n');

      console.log('What this means:');
      console.log('  - Cloudflare is checking your browser');
      console.log('  - Usually clears in 5-15 seconds');
      console.log('  - Happens on first visit or suspicious activity\n');

      console.log('SOLUTIONS:\n');

      console.log('  1. Wait and watch the browser window');
      console.log('     - Challenge should auto-solve in 5-15 seconds');
      console.log('     - If it clears: Good! Your IP is okay\n');

      console.log('  2. If challenge never clears (infinite loop):');
      console.log('     - Browser fingerprint is detectable');
      console.log('     - Run the hardened browser instead');
      console.log('     - Command: node quick-test.js\n');

      console.log('  3. If you see multiple challenges in a row:');
      console.log('     - Slow down your requests');
      console.log('     - Use 5-10 second delays between requests\n');

    } else {
      console.log('✅ SUCCESS: No Block or Challenge Detected!\n');

      console.log('Your IP appears to be clean.\n');

      console.log('If you had errors before, they were likely:');
      console.log('  1. Browser fingerprint detection (not IP block)');
      console.log('  2. Too-fast request patterns');
      console.log('  3. Playwright-specific signals\n');

      console.log('NEXT STEPS:\n');

      console.log('  1. Run the hardened browser:');
      console.log('     node quick-test.js\n');

      console.log('  2. This should work without issues\n');

      console.log('  3. If it still fails, run full diagnostics:');
      console.log('     node diagnose-and-fix.js\n');
    }

    // Take screenshot
    const timestamp = Date.now();
    const fs = await import('fs');
    await fs.promises.mkdir('./test', { recursive: true });

    await page.screenshot({
      path: `./test/ip-check-${timestamp}.png`,
      fullPage: true
    });

    console.log(`📸 Screenshot saved: ./test/ip-check-${timestamp}.png\n`);

    // Keep browser open for manual inspection
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('Browser will stay open for 30 seconds for manual inspection.');
    console.log('Watch to see if the challenge clears automatically.\n');

    await new Promise(resolve => setTimeout(resolve, 30000));

    // Final check after wait
    const finalTitle = await page.title();
    const cleared = !finalTitle.includes('Just a moment') &&
                    !finalTitle.includes('Attention Required') &&
                    !finalTitle.includes('Please unblock');

    if (cleared) {
      console.log('✅ Challenge cleared automatically! IP is good.\n');
    } else {
      console.log('⚠️  Challenge did not clear. See solutions above.\n');
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
  } finally {
    await browser.close();
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('Check complete.\n');
  }
}

checkIPStatus().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
