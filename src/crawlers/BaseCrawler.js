import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Base Crawler class that provides common functionality for web crawling
 */
export default class BaseCrawler {
    /**
     * @param {Object} config - Configuration object
     * @param {string} config.baseUrl - Base URL for the crawler
     * @param {string} config.targetUrl - Initial target URL to start crawling
     * @param {number} config.maxCrawlLength - Maximum number of pages to crawl
     * @param {number} config.requestDelay - Delay between requests in milliseconds
     * @param {number} config.timeout - Request timeout in milliseconds
     */
    constructor(config = {}) {
        this.baseUrl = config.baseUrl || '';
        this.targetUrl = config.targetUrl || '';
        this.maxCrawlLength = config.maxCrawlLength || 50;
        this.requestDelay = config.requestDelay || 1000;
        this.timeout = config.timeout || 10000;
        this.maxRetries = config.maxRetries || 3;
        this.retryDelay = config.retryDelay || 5000;

        this.urlsToVisit = [this.targetUrl];
        this.visitedUrls = new Set();
        this.crawledCount = 0;
        this.extractedData = [];
    }

    /**
     * Normalize URL to absolute format
     * @param {string} url - URL to normalize
     * @returns {string} - Normalized absolute URL
     */
    normalizeUrl(url) {
        if (!url || url === '#' || url.startsWith('javascript:')) {
            return null;
        }

        // Already absolute URL
        if (url.startsWith('http')) {
            return url;
        }

        // Protocol-relative URL
        if (url.startsWith('//')) {
            return 'https:' + url;
        }

        // Relative URL
        const path = url.startsWith('/') ? url : '/' + url;
        return this.baseUrl + path;
    }

    /**
     * Check if URL should be crawled
     * @param {string} url - URL to check
     * @returns {boolean} - True if URL should be crawled
     */
    shouldCrawlUrl(url) {
        return (
            url &&
            url.startsWith(this.baseUrl) &&
            !this.visitedUrls.has(url) &&
            !this.urlsToVisit.includes(url)
        );
    }

    /**
     * Make HTTP request to URL with retry logic
     * @param {string} url - URL to fetch
     * @param {number} retryCount - Current retry attempt
     * @returns {Promise<Object>} - Response object
     */
    async fetchPage(url, retryCount = 0) {
        try {
            // Add random delay to mimic human behavior
            const randomDelay = Math.floor(Math.random() * 500);
            if (retryCount > 0) {
                await this.delay(randomDelay);
            }

            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'DNT': '1',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'none',
                    'Sec-Fetch-User': '?1',
                    'Cache-Control': 'max-age=0',
                    'Referer': this.baseUrl
                },
                timeout: this.timeout,
                maxRedirects: 5,
                validateStatus: function (status) {
                    return status >= 200 && status < 400;
                }
            });
            return response;
        } catch (error) {
            const statusCode = error.response?.status;

            // Retry on specific status codes
            if (retryCount < this.maxRetries &&
                (statusCode === 403 || statusCode === 429 || statusCode === 503 || !error.response)) {

                const delay = this.retryDelay * Math.pow(2, retryCount); // Exponential backoff
                console.log(`  Retry ${retryCount + 1}/${this.maxRetries} after ${delay}ms...`);
                await this.delay(delay);
                return this.fetchPage(url, retryCount + 1);
            }

            if (error.response) {
                throw new Error(`HTTP ${error.response.status}: ${error.response.statusText}`);
            }
            throw new Error(`Failed to fetch ${url}: ${error.message}`);
        }
    }

    /**
     * Parse HTML and extract links
     * @param {string} html - HTML content to parse
     * @returns {Array<string>} - Array of extracted URLs
     */
    extractLinks(html) {
        const $ = cheerio.load(html);
        const links = [];

        $('a[href]').each((_, element) => {
            const url = this.normalizeUrl($(element).attr('href'));
            if (this.shouldCrawlUrl(url)) {
                links.push(url);
            }
        });

        return links;
    }

    /**
     * Extract data from page - to be overridden by subclasses
     * @param {Object} $ - Cheerio instance
     * @param {string} url - Current page URL
     * @returns {Array} - Extracted data
     */
    extractData($, url) {
        // Override this method in subclasses
        return [];
    }

    /**
     * Process a single page
     * @param {string} url - URL to process
     */
    async processPage(url) {
        console.log(`[${this.crawledCount}/${this.maxCrawlLength}] Crawling: ${url}`);

        try {
            const response = await this.fetchPage(url);
            const $ = cheerio.load(response.data);

            // Extract data from page
            const data = this.extractData($, url);
            if (data && data.length > 0) {
                this.extractedData.push(...data);
                console.log(`  Found ${data.length} items on this page`);
            }

            // Extract links
            const links = this.extractLinks(response.data);
            if (links.length > 0) {
                this.urlsToVisit.push(...links);
                console.log(`  Found ${links.length} new links to crawl`);
            }

            console.log(`  Queue size: ${this.urlsToVisit.length}\n`);

            // Rate limiting with random variance
            const variance = Math.floor(Math.random() * 1000); // 0-1000ms random variance
            await this.delay(this.requestDelay + variance);

        } catch (error) {
            console.error(`  Error: ${error.message}\n`);
        }
    }

    /**
     * Delay execution
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise}
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Start the crawling process
     * @returns {Promise<Object>} - Crawl results
     */
    async crawl() {
        console.log(`Starting ${this.constructor.name}...`);
        console.log(`Target: ${this.targetUrl}`);
        console.log(`Max pages to crawl: ${this.maxCrawlLength}\n`);

        while (this.urlsToVisit.length > 0 && this.crawledCount < this.maxCrawlLength) {
            const currentUrl = this.urlsToVisit.shift();

            // Skip if already visited
            if (this.visitedUrls.has(currentUrl)) {
                continue;
            }

            // Mark as visited and increment counter
            this.visitedUrls.add(currentUrl);
            this.crawledCount++;

            // Process the page
            await this.processPage(currentUrl);
        }

        return this.getResults();
    }

    /**
     * Get crawl results
     * @returns {Object} - Results object
     */
    getResults() {
        console.log('\n=== Crawl Complete ===');
        console.log(`Total pages crawled: ${this.crawledCount}`);
        console.log(`Total unique URLs found: ${this.visitedUrls.size}`);
        console.log(`URLs in queue: ${this.urlsToVisit.length}`);
        console.log(`Data items extracted: ${this.extractedData.length}`);

        return {
            crawledCount: this.crawledCount,
            visitedUrls: Array.from(this.visitedUrls),
            remainingUrls: this.urlsToVisit,
            extractedData: this.extractedData
        };
    }

    /**
     * Reset crawler state
     */
    reset() {
        this.urlsToVisit = [this.targetUrl];
        this.visitedUrls = new Set();
        this.crawledCount = 0;
        this.extractedData = [];
    }
}
