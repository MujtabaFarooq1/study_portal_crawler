import { chromium } from "playwright";
import * as cheerio from "cheerio";
import { applyCurrencyByCountry } from "../utils/applyCurrencyByCountry.js";

/**
 * Playwright-based Base Crawler class for sites with anti-bot protection
 * Uses a real browser to bypass Cloudflare and other protections
 */
export default class PlaywrightBaseCrawler {
  /**
   * @param {Object} config - Configuration object
   * @param {string} config.baseUrl - Base URL for the crawler
   * @param {string} config.targetUrl - Initial target URL to start crawling
   * @param {number} config.maxCrawlLength - Maximum number of pages to crawl
   * @param {number} config.requestDelay - Delay between requests in milliseconds
   * @param {boolean} config.headless - Run browser in headless mode
   */
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || "";
    this.targetUrl = config.targetUrl || "";
    this.maxCrawlLength = config.maxCrawlLength || 50;
    this.requestDelay = config.requestDelay || 2000;
    this.headless = false; // Default to true

    this.urlsToVisit = [this.targetUrl];
    this.visitedUrls = new Set();
    this.crawledCount = 0;
    this.extractedData = [];
    this.browser = null;
    this.context = null;
  }

  /**
   * Initialize browser and context
   */
  async initBrowser() {
    console.log("Launching browser...");
    this.browser = await chromium.launch({
      headless: this.headless,
      args: [
        "--disable-blink-features=AutomationControlled",
        "--no-sandbox",
        "--disable-setuid-sandbox",
      ],
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });

    console.log("Browser launched successfully\n");
  }

  /**
   * Close browser
   */
  async closeBrowser() {
    if (this.context) await this.context.close();
    if (this.browser) await this.browser.close();
    console.log("\nBrowser closed");
  }

  /**
   * Normalize URL to absolute format
   * @param {string} url - URL to normalize
   * @returns {string} - Normalized absolute URL
   */
  normalizeUrl(url) {
    if (!url || url === "#" || url.startsWith("javascript:")) {
      return null;
    }

    if (url.startsWith("http")) {
      return url;
    }

    if (url.startsWith("//")) {
      return "https:" + url;
    }

    const path = url.startsWith("/") ? url : "/" + url;
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
   * Fetch page using Playwright
   * @param {string} url - URL to fetch
   * @returns {Promise<Object>} - Object with html content and page reference
   */
  async fetchPage(url) {
    const page = await this.context.newPage();

    try {
      // Add stealth scripts to hide automation
      await page.addInitScript(() => {
        // Remove webdriver property
        Object.defineProperty(navigator, "webdriver", {
          get: () => false,
        });

        // Mock plugins
        Object.defineProperty(navigator, "plugins", {
          get: () => [1, 2, 3, 4, 5],
        });

        // Mock languages
        Object.defineProperty(navigator, "languages", {
          get: () => ["en-US", "en"],
        });

        // Override chrome property
        window.chrome = {
          runtime: {},
        };

        // Override permissions
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) =>
          parameters.name === "notifications"
            ? Promise.resolve({ state: Notification.permission })
            : originalQuery(parameters);
      });

      await applyCurrencyByCountry(page, url);

      // Navigate to page
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });

      // Wait for network to settle
      await page
        .waitForLoadState("networkidle", { timeout: 15000 })
        .catch(() => {
          console.log("  ⏳ Network still active, continuing...");
        });

      // Wait for JavaScript to render content (Vue.js takes time)
      // Wait for actual content to appear on the page
      const isSearchPage = url.includes("/search/");
      if (isSearchPage) {
        // For search pages, wait for program cards to load
        console.log("  ⏳ Waiting for search results to load...");
        try {
          await page.waitForSelector('a[href*="/studies/"]', {
            timeout: 30000, // Wait up to 30 seconds for study links
            state: "attached",
          });
          console.log("  ✓ Study links loaded");
        } catch (e) {
          console.log(
            "  ⚠️  Study links not found after 30s, continuing anyway..."
          );
        }
      } else {
        // For study pages, wait longer for main content to render
        console.log("  ⏳ Waiting for page content to load...");
        await page.waitForTimeout(8000); // Wait 8 seconds for content to fully load
      }

      // Add small random delay to appear more human-like
      const randomDelay = Math.floor(Math.random() * 500) + 500;
      await page.waitForTimeout(randomDelay);

      // Simulate human-like behavior: scroll slightly
      await page.evaluate(() => {
        window.scrollTo(0, Math.floor(Math.random() * 200));
      });

      // Wait a bit more
      await page.waitForTimeout(500);

      // Get HTML content
      const html = await page.content();

      return { html, page };
    } catch (error) {
      await page.close();
      throw new Error(`Failed to fetch ${url}: ${error.message}`);
    }
  }

  /**
   * Extract links from HTML
   * @param {string} html - HTML content
   * @returns {Array<string>} - Array of URLs
   */
  extractLinks(html) {
    const $ = cheerio.load(html);
    const links = [];

    $("a[href]").each((_, element) => {
      const url = this.normalizeUrl($(element).attr("href"));
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
   * @param {Object} page - Playwright page object (for browser context extraction)
   * @returns {Promise<Array>} - Extracted data
   */
  async extractData($, url, page = null) {
    // Override this method in subclasses
    return [];
  }

  /**
   * Process a single page
   * @param {string} url - URL to process
   */
  async processPage(url) {
    // Determine page type
    const isStudyPage = /\/studies\/\d+\//.test(url);
    const isSearchPage = /\/search\/(master|bachelor)/.test(url);
    const pageType = isStudyPage
      ? "[STUDY]"
      : isSearchPage
      ? "[SEARCH]"
      : "[OTHER]";

    console.log(`\n${"=".repeat(80)}`);
    console.log(
      `[${this.crawledCount}/${this.maxCrawlLength}] ${pageType} Crawling:`
    );
    console.log(`URL: ${url}`);
    console.log(`${"=".repeat(80)}`);

    let page = null;
    try {
      const { html, page: playwrightPage } = await this.fetchPage(url);
      page = playwrightPage;
      console.log(`  📄 HTML length: ${html.length} chars`);
      const $ = cheerio.load(html);

      // Extract data from page
      const data = await this.extractData($, url, page);
      if (data && data.length > 0) {
        this.extractedData.push(...data);
        console.log(`\n✓ Found ${data.length} items on this page`);

        // Show a snapshot of the first 3 items
        const snapshot = data.slice(0, 3);
        console.log("\n📊 Data Snapshot:");
        snapshot.forEach((item, index) => {
          console.log(
            `\n  ${index + 1}. ${item.courseName || item.name || "N/A"}`
          );
          if (item.university)
            console.log(`     University: ${item.university}`);
          if (item.country) console.log(`     Country: ${item.country}`);
          if (item.location) console.log(`     Location: ${item.location}`);
          if (item.degreeType) console.log(`     Degree: ${item.degreeType}`);
          if (item.studyMode) console.log(`     Mode: ${item.studyMode}`);
          if (item.tuitionFee) console.log(`     Tuition: ${item.tuitionFee}`);
          if (item.link)
            console.log(`     Link: ${item.link.substring(0, 60)}...`);
        });

        if (data.length > 3) {
          console.log(`\n  ... and ${data.length - 3} more items`);
        }

        console.log(
          `\n📈 Total extracted so far: ${this.extractedData.length}`
        );
      } else {
        console.log(`\nℹ️  No items found on this page`);
      }

      // Extract links
      const links = this.extractLinks(html);
      if (links.length > 0) {
        this.urlsToVisit.push(...links);
        console.log(`\n✓ Found ${links.length} new links to crawl`);

        // Categorize links
        const studyLinks = links.filter((l) => /\/studies\/\d+\//.test(l));
        const searchLinks = links.filter((l) =>
          /\/search\/(master|bachelor)/.test(l)
        );

        if (studyLinks.length > 0) {
          console.log(`  - Study pages: ${studyLinks.length}`);
        }
        if (searchLinks.length > 0) {
          console.log(`  - Search/pagination pages: ${searchLinks.length}`);
          // Show pagination links
          searchLinks.forEach((link) => {
            const pageMatch = link.match(/page=(\d+)/);
            if (pageMatch) {
              console.log(`    → Page ${pageMatch[1]}: ${link}`);
            }
          });
        }
      }

      console.log(`\n📋 Queue size: ${this.urlsToVisit.length}`);
      console.log(
        `⏱️  Waiting ${Math.floor(
          this.requestDelay / 1000
        )}s before next request...\n`
      );

      // Rate limiting with random variance
      const variance = Math.floor(Math.random() * 1000);
      await this.delay(this.requestDelay + variance);
    } catch (error) {
      console.error(`\n✗ Error: ${error.message}\n`);
    } finally {
      // Always close the page to avoid memory leaks
      if (page) {
        await page.close();
      }
    }
  }

  /**
   * Delay execution
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise}
   */
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Start the crawling process
   * @returns {Promise<Object>} - Crawl results
   */
  async crawl() {
    console.log(`Starting ${this.constructor.name}...`);
    console.log(`Target: ${this.targetUrl}`);
    console.log(`Max pages to crawl: ${this.maxCrawlLength}`);
    console.log(`Using Playwright (browser automation)\n`);

    await this.initBrowser();

    try {
      while (
        this.urlsToVisit.length > 0 &&
        this.crawledCount < this.maxCrawlLength
      ) {
        const currentUrl = this.urlsToVisit.shift();

        if (this.visitedUrls.has(currentUrl)) {
          continue;
        }

        this.visitedUrls.add(currentUrl);
        this.crawledCount++;

        await this.processPage(currentUrl);
      }
    } finally {
      await this.closeBrowser();
    }

    return this.getResults();
  }

  /**
   * Get crawl results
   * @returns {Object} - Results object
   */
  getResults() {
    console.log("\n=== Crawl Complete ===");
    console.log(`Total pages crawled: ${this.crawledCount}`);
    console.log(`Total unique URLs found: ${this.visitedUrls.size}`);
    console.log(`URLs in queue: ${this.urlsToVisit.length}`);
    console.log(`Data items extracted: ${this.extractedData.length}`);

    return {
      crawledCount: this.crawledCount,
      visitedUrls: Array.from(this.visitedUrls),
      remainingUrls: this.urlsToVisit,
      extractedData: this.extractedData,
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
