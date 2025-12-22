# Cloudflare Turnstile Captcha Solver

This project now includes automatic detection and solving of Cloudflare Turnstile captchas using the 2captcha API.

## Features

- **Automatic Detection**: Automatically detects when a Cloudflare Turnstile captcha appears on a page
- **2captcha Integration**: Uses the 2captcha API to solve Turnstile captchas
- **Seamless Integration**: Integrated directly into the PlaywrightBaseCrawler for automatic handling
- **Fallback Mechanism**: Falls back to human behavior simulation if captcha solving fails
- **Balance Checking**: Check your 2captcha account balance programmatically
- **Verbose Logging**: Detailed logging of captcha detection and solving process

## Configuration

The captcha solver is configured in [src/config/captcha.config.js](src/config/captcha.config.js):

```javascript
export const CAPTCHA_CONFIG = {
  // Your 2captcha API key
  apiKey: 'be09aa84d6537df50ea55c9dd1a06043',

  // Maximum time to wait for captcha solution (2 minutes)
  timeout: 120000,

  // How often to check for solution (5 seconds)
  pollingInterval: 5000,

  // Enable/disable captcha solving
  enabled: true,

  // Show detailed logs
  verbose: true
};
```

### Important Configuration Options

- **enabled**: Set to `false` to disable automatic captcha solving and use only the fallback method
- **verbose**: Set to `false` to reduce logging output
- **apiKey**: Your 2captcha API key (already configured)

## How It Works

### 1. Detection Phase

The crawler automatically detects Cloudflare Turnstile captchas by checking multiple indicators:

**Visual Elements:**
- Turnstile iframes (`iframe[src*="challenges.cloudflare.com"]`)
- Turnstile element by ID (`#cf-turnstile`)
- Turnstile divs with `data-sitekey` attributes
- Turnstile divs with class (`.cf-turnstile`)
- Hidden input fields (`input[name="cf-turnstile-response"]`)

**Page Content Patterns:**
- "Just a moment" or "Attention Required" in title
- "Verifying you are human" message
- "needs to review the security of your connection" text
- Cloudflare challenge widget IDs (`id="cf-chl-widget-"`)
- `cf-browser-verification` or `cf_challenge_response` in HTML

**Sitekey Extraction (5 Methods):**
1. Data attributes on elements (`data-sitekey`)
2. Parent element traversal (walks up DOM tree)
3. Script tag content parsing for `turnstile.render()` calls
4. Window object inspection (`window.turnstile.sitekey`)
5. **Script URL parsing** - Extracts from Turnstile API URLs like:
   ```
   https://challenges.cloudflare.com/turnstile/v0/g/SITEKEY/api.js
   ```

### 2. Solving Phase

When a Turnstile captcha is detected:

1. The sitekey and page URL are sent to the 2captcha API
2. 2captcha workers solve the captcha (typically takes 10-30 seconds)
3. A solution token is returned

### 3. Submission Phase

The solution token is:

1. Injected into the page's Turnstile response field
2. Submitted to bypass the captcha
3. Verified to ensure the challenge is resolved

### 4. Fallback

If captcha solving fails or takes too long:

- Falls back to the original human behavior simulation method
- Simulates mouse movements and scrolling
- Waits for auto-challenge resolution

## Usage

### In Production (crawl-batch.js) - Automatic

The captcha solver is automatically integrated into [crawl-batch.js](crawl-batch.js:5) which is your main batch crawling script. **No changes needed to your existing workflow!**

When running:
```bash
npm run crawl:batch
```

### Search Page Flow (Enhanced Multi-Stage Fallback):

1. **Initial Load (Headless)**:
   - Detect Turnstile captcha → Solve with 2captcha
   - If no captcha: Try human behavior simulation
   - If still blocked: Proceed to next stage

2. **Retry Detection**:
   - If "Try again" button appears → Check for Turnstile again → Solve if found
   - If captcha solved: Retry link detection
   - If not: Proceed to next stage

3. **Headless=False Mode**:
   - Launch visible browser (same engine)
   - Check for Turnstile → Solve with 2captcha
   - Click "Try again" button if present
   - If still failing: Switch browser engine

