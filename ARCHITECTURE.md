# Architecture Overview

## Class Hierarchy

```
BaseCrawler (Abstract Base Class)
├── MastersPortalCrawler
└── BachelorsPortalCrawler
```

## Class Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        BaseCrawler                          │
├─────────────────────────────────────────────────────────────┤
│ Properties:                                                 │
│ - baseUrl: string                                           │
│ - targetUrl: string                                         │
│ - maxCrawlLength: number                                    │
│ - requestDelay: number                                      │
│ - timeout: number                                           │
│ - urlsToVisit: string[]                                     │
│ - visitedUrls: Set<string>                                  │
│ - crawledCount: number                                      │
│ - extractedData: object[]                                   │
├─────────────────────────────────────────────────────────────┤
│ Methods:                                                    │
│ + constructor(config)                                       │
│ + normalizeUrl(url): string                                 │
│ + shouldCrawlUrl(url): boolean                              │
│ + async fetchPage(url): Promise<Response>                   │
│ + extractLinks(html): string[]                              │
│ + extractData($, url): object[]      [OVERRIDE IN CHILD]   │
│ + async processPage(url): Promise<void>                     │
│ + async crawl(): Promise<Results>                           │
│ + getResults(): Results                                     │
│ + reset(): void                                             │
│ + delay(ms): Promise<void>                                  │
└─────────────────────────────────────────────────────────────┘
                              △
                              │
                 ┌────────────┴────────────┐
                 │                         │
┌────────────────┴────────────┐ ┌─────────┴──────────────────┐
│  MastersPortalCrawler       │ │  BachelorsPortalCrawler    │
├─────────────────────────────┤ ├────────────────────────────┤
│ Extends: BaseCrawler        │ │ Extends: BaseCrawler       │
├─────────────────────────────┤ ├────────────────────────────┤
│ + constructor(config)       │ │ + constructor(config)      │
│ + extractData($, url)       │ │ + extractData($, url)      │
│ + extractProgramData($, el) │ │ + extractProgramData($, el)│
│ + shouldCrawlUrl(url)       │ │ + shouldCrawlUrl(url)      │
└─────────────────────────────┘ └────────────────────────────┘
```

## Data Flow

```
┌──────────────┐
│   index.js   │  Main entry point
└──────┬───────┘
       │
       │ creates instances
       ▼
┌──────────────────────────────────────────┐
│  MastersPortalCrawler                    │
│  BachelorsPortalCrawler                  │
└──────┬───────────────────────────────────┘
       │
       │ inherits from
       ▼
┌──────────────────────────────────────────┐
│  BaseCrawler                             │
│  - Handles URL queue management          │
│  - Manages HTTP requests                 │
│  - Extracts links from pages             │
│  - Coordinates crawling process          │
└──────┬───────────────────────────────────┘
       │
       │ uses
       ▼
┌──────────────────────────────────────────┐
│  External Libraries                      │
│  - axios (HTTP requests)                 │
│  - cheerio (HTML parsing)                │
└──────────────────────────────────────────┘
```

## Crawling Process Flow

```
START
  │
  ▼
┌─────────────────────┐
│ Initialize Crawler  │
│ - Set base URL      │
│ - Set target URL    │
│ - Configure options │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│   crawl() called    │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐      No      ┌──────────────┐
│ URLs in queue AND   │────────────→ │ Return       │
│ count < max?        │              │ Results      │
└──────┬──────────────┘              └──────────────┘
       │ Yes
       ▼
┌─────────────────────┐
│ Get next URL        │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐      Yes
│ Already visited?    │────────────┐
└──────┬──────────────┘            │
       │ No                         │
       ▼                            │
┌─────────────────────┐            │
│ Mark as visited     │            │
│ Increment counter   │            │
└──────┬──────────────┘            │
       │                            │
       ▼                            │
┌─────────────────────┐            │
│ fetchPage(url)      │            │
│ - HTTP GET request  │            │
└──────┬──────────────┘            │
       │                            │
       ▼                            │
┌─────────────────────┐            │
│ Parse HTML          │            │
│ (Cheerio)           │            │
└──────┬──────────────┘            │
       │                            │
       ├────────────────┐           │
       │                │           │
       ▼                ▼           │
┌──────────────┐ ┌──────────────┐  │
│ extractData  │ │ extractLinks │  │
│ (programs)   │ │ (URLs)       │  │
└──────┬───────┘ └──────┬───────┘  │
       │                │           │
       │                ▼           │
       │         ┌──────────────┐   │
       │         │ Add new URLs │   │
       │         │ to queue     │   │
       │         └──────┬───────┘   │
       │                │           │
       ▼                │           │
┌──────────────────────┐│           │
│ Store extracted data ││           │
└──────┬───────────────┘│           │
       │                │           │
       ▼                │           │
┌──────────────────────┐│           │
│ delay(requestDelay)  ││           │
└──────┬───────────────┘│           │
       │                │           │
       └────────────────┴───────────┘
       │
       │ (loop continues)
       │
       ▼
```

## Key Design Patterns

### 1. Template Method Pattern
The `BaseCrawler` defines the skeleton of the crawling algorithm in the `crawl()` method, while subclasses override specific steps like `extractData()`.

### 2. Strategy Pattern
Different crawlers implement different strategies for data extraction by overriding `extractData()` and `shouldCrawlUrl()`.

### 3. Dependency Injection
Configuration is injected through the constructor, making the crawlers flexible and testable.

## Extension Points

To create a new crawler for a different portal:

1. **Extend BaseCrawler**
   ```javascript
   class NewPortalCrawler extends BaseCrawler {
       constructor(config = {}) {
           super({
               baseUrl: 'https://newportal.com',
               targetUrl: 'https://newportal.com/search',
               ...config
           });
       }
   }
   ```

2. **Override extractData()**
   ```javascript
   extractData($, url) {
       const items = [];
       // Your custom extraction logic
       return items;
   }
   ```

3. **Optionally override shouldCrawlUrl()**
   ```javascript
   shouldCrawlUrl(url) {
       if (!super.shouldCrawlUrl(url)) {
           return false;
       }
       // Your custom URL filtering
       return true;
   }
   ```

## Benefits of This Architecture

1. **DRY (Don't Repeat Yourself)**: Common crawling logic is in `BaseCrawler`
2. **Open/Closed Principle**: Open for extension, closed for modification
3. **Single Responsibility**: Each class has a clear, focused purpose
4. **Maintainability**: Easy to add new crawlers or modify existing ones
5. **Testability**: Each component can be tested independently
6. **Reusability**: Base class can be reused for any web crawling needs
