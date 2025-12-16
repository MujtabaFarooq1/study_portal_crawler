import MastersPortalCrawler from '../src/crawlers/MastersPortalCrawler.js';

/**
 * Example: Crawl only Masters Portal
 */
async function crawlMastersOnly() {
    console.log('Crawling Masters Portal only...\n');

    const crawler = new MastersPortalCrawler({
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

crawlMastersOnly().catch(console.error);
