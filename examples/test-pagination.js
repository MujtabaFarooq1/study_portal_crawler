import MastersPortalPlaywrightCrawler from '../src/crawlers/MastersPortalPlaywrightCrawler.js';

/**
 * Test pagination and study page crawling
 * This will crawl a few pages to verify:
 * 1. Only study pages and search pages are crawled
 * 2. Pagination works correctly
 */
async function testPagination() {
    console.log('Testing Masters Portal with Pagination\n');
    console.log('========================================\n');

    const crawler = new MastersPortalPlaywrightCrawler({
        maxCrawlLength: 10,      // Crawl 10 pages total
        requestDelay: 2000,      // 2 seconds between requests
        headless: true
    });

    try {
        const results = await crawler.crawl();

        console.log('\n========================================');
        console.log('TEST RESULTS');
        console.log('========================================\n');

        console.log(`Total pages crawled: ${results.crawledCount}`);
        console.log(`Programs extracted: ${results.extractedData.length}`);
        console.log(`URLs in queue: ${results.remainingUrls.length}\n`);

        console.log('Visited URLs:');
        console.log('-------------');
        results.visitedUrls.forEach((url, index) => {
            const isStudyPage = /\/studies\/\d+\/[^/]+\.html/.test(url);
            const isSearchPage = /\/search\/master/.test(url);
            const type = isStudyPage ? '[STUDY]' : isSearchPage ? '[SEARCH]' : '[OTHER]';
            console.log(`${index + 1}. ${type} ${url}`);
        });

        console.log('\nSample Programs Extracted:');
        console.log('--------------------------');
        results.extractedData.slice(0, 5).forEach((program, index) => {
            console.log(`${index + 1}. ${program.name || 'N/A'}`);
            console.log(`   Link: ${program.link || 'N/A'}`);
        });

        // Verify all URLs are either study pages or search pages
        const invalidUrls = results.visitedUrls.filter(url => {
            const isStudyPage = /\/studies\/\d+\/[^/]+\.html/.test(url);
            const isSearchPage = /\/search\/master/.test(url);
            return !isStudyPage && !isSearchPage;
        });

        if (invalidUrls.length === 0) {
            console.log('\n✅ SUCCESS: All crawled URLs are study or search pages!');
        } else {
            console.log('\n❌ FAIL: Found invalid URLs:');
            invalidUrls.forEach(url => console.log(`   - ${url}`));
        }

        return results;
    } catch (error) {
        console.error('Error during test:', error);
        throw error;
    }
}

testPagination().catch(console.error);
