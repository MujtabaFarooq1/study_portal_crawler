import fs from "fs";
import path from "path";

const OUTPUT_DIR = path.resolve("output");

/**
 * Escape CSV values properly
 */
function escapeCSV(value) {
  if (value === null || value === undefined) return "";
  const str = typeof value === "string" ? value : JSON.stringify(value);
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Append data to a country-specific CSV file
 * @param {Object} data - Data to append
 * @param {string} portalType - 'masters' or 'bachelors'
 * @param {string} countryLabel - URL-safe country label (e.g., 'united-kingdom')
 */
export function appendToCountryCSV(data, portalType, countryLabel) {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const fileName = `${portalType}-courses_${countryLabel}.csv`;
  const csvFile = path.join(OUTPUT_DIR, fileName);
  const exists = fs.existsSync(csvFile);

  const headers = [
    "courseName",
    "university",
    "country",
    "degreeType",
    "studyMode",
    "tuitionFee",
    "duration",
    "intakes",
    "languageRequirements",
    "generalRequirements",
    "officialUniversityLink",
    "sourceUrl",
    "portal",
    "extractedAt",
    "updatedAt",
  ];

  // Add updatedAt timestamp
  const rowData = {
    ...data,
    updatedAt: new Date().toISOString(),
  };

  const row = headers.map((h) => escapeCSV(rowData[h])).join(",") + "\n";

  if (!exists) {
    const headerRow = headers.join(",") + "\n";
    fs.writeFileSync(csvFile, headerRow + row);
    console.log(`  📝 Created new CSV file: ${fileName}`);
  } else {
    fs.appendFileSync(csvFile, row);
  }
}

/**
 * Get CSV file path for a country
 * @param {string} portalType - 'masters' or 'bachelors'
 * @param {string} countryLabel - URL-safe country label
 * @returns {string} - Full path to CSV file
 */
export function getCountryCSVPath(portalType, countryLabel) {
  const fileName = `${portalType}-courses_${countryLabel}.csv`;
  return path.join(OUTPUT_DIR, fileName);
}
