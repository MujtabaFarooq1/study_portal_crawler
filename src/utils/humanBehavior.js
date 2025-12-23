/**
 * HUMAN BEHAVIOR SIMULATOR
 *
 * This module provides realistic human-like interactions with pages,
 * including timing, mouse movements, scrolling, and navigation patterns.
 *
 * PRINCIPLES:
 * 1. Realistic jitter (non-deterministic delays)
 * 2. Smooth mouse movements (not instant jumps)
 * 3. Natural scroll patterns
 * 4. Progressive waiting (not hard timeouts)
 * 5. Avoid networkidle as sole signal
 */

export class HumanBehavior {
  constructor(options = {}) {
    this.options = {
      baseDelay: options.baseDelay || 2000,
      jitterRange: options.jitterRange || 1000,
      mouseMovements: options.mouseMovements !== false,
      scrollBehavior: options.scrollBehavior !== false,
      verbose: options.verbose !== undefined ? options.verbose : true,
      ...options
    };
  }

  /**
   * Generate realistic random delay with jitter
   * @param {number} baseMs - Base delay in milliseconds
   * @param {number} jitterMs - Jitter range in milliseconds
   * @returns {number} Actual delay to use
   */
  getRandomDelay(baseMs = this.options.baseDelay, jitterMs = this.options.jitterRange) {
    // Use normal distribution for more realistic variance
    const jitter = (Math.random() - 0.5) * jitterMs;
    return Math.max(100, baseMs + jitter);
  }

  /**
   * Wait with random delay and log progress
   * @param {number} baseMs - Base delay in milliseconds
   * @param {string} reason - Reason for waiting (for logging)
   */
  async wait(baseMs, reason = 'Waiting') {
    const actualDelay = this.getRandomDelay(baseMs, this.options.jitterRange);

    if (this.options.verbose) {
      console.log(`  ⏱️  ${reason}... (${Math.round(actualDelay)}ms)`);
    }

    await new Promise(resolve => setTimeout(resolve, actualDelay));
  }

  /**
   * Generate smooth mouse movement path using Bezier curve
   * @param {number} fromX - Starting X coordinate
   * @param {number} fromY - Starting Y coordinate
   * @param {number} toX - Ending X coordinate
   * @param {number} toY - Ending Y coordinate
   * @param {number} steps - Number of steps in the path
   * @returns {Array} Array of {x, y} coordinates
   */
  generateMousePath(fromX, fromY, toX, toY, steps = 10) {
    const path = [];

    // Add control points for Bezier curve (creates natural arc)
    const controlX1 = fromX + (toX - fromX) * 0.25 + (Math.random() - 0.5) * 100;
    const controlY1 = fromY + (toY - fromY) * 0.25 + (Math.random() - 0.5) * 100;
    const controlX2 = fromX + (toX - fromX) * 0.75 + (Math.random() - 0.5) * 100;
    const controlY2 = fromY + (toY - fromY) * 0.75 + (Math.random() - 0.5) * 100;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const invT = 1 - t;

      // Cubic Bezier curve formula
      const x = Math.round(
        invT * invT * invT * fromX +
        3 * invT * invT * t * controlX1 +
        3 * invT * t * t * controlX2 +
        t * t * t * toX
      );

      const y = Math.round(
        invT * invT * invT * fromY +
        3 * invT * invT * t * controlY1 +
        3 * invT * t * t * controlY2 +
        t * t * t * toY
      );

      path.push({ x, y });
    }

