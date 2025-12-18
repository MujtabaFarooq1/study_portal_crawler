import { COUNTRY_CURRENCY_MAP } from "./src/constants/country_currency_map.js";
import MastersPortalCountryCrawler from "./src/crawlers/MastersPortalCountryCrawler.js";
import BachelorsPortalCountryCrawler from "./src/crawlers/BachelorsPortalCountryCrawler.js";
import StateManager from "./src/utils/stateManager.js";
import { chromium } from "playwright";
import {
  extractStudyUrlsFromSearchPage,
  getNextPageUrl,
  getCurrentPageNumber,
} from "./src/utils/extractStudyUrls.js";
import { appendToCountryCSV } from "./src/utils/csvWriterByCountry.js";
import { applyCurrencyByCountryContext } from "./src/utils/applyCurrencyByCountryContext.js";

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
      headless: false,
      maxPagesPerCountry: config.maxPagesPerCountry || 999, // Max search pages to crawl
    };
    this.browser = null;
    this.context = null;
  }

  /**
   * Initialize browser
   */
  async initBrowser() {
    console.log("🌐 Launching browser...");
    this.browser = await chromium.launch({
      headless: this.config.headless,
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

    console.log("✓ Browser launched\n");
  }

  /**
   * Close browser
   */
  async closeBrowser() {
    if (this.context) await this.context.close();
    if (this.browser) await this.browser.close();
    console.log("\n🔒 Browser closed");
  }

  /**
   * Delay execution
   */
  async delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Crawl a single search page and extract study URLs
   */
  async crawlSearchPage(url, countryLabel, portalType, countryKey) {
    const page = await this.context.newPage();

    try {
      // Apply currency context
      await applyCurrencyByCountryContext(page, countryKey);

      // Navigate to search page
      console.log(`  🔍 Loading: ${url}`);
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });

      // Wait for content
      await page
        .waitForLoadState("networkidle", { timeout: 15000 })
        .catch(() => {
          console.log("  ⏳ Network still active, continuing...");
        });

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
   */
  async scrapeStudyPage(url, countryLabel, portalType, countryKey) {
    const page = await this.context.newPage();

    try {
      // Apply currency context
      await applyCurrencyByCountryContext(page, countryKey);

      // Navigate to study page
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });

      await page
        .waitForLoadState("networkidle", { timeout: 15000 })
        .catch(() => {});

      // Wait for main content
      await page.waitForSelector("#Hero", { timeout: 10000 });
      await page.waitForSelector("#QuickFacts", { timeout: 10000 });
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

          console.log(`  ✓ Found ${result.studyUrls.length} study URLs on this page`);

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
            console.log(`\n  📚 Scraping ${newUrls.length} study pages from this search page...`);

            for (let i = 0; i < newUrls.length; i++) {
              const url = newUrls[i];
              totalStudiesScraped++;

              console.log(
                `\n  [${i + 1}/${newUrls.length}] (Total: ${totalStudiesScraped}) ${url.substring(
                  0,
                  70
                )}...`
              );

              try {
                await this.scrapeStudyPage(url, countryLabel, portalType, countryKey);

                // Mark as scraped
                this.stateManager.markStudyUrlScraped(countryLabel, portalType, url);

                // Update count
                const currentCount = this.stateManager.getCountryState(
                  countryLabel,
                  portalType
                ).programsExtracted;
                this.stateManager.updateCountryState(countryLabel, portalType, {
                  programsExtracted: currentCount + 1,
                });

                console.log(`  ✓ Extracted successfully (${totalStudiesScraped} total)`);

                // Delay before next study page
                const delay = this.config.requestDelay + Math.random() * 1000;
                await this.delay(delay);
              } catch (error) {
                console.error(`  ❌ Error:`, error.message);

                // Mark as scraped anyway to avoid retrying forever
                this.stateManager.markStudyUrlScraped(countryLabel, portalType, url);
              }
            }

            console.log(`\n  ✓ Completed scraping all studies from page ${currentPageNum}`);
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

// Run the crawler
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
