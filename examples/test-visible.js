import MastersPortalPlaywrightCrawler from '../src/crawlers/MastersPortalPlaywrightCrawler.js';

/**
 * Test with visible browser to see what's happening
 */
async function testVisible() {
    console.log('🔍 Testing with Visible Browser\n');

    const crawler = new MastersPortalPlaywrightCrawler({
        maxCrawlLength: 2,       // Just 2 pages
        requestDelay: 5000,
        headless: false          // Show the browser!
    });

    try {
        const results = await crawler.crawl();

        console.log('\n📊 Results:');
        console.log(`Pages crawled: ${results.crawledCount}`);
        console.log(`Items extracted: ${results.extractedData.length}`);

        if (results.extractedData.length > 0) {
            console.log('\nFirst item:');
            console.log(JSON.stringify(results.extractedData[0], null, 2));
        }

        return results;
    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
}

testVisible().catch(console.error);