    return path;
  }

  /**
   * Simulate realistic mouse movement
   * @param {Page} page - Playwright page object
   * @param {number} toX - Target X coordinate (optional, random if not provided)
   * @param {number} toY - Target Y coordinate (optional, random if not provided)
   */
  async moveMouse(page, toX = null, toY = null) {
    if (!this.options.mouseMovements) return;

    try {
      // Get current viewport size
      const viewport = page.viewportSize();
      const maxX = viewport.width;
      const maxY = viewport.height;

      // Generate random target if not provided
      const targetX = toX !== null ? toX : Math.floor(Math.random() * maxX);
      const targetY = toY !== null ? toY : Math.floor(Math.random() * maxY);

      // Get current mouse position (or assume center)
      let currentX = Math.floor(maxX / 2);
      let currentY = Math.floor(maxY / 2);

      // Generate smooth path
      const path = this.generateMousePath(currentX, currentY, targetX, targetY, 15);

      // Move mouse along path
      for (const point of path) {
        await page.mouse.move(point.x, point.y);
        await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 20));
      }

      if (this.options.verbose) {
        console.log(`  🖱️  Mouse moved to (${targetX}, ${targetY})`);
      }
    } catch (error) {
      // Silently fail - not critical
    }
  }

  /**
   * Simulate realistic scrolling behavior
   * @param {Page} page - Playwright page object
   * @param {Object} options - Scroll options
   */
  async scroll(page, options = {}) {
    if (!this.options.scrollBehavior) return;

    const {
      direction = 'down',
      distance = null,
      smooth = true
    } = options;

    try {
      // Get page dimensions
      const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
      const viewportHeight = await page.evaluate(() => window.innerHeight);

      // Calculate scroll distance
      let scrollDistance;
      if (distance !== null) {
        scrollDistance = distance;
      } else {
        // Random scroll between 200-800 pixels
        scrollDistance = Math.floor(Math.random() * 600) + 200;
      }

      if (direction === 'down') {
        scrollDistance = Math.abs(scrollDistance);
      } else {
        scrollDistance = -Math.abs(scrollDistance);
      }

      if (smooth) {
        // Smooth scroll in steps
        const steps = 10;
        const stepDistance = scrollDistance / steps;

        for (let i = 0; i < steps; i++) {
          await page.evaluate((delta) => {
            window.scrollBy(0, delta);
          }, stepDistance);

          await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 50));
        }
      } else {
        // Instant scroll
        await page.evaluate((delta) => {
          window.scrollBy(0, delta);
        }, scrollDistance);
      }

      if (this.options.verbose) {
        console.log(`  📜 Scrolled ${direction} ${Math.abs(Math.round(scrollDistance))}px`);
      }
    } catch (error) {
      // Silently fail - not critical
    }
  }

  /**
   * Simulate reading behavior (random small scrolls and pauses)
   * @param {Page} page - Playwright page object
   * @param {number} duration - How long to "read" in milliseconds
   */
  async simulateReading(page, duration = 5000) {
    const startTime = Date.now();

    if (this.options.verbose) {
      console.log(`  📖 Simulating reading behavior for ${duration}ms...`);
    }

    while (Date.now() - startTime < duration) {
      // Small random scroll
      await this.scroll(page, {
        distance: Math.floor(Math.random() * 150) + 50,
        direction: Math.random() > 0.2 ? 'down' : 'up',
        smooth: true
      });

      // Random pause
      await this.wait(800 + Math.random() * 1200, 'Reading');

      // Occasional mouse movement
      if (Math.random() > 0.5) {
        await this.moveMouse(page);
      }
    }
  }

  /**
   * Navigate to URL with realistic behavior
   * @param {Page} page - Playwright page object
   * @param {string} url - URL to navigate to
   * @param {Object} options - Navigation options
   */
  async navigate(page, url, options = {}) {
    const {
      waitForSelector = null,
      waitForFunction = null,
      timeout = 60000,
      simulateHuman = true
    } = options;

    if (this.options.verbose) {
      console.log(`  🌐 Navigating to: ${url.substring(0, 80)}...`);
    }

    // Pre-navigation mouse movement
    if (simulateHuman) {
      await this.moveMouse(page, Math.random() * 200, Math.random() * 200);
      await this.wait(500, 'Pre-navigation delay');
    }

    // Navigate
    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout
    });

    if (this.options.verbose) {
      console.log(`  ✅ Navigation complete (status: ${response?.status() || 'unknown'})`);
    }

    // Post-navigation human simulation
    if (simulateHuman) {
      // Random delay after page load
      await this.wait(1000 + Math.random() * 2000, 'Post-navigation delay');

      // Mouse movement
      await this.moveMouse(page);

      // Small scroll
      await this.scroll(page, { distance: Math.floor(Math.random() * 100) + 50 });
    }

    // Wait for specific selector if provided
    if (waitForSelector) {
      if (this.options.verbose) {
        console.log(`  ⏳ Waiting for selector: ${waitForSelector}`);
      }

      try {
        await page.waitForSelector(waitForSelector, {
          timeout: 30000,
          state: 'visible'
        });

        if (this.options.verbose) {
          console.log('  ✅ Selector found');
        }
      } catch (error) {
        if (this.options.verbose) {
          console.log(`  ⚠️  Selector not found within timeout: ${error.message}`);
        }
      }
    }

    // Wait for custom function if provided
    if (waitForFunction) {
      if (this.options.verbose) {
        console.log('  ⏳ Waiting for custom condition...');
      }

      try {
        await page.waitForFunction(waitForFunction, { timeout: 30000 });

        if (this.options.verbose) {
          console.log('  ✅ Condition met');
        }
      } catch (error) {
        if (this.options.verbose) {
          console.log(`  ⚠️  Condition not met: ${error.message}`);
        }
      }
    }

    return response;
  }

  /**
   * Wait for page stability (alternative to networkidle)
   * Uses multiple signals instead of relying solely on network
   * @param {Page} page - Playwright page object
   * @param {number} timeout - Maximum wait time
   */
  async waitForStability(page, timeout = 15000) {
    const startTime = Date.now();

    if (this.options.verbose) {
      console.log('  ⏳ Waiting for page stability...');
    }

    try {
      // Try networkidle but don't rely on it
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

      // Wait for DOM content to be stable
      await page.waitForFunction(() => {
        return document.readyState === 'complete';
      }, { timeout: 10000 });

      // Additional wait for JS frameworks to render
      await this.wait(2000, 'Framework render delay');

      if (this.options.verbose) {
        const elapsed = Date.now() - startTime;
        console.log(`  ✅ Page stable after ${elapsed}ms`);
      }
    } catch (error) {
      if (this.options.verbose) {
        console.log('  ⚠️  Stability wait timed out, proceeding anyway');
      }
    }
  }

  /**
   * Simulate Cloudflare challenge wait with human behavior
   * @param {Page} page - Playwright page object
   * @param {number} maxAttempts - Maximum wait attempts
   */
  async waitForCloudflareChallenge(page, maxAttempts = 5) {
    if (this.options.verbose) {
      console.log('  🔐 Waiting for Cloudflare challenge to resolve...');
    }

    for (let i = 0; i < maxAttempts; i++) {
      // Simulate human behavior during wait
      await this.moveMouse(page);
      await this.wait(1000, 'Challenge wait');

      // Small scroll
      await this.scroll(page, {
        distance: Math.floor(Math.random() * 100) + 20,
        smooth: true
      });

      await this.wait(2000 + Math.random() * 2000, 'Challenge processing');

      // Check if challenge cleared
      const title = await page.title();
      const content = await page.content();

      const isChallenge =
        title.includes('Just a moment') ||
        title.includes('Attention Required') ||
        content.includes('cf-browser-verification');

      if (!isChallenge) {
        if (this.options.verbose) {
          console.log(`  ✅ Challenge cleared after ${i + 1} attempt(s)`);
        }
        return true;
      }

      if (this.options.verbose && i < maxAttempts - 1) {
        console.log(`  ⏳ Challenge still active (attempt ${i + 1}/${maxAttempts})...`);
      }
    }

    if (this.options.verbose) {
      console.log('  ⚠️  Challenge did not clear within max attempts');
    }
    return false;
  }

  /**
   * Perform human-like interaction with a page element
   * @param {Page} page - Playwright page object
   * @param {string} selector - Element selector
   * @param {string} action - Action to perform ('click', 'hover', 'type')
   * @param {Object} options - Additional options
   */
  async interact(page, selector, action = 'click', options = {}) {
    const { text = '', delay = 100 } = options;

    try {
      // Wait for element to be visible
      await page.waitForSelector(selector, { state: 'visible', timeout: 10000 });

      // Move mouse to element
      const element = await page.locator(selector).first();
      const box = await element.boundingBox();

      if (box) {
        // Move to random point within element
        const targetX = box.x + Math.random() * box.width;
        const targetY = box.y + Math.random() * box.height;

        await this.moveMouse(page, targetX, targetY);
        await this.wait(200, 'Before interaction');
      }

      // Perform action
      switch (action) {
        case 'click':
          await element.click();
          if (this.options.verbose) {
            console.log(`  🖱️  Clicked: ${selector}`);
          }
          break;

        case 'hover':
          await element.hover();
          if (this.options.verbose) {
            console.log(`  🖱️  Hovered: ${selector}`);
          }
          break;

        case 'type':
          await element.type(text, { delay: delay + Math.random() * 50 });
          if (this.options.verbose) {
            console.log(`  ⌨️  Typed into: ${selector}`);
          }
          break;

        default:
          throw new Error(`Unknown action: ${action}`);
      }

      // Post-interaction delay
      await this.wait(300, 'Post-interaction');
    } catch (error) {
      if (this.options.verbose) {
        console.log(`  ⚠️  Interaction failed: ${error.message}`);
      }
      throw error;
    }
  }
}
