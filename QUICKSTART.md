# Quick Start Guide

Get started with the Educational Portal Crawler in minutes!

## Installation

```bash
# Install dependencies (includes Playwright)
npm install

# Install browser binaries for Playwright
npx playwright install chromium
```

**Note:** Playwright downloads browser binaries (~200MB). This is one-time and necessary for bypassing anti-bot protection.

## Basic Usage

### ⭐ Recommended: Use Playwright (No 403 Errors!)

```bash
# Run both crawlers with browser automation
npm run dev
```

This uses Playwright to bypass Cloudflare and other anti-bot protection.

### Run individual crawlers

**Masters Portal:**
```bash
node examples/masters-playwright.js
```

**Bachelors Portal:**
```bash
node examples/bachelors-playwright.js
```

## Why Playwright?

These educational portals use **Cloudflare protection** which blocks simple HTTP requests with **403 Forbidden** errors. Playwright solves this by:
- Using a real Chrome browser
- Executing JavaScript
- Passing bot detection tests
- Handling CAPTCHAs (when possible)

## Code Examples

### Example 1: Simple Playwright Crawl

```javascript
import MastersPortalPlaywrightCrawler from './src/crawlers/MastersPortalPlaywrightCrawler.js';

const crawler = new MastersPortalPlaywrightCrawler();
const results = await crawler.crawl();

console.log(`Found ${results.extractedData.length} programs`);
```

### Example 2: Custom Configuration

```javascript
import MastersPortalPlaywrightCrawler from './src/crawlers/MastersPortalPlaywrightCrawler.js';

const crawler = new MastersPortalPlaywrightCrawler({
    maxCrawlLength: 10,     // Crawl 10 pages
    requestDelay: 3000,     // Wait 3 seconds between requests
    headless: false         // Show browser window (for debugging)
});

const results = await crawler.crawl();
```

### Example 3: Save Results to JSON

```javascript
import MastersPortalPlaywrightCrawler from './src/crawlers/MastersPortalPlaywrightCrawler.js';
import fs from 'fs/promises';

const crawler = new MastersPortalPlaywrightCrawler({ maxCrawlLength: 20 });
const results = await crawler.crawl();

// Save to file
await fs.writeFile(
    'masters-programs.json',
    JSON.stringify(results.extractedData, null, 2)
);

console.log('✓ Results saved to masters-programs.json');
```

### Example 4: Debug Mode (See Browser)

```javascript
const crawler = new MastersPortalPlaywrightCrawler({
    maxCrawlLength: 3,
    headless: false  // Browser window will be visible
});

const results = await crawler.crawl();
```

This is useful for:
- Debugging selector issues
- Seeing what the page looks like
- Checking if data is being extracted

### Example 5: Both Portals in Parallel

```javascript
import {
    MastersPortalPlaywrightCrawler,
    BachelorsPortalPlaywrightCrawler
} from './src/crawlers/index.js';

async function crawlBoth() {
    const [mastersResults, bachelorsResults] = await Promise.all([
        new MastersPortalPlaywrightCrawler({ maxCrawlLength: 10 }).crawl(),
        new BachelorsPortalPlaywrightCrawler({ maxCrawlLength: 10 }).crawl()
    ]);

    const allPrograms = [
        ...mastersResults.extractedData,
        ...bachelorsResults.extractedData
    ];

    console.log(`Total programs found: ${allPrograms.length}`);
    return allPrograms;
}

crawlBoth();
```

### Example 6: Filter and Export

```javascript
import MastersPortalPlaywrightCrawler from './src/crawlers/MastersPortalPlaywrightCrawler.js';
import fs from 'fs/promises';

const crawler = new MastersPortalPlaywrightCrawler({ maxCrawlLength: 30 });
const results = await crawler.crawl();

// Filter programs by criteria
const usPrograms = results.extractedData.filter(program =>
    program.location && program.location.includes('United States')
);

const onlinePrograms = results.extractedData.filter(program =>
    program.studyType && program.studyType.toLowerCase().includes('online')
);

console.log(`Found ${usPrograms.length} programs in the US`);
console.log(`Found ${onlinePrograms.length} online programs`);

// Export filtered results
await fs.writeFile('us-programs.json', JSON.stringify(usPrograms, null, 2));
```

## Configuration Options

### Playwright Crawlers

```javascript
{
    maxCrawlLength: 50,      // Max pages to crawl (default: 50)
    requestDelay: 2000,      // Delay between requests in ms (default: 2000)
    headless: true          // Run browser in headless mode (default: true)
}
```

### HTTP Crawlers (may get 403 errors)

```javascript
{
    maxCrawlLength: 50,      // Max pages to crawl (default: 50)
    requestDelay: 3000,      // Delay between requests in ms (default: 1000)
    timeout: 10000,         // Request timeout in ms (default: 10000)
    maxRetries: 3,          // Retry attempts (default: 3)
    retryDelay: 5000        // Initial retry delay in ms (default: 5000)
}
```

## Extracted Data Structure

Each program object contains:

```javascript
{
    name: "Master of Computer Science",
    university: "Stanford University",
    location: "United States",
    link: "https://...",
    duration: "2 years",
    fee: "$50,000",
    studyType: "Full-time",
    portal: "mastersportal.com",
    extractedAt: "2024-01-01T00:00:00.000Z"
}
```

## Comparison: HTTP vs Playwright

| Feature | HTTP Crawlers | Playwright Crawlers |
|---------|--------------|---------------------|
| Speed | Fast ⚡ | Slower 🐌 |
| Success Rate | Low (403 errors) ❌ | High ✅ |
| Resource Usage | Light | Heavy (browser) |
| JavaScript Support | No | Yes ✅ |
| Anti-bot Bypass | No ❌ | Yes ✅ |
| **Recommended** | No | **Yes** ⭐ |

## Tips for Best Results

1. **Start Small**: Test with `maxCrawlLength: 5` first
2. **Use Playwright**: HTTP crawlers will likely fail due to anti-bot protection
3. **Be Patient**: Browser automation is slower but more reliable
4. **Debug Mode**: Use `headless: false` to see what's happening
5. **Save Often**: Export data periodically to avoid losing progress
6. **Respect Delays**: Use `requestDelay: 3000` or higher
7. **Check Selectors**: If no data extracted, selectors may need updating

## Troubleshooting

### No Data Extracted

**Solution 1: Use Debug Mode**
```javascript
const crawler = new MastersPortalPlaywrightCrawler({
    maxCrawlLength: 1,
    headless: false  // Watch the browser
});
```

**Solution 2: Check Selectors**
The website HTML might have changed. Update selectors in the `extractData()` method.

### Still Getting 403 Errors

You're probably using HTTP crawlers. Switch to Playwright:
```javascript
// ❌ Don't use
import MastersPortalCrawler from './src/crawlers/MastersPortalCrawler.js';

// ✅ Use this instead
import MastersPortalPlaywrightCrawler from './src/crawlers/MastersPortalPlaywrightCrawler.js';
```

### Browser Won't Launch

```bash
# Reinstall Playwright browsers
npx playwright install chromium --force
```

### Too Slow

Playwright is slower than HTTP because it runs a real browser. To speed up:
- Reduce `maxCrawlLength`
- Increase `requestDelay` (paradoxically helps avoid blocks)
- Run multiple crawlers in parallel

## Next Steps

- Read [README.md](README.md) for detailed documentation
- Check [ARCHITECTURE.md](ARCHITECTURE.md) to understand the design
- See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues
- Create custom crawlers for other portals

## Support

For issues or questions, check the documentation or create an issue in the repository.

Happy crawling with Playwright! 🎭🚀
