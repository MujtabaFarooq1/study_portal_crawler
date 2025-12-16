import { chromium } from 'playwright';
import * as cheerio from 'cheerio';

/**
 * Simplest possible test - just fetch and extract links
 */
async function simpleCrawl() {
    console.log('Simple Crawl Test\n');

    const browser = await chromium.launch({
        headless: true,
        args: ['--disable-blink-features=AutomationControlled', '--no-sandbox']
    });

    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    });

    const page = await context.newPage();

    try {
        console.log('1. Navigating to search page...');
        await page.goto('https://www.mastersportal.com/search/master', {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });

        console.log('2. Waiting for network idle...');
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {
            console.log('   Network still active');
        });

        console.log('3. Waiting for study links...');
        try {
            await page.waitForSelector('a[href*="/studies/"]', { timeout: 30000 });
            console.log('   ✓ Found study links!');
        } catch (e) {
            console.log('   ✗ No study links found');
        }

        console.log('4. Getting HTML...');
        const html = await page.content();
        console.log(`   HTML length: ${html.length} chars`);

        console.log('5. Parsing with Cheerio...');
        const $ = cheerio.load(html);

        const studyLinks = [];
        $('a[href]').each((_, elem) => {
            const href = $(elem).attr('href');
            if (href && href.includes('/studies/') && href.includes('.html')) {
                studyLinks.push(href);
            }
        });

        console.log(`\n✓ Found ${studyLinks.length} study page links`);
        if (studyLinks.length > 0) {
            console.log('\nFirst 5 links:');
            studyLinks.slice(0, 5).forEach((link, i) => {
                console.log(`  ${i + 1}. ${link}`);
            });
        }

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await browser.close();
    }
}

simpleCrawl().catch(console.error);
