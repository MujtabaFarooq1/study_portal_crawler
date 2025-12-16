import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import fs from 'fs/promises';

/**
 * Debug script to see what HTML we get from search page
 */
async function debugSearchPage() {
    console.log('🔍 Debugging Search Page HTML\n');

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

        // Visit search page
        const searchUrl = 'https://www.mastersportal.com/search/master';
        console.log(`Navigating to: ${searchUrl}`);

        await page.goto(searchUrl, {
            waitUntil: 'networkidle',
            timeout: 30000
        });

        console.log('Waiting for cards to load...');

        // Wait for cards specifically
        try {
            await page.waitForSelector('.SearchStudyCard', { timeout: 10000 });
            console.log('✅ SearchStudyCard elements found!');
        } catch (e) {
            console.log('⚠️ SearchStudyCard not found, trying generic Card selector...');
            try {
                await page.waitForSelector('[class*="Card"]', { timeout: 5000 });
                console.log('✅ Generic Card elements found!');
            } catch (e2) {
                console.log('❌ No cards found at all');
            }
        }

        await page.waitForTimeout(3000);

        const html = await page.content();
        console.log(`\nHTML length: ${html.length} characters`);

        // Save HTML to file
        await fs.writeFile('search-page-debug.html', html);
        console.log('✅ HTML saved to search-page-debug.html');

        // Test with Cheerio
        console.log('\nTesting with Cheerio:');
        const $ = cheerio.load(html);

        const selectors = [
            '.SearchStudyCard',
            '.StudyCard',
            '[class*="Card"]',
            'article',
            '[class*="SearchStudyCard"]'
        ];

        for (const selector of selectors) {
            const count = $(selector).length;
            console.log(`  ${selector}: ${count} elements`);

            if (count > 0 && count < 100) {
                // Show first element classes
                const firstClasses = $(selector).first().attr('class');
                console.log(`    First element classes: ${firstClasses?.substring(0, 100)}`);
            }
        }

        // Check page title
        const title = await page.title();
        console.log(`\nPage title: ${title}`);

        // Take a screenshot
        await page.screenshot({ path: 'search-page-screenshot.png', fullPage: false });
        console.log('📸 Screenshot saved to search-page-screenshot.png');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await browser.close();
    }
}

debugSearchPage().catch(console.error);
