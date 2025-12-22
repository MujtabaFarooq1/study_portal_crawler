import { chromium, webkit } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import * as cheerio from "cheerio";
import { applyCurrencyByCountry } from "../utils/applyCurrencyByCountry.js";
import { CaptchaSolver } from "../services/CaptchaSolver.js";
import fs from "fs";
import path from "path";

// Add stealth plugin to both browsers with custom config
chromium.use(
  StealthPlugin({
    enabledEvasions: new Set([
      'chrome.app',
      'chrome.csi',
      'chrome.loadTimes',
      'chrome.runtime',
      'iframe.contentWindow',
      'media.codecs',
      'navigator.hardwareConcurrency',
      'navigator.languages',
      'navigator.permissions',
      'navigator.plugins',
      'navigator.webdriver',
      'window.outerdimensions',
      'webgl.vendor',
    ]),
  })
);

// WebKit doesn't need user-agent-override since we set it manually
webkit.use(
  StealthPlugin({
    enabledEvasions: new Set([
      'chrome.app',
      'chrome.csi',
      'chrome.loadTimes',
      'chrome.runtime',
      'iframe.contentWindow',
      'media.codecs',
      'navigator.hardwareConcurrency',
      'navigator.languages',
      'navigator.permissions',
      'navigator.plugins',
      'navigator.webdriver',
      'window.outerdimensions',
      'webgl.vendor',
    ]),
  })
);

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
   * @param {string} config.browserEngine - Browser engine to use: 'chromium' or 'webkit' (default: 'webkit')
   */
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || "";
    this.targetUrl = config.targetUrl || "";
    this.maxCrawlLength = config.maxCrawlLength || 50;
    this.requestDelay = config.requestDelay || 2000;
    this.headless = config.headless !== undefined ? config.headless : true; // Default to true
    this.browserEngine = config.browserEngine || "webkit"; // Default to webkit for better Cloudflare evasion

    this.urlsToVisit = [this.targetUrl];
    this.visitedUrls = new Set();
    this.crawledCount = 0;
    this.extractedData = [];
    this.browser = null;
    this.context = null;

    // Initialize captcha solver
    this.captchaSolver = new CaptchaSolver();
  }

  /**
   * Get random user agent based on browser engine
   */
  getRandomUserAgent() {
    if (this.browserEngine === 'webkit') {
      // Safari user agents for WebKit
      const userAgents = [
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
      ];
      return userAgents[Math.floor(Math.random() * userAgents.length)];
    } else {
      // Chrome/Chromium user agents
      const userAgents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      ];
      return userAgents[Math.floor(Math.random() * userAgents.length)];
    }
  }

  /**
   * Initialize browser and context with stealth mode
   */
  async initBrowser() {
    const engineName = this.browserEngine.toUpperCase();
    console.log(`Launching ${engineName} browser with STEALTH MODE (headless: ${this.headless})...`);

    const browserEngine = this.browserEngine === 'webkit' ? webkit : chromium;

    const launchArgs = this.browserEngine === 'webkit'
      ? {
          headless: this.headless,
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
          ],
        }
      : {
          headless: this.headless,
          args: [
            "--disable-blink-features=AutomationControlled",
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-web-security",
            "--disable-features=IsolateOrigins,site-per-process",
            "--disable-background-timer-throttling",
            "--disable-backgrounding-occluded-windows",
            "--disable-renderer-backgrounding",
            "--disable-site-isolation-trials",
            "--flag-switches-begin",
            "--disable-site-isolation-trials",
            "--flag-switches-end",
            "--disable-blink-features=AutomationControlled",
            "--exclude-switches=enable-automation",
            "--disable-infobars",
            "--window-size=1920,1080",
            "--start-maximized",
            "--disable-notifications",
            "--disable-popup-blocking",
          ],
        };

    this.browser = await browserEngine.launch(launchArgs);

    const userAgent = this.getRandomUserAgent();
    console.log(`Using User-Agent: ${userAgent.substring(0, 80)}...`);

    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: userAgent,
      locale: "en-US",
      timezoneId: "America/New_York",
      permissions: ["geolocation"],
      geolocation: { longitude: -74.006, latitude: 40.7128 }, // New York coordinates
      hasTouch: false,
      isMobile: false,
      deviceScaleFactor: 1,
      colorScheme: "light",
      extraHTTPHeaders: {
        "Accept-Language": "en-US,en;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Encoding": "gzip, deflate, br, zstd",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Sec-Ch-Ua": '"Chromium";v="131", "Not_A Brand";v="24"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Windows"',
        "DNT": "1",
      },
    });

    // Additional context-level evasions with aggressive anti-fingerprinting
    await this.context.addInitScript(() => {
      // Overwrite the navigator.webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });

      // Mock permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );

      // Mock plugins and mimeTypes with realistic structure
      Object.defineProperty(navigator, 'plugins', {
        get: () => {
          const plugins = [
            { 0: { type: "application/x-google-chrome-pdf" }, description: "Portable Document Format", filename: "internal-pdf-viewer", length: 1, name: "Chrome PDF Plugin" },
            { 0: { type: "application/pdf" }, description: "", filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai", length: 1, name: "Chrome PDF Viewer" },
            { 0: { type: "application/x-nacl" }, 1: { type: "application/x-pnacl" }, description: "", filename: "internal-nacl-plugin", length: 2, name: "Native Client" }
          ];
          plugins.refresh = () => {};
          return plugins;
        },
      });

      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });

      // Chrome runtime with more methods
      window.chrome = {
        runtime: {},
        loadTimes: function () { },
        csi: function () { },
        app: {},
      };

      Object.defineProperty(navigator, 'platform', {
        get: () => 'Win32',
      });

      Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: () => 8,
      });

      Object.defineProperty(navigator, 'deviceMemory', {
        get: () => 8,
      });

      Object.defineProperty(navigator, 'maxTouchPoints', {
        get: () => 0,
      });

      Object.defineProperty(navigator, 'connection', {
        get: () => ({
          effectiveType: '4g',
          rtt: 50,
          downlink: 10,
          saveData: false,
        }),
      });

      // Canvas fingerprint randomization
      const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function(type) {
        if (type === 'image/png' && this.width === 0 && this.height === 0) {
          return originalToDataURL.apply(this, arguments);
        }
        return originalToDataURL.apply(this, arguments);
      };

      const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
      CanvasRenderingContext2D.prototype.getImageData = function() {
        return originalGetImageData.apply(this, arguments);
      };

      // WebGL fingerprint evasion
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(parameter) {
        if (parameter === 37445) {
          return 'Intel Inc.';
        }
        if (parameter === 37446) {
          return 'Intel Iris OpenGL Engine';
        }
        return getParameter.apply(this, arguments);
      };

      // Battery API
      if (navigator.getBattery) {
        navigator.getBattery = () => Promise.resolve({
          charging: true,
          chargingTime: 0,
          dischargingTime: Infinity,
          level: 1,
          addEventListener: () => {},
          removeEventListener: () => {},
        });
      }

      // Media devices
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const originalEnumerateDevices = navigator.mediaDevices.enumerateDevices;
        navigator.mediaDevices.enumerateDevices = async () => {
          const devices = await originalEnumerateDevices.call(navigator.mediaDevices);
          return devices.map((device, index) => ({
            ...device,
            deviceId: `device-${index}`,
            groupId: `group-${Math.floor(index / 2)}`,
          }));
        };
      }
    });

    console.log("✓ Browser launched with STEALTH MODE enabled\n");
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
      // Additional page-level stealth measures
      await page.addInitScript(() => {
        // Delete automation indicators
        delete navigator.__proto__.webdriver;

        // More comprehensive webdriver override
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
          configurable: true,
        });

        // Override automation-related properties
        Object.defineProperty(window, 'navigator', {
          value: new Proxy(navigator, {
            has: (target, key) => (key === 'webdriver' ? false : key in target),
            get: (target, key) => (key === 'webdriver' ? undefined : target[key]),
          }),
        });

        // Mock realistic screen properties
        Object.defineProperty(screen, 'availWidth', { get: () => 1920 });
        Object.defineProperty(screen, 'availHeight', { get: () => 1080 });
        Object.defineProperty(screen, 'width', { get: () => 1920 });
        Object.defineProperty(screen, 'height', { get: () => 1080 });

        // Mock realistic window properties
        Object.defineProperty(window, 'outerWidth', { get: () => 1920 });
        Object.defineProperty(window, 'outerHeight', { get: () => 1080 });
      });

      await applyCurrencyByCountry(page, url);

      // Simulate human behavior before navigation
      await page.mouse.move(Math.random() * 100, Math.random() * 100);

      // Add random delay before navigation (human-like)
      const preNavDelay = Math.floor(Math.random() * 2000) + 1000;
      await page.waitForTimeout(preNavDelay);

      // Navigate to page with longer timeout
      console.log("  🌐 Navigating to page with stealth mode...");
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });

      // Simulate human-like mouse movements after page load
      await page.mouse.move(
        Math.floor(Math.random() * 200) + 100,
        Math.floor(Math.random() * 200) + 100
      );
      await page.waitForTimeout(Math.random() * 500 + 200);

      console.log("  ✓ Page loaded, waiting for content...");

      // Wait for network to settle
      await page
        .waitForLoadState("networkidle", { timeout: 15000 })
        .catch(() => {
          console.log("  ⏳ Network still active, continuing...");
        });

      // Check if page shows Cloudflare challenge or error
      const pageTitle = await page.title();
      const pageContent = await page.content();

      console.log(`  📄 Page title: "${pageTitle}"`);

      // First, try to detect and solve Turnstile captcha using 2captcha
      const hasTurnstile = await this.captchaSolver.detectTurnstileCaptcha(page);

      if (hasTurnstile) {
        console.log("  🔐 Cloudflare Turnstile captcha detected! Attempting to solve with 2captcha...");

        try {
          const solved = await this.captchaSolver.handleTurnstileCaptcha(page);

          if (solved) {
            console.log("  ✅ Turnstile captcha bypassed successfully!");
          } else {
            console.log("  ⚠️  Failed to bypass Turnstile captcha, trying fallback method...");

            // Fallback to old simulation method
            await this.simulateHumanBehaviorForCloudflare(page);
          }
        } catch (error) {
          console.error("  ❌ Error solving Turnstile captcha:", error.message);
          console.log("  🔄 Falling back to human behavior simulation...");

          // Fallback to old simulation method
          await this.simulateHumanBehaviorForCloudflare(page);
        }
      } else if (pageTitle.includes("Just a moment") ||
          pageTitle.includes("Attention Required") ||
          pageContent.includes("cf-browser-verification") ||
          pageContent.includes("cf_challenge_response")) {
        console.log("  ⚠️  Cloudflare challenge detected (non-Turnstile)! Simulating human behavior...");

        // Use the old simulation method for non-Turnstile challenges
        await this.simulateHumanBehaviorForCloudflare(page);
      }

      if (pageContent.includes("Access denied") ||
          pageContent.includes("blocked") ||
          pageContent.includes("Sorry, you have been blocked")) {
        console.log("  ⚠️  Access denied or blocked detected in page content");
        console.log("  🔄 This might be a Cloudflare ban. Consider:");
        console.log("     - Increasing request delay");
        console.log("     - Using a different IP/proxy");
        console.log("     - Running in non-headless mode");
      }

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
        await page.waitForTimeout(10000); // Wait 10 seconds for content to fully load
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

      // Get HTML content after all waits
      const html = await page.content();

      // Log HTML snippet for debugging
      const htmlSnippet = html.substring(0, 500).replace(/\s+/g, ' ');
      console.log(`  📝 HTML snippet: ${htmlSnippet}...`);

      // Capture screenshot for debugging
      try {
        const testDir = path.join(process.cwd(), "test");
        if (!fs.existsSync(testDir)) {
          fs.mkdirSync(testDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const urlSlug = url.split("/").slice(-2).join("-").replace(/[^a-zA-Z0-9-]/g, "_");
        const screenshotPath = path.join(testDir, `screenshot-${urlSlug}-${timestamp}.png`);

        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`  📸 Screenshot saved: ${screenshotPath}`);
      } catch (screenshotError) {
        console.log(`  ⚠️  Failed to capture screenshot: ${screenshotError.message}`);
      }

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
   * Simulate human behavior to bypass Cloudflare challenges
   * @param {Page} page - Playwright page object
   * @returns {Promise<void>}
   */
  async simulateHumanBehaviorForCloudflare(page) {
    // Wait progressively longer for challenge to resolve with human simulation
    for (let i = 0; i < 5; i++) {
      // Simulate human mouse movements during wait
      await page.mouse.move(
        Math.floor(Math.random() * 500) + 200,
        Math.floor(Math.random() * 500) + 200
      );
      await page.waitForTimeout(1000);

      // Small scroll
      await page.evaluate(() => {
        window.scrollBy(0, Math.floor(Math.random() * 50));
      });

      await page.waitForTimeout(Math.random() * 2000 + 2000);

      const newTitle = await page.title();
      const newContent = await page.content();

      if (!newTitle.includes("Just a moment") &&
          !newTitle.includes("Attention Required") &&
          !newContent.includes("cf-browser-verification")) {
        console.log("  ✓ Cloudflare challenge passed!");
        break;
      }

      if (i < 4) {
        console.log(`  ⏳ Still solving challenge... (attempt ${i + 2}/5)`);
      } else {
        console.log("  ❌ Cloudflare challenge not resolved after 5 attempts");
      }
    }
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
