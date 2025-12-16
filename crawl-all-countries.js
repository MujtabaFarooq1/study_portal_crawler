import { COUNTRY_CURRENCY_MAP } from "./src/constants/country_currency_map.js";
import MastersPortalCountryCrawler from "./src/crawlers/MastersPortalCountryCrawler.js";
import BachelorsPortalCountryCrawler from "./src/crawlers/BachelorsPortalCountryCrawler.js";

/**
 * Main orchestrator to crawl all countries for both Masters and Bachelors programs
 */
async function crawlAllCountries() {
  console.log("========================================");
  console.log("Multi-Country Educational Portal Crawler");
  console.log("========================================\n");

  const countries = Object.entries(COUNTRY_CURRENCY_MAP);
  const totalCountries = countries.length;

  console.log(`Found ${totalCountries} countries to crawl:`);
  countries.forEach(([name, config]) => {
    console.log(`  - ${name}: ${config.url_safe_label} (${config.currency_code})`);
  });
  console.log("\n");

  const results = {
    masters: {},
    bachelors: {},
    summary: {
      totalCountries: totalCountries,
      completedCountries: 0,
      totalPrograms: 0,
      errors: [],
    },
  };

  // Iterate through each country
  for (let i = 0; i < countries.length; i++) {
    const [countryName, countryConfig] = countries[i];
    const { url_safe_label: countryLabel, currency_code: currencyCode } = countryConfig;

    console.log("\n" + "=".repeat(80));
    console.log(
      `COUNTRY ${i + 1}/${totalCountries}: ${countryName.toUpperCase()} (${countryLabel})`
    );
    console.log("=".repeat(80) + "\n");

    try {
      // ============================================
      // CRAWL MASTERS PORTAL FOR THIS COUNTRY
      // ============================================
      console.log(`\n[${"MASTERS".padEnd(8)}] Starting crawl for ${countryName}...`);
      console.log(`URL: https://www.mastersportal.com/search/master/${countryLabel}\n`);

      const mastersCrawler = new MastersPortalCountryCrawler({
        countryLabel: countryLabel,
        maxCrawlLength: 100, // Adjust as needed
        requestDelay: 3000, // 3 seconds between requests
        headless: true, // Set to false to see browser
      });

      const mastersResults = await mastersCrawler.crawl();
      results.masters[countryLabel] = {
        country: countryName,
        programsFound: mastersResults.extractedData.length,
        pagesVisited: mastersResults.crawledCount,
      };

      console.log(`\n✓ Masters crawl completed for ${countryName}`);
      console.log(`  Programs found: ${mastersResults.extractedData.length}`);
      console.log(`  CSV: output/masters-courses_${countryLabel}.csv`);

      // ============================================
      // CRAWL BACHELORS PORTAL FOR THIS COUNTRY
      // ============================================
      console.log(
        `\n[${"BACHELORS".padEnd(8)}] Starting crawl for ${countryName}...`
      );
      console.log(
        `URL: https://www.bachelorsportal.com/search/bachelor/${countryLabel}\n`
      );

      const bachelorsCrawler = new BachelorsPortalCountryCrawler({
        countryLabel: countryLabel,
        maxCrawlLength: 100, // Adjust as needed
        requestDelay: 3000, // 3 seconds between requests
        headless: true, // Set to false to see browser
      });

      const bachelorsResults = await bachelorsCrawler.crawl();
      results.bachelors[countryLabel] = {
        country: countryName,
        programsFound: bachelorsResults.extractedData.length,
        pagesVisited: bachelorsResults.crawledCount,
      };

      console.log(`\n✓ Bachelors crawl completed for ${countryName}`);
      console.log(`  Programs found: ${bachelorsResults.extractedData.length}`);
      console.log(`  CSV: output/bachelors-courses_${countryLabel}.csv`);

      // Update summary
      results.summary.completedCountries++;
      results.summary.totalPrograms +=
        mastersResults.extractedData.length + bachelorsResults.extractedData.length;

      console.log(`\n✓ ${countryName} completed successfully!`);
      console.log(
        `  Total programs: ${
          mastersResults.extractedData.length + bachelorsResults.extractedData.length
        }`
      );
    } catch (error) {
      console.error(`\n✗ Error crawling ${countryName}:`, error.message);
      results.summary.errors.push({
        country: countryName,
        error: error.message,
      });
    }

    // Add a delay between countries to be respectful
    if (i < countries.length - 1) {
      console.log("\n⏳ Waiting 5 seconds before next country...\n");
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  // ============================================
  // FINAL SUMMARY
  // ============================================
  console.log("\n" + "=".repeat(80));
  console.log("CRAWL SUMMARY - ALL COUNTRIES");
  console.log("=".repeat(80));
  console.log(`\nTotal countries processed: ${results.summary.completedCountries}/${totalCountries}`);
  console.log(`Total programs extracted: ${results.summary.totalPrograms}`);

  console.log("\n--- Masters Programs by Country ---");
  Object.entries(results.masters).forEach(([label, data]) => {
    console.log(`  ${data.country.padEnd(15)}: ${data.programsFound} programs`);
  });

  console.log("\n--- Bachelors Programs by Country ---");
  Object.entries(results.bachelors).forEach(([label, data]) => {
    console.log(`  ${data.country.padEnd(15)}: ${data.programsFound} programs`);
  });

  if (results.summary.errors.length > 0) {
    console.log("\n--- Errors ---");
    results.summary.errors.forEach((err) => {
      console.log(`  ${err.country}: ${err.error}`);
    });
  }

  console.log("\n--- Output Files ---");
  console.log("All CSV files are saved in the 'output/' directory:");
  countries.forEach(([name, config]) => {
    console.log(`  - output/masters-courses_${config.url_safe_label}.csv`);
    console.log(`  - output/bachelors-courses_${config.url_safe_label}.csv`);
  });

  console.log("\n" + "=".repeat(80));
  console.log("Crawling completed!");
  console.log("=".repeat(80) + "\n");

  return results;
}

// Run the crawler
crawlAllCountries()
  .then(() => {
    console.log("All done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
