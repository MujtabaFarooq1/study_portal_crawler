import StateManager from "./src/utils/stateManager.js";

/**
 * Show current crawl progress
 */
const stateManager = new StateManager();
const summary = stateManager.getProgressSummary();

console.log("\n========================================");
console.log("📊 CRAWL PROGRESS");
console.log("========================================\n");

console.log(`Current Phase: ${summary.phase.toUpperCase()}`);
console.log(`Last Updated: ${stateManager.state.lastUpdated}\n`);

console.log("Country Status:");
console.log("─".repeat(100));
console.log(
  "Country".padEnd(20),
  "Portal".padEnd(10),
  "Status".padEnd(15),
  "Page".padEnd(8),
  "Programs".padEnd(12),
  "Queue".padEnd(8),
  "Scraped"
);
console.log("─".repeat(100));

for (const [country, data] of Object.entries(summary.countries)) {
  // Masters
  console.log(
    country.padEnd(20),
    "Masters".padEnd(10),
    data.masters.status.padEnd(15),
    String(data.masters.page).padEnd(8),
    String(data.masters.programsExtracted).padEnd(12),
    String(data.masters.queueSize).padEnd(8),
    String(data.masters.scrapedCount)
  );

  // Bachelors
  console.log(
    "".padEnd(20),
    "Bachelors".padEnd(10),
    data.bachelors.status.padEnd(15),
    String(data.bachelors.page).padEnd(8),
    String(data.bachelors.programsExtracted).padEnd(12),
    String(data.bachelors.queueSize).padEnd(8),
    String(data.bachelors.scrapedCount)
  );

  console.log("─".repeat(100));
}

// Calculate totals
let totalPrograms = 0;
let totalQueue = 0;
let totalScraped = 0;

for (const [country, data] of Object.entries(summary.countries)) {
  totalPrograms += data.masters.programsExtracted + data.bachelors.programsExtracted;
  totalQueue += data.masters.queueSize + data.bachelors.queueSize;
  totalScraped += data.masters.scrapedCount + data.bachelors.scrapedCount;
}

console.log("\nTotals:");
console.log(`  Programs Extracted: ${totalPrograms}`);
console.log(`  URLs in Queue: ${totalQueue}`);
console.log(`  URLs Scraped: ${totalScraped}`);
console.log("");
