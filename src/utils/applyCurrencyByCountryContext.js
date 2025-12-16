import { COUNTRY_CURRENCY_MAP } from "../constants/country_currency_map.js";
import { setOfflineCurrency } from "./setOfflineCurrency.js";

/**
 * Apply currency settings based on a country context (not URL)
 * @param {Object} page - Playwright page object
 * @param {string} countryKey - Country key from COUNTRY_CURRENCY_MAP (e.g., 'UK', 'USA')
 */
export async function applyCurrencyByCountryContext(page, countryKey) {
  if (!countryKey) {
    console.warn(`⚠️ No country context provided`);
    return;
  }

  const config = COUNTRY_CURRENCY_MAP[countryKey];

  if (!config?.currency_code) {
    throw new Error(`Currency not defined for country: ${countryKey}`);
  }

  await setOfflineCurrency(page, config.currency_code);

  console.log(`💱 Currency set to ${config.currency_code} for ${countryKey}`);
}
