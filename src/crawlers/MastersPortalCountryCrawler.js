import { appendToCountryCSV } from "../utils/csvWriterByCountry.js";
import PlaywrightBaseCrawler from "./PlaywrightBaseCrawler.js";
import { applyCurrencyByCountryContext } from "../utils/applyCurrencyByCountryContext.js";
import { getCountryFromUrl } from "../utils/getCountryFromUrl.js";
import { COUNTRY_CURRENCY_MAP } from "../constants/country_currency_map.js";
import fs from "fs";
import path from "path";

/**
 * Masters Portal crawler for specific countries
 * Uses Playwright to bypass Cloudflare and anti-bot protection
 */
export default class MastersPortalCountryCrawler extends PlaywrightBaseCrawler {
  constructor(config = {}) {
    const countryLabel = config.countryLabel || "";
    const targetUrl = countryLabel
      ? `https://www.mastersportal.com/search/master/${countryLabel}`
      : "https://www.mastersportal.com/search/master";

    super({
      baseUrl: "https://www.mastersportal.com",
      targetUrl: targetUrl,
      maxCrawlLength: config.maxCrawlLength || 50,
      requestDelay: config.requestDelay || 2000,
      headless: config.headless !== false,
    });

    this.countryLabel = countryLabel;
    this.portalType = "masters";
    this.currentCountryContext = countryLabel; // Track country context for study pages
  }

