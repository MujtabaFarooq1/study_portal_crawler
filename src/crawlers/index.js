/**
 * Crawler exports
 * Provides easy access to all crawler classes
 */

// HTTP-based crawlers (may fail due to anti-bot protection)
export { default as BaseCrawler } from "./BaseCrawler.js";
export { default as MastersPortalCrawler } from "./MastersPortalCrawler.js";
export { default as BachelorsPortalCrawler } from "./BachelorsPortalCrawler.js";

// Playwright-based crawlers (recommended - bypasses anti-bot protection)
export { default as PlaywrightBaseCrawler } from "./PlaywrightBaseCrawler.js";
export { default as MastersPortalPlaywrightCrawler } from "./MastersPortalPlaywrightCrawler.js";
export { default as BachelorsPortalPlaywrightCrawler } from "./BachelorsPortalPlaywrightCrawler.js";
