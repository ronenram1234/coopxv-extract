/**
 * E2E Cycle 2: Simulate real-life changes between scans.
 * Run AFTER Cycle 1 scan completes.
 *
 * Changes:
 * 1. RamGash-1: Change Column A from 1 → 11 (maintenance)
 * 2. Ofice-3: Remove all 1s and 11s (closed - flock ended)
 * 3. Add new file: CXV-928.5_Odem-2_C1-26.xlsx (new coop joins O_OfGil)
 *
 * Usage: node tests/e2e-cycle2.js
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

console.log("\n=== CYCLE 2: Life Happens ===\n");

// 1. RamGash-1 → maintenance (Column A = 11)
const ramgash1 = path.join(baseDir, "RamGash/RamGash/CXV-928.51_RamGash-1_C68-26.xlsx");
createFile(ramgash1, "RamGash", "Jezreel", "RamGash", "68-26", 1, 601, 11, 42);
console.log("Changed: RamGash-1 → Column A = 11 (MAINTENANCE)");

// 2. Ofice-3 → closed (Column A = 0, no 1s or 11s)
const ofice3 = path.join(baseDir, "Of-Bar/Ram_On/CXV-928.4_Ofice-3_C1-26.xlsx");
createFile(ofice3, "Of-Bar", "Sharon", "Ram On", "1-26", 3, 503, 0, 28);
console.log("Changed: Ofice-3 → Column A = 0 (CLOSED - flock ended)");

// 3. Add new coop to O_OfGil
const odem2 = path.join(baseDir, "O_OfGil/Farm_Odem/CXV-928.5_Odem-2_C1-26.xlsx");
createFile(odem2, "O_OfGil", "Golan", "Odem", "1-26", 2, 702, 1, 20);
console.log("Added:   Odem-2 → NEW coop in O_OfGil (ACTIVE)");

console.log("\n--- Cycle 2 ready. Wait for next extract scan (1 min) ---");
console.log("Expected: Active(5), Maintenance(1), Closed(1)\n");
