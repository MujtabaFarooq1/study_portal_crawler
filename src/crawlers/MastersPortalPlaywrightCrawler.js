import { appendToCSV } from "../utils/csvWriter.js";
import PlaywrightBaseCrawler from "./PlaywrightBaseCrawler.js";

/**
 * Masters Portal crawler using Playwright (browser automation)
 * Bypasses Cloudflare and other anti-bot protection
 */
export default class MastersPortalPlaywrightCrawler extends PlaywrightBaseCrawler {
  constructor(config = {}) {
    super({
      baseUrl: "https://www.mastersportal.com",
      targetUrl: "https://www.mastersportal.com/search/master",
      maxCrawlLength: config.maxCrawlLength || 50,
      requestDelay: config.requestDelay || 2000,
      headless: config.headless !== false,
    });
  }

  async extractData($, url, page = null) {
    const isStudyPage = /\/studies\/\d+\//.test(url);

    if (isStudyPage && page) {
      const data = await this.extractStudyPageData(page, url);

      if (data) {
        appendToCSV({
          ...data,
          intakes: data.intakes?.join(", ") || "",
          languageRequirements: JSON.stringify(data.languageRequirements || {}),
          generalRequirements: Array.isArray(data.generalRequirements)
            ? data.generalRequirements.join(" | ")
            : data.generalRequirements || "",
        });

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
          if (/Bachelor|Master|PhD|MBA|\./i.test(text)) degreeType = text;
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
   * URL filtering logic (unchanged)
   */
  shouldCrawlUrl(url) {
    if (!super.shouldCrawlUrl(url)) return false;

    const cleanUrl = url.split("#")[0].split("?")[0];

    const isStudyPage = /\/studies\/\d+\/[^/]+\.html/.test(cleanUrl);
    const isSearchPage = cleanUrl.endsWith("/search/master");

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
