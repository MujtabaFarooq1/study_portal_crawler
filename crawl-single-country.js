import { COUNTRY_CURRENCY_MAP } from "./src/constants/country_currency_map.js";
import MastersPortalCountryCrawler from "./src/crawlers/MastersPortalCountryCrawler.js";
import BachelorsPortalCountryCrawler from "./src/crawlers/BachelorsPortalCountryCrawler.js";

/**
 * Crawl a single country for testing
 * Usage: node crawl-single-country.js [country-key]
 * Example: node crawl-single-country.js UK
 */
async function crawlSingleCountry() {
  // Get country from command line argument, default to UK
  const countryKey = process.argv[2] || "UK";

  if (!COUNTRY_CURRENCY_MAP[countryKey]) {
    console.error(`\n❌ Country "${countryKey}" not found in COUNTRY_CURRENCY_MAP`);
    console.log("\nAvailable countries:");
    Object.keys(COUNTRY_CURRENCY_MAP).forEach((key) => {
      const config = COUNTRY_CURRENCY_MAP[key];
      console.log(`  - ${key}: ${config.url_safe_label}`);
    });
    process.exit(1);
  }

  const countryConfig = COUNTRY_CURRENCY_MAP[countryKey];
  const { url_safe_label: countryLabel, currency_code: currencyCode } = countryConfig;

  console.log("========================================");
  console.log("Single Country Crawler - TEST MODE");
  console.log("========================================");
  console.log(`Country: ${countryKey}`);
  console.log(`Label: ${countryLabel}`);
  console.log(`Currency: ${currencyCode}`);
  console.log("========================================\n");

  try {
    // ============================================
    // CRAWL MASTERS PORTAL
    // ============================================
    console.log(`\n[MASTERS] Starting crawl for ${countryKey}...`);
    console.log(`URL: https://www.mastersportal.com/search/master/${countryLabel}\n`);

    const mastersCrawler = new MastersPortalCountryCrawler({
      countryLabel: countryLabel,
      maxCrawlLength: 20, // Limited for testing
      requestDelay: 2000,
      headless: false, // Show browser for testing
    });

    const mastersResults = await mastersCrawler.crawl();

    console.log(`\n✓ Masters crawl completed!`);
    console.log(`  Programs found: ${mastersResults.extractedData.length}`);
    console.log(`  CSV: output/masters-courses_${countryLabel}.csv`);

    // ============================================
    // CRAWL BACHELORS PORTAL
    // ============================================
    console.log(`\n[BACHELORS] Starting crawl for ${countryKey}...`);
    console.log(
      `URL: https://www.bachelorsportal.com/search/bachelor/${countryLabel}\n`
    );

    const bachelorsCrawler = new BachelorsPortalCountryCrawler({
      countryLabel: countryLabel,
      maxCrawlLength: 20, // Limited for testing
      requestDelay: 2000,
      headless: false, // Show browser for testing
    });

    const bachelorsResults = await bachelorsCrawler.crawl();

    console.log(`\n✓ Bachelors crawl completed!`);
    console.log(`  Programs found: ${bachelorsResults.extractedData.length}`);
    console.log(`  CSV: output/bachelors-courses_${countryLabel}.csv`);

    // ============================================
    // SUMMARY
    // ============================================
    console.log("\n" + "=".repeat(60));
    console.log("SUMMARY");
    console.log("=".repeat(60));
    console.log(`Country: ${countryKey} (${countryLabel})`);
    console.log(`Masters programs: ${mastersResults.extractedData.length}`);
    console.log(`Bachelors programs: ${bachelorsResults.extractedData.length}`);
    console.log(
      `Total programs: ${
        mastersResults.extractedData.length + bachelorsResults.extractedData.length
      }`
    );
    console.log("\nOutput files:");
    console.log(`  - output/masters-courses_${countryLabel}.csv`);
    console.log(`  - output/bachelors-courses_${countryLabel}.csv`);
    console.log("=".repeat(60) + "\n");
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the crawler
crawlSingleCountry()
  .then(() => {
    console.log("Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
