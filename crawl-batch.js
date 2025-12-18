import { COUNTRY_CURRENCY_MAP } from "./src/constants/country_currency_map.js";
import MastersPortalCountryCrawler from "./src/crawlers/MastersPortalCountryCrawler.js";
import BachelorsPortalCountryCrawler from "./src/crawlers/BachelorsPortalCountryCrawler.js";
import StateManager from "./src/utils/stateManager.js";
import { chromium, webkit } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import {
  extractStudyUrlsFromSearchPage,
  getNextPageUrl,
  getCurrentPageNumber,
} from "./src/utils/extractStudyUrls.js";
import { appendToCountryCSV } from "./src/utils/csvWriterByCountry.js";
import { applyCurrencyByCountryContext } from "./src/utils/applyCurrencyByCountryContext.js";
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
 * Batch Crawler with Resume Capability
 * 1. Processes all countries in order
 * 2. For each country: Masters first, then Bachelors
 * 3. Extracts all study URLs from search pages
 * 4. Scrapes each study page
 * 5. Can resume from where it left off if interrupted
 */

class BatchCrawler {
  constructor(config = {}) {
    this.stateManager = new StateManager();
    this.config = {
      requestDelay: config.requestDelay || 3000,
      headless: config.headless,
      maxPagesPerCountry: config.maxPagesPerCountry || 999, // Max search pages to crawl
    };
    // Dual browser setup: Chromium for search, WebKit for study pages
    this.chromiumBrowser = null;
    this.chromiumContext = null;
    this.webkitBrowser = null;
    this.webkitContext = null;
  }

  /**
   * Get random Chromium user agent
   */
  getChromiumUserAgent() {
    const userAgents = [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    ];
    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }

  /**
   * Get random WebKit user agent
   */
  getWebKitUserAgent() {
    const userAgents = [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
    ];
    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }

  /**
   * Initialize dual browsers with stealth mode
   * Chromium for search pages, WebKit for study pages
   */
  async initBrowser() {
    console.log(`🌐 Launching DUAL BROWSER setup with STEALTH MODE...`);
    console.log(`   - CHROMIUM for search pages (faster, less protection needed)`);
    console.log(`   - WEBKIT for study pages (better Cloudflare evasion)`);

    // Launch Chromium for search pages
    this.chromiumBrowser = await chromium.launch({
      headless: this.config.headless,
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
        "--exclude-switches=enable-automation",
        "--disable-infobars",
        "--window-size=1920,1080",
        "--start-maximized",
        "--disable-notifications",
        "--disable-popup-blocking",
      ],
    });

    const chromiumUserAgent = this.getChromiumUserAgent();
    console.log(`   Chromium UA: ${chromiumUserAgent.substring(0, 70)}...`);

    this.chromiumContext = await this.chromiumBrowser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: chromiumUserAgent,
      locale: "en-US",
      timezoneId: "America/New_York",
      permissions: ["geolocation"],
      geolocation: { longitude: -74.006, latitude: 40.7128 },
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

