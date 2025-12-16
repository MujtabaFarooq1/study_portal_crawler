import { chromium } from 'playwright';
import fs from 'fs/promises';

/**
 * Debug script to see what HTML we're actually getting
 */
async function debugHTML() {
    console.log('🔍 Debugging HTML Retrieval\n');

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

        console.log('Navigating to search page...');
        await page.goto('https://www.mastersportal.com/search/master', {
            waitUntil: 'networkidle',
            timeout: 30000
        });

        console.log('Waiting 3 seconds...');
        await page.waitForTimeout(3000);

        const html = await page.content();
        console.log(`HTML length: ${html.length} characters\n`);

        // Save HTML to file
        await fs.writeFile('debug-page.html', html);
        console.log('✅ HTML saved to debug-page.html');

        // Check for common patterns
        console.log('\nHTML Analysis:');
        console.log(`Contains "Cloudflare": ${html.includes('Cloudflare')}`);
        console.log(`Contains "blocked": ${html.includes('blocked')}`);
        console.log(`Contains "Card": ${html.includes('Card')}`);
        console.log(`Contains "StudyCard": ${html.includes('StudyCard')}`);
        console.log(`Contains "master": ${html.includes('master')}`);

        // Check page title
        const title = await page.title();
        console.log(`\nPage title: ${title}`);

        // Take a screenshot
        await page.screenshot({ path: 'debug-screenshot.png', fullPage: false });
        console.log('📸 Screenshot saved to debug-screenshot.png');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await browser.close();
    }
}

debugHTML().catch(console.error);
