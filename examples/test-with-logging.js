import MastersPortalPlaywrightCrawler from '../src/crawlers/MastersPortalPlaywrightCrawler.js';

/**
 * Test crawler with enhanced logging to see what's happening in real-time
 */
async function testWithLogging() {
    console.log('🚀 Starting Masters Portal Crawler with Enhanced Logging\n');

    const crawler = new MastersPortalPlaywrightCrawler({
        maxCrawlLength: 5,       // Crawl 5 pages for demo
        requestDelay: 2000,      // 2 seconds between requests
        headless: true
    });

    try {
        const results = await crawler.crawl();

        console.log('\n' + '='.repeat(80));
        console.log('🎉 CRAWL COMPLETE - FINAL SUMMARY');
        console.log('='.repeat(80));
        console.log(`\n📊 Statistics:`);
        console.log(`   - Pages crawled: ${results.crawledCount}`);
        console.log(`   - Programs extracted: ${results.extractedData.length}`);
        console.log(`   - URLs still in queue: ${results.remainingUrls.length}`);
        console.log(`   - Unique URLs visited: ${results.visitedUrls.length}`);

        console.log(`\n🔍 URL Breakdown:`);
        const studyUrls = results.visitedUrls.filter(u => /\/studies\/\d+\//.test(u));
        const searchUrls = results.visitedUrls.filter(u => /\/search\/(master|bachelor)/.test(u));
        console.log(`   - Study pages: ${studyUrls.length}`);
        console.log(`   - Search pages: ${searchUrls.length}`);

        if (results.extractedData.length > 0) {
            console.log(`\n📝 Sample Programs (first 5):`);
            results.extractedData.slice(0, 5).forEach((program, index) => {
                console.log(`\n   ${index + 1}. ${program.name || 'N/A'}`);
                if (program.university) console.log(`      University: ${program.university}`);
                if (program.location) console.log(`      Location: ${program.location}`);
            });
        }

        console.log('\n' + '='.repeat(80) + '\n');

        return results;
    } catch (error) {
        console.error('❌ Error during crawl:', error);
        throw error;
    }
}

testWithLogging().catch(console.error);
