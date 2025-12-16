import BachelorsPortalPlaywrightCrawler from '../src/crawlers/BachelorsPortalPlaywrightCrawler.js';
import fs from 'fs/promises';

/**
 * Example: Crawl Bachelors Portal using Playwright (browser automation)
 * This approach bypasses anti-bot protection like Cloudflare
 */
async function crawlBachelorsWithPlaywright() {
    console.log('Crawling Bachelors Portal with Playwright...\n');

    const crawler = new BachelorsPortalPlaywrightCrawler({
        maxCrawlLength: 5,       // Start with 5 pages for testing
        requestDelay: 3000,      // 3 seconds between requests
        headless: true           // Set to false to see the browser in action
    });

    try {
        const results = await crawler.crawl();

        console.log('\nExtracted Programs:');
        console.log('===================');

        if (results.extractedData.length === 0) {
            console.log('No programs extracted. The selectors may need updating.');
            console.log('Try running with headless: false to see what the page looks like.');
        } else {
            results.extractedData.slice(0, 10).forEach((program, index) => {
                console.log(`\n${index + 1}. ${program.name}`);
                console.log(`   University: ${program.university}`);
                console.log(`   Location: ${program.location}`);
                console.log(`   Link: ${program.link}`);
            });

            if (results.extractedData.length > 10) {
                console.log(`\n... and ${results.extractedData.length - 10} more programs`);
            }

            // Save to JSON file
            await fs.writeFile(
                'bachelors-programs.json',
                JSON.stringify(results.extractedData, null, 2)
            );
            console.log('\n✓ Results saved to bachelors-programs.json');
        }

        return results;
    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
}

crawlBachelorsWithPlaywright().catch(console.error);