4. **Browser Switch**:
   - Try alternate browser (Chromium ↔ WebKit)
   - Repeat entire flow with new browser

### Study Page Flow:

1. **Initial Load (Headless WebKit)**:
   - Detect Turnstile → Solve with 2captcha
   - Fall back to human simulation if needed

2. **First Fallback (Headless Chromium)**:
   - Same detection and solving

3. **Final Fallback (Headless=False)**:
   - Visible browser with captcha solving

### In PlaywrightBaseCrawler (Automatic)

The captcha solver is also integrated into [PlaywrightBaseCrawler.js](src/crawlers/PlaywrightBaseCrawler.js:5) for other crawlers that extend it.

When any crawler encounters a Cloudflare Turnstile captcha, it will:
1. Detect it automatically
2. Solve it using 2captcha
3. Continue crawling

### Standalone Usage

You can also use the CaptchaSolver directly:

```javascript
import { CaptchaSolver } from './src/services/CaptchaSolver.js';

const solver = new CaptchaSolver();

// Check your balance
const balance = await solver.getBalance();
console.log(`Balance: $${balance}`);

// Detect captcha on a page
const captchaInfo = await solver.detectTurnstileCaptcha(page);

if (captchaInfo) {
  // Solve and bypass in one step
  const success = await solver.handleTurnstileCaptcha(page);

  // Or solve manually
  const token = await solver.solveTurnstile(
    captchaInfo.sitekey,
    captchaInfo.url
  );
  await solver.submitTurnstileSolution(page, token);
}
```

## Testing

Test the captcha solver with the provided test script:

```bash
# Test with default URL (mastersportal.com)
node test-captcha-solver.js

# Test with a specific URL
node test-captcha-solver.js https://example.com/page-with-captcha
```

The test script will:
1. Check your 2captcha balance
2. Navigate to the URL
3. Detect any Turnstile captchas
4. Attempt to solve them
5. Show the results

## 2captcha API Documentation

For more information about the 2captcha Cloudflare Turnstile API:
- [API Documentation](https://2captcha.com/api-docs/cloudflare-turnstile)
- [Dashboard](https://2captcha.com/enterpage) (to check balance and add funds)

## Cost

2captcha Cloudflare Turnstile solving costs:
- **$2.99 per 1000 captchas**
- Very cost-effective for automated scraping

## Troubleshooting

### Low Balance

If you see a low balance warning:
1. Visit https://2captcha.com/enterpage
2. Top up your account
3. Minimum recommended balance: $5

### Captcha Not Detected

If captchas aren't being detected:
1. Check if the page actually has a Turnstile captcha
2. Run the test script with the URL to see debug output
3. Enable verbose logging in the config
4. Check the screenshot saved by the test script

### Captcha Not Solved

If captchas are detected but not solved:
1. Check your 2captcha balance
2. Verify your API key is correct
3. Check 2captcha service status at https://2captcha.com
4. The fallback method will automatically activate

### Rate Limiting

If you encounter rate limiting:
1. Increase the `requestDelay` in your crawler config
2. The captcha solver helps bypass most rate limiting
3. Consider using proxies for high-volume scraping

## Files Changed/Added

- ✅ **src/services/CaptchaSolver.js** - Main captcha solver service
- ✅ **src/config/captcha.config.js** - Configuration file
- ✅ **src/crawlers/PlaywrightBaseCrawler.js** - Updated to use captcha solver
- ✅ **test-captcha-solver.js** - Test script
- ✅ **package.json** - Added `2captcha` dependency

## API Key Security

**Important**: The API key is currently hardcoded in the config file. For production use, consider:

1. Using environment variables:
```javascript
apiKey: process.env.TWOCAPTCHA_API_KEY || 'be09aa84d6537df50ea55c9dd1a06043'
```

2. Creating a `.env` file:
```
TWOCAPTCHA_API_KEY=be09aa84d6537df50ea55c9dd1a06043
```

3. Adding `.env` to `.gitignore` to prevent committing secrets

## Support

For issues related to:
- **2captcha API**: Contact support@2captcha.com
- **This implementation**: Check the console logs with verbose mode enabled
- **Cloudflare detection**: Run the test script to debug
