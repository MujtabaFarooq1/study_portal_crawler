import { chromium } from 'playwright';
import fs from 'fs/promises';

/**
 * Debug script to see what HTML we get from a study page
 */
async function debugStudyPage() {
    console.log('🔍 Debugging Study Page HTML\n');

    const browser = await chromium.launch({
        headless: true,
        args: [
            '--disable-blink-features=AutomationControlled',
            '--no-sandbox'
        ]
    });

    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        extraHTTPHeaders: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
        }
    });

    const page = await context.newPage();

    try {
        // Add stealth
        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => false,
            });
        });

        // Visit a study page
        const studyUrl = 'https://www.mastersportal.com/studies/466158/business-analytics.html';
        console.log(`Navigating to: ${studyUrl}`);

        await page.goto(studyUrl, {
            waitUntil: 'networkidle',
            timeout: 30000
        });

        console.log('Waiting for content to load...');
        await page.waitForTimeout(5000);

        const html = await page.content();
        console.log(`HTML length: ${html.length} characters\n`);

        // Save HTML to file
        await fs.writeFile('study-page-debug.html', html);
        console.log('✅ HTML saved to study-page-debug.html');

        // Check for common patterns
        console.log('\nHTML Analysis:');
        console.log(`Contains "Cloudflare": ${html.includes('Cloudflare')}`);
        console.log(`Contains "blocked": ${html.includes('blocked')}`);
        console.log(`Contains "QuickFacts": ${html.includes('QuickFacts')}`);
        console.log(`Contains "OrganisationTitle": ${html.includes('OrganisationTitle')}`);
        console.log(`Contains "IELTSCard": ${html.includes('IELTSCard')}`);
        console.log(`Contains "TOEFLCard": ${html.includes('TOEFLCard')}`);

        // Check page title
        const title = await page.title();
        console.log(`\nPage title: ${title}`);

        // Check h1
        const h1 = await page.$eval('h1', el => el.textContent).catch(() => 'Not found');
        console.log(`H1 content: ${h1}`);

        // Take a screenshot
        await page.screenshot({ path: 'study-page-screenshot.png', fullPage: false });
        console.log('📸 Screenshot saved to study-page-screenshot.png');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await browser.close();
    }
}

debugStudyPage().catch(console.error);
