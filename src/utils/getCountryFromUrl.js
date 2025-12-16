import { COUNTRY_CURRENCY_MAP } from "../constants/country_currency_map.js";

export function getCountryFromUrl(url) {
  try {
    const { pathname } = new URL(url);

    const segments = pathname
      .split("/")
      .map((s) => s.trim())
      .filter(Boolean);

    // For search pages: /search/master/united-kingdom or /search/bachelor/united-kingdom
    // Country is the segment after 'master' or 'bachelor'
    const masterIndex = segments.indexOf("master");
    const bachelorIndex = segments.indexOf("bachelor");

    let urlCountryLabel = null;

    if (masterIndex !== -1 && segments.length > masterIndex + 1) {
      urlCountryLabel = segments[masterIndex + 1];
    } else if (bachelorIndex !== -1 && segments.length > bachelorIndex + 1) {
      urlCountryLabel = segments[bachelorIndex + 1];
    }

    if (!urlCountryLabel) {
      return null;
    }

    const entry = Object.entries(COUNTRY_CURRENCY_MAP).find(
      ([, value]) => value.url_safe_label === urlCountryLabel
    );

    return entry ? entry[0] : null;
  } catch {
    return null;
  }
}