  /**
   * Override fetchPage to apply country-specific currency context
   */
  async fetchPage(url) {
    const page = await this.context.newPage();

    try {
      // Add stealth scripts to hide automation
      await page.addInitScript(() => {
        Object.defineProperty(navigator, "webdriver", {
          get: () => false,
        });
        Object.defineProperty(navigator, "plugins", {
          get: () => [1, 2, 3, 4, 5],
        });
        Object.defineProperty(navigator, "languages", {
          get: () => ["en-US", "en"],
        });
        window.chrome = {
          runtime: {},
        };
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) =>
          parameters.name === "notifications"
            ? Promise.resolve({ state: Notification.permission })
            : originalQuery(parameters);
      });

      // Determine country context: from URL (search page) or from instance (study page)
      const urlCountryKey = getCountryFromUrl(url);
      const countryKey = urlCountryKey || this.currentCountryContext;

      if (countryKey) {
        // Find the country key in COUNTRY_CURRENCY_MAP
        const countryEntry = Object.entries(COUNTRY_CURRENCY_MAP).find(
          ([key, value]) => value.url_safe_label === this.countryLabel
        );
        const actualCountryKey = countryEntry ? countryEntry[0] : null;

        if (actualCountryKey) {
          await applyCurrencyByCountryContext(page, actualCountryKey);
        }
      }

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

      // Wait for content based on page type
      const isSearchPage = url.includes("/search/");
      if (isSearchPage) {
        console.log("  ⏳ Waiting for search results to load...");
        try {
          await page.waitForSelector('a[href*="/studies/"]', {
            timeout: 30000,
            state: "attached",
          });
          console.log("  ✓ Study links loaded");
        } catch (e) {
          console.log("  ⚠️  Study links not found after 30s, continuing anyway...");
        }
      } else {
        console.log("  ⏳ Waiting for page content to load...");
        await page.waitForTimeout(8000);
      }

      // Add human-like behavior
      const randomDelay = Math.floor(Math.random() * 500) + 500;
      await page.waitForTimeout(randomDelay);
      await page.evaluate(() => {
        window.scrollTo(0, Math.floor(Math.random() * 200));
      });
      await page.waitForTimeout(500);

      const html = await page.content();
      return { html, page };
    } catch (error) {
      await page.close();
      throw new Error(`Failed to fetch ${url}: ${error.message}`);
    }
  }

  async extractData($, url, page = null) {
    const isStudyPage = /\/studies\/\d+\//.test(url);

    if (isStudyPage && page) {
      const data = await this.extractStudyPageData(page, url);

      if (data) {
        // Save to country-specific CSV
        appendToCountryCSV(
          {
            ...data,
            intakes: data.intakes?.join(", ") || "",
            languageRequirements: JSON.stringify(
              data.languageRequirements || {}
            ),
            generalRequirements: Array.isArray(data.generalRequirements)
              ? data.generalRequirements.join(" | ")
              : data.generalRequirements || "",
          },
          this.portalType,
          this.countryLabel
        );

        return [data];
      }
    }

    return [];
  }

  /**
   * Extract detailed data from individual study page
   * Uses browser DOM (Playwright) – NOT Cheerio
   */
  async extractStudyPageData(page, url) {
    console.log("  Extracting detailed study page data (Playwright)...");

    try {
      // Capture screenshot BEFORE waiting for selectors to debug what's on the page
      try {
        const testDir = path.join(process.cwd(), "test");
        if (!fs.existsSync(testDir)) {
          fs.mkdirSync(testDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const urlSlug = url.split("/").filter(Boolean).slice(-2).join("-").replace(/[^a-zA-Z0-9-]/g, "_");
        const screenshotPath = path.join(testDir, `before-extraction-${urlSlug}-${timestamp}.png`);

        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`  📸 Pre-extraction screenshot: ${screenshotPath}`);
      } catch (screenshotError) {
        console.log(`  ⚠️  Pre-extraction screenshot failed: ${screenshotError.message}`);
      }

      console.log("  ⏳ Waiting for #Hero section...");
      await page.waitForSelector("#Hero", { timeout: 30000 });
      console.log("  ✓ #Hero loaded");

      console.log("  ⏳ Waiting for #QuickFacts section...");
      await page.waitForSelector("#QuickFacts", { timeout: 30000 });
      console.log("  ✓ #QuickFacts loaded");

      await page.waitForTimeout(3000);

      // Capture screenshot of successfully loaded study page
      try {
        const testDir = path.join(process.cwd(), "test");
        if (!fs.existsSync(testDir)) {
          fs.mkdirSync(testDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const urlSlug = url.split("/").filter(Boolean).slice(-2).join("-").replace(/[^a-zA-Z0-9-]/g, "_");
        const screenshotPath = path.join(testDir, `country-study-${urlSlug}-${timestamp}.png`);

        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`  📸 Country study screenshot: ${screenshotPath}`);
      } catch (screenshotError) {
        console.log(`  ⚠️  Screenshot failed: ${screenshotError.message}`);
      }

      const data = await page.evaluate(() => {
        const result = {};

        /* ===========================
                   HERO SECTION
                ============================ */
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

        /* ===========================
                   DEGREE TYPE & STUDY MODE
                ============================ */
        let degreeType = null;
        let studyMode = null;

        // Get all span tags within DegreeTags
        const degreeTags = document.querySelectorAll('.DegreeTags span');

        // First span is typically the degree type
        if (degreeTags.length > 0) {
          const firstTag = degreeTags[0].textContent.trim();
          // Check if first tag is study mode or degree type
          if (/campus|online|distance|blended/i.test(firstTag)) {
            studyMode = firstTag;
          } else {
            degreeType = firstTag;
          }
        }

        // Second span is typically study mode (if not already set)
        if (degreeTags.length > 1 && !studyMode) {
          const secondTag = degreeTags[1].textContent.trim();
          if (/campus|online|distance|blended/i.test(secondTag)) {
            studyMode = secondTag;
          }
        }

        result.degreeType = degreeType;
        result.studyMode = studyMode;

        /* ===========================
                   TUITION FEE (INTERNATIONAL)
                ============================ */
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

        /* ===========================
                   DURATION
                ============================ */
        result.duration =
          document.querySelector(".js-duration")?.textContent.trim() || null;

        /* ===========================
                   START DATES
                ============================ */
        const startDates = [];
        document
          .querySelectorAll(".QuickFactComponent .Label i.lnr-calendar-full")[0]
          ?.closest(".QuickFactComponent")
          ?.querySelectorAll("time")
          ?.forEach((t) => startDates.push(t.textContent.trim()));

        result.intakes = startDates;

        /* ===========================
                   ENGLISH REQUIREMENTS
                ============================ */
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

        /* ===========================
                   GENERAL REQUIREMENTS
                ============================ */
        const reqs = [];
        document
          .querySelectorAll("#OtherRequirements h3 + ul li")
          .forEach((li) => reqs.push(li.textContent.trim()));

        result.generalRequirements = reqs.length ? reqs : null;

        /* ===========================
                   COUNTRY / LOCATION
                ============================ */
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

      return {
        ...data,
        sourceUrl: url,
        portal: "mastersportal.com",
        extractedAt: new Date().toISOString(),
      };
    } catch (err) {
      console.error("❌ Study page extraction failed:", err.message);
      return null;
    }
  }

  /**
   * URL filtering logic
   */
  shouldCrawlUrl(url) {
    if (!super.shouldCrawlUrl(url)) return false;

    const cleanUrl = url.split("#")[0].split("?")[0];

    const isStudyPage = /\/studies\/\d+\/[^/]+\.html/.test(cleanUrl);
    const isSearchPage =
      cleanUrl.includes("/search/master") &&
      (cleanUrl.includes(`/${this.countryLabel}`) || !this.countryLabel);

    if (isStudyPage) return true;

    if (isSearchPage) {
      if (url.includes("?")) {
        const params = [...new URL(url).searchParams.keys()];
        return params.every((p) => ["page", "ref"].includes(p));
      }
      return true;
    }

    return false;
  }
}
