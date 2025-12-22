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
  verbose: true
};
