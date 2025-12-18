/**
 * Extract all study URLs from a search page
 * Scrolls to bottom to ensure all lazy-loaded content is visible
 * @param {Object} page - Playwright page object
 * @returns {Promise<Array<string>>} - Array of study URLs
 */
export async function extractStudyUrlsFromSearchPage(page) {
  console.log("  📜 Scrolling page to load all content...");

  // Scroll to bottom multiple times to trigger lazy loading
  await page.evaluate(async () => {
    const scrollDelay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    // Scroll down in chunks
    for (let i = 0; i < 5; i++) {
      window.scrollTo({
        top: document.body.scrollHeight,
        behavior: "smooth",
      });
      await scrollDelay(1000);
    }

    // Scroll back to top
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
    await scrollDelay(500);
  });

  console.log("  ✓ Scrolling complete");

  // Wait a bit for any final lazy-loaded content
  await page.waitForTimeout(2000);

  // Extract all study URLs
  const studyUrls = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href*="/studies/"]'));
    const uniqueUrls = new Set();

    links.forEach((link) => {
      const href = link.href;
      // Only include actual study pages, not search/filter links
      if (href && /\/studies\/\d+\/[^/]+\.html/.test(href)) {
        // Remove query params and hash
        const cleanUrl = href.split("?")[0].split("#")[0];
        uniqueUrls.add(cleanUrl);
      }
    });

    return Array.from(uniqueUrls);
  });

  console.log(`  ✓ Found ${studyUrls.length} unique study URLs on this page`);

  return studyUrls;
}

/**
 * Check if there's a next page button and get its URL
 * @param {Object} page - Playwright page object
 * @param {string} baseUrl - Base URL for the portal
 * @returns {Promise<string|null>} - Next page URL or null
 */
export async function getNextPageUrl(page, baseUrl) {
  const nextPageUrl = await page.evaluate(() => {
    // Look for pagination next button (using standard DOM methods)
    let nextButton = document.querySelector('a.Pagination-link--next, a[rel="next"]');

    // If not found, look for links/buttons with "Next" text
    if (!nextButton) {
      const allLinks = Array.from(document.querySelectorAll('a, button'));
      nextButton = allLinks.find(el => {
        const text = el.textContent.trim().toLowerCase();
        return text === 'next' || text === 'next »' || text === '›' || text === '»';
      });
    }

    if (nextButton && !nextButton.classList.contains("disabled")) {
      return nextButton.href || nextButton.getAttribute("href");
    }

    // Alternative: look for page numbers and find current + 1
    const currentPage = document.querySelector(
      '.Pagination-link.is-active, .pagination .active'
    );

    if (currentPage) {
      const nextPageElement = currentPage.nextElementSibling;
      if (
        nextPageElement &&
        nextPageElement.tagName === "A" &&
        !nextPageElement.classList.contains("Pagination-link--next")
      ) {
        return nextPageElement.href;
      }
    }

    return null;
  });

  if (nextPageUrl) {
    // Convert relative URL to absolute if needed
    if (nextPageUrl.startsWith("/")) {
      return baseUrl + nextPageUrl;
    }
    return nextPageUrl;
  }

  return null;
}

/**
 * Extract current page number from URL or page
 * @param {Object} page - Playwright page object
 * @param {string} url - Current URL
 * @returns {Promise<number>} - Current page number
 */
export async function getCurrentPageNumber(page, url) {
  // Try to get from URL first
  const urlMatch = url.match(/[?&]page=(\d+)/);
  if (urlMatch) {
    return parseInt(urlMatch[1], 10);
  }

  // Try to get from page element
  const pageNum = await page.evaluate(() => {
    const activePage = document.querySelector(
      '.Pagination-link.is-active, .pagination .active'
    );
    if (activePage) {
      const text = activePage.textContent.trim();
      const num = parseInt(text, 10);
      if (!isNaN(num)) return num;
    }
    return 1;
  });

  return pageNum;
}
