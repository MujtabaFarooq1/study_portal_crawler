import MastersPortalPlaywrightCrawler from '../src/crawlers/MastersPortalPlaywrightCrawler.js';
import fs from 'fs/promises';

/**
 * Extend crawler to save HTML for debugging
 */
class DebugCrawler extends MastersPortalPlaywrightCrawler {
    async processPage(url) {
        console.log(`\nProcessing: ${url}`);

        // Fetch HTML
        const html = await this.fetchPage(url);

        // Save HTML
        await fs.writeFile('crawler-fetched.html', html);
        console.log(`✓ Saved HTML (${html.length} chars) to crawler-fetched.html`);

        // Test with cheerio
        const cheerio = await import('cheerio');
        const $ = cheerio.load(html);

        const searchCards = $('.SearchStudyCard').length;
        console.log(`✓ Found ${searchCards} SearchStudyCard elements`);

        // Don't actually crawl
        this.crawledCount = this.maxCrawlLength;
    }
}

async function test() {
    const crawler = new DebugCrawler({
        maxCrawlLength: 1,
        requestDelay: 2000,
        headless: false  // Show browser
    });

    await crawler.crawl();
}

test().catch(console.error);
