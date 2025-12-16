import BaseCrawler from '../src/crawlers/BaseCrawler.js';

/**
 * Example: Creating a custom crawler by extending BaseCrawler
 * This shows how to create a crawler for any educational portal
 */
class CustomEducationalCrawler extends BaseCrawler {
    constructor(config = {}) {
        super({
            baseUrl: 'https://www.example-portal.com',
            targetUrl: 'https://www.example-portal.com/search',
            ...config
        });
    }

    /**
     * Override extractData to implement custom extraction logic
     */
    extractData($, url) {
        const items = [];

        // Your custom selector logic here
        $('.program-card').each((_, element) => {
            const item = {
                title: $(element).find('.title').text().trim(),
                description: $(element).find('.description').text().trim(),
                url: $(element).find('a').attr('href'),
                extractedAt: new Date().toISOString()
            };

            if (item.title) {
                items.push(item);
            }
        });

        return items;
    }

    /**
     * Override shouldCrawlUrl to add custom URL filtering
     */
    shouldCrawlUrl(url) {
        if (!super.shouldCrawlUrl(url)) {
            return false;
        }

        // Add your custom filtering logic
        const excludePatterns = ['/login', '/register', '/contact'];
        return !excludePatterns.some(pattern => url.includes(pattern));
    }
}

/**
 * Example usage of custom crawler
 */
async function runCustomCrawler() {
    console.log('Running custom crawler example...\n');

    const crawler = new CustomEducationalCrawler({
        maxCrawlLength: 10,
        requestDelay: 2000
    });

    const results = await crawler.crawl();

    console.log('\nCustom Crawler Results:');
    console.log(`Total items extracted: ${results.extractedData.length}`);

    return results;
}

// Uncomment to run
// runCustomCrawler().catch(console.error);

export default CustomEducationalCrawler;
