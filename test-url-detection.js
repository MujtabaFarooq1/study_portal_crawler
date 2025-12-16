// Quick test of URL detection logic
import { getCountryFromUrl } from "./src/utils/getCountryFromUrl.js";

const testUrls = [
  "https://www.mastersportal.com/search/master/united-kingdom",
  "https://www.bachelorsportal.com/search/bachelor/united-states",
  "https://www.mastersportal.com/studies/123456/course.html",
  "https://www.mastersportal.com/search/master/australia?page=2",
];

console.log("Testing URL Detection:\n");
testUrls.forEach(url => {
  const country = getCountryFromUrl(url);
  console.log(`${url}`);
  console.log(`  -> Country: ${country || 'None (not in URL)'}\n`);
});
