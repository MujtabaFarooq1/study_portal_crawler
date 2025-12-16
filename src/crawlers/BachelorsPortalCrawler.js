import BaseCrawler from './BaseCrawler.js';

/**
 * Bachelors Portal specific crawler
 */
export default class BachelorsPortalCrawler extends BaseCrawler {
    constructor(config = {}) {
        super({
            baseUrl: 'https://www.bachelorsportal.com',
            targetUrl: 'https://www.bachelorsportal.com/search/bachelor',
            maxCrawlLength: config.maxCrawlLength || 50,
            requestDelay: config.requestDelay || 1000,
            timeout: config.timeout || 10000
        });
    }

    /**
     * Extract program data from Bachelors Portal page
     * @param {Object} $ - Cheerio instance
     * @param {string} url - Current page URL
     * @returns {Array} - Array of program objects
     */
    extractData($, url) {
        const programs = [];

        // Try multiple selectors to find program cards
        const selectors = [
            '.StudyCard',
            '.study-card',
            '[data-testid="study-card"]',
            '.search-result-item',
            'article[class*="card"]'
        ];

        let foundElements = false;
        for (const selector of selectors) {
            const elements = $(selector);
            if (elements.length > 0) {
                foundElements = true;
                elements.each((_, element) => {
                    const program = this.extractProgramData($, $(element));
                    if (program.name) {
                        programs.push(program);
                    }
                });
                break;
            }
        }

        if (!foundElements) {
            // Log if no program cards found (might be a non-search page)
            console.log('  No program cards found on this page');
        }

        return programs;
    }

    /**
     * Extract data from a single program card
     * @param {Object} $ - Cheerio instance
     * @param {Object} element - Program card element
     * @returns {Object} - Program object
     */
    extractProgramData($, element) {
        // Try multiple selectors for program name
        const nameSelectors = ['h2', 'h3', '.card-title', '[class*="title"]'];
        let programName = '';
        for (const selector of nameSelectors) {
            programName = element.find(selector).first().text().trim();
            if (programName) break;
        }

        // Extract university
        const universitySelectors = ['.university', '.institution', '[class*="university"]', '[class*="institution"]'];
        let university = '';
        for (const selector of universitySelectors) {
            university = element.find(selector).first().text().trim();
            if (university) break;
        }

        // Extract location
        const locationSelectors = ['.location', '.country', '[class*="location"]', '[class*="country"]'];
        let location = '';
        for (const selector of locationSelectors) {
            location = element.find(selector).first().text().trim();
            if (location) break;
        }

        // Extract link
        let link = element.find('a').first().attr('href');
        if (link && !link.startsWith('http')) {
            link = this.baseUrl + (link.startsWith('/') ? link : '/' + link);
        }

        // Extract additional metadata
        const duration = element.find('[class*="duration"]').first().text().trim();
        const fee = element.find('[class*="fee"], [class*="tuition"]').first().text().trim();
        const studyType = element.find('[class*="study-type"], [class*="pace"]').first().text().trim();

        return {
            name: programName,
            university,
            location,
            link,
            duration,
            fee,
            studyType,
            portal: 'bachelorsportal.com',
            extractedAt: new Date().toISOString()
        };
    }

    /**
     * Override to add custom filtering for Bachelors Portal URLs
     * @param {string} url - URL to check
     * @returns {boolean} - True if URL should be crawled
     */
    shouldCrawlUrl(url) {
        if (!super.shouldCrawlUrl(url)) {
            return false;
        }

        // Exclude certain URL patterns
        const excludePatterns = [
            '/advertise',
            '/contact',
            '/about',
            '/login',
            '/register',
            '/privacy',
            '/terms',
            '/cookies',
            '.pdf',
            '.jpg',
            '.png',
            '.gif'
        ];

        return !excludePatterns.some(pattern => url.includes(pattern));
    }
}
