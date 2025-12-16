import MastersPortalPlaywrightCrawler from '../src/crawlers/MastersPortalPlaywrightCrawler.js';
import BachelorsPortalPlaywrightCrawler from '../src/crawlers/BachelorsPortalPlaywrightCrawler.js';

/**
 * Test URL filtering to ensure only study pages and pagination pages are crawled
 */

console.log('Testing Masters Portal URL Filtering\n');
console.log('=====================================\n');

const mastersCrawler = new MastersPortalPlaywrightCrawler();

const mastersTestUrls = [
    'https://www.mastersportal.com/studies/466158/business-analytics.html',
    'https://www.mastersportal.com/studies/466158/business-analytics.html?ref=search_card',
    'https://www.mastersportal.com/search/master',
    'https://www.mastersportal.com/search/master?page=2',
    'https://www.mastersportal.com/search/master?page=3',
    'https://www.mastersportal.com/about',
    'https://www.mastersportal.com/contact',
    'https://www.mastersportal.com/privacy',
    'https://www.mastersportal.com/universities/123/harvard.html',
    'https://www.mastersportal.com/countries/usa.html'
];

mastersTestUrls.forEach(url => {
    // Temporarily add to visited to test shouldCrawlUrl
    const originalVisited = mastersCrawler.visitedUrls;
    mastersCrawler.visitedUrls = new Set();

    const shouldCrawl = mastersCrawler.shouldCrawlUrl(url);
    const result = shouldCrawl ? '✅ ALLOW' : '❌ BLOCK';
    console.log(`${result}: ${url}`);

    mastersCrawler.visitedUrls = originalVisited;
});

console.log('\n\nTesting Bachelors Portal URL Filtering\n');
console.log('=======================================\n');

const bachelorsCrawler = new BachelorsPortalPlaywrightCrawler();

const bachelorsTestUrls = [
    'https://www.bachelorsportal.com/studies/148910/english.html',
    'https://www.bachelorsportal.com/studies/148910/english.html?ref=search_card',
    'https://www.bachelorsportal.com/studies/148910/english.html#content:work_permit',
    'https://www.bachelorsportal.com/search/bachelor',
    'https://www.bachelorsportal.com/search/bachelor?page=2',
    'https://www.bachelorsportal.com/search/bachelor?page=10',
    'https://www.bachelorsportal.com/about',
    'https://www.bachelorsportal.com/contact',
    'https://www.bachelorsportal.com/universities/456/oxford.html',
    'https://www.bachelorsportal.com/countries/uk.html'
];

bachelorsTestUrls.forEach(url => {
    // Temporarily add to visited to test shouldCrawlUrl
    const originalVisited = bachelorsCrawler.visitedUrls;
    bachelorsCrawler.visitedUrls = new Set();

    const shouldCrawl = bachelorsCrawler.shouldCrawlUrl(url);
    const result = shouldCrawl ? '✅ ALLOW' : '❌ BLOCK';
    console.log(`${result}: ${url}`);

    bachelorsCrawler.visitedUrls = originalVisited;
});

console.log('\n\nExpected Results:\n');
console.log('✅ Study pages (/studies/[id]/[name].html)');
console.log('✅ Search/pagination pages (/search/master or /search/bachelor with ?page=X)');
console.log('❌ All other pages (about, contact, universities, countries, etc.)');
