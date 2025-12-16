import { COUNTRY_CURRENCY_MAP } from "./src/constants/country_currency_map.js";
import MastersPortalCountryCrawler from "./src/crawlers/MastersPortalCountryCrawler.js";
import BachelorsPortalCountryCrawler from "./src/crawlers/BachelorsPortalCountryCrawler.js";

/**
 * Quick test of the country crawler with minimal pages
 */
async function testCountryCrawler() {
  console.log("========================================");
  console.log("Testing Country Crawler");
  console.log("========================================\n");

  // Test with UK
  const countryKey = "UK";
  const { url_safe_label: countryLabel } = COUNTRY_CURRENCY_MAP[countryKey];

  console.log(`Testing with: ${countryKey} (${countryLabel})\n`);

  try {
    // Test Masters crawler
    console.log("[MASTERS] Starting test crawl...");
    const mastersCrawler = new MastersPortalCountryCrawler({
      countryLabel: countryLabel,
      maxCrawlLength: 5, // Just 5 pages for quick test
      requestDelay: 2000,
      headless: true,
    });

    const mastersResults = await mastersCrawler.crawl();
    console.log(`\n✓ Masters test completed!`);
    console.log(`  Programs found: ${mastersResults.extractedData.length}`);
    console.log(`  Output: output/masters-courses_${countryLabel}.csv`);

    // Test Bachelors crawler
    console.log(`\n[BACHELORS] Starting test crawl...`);
    const bachelorsCrawler = new BachelorsPortalCountryCrawler({
      countryLabel: countryLabel,
      maxCrawlLength: 5, // Just 5 pages for quick test
      requestDelay: 2000,
      headless: true,
    });

    const bachelorsResults = await bachelorsCrawler.crawl();
    console.log(`\n✓ Bachelors test completed!`);
    console.log(`  Programs found: ${bachelorsResults.extractedData.length}`);
    console.log(`  Output: output/bachelors-courses_${countryLabel}.csv`);

    console.log("\n========================================");
    console.log("Test successful!");
    console.log("========================================");
    console.log(`Total programs extracted: ${mastersResults.extractedData.length + bachelorsResults.extractedData.length}`);
    console.log("\nCheck the output directory for CSV files.");
    console.log("========================================\n");
  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testCountryCrawler()
  .then(() => {
    console.log("Test complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
