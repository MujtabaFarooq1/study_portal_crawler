import PlaywrightBaseCrawler from "./PlaywrightBaseCrawler.js";
import { appendToCountryCSV } from "../utils/csvWriterByCountry.js";
import { applyCurrencyByCountryContext } from "../utils/applyCurrencyByCountryContext.js";
import { getCountryFromUrl } from "../utils/getCountryFromUrl.js";
import { COUNTRY_CURRENCY_MAP } from "../constants/country_currency_map.js";

/**
 * Bachelors Portal crawler for specific countries
 * Uses Playwright to bypass Cloudflare and anti-bot protection
 */
export default class BachelorsPortalCountryCrawler extends PlaywrightBaseCrawler {
  constructor(config = {}) {
    const countryLabel = config.countryLabel || "";
    const targetUrl = countryLabel
      ? `https://www.bachelorsportal.com/search/bachelor/${countryLabel}`
      : "https://www.bachelorsportal.com/search/bachelor";

    super({
      baseUrl: "https://www.bachelorsportal.com",
      targetUrl: targetUrl,
      maxCrawlLength: config.maxCrawlLength || 50,
      requestDelay: config.requestDelay || 2000,
      headless: config.headless !== false,
    });

    this.countryLabel = countryLabel;
    this.portalType = "bachelors";
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
   * Uses browser DOM (Playwright)
   */
  async extractStudyPageData(page, url) {
    console.log("  Extracting detailed bachelor study page data...");

    try {
      await page.waitForSelector("#Hero", { timeout: 10000 });
      await page.waitForSelector("#QuickFacts", { timeout: 10000 });
      await page.waitForTimeout(2000);

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

        document.querySelectorAll(".DegreeTags .Tag").forEach((tag) => {
          const text = tag.textContent.trim();
          if (/Bachelor|B\.|BA|BSc/i.test(text)) degreeType = text;
          if (/campus|online|distance|blended/i.test(text)) studyMode = text;
        });

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
        const intakes = [];
        document
          .querySelectorAll(".QuickFactComponent .Label i.lnr-calendar-full")[0]
          ?.closest(".QuickFactComponent")
          ?.querySelectorAll("time")
          ?.forEach((t) => intakes.push(t.textContent.trim()));

        result.intakes = intakes;

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
        portal: "bachelorsportal.com",
        extractedAt: new Date().toISOString(),
      };
    } catch (err) {
      console.error("❌ Bachelor study extraction failed:", err.message);
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
      cleanUrl.includes("/search/bachelor") &&
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