    // Launch WebKit for study pages
    this.webkitBrowser = await webkit.launch({
      headless: this.config.headless,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
      ],
    });

    const webkitUserAgent = this.getWebKitUserAgent();
    console.log(`   WebKit UA: ${webkitUserAgent.substring(0, 70)}...`);

    this.webkitContext = await this.webkitBrowser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: webkitUserAgent,
      locale: "en-US",
      timezoneId: "America/New_York",
      permissions: ["geolocation"],
      geolocation: { longitude: -74.006, latitude: 40.7128 },
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
        "DNT": "1",
      },
    });

    // Additional context-level evasions for both browsers
    const stealthScript = () => {
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

      // Mock plugins with realistic structure
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

      // Chrome runtime
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

      // Canvas fingerprint evasion
      const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function(type) {
        if (type === 'image/png' && this.width === 0 && this.height === 0) {
          return originalToDataURL.apply(this, arguments);
        }
        return originalToDataURL.apply(this, arguments);
      };

      // WebGL fingerprint evasion
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(parameter) {
        if (parameter === 37445) return 'Intel Inc.';
        if (parameter === 37446) return 'Intel Iris OpenGL Engine';
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
    };

    await this.chromiumContext.addInitScript(stealthScript);
    await this.webkitContext.addInitScript(stealthScript);

    console.log(`✓ Both browsers launched with STEALTH MODE enabled\n`);
  }

  /**
   * Close both browsers
   */
  async closeBrowser() {
    if (this.chromiumContext) await this.chromiumContext.close();
    if (this.chromiumBrowser) await this.chromiumBrowser.close();
    if (this.webkitContext) await this.webkitContext.close();
    if (this.webkitBrowser) await this.webkitBrowser.close();
    console.log("\n🔒 Both browsers closed");
  }

  /**
   * Delay execution
   */
  async delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Crawl a single search page and extract study URLs
   * Uses CHROMIUM browser for faster search page processing
   */
  async crawlSearchPage(url, countryLabel, portalType, countryKey) {
    const page = await this.chromiumContext.newPage();

    try {
      // Add page-level stealth
      await page.addInitScript(() => {
        delete navigator.__proto__.webdriver;
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
          configurable: true,
        });
        Object.defineProperty(window, 'navigator', {
          value: new Proxy(navigator, {
            has: (target, key) => (key === 'webdriver' ? false : key in target),
            get: (target, key) => (key === 'webdriver' ? undefined : target[key]),
          }),
        });
        Object.defineProperty(screen, 'availWidth', { get: () => 1920 });
        Object.defineProperty(screen, 'availHeight', { get: () => 1080 });
        Object.defineProperty(window, 'outerWidth', { get: () => 1920 });
        Object.defineProperty(window, 'outerHeight', { get: () => 1080 });
      });

      // Apply currency context
      await applyCurrencyByCountryContext(page, countryKey);

      // Simulate human behavior before navigation
      await page.mouse.move(Math.random() * 100, Math.random() * 100);

      // Add random delay before navigation
      const preNavDelay = Math.floor(Math.random() * 2000) + 1000;
      await page.waitForTimeout(preNavDelay);

      // Navigate to search page
      console.log(`  🔍 [CHROMIUM] Loading search page: ${url}`);
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });

      // Simulate human-like mouse movements after page load
      await page.mouse.move(
        Math.floor(Math.random() * 200) + 100,
        Math.floor(Math.random() * 200) + 100
      );
      await page.waitForTimeout(Math.random() * 500 + 200);

      // Wait for content
      await page
        .waitForLoadState("networkidle", { timeout: 15000 })
        .catch(() => {
          console.log("  ⏳ Network still active, continuing...");
        });

      // Capture screenshot BEFORE Cloudflare check
      try {
        const testDir = path.join(process.cwd(), "test");
        if (!fs.existsSync(testDir)) {
          fs.mkdirSync(testDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const urlSlug = url.split("/").filter(Boolean).slice(-2).join("-").replace(/[^a-zA-Z0-9-]/g, "_");
        const screenshotPath = path.join(testDir, `search-before-cf-${urlSlug}-${timestamp}.png`);

        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`  📸 Screenshot before CF check: ${screenshotPath}`);
      } catch (screenshotError) {
        console.log(`  ⚠️  Screenshot before CF failed: ${screenshotError.message}`);
      }

      // Check for Cloudflare with enhanced handling
      const pageTitle = await page.title();
      if (pageTitle.includes("Just a moment") || pageTitle.includes("Attention Required")) {
        console.log("  ⚠️  Cloudflare detected, simulating human behavior...");

        for (let i = 0; i < 5; i++) {
          await page.mouse.move(
            Math.floor(Math.random() * 500) + 200,
            Math.floor(Math.random() * 500) + 200
          );
          await page.waitForTimeout(1000);

          await page.evaluate(() => {
            window.scrollBy(0, Math.floor(Math.random() * 50));
          });

          await page.waitForTimeout(Math.random() * 2000 + 2000);

          const newTitle = await page.title();
          if (!newTitle.includes("Just a moment") && !newTitle.includes("Attention Required")) {
            console.log("  ✓ Cloudflare challenge passed!");
            break;
          }

          if (i < 4) {
            console.log(`  ⏳ Still solving... (${i + 2}/5)`);
          }
        }
      }

      // Capture screenshot AFTER Cloudflare check
      try {
        const testDir = path.join(process.cwd(), "test");
        if (!fs.existsSync(testDir)) {
          fs.mkdirSync(testDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const urlSlug = url.split("/").filter(Boolean).slice(-2).join("-").replace(/[^a-zA-Z0-9-]/g, "_");
        const screenshotPath = path.join(testDir, `search-after-cf-${urlSlug}-${timestamp}.png`);

        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`  📸 Screenshot after CF check: ${screenshotPath}`);
      } catch (screenshotError) {
        console.log(`  ⚠️  Screenshot after CF failed: ${screenshotError.message}`);
      }

      // Wait for study links to appear
      try {
        await page.waitForSelector('a[href*="/studies/"]', {
          timeout: 20000,
          state: "attached",
        });
      } catch (e) {
        console.log("  ⚠️  No study links found on this page");
        return { studyUrls: [], nextPageUrl: null, currentPage: 1 };
      }

      // Extract all study URLs from this page
      const studyUrls = await extractStudyUrlsFromSearchPage(page);

      // Get next page URL
      const baseUrl =
        portalType === "masters"
          ? "https://www.mastersportal.com"
          : "https://www.bachelorsportal.com";
      const nextPageUrl = await getNextPageUrl(page, baseUrl);

      // Get current page number
      const currentPage = await getCurrentPageNumber(page, url);

      await page.close();

      return { studyUrls, nextPageUrl, currentPage };
    } catch (error) {
      await page.close();
      throw error;
    }
  }

  /**
   * Scrape a single study page
   * Uses WEBKIT browser for better Cloudflare evasion
   */
  async scrapeStudyPage(url, countryLabel, portalType, countryKey) {
    const page = await this.webkitContext.newPage();

    try {
      // Add page-level stealth
      await page.addInitScript(() => {
        delete navigator.__proto__.webdriver;
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
          configurable: true,
        });
        Object.defineProperty(window, 'navigator', {
          value: new Proxy(navigator, {
            has: (target, key) => (key === 'webdriver' ? false : key in target),
            get: (target, key) => (key === 'webdriver' ? undefined : target[key]),
          }),
        });
        Object.defineProperty(screen, 'availWidth', { get: () => 1920 });
        Object.defineProperty(screen, 'availHeight', { get: () => 1080 });
        Object.defineProperty(window, 'outerWidth', { get: () => 1920 });
        Object.defineProperty(window, 'outerHeight', { get: () => 1080 });
      });

      // Apply currency context
      await applyCurrencyByCountryContext(page, countryKey);

      // Simulate human behavior before navigation
      await page.mouse.move(Math.random() * 100, Math.random() * 100);

      // Add random delay before navigation
      const preNavDelay = Math.floor(Math.random() * 2000) + 1000;
      await page.waitForTimeout(preNavDelay);

      // Navigate to study page
      console.log(`  🌐 [WEBKIT] Loading study page with stealth...`);
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });

      // Simulate human-like mouse movements after page load
      await page.mouse.move(
        Math.floor(Math.random() * 200) + 100,
        Math.floor(Math.random() * 200) + 100
      );
      await page.waitForTimeout(Math.random() * 500 + 200);

      await page
        .waitForLoadState("networkidle", { timeout: 15000 })
        .catch(() => {});

      // Check for Cloudflare with enhanced handling
      const pageTitle = await page.title();
      if (pageTitle.includes("Just a moment") || pageTitle.includes("Attention Required")) {
        console.log("  ⚠️  Cloudflare detected on study page, simulating human behavior...");

        for (let i = 0; i < 5; i++) {
          await page.mouse.move(
            Math.floor(Math.random() * 500) + 200,
            Math.floor(Math.random() * 500) + 200
          );
          await page.waitForTimeout(1000);

          await page.evaluate(() => {
            window.scrollBy(0, Math.floor(Math.random() * 50));
          });

          await page.waitForTimeout(Math.random() * 2000 + 2000);

          const newTitle = await page.title();
          if (!newTitle.includes("Just a moment") && !newTitle.includes("Attention Required")) {
            console.log("  ✓ Cloudflare challenge passed!");
            break;
          }

          if (i < 4) {
            console.log(`  ⏳ Still solving challenge... (${i + 2}/5)`);
          } else {
            console.log("  ❌ Cloudflare not resolved after 5 attempts");
          }
        }
      }

      // Wait for main content
      console.log("  ⏳ Waiting for #Hero section...");
      await page.waitForSelector("#Hero", { timeout: 30000 });
      console.log("  ✓ #Hero loaded");

      console.log("  ⏳ Waiting for #QuickFacts section...");
      await page.waitForSelector("#QuickFacts", { timeout: 30000 });
      console.log("  ✓ #QuickFacts loaded");

      await page.waitForTimeout(3000);

      // Extract data using the same logic as the original crawlers
      const data = await page.evaluate(() => {
        const result = {};

        // Hero section
        const hero = document.querySelector("#Hero");
        const titleWrapper = hero?.querySelector(".StudyTitleWrapper");

        result.university =
          titleWrapper
            ?.querySelector(".OrganisationName")
            ?.textContent.trim() || null;
        result.courseName =
          titleWrapper?.querySelector(".StudyTitle")?.innerText.trim() || null;
        result.officialUniversityLink =
          titleWrapper?.querySelector(".ProgrammeWebsiteLink")?.href || null;

        // Degree type & study mode
        let degreeType = null;
        let studyMode = null;
        document.querySelectorAll(".DegreeTags .Tag").forEach((tag) => {
          const text = tag.textContent.trim();
          if (/Bachelor|Master|PhD|MBA|B\.|BSc|BA/i.test(text))
            degreeType = text;
          if (/campus|online|distance|blended/i.test(text)) studyMode = text;
        });
        result.degreeType = degreeType;
        result.studyMode = studyMode;

        // Tuition fee
        const fee = document.querySelector(
          '.TuitionFeeContainer[data-target="international"]'
        );
        if (fee) {
          const title = fee.querySelector(".Title")?.textContent.trim();
          const currency = fee
            .querySelector(".CurrencyType")
            ?.textContent.trim();
          const unit = fee.querySelector(".Unit")?.textContent.trim();
          result.tuitionFee =
            title && currency && unit ? `${title} ${currency} ${unit}` : null;
        } else {
          result.tuitionFee = null;
        }

        // Duration
        result.duration =
          document.querySelector(".js-duration")?.textContent.trim() || null;

        // Start dates
        const startDates = [];
        document
          .querySelectorAll(".QuickFactComponent .Label i.lnr-calendar-full")[0]
          ?.closest(".QuickFactComponent")
          ?.querySelectorAll("time")
          ?.forEach((t) => startDates.push(t.textContent.trim()));
        result.intakes = startDates;

        // English requirements
        const tests = new Map();
        document
          .querySelectorAll(
            "#EnglishRequirements .CardContents.EnglishCardContents"
          )
          .forEach((card) => {
            const name = card
              .querySelector(".Heading")
              ?.textContent.replace(/\s+/g, " ")
              .trim();
            const score =
              card
                .querySelector(".Score span")
                ?.textContent.replace(/[^0-9.]/g, "")
                .trim() || null;
            if (name && !tests.has(name)) {
              tests.set(name, score);
            }
          });
        result.languageRequirements = Object.fromEntries(tests);

        // General requirements
        const reqs = [];
        document
          .querySelectorAll("#OtherRequirements h3 + ul li")
          .forEach((li) => reqs.push(li.textContent.trim()));
        result.generalRequirements = reqs.length ? reqs : null;

        // Country/location
        document
          .querySelectorAll("#QuickFacts .QuickFactComponent")
          .forEach((comp) => {
            if (comp.textContent.includes("Campus location")) {
              result.country =
                comp.querySelector(".Value")?.textContent.trim() || null;
            }
          });

        return result;
      });

      // Add metadata
      const fullData = {
        ...data,
        sourceUrl: url,
        portal:
          portalType === "masters"
            ? "mastersportal.com"
            : "bachelorsportal.com",
        extractedAt: new Date().toISOString(),
      };

      // Save to CSV
      appendToCountryCSV(
        {
          ...fullData,
          intakes: fullData.intakes?.join(", ") || "",
          languageRequirements: JSON.stringify(
            fullData.languageRequirements || {}
          ),
          generalRequirements: Array.isArray(fullData.generalRequirements)
            ? fullData.generalRequirements.join(" | ")
            : fullData.generalRequirements || "",
        },
        portalType,
        countryLabel
      );

      await page.close();
      return fullData;
    } catch (error) {
      await page.close();
      throw error;
    }
  }

  /**
   * Process a single country/portal combination
   */
  async processCountryPortal(countryKey, countryConfig, portalType) {
    const { url_safe_label: countryLabel } = countryConfig;
    const countryState = this.stateManager.getCountryState(
      countryLabel,
      portalType
    );

    console.log(`\n${"=".repeat(80)}`);
    console.log(
      `📍 ${countryKey} - ${portalType.toUpperCase()} (${countryLabel})`
    );
    console.log(`${"=".repeat(80)}`);

    // Check if already completed
    if (this.stateManager.isCompleted(countryLabel, portalType)) {
      console.log("✓ Already completed, skipping...");
      return;
    }

    // Mark as in progress
    this.stateManager.updateCountryState(countryLabel, portalType, {
      status: "in_progress",
      startedAt: countryState.startedAt || new Date().toISOString(),
    });

    try {
      const baseUrl =
        portalType === "masters"
          ? "https://www.mastersportal.com"
          : "https://www.bachelorsportal.com";

      let currentPageNum = countryState.currentPage || 1;
      let searchUrl = `${baseUrl}/search/${
        portalType === "masters" ? "master" : "bachelor"
      }/${countryLabel}`;

      if (currentPageNum > 1) {
        searchUrl += `?page=${currentPageNum}`;
        console.log(`  ↻ Resuming from page ${currentPageNum}`);
      }

      let hasMorePages = true;
      let pagesProcessed = 0;
      let totalStudiesScraped = 0;

      while (hasMorePages && pagesProcessed < this.config.maxPagesPerCountry) {
        console.log(`\n${"─".repeat(80)}`);
        console.log(`📄 SEARCH PAGE ${currentPageNum}`);
        console.log(`${"─".repeat(80)}`);

        try {
          // STEP 1: Extract study URLs from this search page
          const result = await this.crawlSearchPage(
            searchUrl,
            countryLabel,
            portalType,
            countryKey
          );

          console.log(
            `  ✓ Found ${result.studyUrls.length} study URLs on this page`
          );

          // Filter out already scraped URLs
          const countryState = this.stateManager.getCountryState(
            countryLabel,
            portalType
          );
          const newUrls = result.studyUrls.filter(
            (url) => !countryState.scrapedStudyUrls.includes(url)
          );

          console.log(`  ✓ ${newUrls.length} new URLs to scrape`);

          // STEP 2: Immediately scrape each study page from this search page
          if (newUrls.length > 0) {
            console.log(
              `\n  📚 Scraping ${newUrls.length} study pages from this search page...`
            );

            for (let i = 0; i < newUrls.length; i++) {
              const url = newUrls[i];
              totalStudiesScraped++;

              console.log(
                `\n  [${i + 1}/${
                  newUrls.length
                }] (Total: ${totalStudiesScraped}) ${url.substring(0, 70)}...`
              );

              try {
                await this.scrapeStudyPage(
                  url,
                  countryLabel,
                  portalType,
                  countryKey
                );

                // Mark as scraped
                this.stateManager.markStudyUrlScraped(
                  countryLabel,
                  portalType,
                  url
                );

                // Update count
                const currentCount = this.stateManager.getCountryState(
                  countryLabel,
                  portalType
                ).programsExtracted;
                this.stateManager.updateCountryState(countryLabel, portalType, {
                  programsExtracted: currentCount + 1,
                });

                console.log(
                  `  ✓ Extracted successfully (${totalStudiesScraped} total)`
                );

                // Delay before next study page
                const delay = this.config.requestDelay + Math.random() * 1000;
                await this.delay(delay);
              } catch (error) {
                console.error(`  ❌ Error:`, error.message);

                // Mark as scraped anyway to avoid retrying forever
                this.stateManager.markStudyUrlScraped(
                  countryLabel,
                  portalType,
                  url
                );
              }
            }

            console.log(
              `\n  ✓ Completed scraping all studies from page ${currentPageNum}`
            );
          } else {
            console.log(`  ℹ️  All URLs from this page were already scraped`);
          }

          // Update state with current page
          this.stateManager.updateCountryState(countryLabel, portalType, {
            currentPage: currentPageNum,
            totalPagesDiscovered: Math.max(
              currentPageNum,
              countryState.totalPagesDiscovered || 0
            ),
          });

          // STEP 3: Check for next search page
          if (result.nextPageUrl) {
            searchUrl = result.nextPageUrl;
            currentPageNum++;
            pagesProcessed++;

            console.log(`\n  ➡️  Moving to next search page...`);

            // Delay before next search page
            const delay = this.config.requestDelay + Math.random() * 1000;
            console.log(`  ⏳ Waiting ${(delay / 1000).toFixed(1)}s...`);
            await this.delay(delay);
          } else {
            console.log(`\n  ℹ️  No more search pages found`);
            hasMorePages = false;
          }
        } catch (error) {
          console.error(`  ❌ Error on page ${currentPageNum}:`, error.message);
          this.stateManager.updateCountryState(countryLabel, portalType, {
            lastError: error.message,
          });

          // Try to continue to next page instead of stopping
          if (result && result.nextPageUrl) {
            console.log(`  ⚠️  Attempting to continue to next page...`);
            searchUrl = result.nextPageUrl;
            currentPageNum++;
            pagesProcessed++;
            await this.delay(5000);
          } else {
            hasMorePages = false;
          }
        }
      }

      // Mark as completed
      this.stateManager.updateCountryState(countryLabel, portalType, {
        status: "completed",
        completedAt: new Date().toISOString(),
      });

      const finalCount = this.stateManager.getCountryState(
        countryLabel,
        portalType
      ).programsExtracted;

      console.log(`\n✅ ${countryKey} ${portalType} completed!`);
      console.log(`  Total programs extracted: ${finalCount}`);
    } catch (error) {
      console.error(`\n❌ Fatal error for ${countryKey} ${portalType}:`, error);
      this.stateManager.updateCountryState(countryLabel, portalType, {
        status: "error",
        lastError: error.message,
      });
    }
  }

  /**
   * Main crawl function
   */
  async crawl() {
    console.log("========================================");
    console.log("🚀 BATCH CRAWLER WITH RESUME");
    console.log("========================================\n");

    const countries = Object.entries(COUNTRY_CURRENCY_MAP);

    console.log(`📊 Found ${countries.length} countries to process`);
    console.log(`📌 Current phase: ${this.stateManager.getCurrentPhase()}\n`);

    // Show progress summary
    const summary = this.stateManager.getProgressSummary();
    console.log("Progress Summary:");
    console.log(JSON.stringify(summary, null, 2));
    console.log("");

    await this.initBrowser();

    try {
      // PHASE 1: Process all Masters portals
      if (this.stateManager.getCurrentPhase() === "masters") {
        console.log("\n" + "=".repeat(80));
        console.log("🎓 PHASE 1: MASTERS PORTALS FOR ALL COUNTRIES");
        console.log("=".repeat(80));

        for (const [countryKey, countryConfig] of countries) {
          await this.processCountryPortal(countryKey, countryConfig, "masters");
        }

        // Move to bachelors phase
        this.stateManager.setCurrentPhase("bachelors");
      }

      // PHASE 2: Process all Bachelors portals
      if (this.stateManager.getCurrentPhase() === "bachelors") {
        console.log("\n" + "=".repeat(80));
        console.log("🎓 PHASE 2: BACHELORS PORTALS FOR ALL COUNTRIES");
        console.log("=".repeat(80));

        for (const [countryKey, countryConfig] of countries) {
          await this.processCountryPortal(
            countryKey,
            countryConfig,
            "bachelors"
          );
        }

        console.log("\n" + "=".repeat(80));
        console.log("🎉 ALL COUNTRIES COMPLETED!");
        console.log("=".repeat(80));
      }
    } finally {
      await this.closeBrowser();
    }

    // Final summary
    const finalSummary = this.stateManager.getProgressSummary();
    console.log("\n📊 FINAL SUMMARY:");
    console.log(JSON.stringify(finalSummary, null, 2));
  }
}

// Run the crawler with dual browser setup
// Chromium for search pages, WebKit for study pages
const crawler = new BatchCrawler({
  headless: true,
  requestDelay: 3000,
  maxPagesPerCountry: 999,
});

crawler
  .crawl()
  .then(() => {
    console.log("\n✅ Batch crawl completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  });
