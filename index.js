// Use Playwright crawlers to bypass anti-bot protection
import MastersPortalPlaywrightCrawler from './src/crawlers/MastersPortalPlaywrightCrawler.js';
import BachelorsPortalPlaywrightCrawler from './src/crawlers/BachelorsPortalPlaywrightCrawler.js';

/**
 * Main entry point for the crawler application
 */
async function main() {
    console.log('========================================');
    console.log('Educational Portal Crawler');
    console.log('========================================\n');

    try {
        // Example: Run Masters Portal crawler
        console.log('Starting Masters Portal crawl...\n');
        const mastersCrawler = new MastersPortalPlaywrightCrawler({
            maxCrawlLength: 10,      // Crawl 10 pages for demo
            requestDelay: 3000,      // 3 seconds between requests
            headless: true           // Run browser in headless mode
        });

        const mastersResults = await mastersCrawler.crawl();

        console.log('\n========================================\n');

        // Example: Run Bachelors Portal crawler
        console.log('Starting Bachelors Portal crawl...\n');
        const bachelorsCrawler = new BachelorsPortalPlaywrightCrawler({
            maxCrawlLength: 10,      // Crawl 10 pages for demo
            requestDelay: 3000,      // 3 seconds between requests
            headless: true           // Run browser in headless mode
        });

        const bachelorsResults = await bachelorsCrawler.crawl();

        // Summary
        console.log('\n========================================');
        console.log('CRAWL SUMMARY');
        console.log('========================================');
        console.log(`Masters Portal: ${mastersResults.extractedData.length} programs found`);
        console.log(`Bachelors Portal: ${bachelorsResults.extractedData.length} programs found`);
        console.log(`Total programs: ${mastersResults.extractedData.length + bachelorsResults.extractedData.length}`);
        console.log('========================================\n');

        // You can save results to a file or database here
        // Example: await saveToFile(mastersResults, bachelorsResults);

    } catch (error) {
        console.error('Error during crawling:', error);
        process.exit(1);
    }
}

// Run the crawler
main();
