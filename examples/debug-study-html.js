import { chromium } from 'playwright';
import fs from 'fs/promises';

/**
 * Debug - save HTML from study page to see what we're getting
 */
async function debugStudyHTML() {
    console.log('🔍 Debugging Study Page HTML\n');

    const browser = await chromium.launch({
        headless: true,
        args: ['--disable-blink-features=AutomationControlled', '--no-sandbox']
    });

    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    });

    const page = await context.newPage();

    try {
        const url = 'https://www.mastersportal.com/studies/254523/medical-bioscience.html';

        console.log('1. Navigating to study page...');
        await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });

        console.log('2. Waiting for network idle...');
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

        console.log('3. Waiting 8 seconds for content...');
        await page.waitForTimeout(8000);

        console.log('4. Getting HTML...');
        const html = await page.content();
        console.log(`   HTML length: ${html.length} chars`);

        // Save HTML
        await fs.writeFile('study-page-full.html', html);
        console.log('   ✓ Saved to study-page-full.html');

        // Take screenshot
        await page.screenshot({ path: 'study-page-full.png', fullPage: false });
        console.log('   ✓ Screenshot saved to study-page-full.png');

        // Check for specific elements
        console.log('\n5. Checking for elements:');
        console.log(`   #Hero: ${html.includes('id="Hero"')}`);
        console.log(`   .StudyTitle: ${html.includes('StudyTitle')}`);
        console.log(`   .OrganisationName: ${html.includes('OrganisationName')}`);
        console.log(`   Medical Bioscience: ${html.includes('Medical Bioscience')}`);
        console.log(`   blocked: ${html.includes('blocked') || html.includes('Sorry')}`);

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await browser.close();
    }
}

debugStudyHTML().catch(console.error);
