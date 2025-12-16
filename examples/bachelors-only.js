import BachelorsPortalCrawler from '../src/crawlers/BachelorsPortalCrawler.js';

/**
 * Example: Crawl only Bachelors Portal
 */
async function crawlBachelorsOnly() {
    console.log('Crawling Bachelors Portal only...\n');

    const crawler = new BachelorsPortalCrawler({
        maxCrawlLength: 30,
        requestDelay: 1500 // 1.5 seconds between requests
    });

    const results = await crawler.crawl();

    console.log('\nExtracted Programs:');
    console.log('===================');

    results.extractedData.slice(0, 10).forEach((program, index) => {
        console.log(`\n${index + 1}. ${program.name}`);
        console.log(`   University: ${program.university}`);
        console.log(`   Location: ${program.location}`);
        console.log(`   Link: ${program.link}`);
    });

    if (results.extractedData.length > 10) {
        console.log(`\n... and ${results.extractedData.length - 10} more programs`);
    }

    return results;
}

crawlBachelorsOnly().catch(console.error);
