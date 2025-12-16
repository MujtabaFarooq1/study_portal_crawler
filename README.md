# Educational Portal Crawler

A modern, object-oriented web crawler built with ES modules for scraping educational portals like Masters Portal and Bachelors Portal. Includes both **HTTP-based** and **Playwright-based** (browser automation) crawlers to bypass anti-bot protection.

## Features

- **Two Crawler Types**:
  - **HTTP-based**: Fast but may be blocked by anti-bot protection (403 errors)
  - **Playwright-based**: Uses real browser automation to bypass Cloudflare and other protections ✨
- **Object-Oriented Design**: Built with proper OOP principles using ES6 classes
- **ES Modules**: Modern JavaScript with import/export syntax
- **Extensible Base Class**: Easy to create custom crawlers for any educational portal
- **Rate Limiting**: Configurable delays between requests to be respectful
- **Smart URL Handling**: Automatic normalization of relative and absolute URLs
- **Duplicate Prevention**: Tracks visited URLs to avoid re-crawling
- **Error Handling**: Graceful error handling with detailed logging
- **Data Extraction**: Extracts program information including name, university, location, and more

## Project Structure

```
master_portal_crawler/
├── src/
│   └── crawlers/
│       ├── BaseCrawler.js                      # HTTP-based base class
│       ├── MastersPortalCrawler.js             # HTTP Masters Portal
│       ├── BachelorsPortalCrawler.js           # HTTP Bachelors Portal
│       ├── PlaywrightBaseCrawler.js            # Playwright base class ⭐
│       ├── MastersPortalPlaywrightCrawler.js   # Playwright Masters Portal ⭐
│       ├── BachelorsPortalPlaywrightCrawler.js # Playwright Bachelors Portal ⭐
│       └── index.js                            # Exports
├── examples/
│   ├── masters-only.js                 # HTTP example
│   ├── bachelors-only.js               # HTTP example
│   ├── masters-playwright.js           # Playwright example ⭐
│   ├── bachelors-playwright.js         # Playwright example ⭐
│   └── custom-crawler.js               # Custom crawler template
├── index.js                            # Main entry (uses Playwright)
├── package.json
└── README.md
```

## Installation

```bash
npm install
```

**Note:** Playwright will download browser binaries (~200MB) on first install. This is normal and required for browser automation.

To install browsers manually:
```bash
npx playwright install chromium
```

## Usage

### ⭐ Recommended: Run with Playwright (Bypasses 403 Errors)

```bash
npm run dev
```

This runs both crawlers using Playwright browser automation, which bypasses anti-bot protection.

### Run Individual Crawlers

**With Playwright (recommended):**
```bash
node examples/masters-playwright.js
node examples/bachelors-playwright.js
```

**With HTTP (may get 403 errors):**
```bash
node examples/masters-only.js
node examples/bachelors-only.js
```

### Use as Module

**Playwright Crawlers (recommended):**
```javascript
import {
    MastersPortalPlaywrightCrawler,
    BachelorsPortalPlaywrightCrawler
} from './src/crawlers/index.js';

// Crawl with Playwright (bypasses 403 errors)
const mastersCrawler = new MastersPortalPlaywrightCrawler({
    maxCrawlLength: 50,
    requestDelay: 2000,
    headless: true  // Set to false to see browser
});

const results = await mastersCrawler.crawl();
```

**HTTP Crawlers (may get blocked):**
```javascript
import {
    MastersPortalCrawler,
    BachelorsPortalCrawler
} from './src/crawlers/index.js';

const mastersCrawler = new MastersPortalCrawler({
    maxCrawlLength: 50,
    requestDelay: 3000,
    maxRetries: 5
});

const results = await mastersCrawler.crawl();
```

## Creating Custom Crawlers

Extend the `BaseCrawler` class to create crawlers for other educational portals:

```javascript
import BaseCrawler from './src/crawlers/BaseCrawler.js';

class MyCustomCrawler extends BaseCrawler {
    constructor(config = {}) {
        super({
            baseUrl: 'https://www.example.com',
            targetUrl: 'https://www.example.com/search',
            ...config
        });
    }

    // Override to implement custom data extraction
    extractData($, url) {
        const items = [];

        $('.program-card').each((_, element) => {
            items.push({
                name: $(element).find('.title').text().trim(),
                // ... extract other fields
            });
        });

        return items;
    }

    // Override to add custom URL filtering
    shouldCrawlUrl(url) {
        if (!super.shouldCrawlUrl(url)) {
            return false;
        }

        // Add your custom logic
        return !url.includes('/exclude-this');
    }
}

// Use your custom crawler
const crawler = new MyCustomCrawler({ maxCrawlLength: 30 });
const results = await crawler.crawl();
```

