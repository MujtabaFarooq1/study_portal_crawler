import fs from "fs";
import path from "path";

const OUTPUT_DIR = path.resolve("output");
const CSV_FILE = path.join(OUTPUT_DIR, "mastersportal_studies.csv");

function escapeCSV(value) {
  if (value === null || value === undefined) return "";
  const str = typeof value === "string" ? value : JSON.stringify(value);

  return `"${str.replace(/"/g, '""')}"`;
}

export function appendToCSV(data) {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const exists = fs.existsSync(CSV_FILE);

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
  ];

  const row = headers.map((h) => escapeCSV(data[h])).join(",") + "\n";

  if (!exists) {
    const headerRow = headers.join(",") + "\n";
    fs.writeFileSync(CSV_FILE, headerRow + row);
  } else {
    fs.appendFileSync(CSV_FILE, row);
  }
}
