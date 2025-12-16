import { COUNTRY_CURRENCY_MAP } from "../constants/country_currency_map.js";
import { setOfflineCurrency } from "./setOfflineCurrency.js";
import { getCountryFromUrl } from "./getCountryFromUrl.js";

export async function applyCurrencyByCountry(page, url) {
  const countryKey = getCountryFromUrl(url);

  if (!countryKey) {
    console.warn(`⚠️ No country detected from URL: ${url}`);
    return;
  }

  const config = COUNTRY_CURRENCY_MAP[countryKey];

  if (!config?.currency_code) {
    throw new Error(`Currency not defined for country: ${countryKey}`);
  }

  await setOfflineCurrency(page, config.currency_code);

  console.log(`💱 Currency set to ${config.currency_code} for ${countryKey}`);
}