## API Reference

### BaseCrawler

The base class that provides core crawling functionality.

#### Constructor Options

```javascript
{
    baseUrl: string,          // Base URL of the website
    targetUrl: string,        // Starting URL for crawling
    maxCrawlLength: number,   // Maximum pages to crawl (default: 50)
    requestDelay: number,     // Delay between requests in ms (default: 1000)
    timeout: number          // Request timeout in ms (default: 10000)
}
```

#### Methods

- `async crawl()` - Start the crawling process
- `async processPage(url)` - Process a single page
- `extractData($, url)` - Extract data from page (override in subclasses)
- `extractLinks(html)` - Extract links from HTML
- `shouldCrawlUrl(url)` - Check if URL should be crawled
- `normalizeUrl(url)` - Normalize URL to absolute format
- `getResults()` - Get crawl results
- `reset()` - Reset crawler state

#### Results Object

```javascript
{
    crawledCount: number,           // Number of pages crawled
    visitedUrls: string[],          // Array of visited URLs
    remainingUrls: string[],        // URLs in queue
    extractedData: object[]         // Extracted program data
}
```

### MastersPortalCrawler

Crawler for Masters Portal (mastersportal.com).

Inherits all methods from `BaseCrawler` and implements custom data extraction for Masters programs.

### BachelorsPortalCrawler

Crawler for Bachelors Portal (bachelorsportal.com).

Inherits all methods from `BaseCrawler` and implements custom data extraction for Bachelor programs.

## Extracted Data Format

Each program object contains:

```javascript
{
    name: string,              // Program name
    university: string,        // University name
    location: string,          // Location/Country
    link: string,             // Program URL
    duration: string,         // Program duration
    fee: string,              // Tuition fee
    studyType: string,        // Full-time/Part-time
    portal: string,           // Source portal
    extractedAt: string       // ISO timestamp
}
```

## Important Notes

### Anti-Bot Protection (403 Errors)

These educational portals use anti-bot protection (Cloudflare, etc.) which may block automated requests with **HTTP 403 Forbidden** errors. This is expected behavior for many modern websites.

**Solutions:**
- Use longer delays: `requestDelay: 3000` or higher
- Implement proxy rotation
- Use browser automation tools (Puppeteer/Playwright)
- Contact website administrators for API access
- See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for detailed solutions

### Retry Logic

The crawler includes automatic retry with exponential backoff:
```javascript
{
    maxRetries: 3,        // Number of retry attempts (default: 3)
    retryDelay: 5000      // Initial retry delay in ms (default: 5000)
}
```

## Best Practices

1. **Respect Rate Limits**: Use appropriate `requestDelay` (recommended: 2000-3000ms)
2. **Handle Errors**: Always wrap crawler calls in try-catch blocks
3. **Monitor Output**: Check console logs for crawling progress
4. **Test Small First**: Start with small `maxCrawlLength` values for testing
5. **Save Results**: Export data to JSON/CSV for further processing
6. **Check robots.txt**: Respect website crawling policies
7. **Legal Compliance**: Review terms of service before scraping

## Examples

See the `examples/` directory for complete working examples:

- [masters-only.js](examples/masters-only.js) - Crawl only Masters Portal
- [bachelors-only.js](examples/bachelors-only.js) - Crawl only Bachelors Portal
- [custom-crawler.js](examples/custom-crawler.js) - Create custom crawler

## Troubleshooting

Encountering issues? Check our comprehensive troubleshooting guide:

- **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** - Detailed solutions for common issues including:
  - HTTP 403 Forbidden errors
  - Timeout issues
  - No data extracted
  - Memory problems
  - Rate limiting
  - Alternative approaches using Puppeteer/Playwright

## License

ISC

## Contributing

Feel free to extend this crawler for other educational portals by creating new classes that extend `BaseCrawler`.

## Legal and Ethical Use

This crawler is provided for educational purposes. Always:
- Review and comply with website Terms of Service
- Respect robots.txt directives
- Implement appropriate rate limiting
- Consider using official APIs when available
- Don't overload servers with requests

The authors are not responsible for misuse of this tool.
