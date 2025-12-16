import PlaywrightBaseCrawler from './PlaywrightBaseCrawler.js';

/**
 * Bachelors Portal crawler using Playwright (browser automation)
 * Bypasses Cloudflare and other anti-bot protection
 */
export default class BachelorsPortalPlaywrightCrawler extends PlaywrightBaseCrawler {
    constructor(config = {}) {
        super({
            baseUrl: 'https://www.bachelorsportal.com',
            targetUrl: 'https://www.bachelorsportal.com/search/bachelor',
            maxCrawlLength: config.maxCrawlLength || 50,
            requestDelay: config.requestDelay || 2000,
            headless: config.headless !== false
        });
    }

    /**
     * Extract program data from Bachelors Portal page
     * @param {Object} $ - Cheerio instance
     * @param {string} url - Current page URL
     * @returns {Array} - Array of program objects
     */
    extractData($, url) {
        // Check if this is a study page or search page
        const isStudyPage = /\/studies\/\d+\//.test(url);

        if (isStudyPage) {
            // Extract detailed data from individual study page
            const detailedData = this.extractStudyPageData($, url);
            return detailedData ? [detailedData] : [];
        } else {
            // Search page - don't extract data here, just return empty
            // Links will be extracted by the base crawler's extractLinks() method
            return [];
        }
    }

    /**
     * Extract detailed data from individual study page
     * @param {Object} $ - Cheerio instance
     * @param {string} url - Current page URL
     * @returns {Object} - Detailed program object
     */
    extractStudyPageData($, url) {
        console.log('  Extracting detailed study page data...');

        // Extract course name and university from Hero section
        const courseName = $('#Hero .StudyTitleWrapper .StudyTitle').first().text().trim();
        const university = $('#Hero .StudyTitleWrapper .OrganisationName').first().text().trim();

        // Extract official university website link
        const officialLink = $('#Hero .StudyTitleWrapper .StudyTitle .ProgrammeWebsiteLink').first().attr('href');

        // Extract tuition fee (international)
        const tuitionFeeTitle = $('.TuitionFeeContainer[data-target="international"] .Title').first().text().trim();
        const tuitionCurrency = $('.TuitionFeeContainer[data-target="international"] .CurrencyType').first().text().trim();
        const tuitionUnit = $('.TuitionFeeContainer[data-target="international"] .Unit').first().text().trim();
        const tuitionFee = (tuitionFeeTitle && tuitionCurrency && tuitionUnit)
            ? `${tuitionFeeTitle} ${tuitionCurrency} ${tuitionUnit}`.trim()
            : null;

        // Extract duration
        const duration = $('.js-duration').first().text().trim();

        // Extract start dates
        const startDates = [];
        $('.QuickFactComponent .Label i.lnr-calendar-full').first()
            .closest('.QuickFactComponent')
            .find('time').each((_, elem) => {
                const date = $(elem).text().trim();
                if (date) startDates.push(date);
            });
        const intakes = startDates.join(', ');

        // Extract language/English test requirements
        const languageRequirements = {};
        $('#EnglishRequirements .CardContents.EnglishCardContents').each((_, card) => {
            const testName = $(card).find('.Heading').text().replace(/\s+/g, ' ').trim();
            const scoreEl = $(card).find('.Score span').first();
            if (testName && scoreEl.length > 0) {
                const score = scoreEl.text().replace(/\s+/g, ' ').trim().replace(/[^0-9.]/g, '');
                if (score) {
                    languageRequirements[testName] = score;
                }
            }
        });

        // Extract general requirements
        const generalRequirements = [];
        $('#OtherRequirements h3 + ul li').each((_, elem) => {
            const req = $(elem).text().trim();
            if (req) generalRequirements.push(req);
        });

        // Extract country/location from QuickFacts
        const country = $('#QuickFacts .QuickFactComponent').filter((_, el) => {
            return $(el).find('.Label').text().includes('Campus location');
        }).find('.Value').text().trim();

        return {
            courseName,
            university,
            country,
            tuitionFee,
            duration,
            intakes,
            languageRequirements,
            generalRequirements,
            officialUniversityLink: officialLink || null,
            sourceUrl: url,
            portal: 'bachelorsportal.com',
            extractedAt: new Date().toISOString()
        };
    }

    /**
     * Override to add custom filtering for Bachelors Portal URLs
     * Only crawl study pages and pagination pages
     * @param {string} url - URL to check
     * @returns {boolean} - True if URL should be crawled
     */
    shouldCrawlUrl(url) {
        if (!super.shouldCrawlUrl(url)) {
            return false;
        }

        // Clean URL by removing hash fragments for comparison
        const cleanUrl = url.split('#')[0].split('?')[0];

        // Only allow two types of URLs:
        // 1. Study pages: /studies/[id]/[program-name].html
        // 2. Search/pagination pages: /search/bachelor or /search/bachelor?page=X
        const allowedPatterns = [
            /\/studies\/\d+\/[^/]+\.html/,   // Study pages
            /\/search\/bachelor$/            // Search page (exact match)
        ];

        // Check if URL matches allowed patterns
        const isStudyPage = allowedPatterns[0].test(cleanUrl);
        const isSearchPage = cleanUrl.endsWith('/search/bachelor');

        if (isStudyPage) {
            // For study pages, allow any query params (ref, etc.)
            return true;
        }

        if (isSearchPage) {
            // For search pages, only allow 'page' and 'ref' params
            if (url.includes('?')) {
                const urlObj = new URL(url);
                const params = Array.from(urlObj.searchParams.keys());
                const allowedParams = ['page', 'ref'];
                const hasOnlyAllowedParams = params.every(param => allowedParams.includes(param));
                return hasOnlyAllowedParams;
            }
            // Allow base search page without params
            return true;
        }

        return false;
    }
}
