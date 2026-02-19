/**
 * E2E Cycle 3: More real-life changes.
 * Run AFTER Cycle 2 scan completes.
 *
 * Changes:
 * 1. DELETE RamGash-2 from folder (simulate sensor removed / file gone)
 * 2. Add new farm: Sarid with 2 coops (new farm joins the system)
 *
 * Usage: node tests/e2e-cycle3.js
 */

const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

const baseDir = path.join(__dirname, "e2e");

function makeDate(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d;
}

const headers = [
  "לעדכן אב (1)", "תאריך", "ארגון", "אזור", "משק", "מחזור",
  "לול", "להקה", "אפרוחים", "צפיפות", "גיל", "ציון",
  "מגמה יצרנית", "מגמה אתמול", "ציון קודם", "מחלה",
  "אחוז יצרנות", "אחוז שינוי", "תיקון טמפ", "מגמה שלשום",
];

function createFile(filePath, org, area, farm, cycle, house, flock, colA, numRows) {
  const rows = [headers];
  for (let i = 0; i < numRows; i++) {
    rows.push([
      colA, makeDate(numRows - i), org, area, farm, cycle,
      house, flock,
      Math.floor(25000 + Math.random() * 5000),
      Math.round((12 + Math.random() * 2) * 100) / 100,
      i + 1,
      Math.round((80 + Math.random() * 15) * 10) / 10,
      Math.random() > 0.5 ? "up" : "down",
      Math.random() > 0.5 ? "up" : "down",
      Math.round((78 + Math.random() * 15) * 10) / 10,
      "",
      Math.round((85 + Math.random() * 10) * 10) / 10,
      Math.round((Math.random() * 4 - 2) * 10) / 10,
      Math.round((Math.random() * 2 - 1) * 10) / 10,
      Math.random() > 0.5 ? "up" : "down",
    ]);
  }
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "BData_in");
  XLSX.writeFile(wb, filePath);
}

console.log("\n=== CYCLE 3: More Changes ===\n");

// 1. DELETE RamGash-2 (simulate file removed from sensor folder)
const ramgash2 = path.join(baseDir, "RamGash/RamGash/CXV-928.51_RamGash-2_C68-26.xlsx");
if (fs.existsSync(ramgash2)) {
  fs.unlinkSync(ramgash2);
  console.log("Deleted: RamGash-2 → FILE REMOVED from folder (will become CLOSED-REMOVED)");
} else {
  console.log("Warning: RamGash-2 already gone");
}

// 2. Add new farm: Sarid
const saridDir = path.join(baseDir, "Sarid/Sarid");
fs.mkdirSync(saridDir, { recursive: true });

const sarid1 = path.join(saridDir, "CXV-928.7_Sarid-1_C2-26.xlsx");
createFile(sarid1, "Sarid", "Jezreel", "Sarid", "2-26", 1, 801, 1, 25);
console.log("Added:   Sarid-1 → NEW farm + coop (ACTIVE)");

const sarid2 = path.join(saridDir, "CXV-928.7_Sarid-2_C2-26.xlsx");
createFile(sarid2, "Sarid", "Jezreel", "Sarid", "2-26", 2, 802, 1, 18);
console.log("Added:   Sarid-2 → NEW farm + coop (ACTIVE)");

console.log("\n--- Cycle 3 ready. Wait for next extract scan (1 min) ---");
console.log("Expected: Active(7), Maintenance(1), Closed(1), Removed(1 - RamGash-2)\n");
console.log("Note: 'Removed' status is detected by the UI when lastScanNumber");
console.log("falls behind the latest scan by more than 2 scans.\n");
