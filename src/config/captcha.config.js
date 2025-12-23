export const CAPTCHA_CONFIG = {
  // 2captcha API key
  apiKey: 'be09aa84d6537df50ea55c9dd1a06043',

  // Maximum time to wait for captcha solution (in milliseconds)
  timeout: 120000, // 2 minutes

  // Polling interval to check for solution (in milliseconds)
  pollingInterval: 5000, // 5 seconds

  // Enable/disable captcha solving
  enabled: true,

  // Log captcha solving attempts
  verbose: true,

  // 2captcha Proxy Configuration (Anti-detect browser config)
  proxy: {
    enabled: true,
    // Format: host:port:username-zone-custom:password
    server: '101.32.255.125:2334',
    username: 'uc827ee4b566305bb-zone-custom',
    password: 'uc827ee4b566305bb',
    // Full proxy URL for Playwright
    url: 'http://uc827ee4b566305bb-zone-custom:uc827ee4b566305bb@101.32.255.125:2334',
    // Run proxy browser in headless mode (true = headless, false = visible)
    // Headless is faster and uses less resources
    headless: true
  }
};
