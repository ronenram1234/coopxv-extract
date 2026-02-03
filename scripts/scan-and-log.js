/**
 * UAVTradeZone Modification Record
 *
 * Change ID:    WINSTON_LOG_001 (logger.js) / WINSTON_LOG_002 (index.js) / WINSTON_LOG_003 (scan-and-log.js)
 * Date:         2026-02-03
 * Modified By:  Cursor AI
 *
 * Description:
 * [logger.js]: Created Winston logger configuration with daily rotation and structured logging
 * [index.js]: Replaced console.log with Winston logger while maintaining console output format
 * [scan-and-log.js]: Replaced custom file writing with Winston structured logging
 *
 * File Size Check:
 * - Current: ~150 lines
 * - Adding/Removing: ~-50 lines (removed file writing logic)
 * - Projected: ~150 lines
 * - Decision: Proceed (under 250 limit)
 *
 * Related Files:
 * - config/database.js
 * - config/logger.js
 * - index.js
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const {
  rootDirectory,
  filePattern,
  logDirectory
} = require('../config/database');
// [2026-02-03] winston-migration: Log field names to structured JSON file
const logger = require('../config/logger');
const {
  logFieldName,
  logLastRow,
  logScanSummary,
  getScanResultsLogPath
} = require('../config/logger');

/** Convert glob pattern (e.g. *.xlsx) to a RegExp for matching basenames. */
function patternToRegex(glob) {
  const escaped = glob
    .replace(/\\/g, '\\\\')
    .replace(/\*\*/g, '\u0000')
    // [2026-02-03] windows-pattern: Match path separators on both OS types
    .replace(/\*/g, '[^/\\\\]*')
    .replace(/\u0000/g, '.*')
    .replace(/\./g, '\\.')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`, 'i');
}

/** Recursively list all file paths under dir with resilient error handling. */
function walkSync(dir) {
  const files = [];
  if (!fs.existsSync(dir)) {
    logger.warn(`⚠️  Directory not found: ${dir}`);
    return files;
  }

  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch (error) {
      logger.warn(`⚠️  Unable to read directory ${current}: ${error.message}`);
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

/** Return true if file path matches FILE_PATTERN (by basename). */
function matchesPattern(filePath, regex) {
  return regex.test(path.basename(filePath));
}

/** Check if value in column A equals 1 (numeric or string). */
function isColumnAOne(value) {
  if (value === 1) return true;
  if (typeof value === 'string' && value.trim() === '1') return true;
  return value === '1';
}

/** ISO 8601 timestamp for log lines. */
function dateTime() {
  return new Date().toISOString();
}

async function runScan() {
  // [2026-02-03] winston-migration: Logger ensures log dir on load
  logger.info('📂 Ensuring log directory exists...');
  logger.info(`🔍 Scanning directory: ${rootDirectory}`);
  logger.info(`🔍 Looking for pattern: ${filePattern}`);

  const regex = patternToRegex(filePattern);
  const allFiles = walkSync(rootDirectory);
  const matchingFiles = allFiles.filter((file) => matchesPattern(file, regex));
  logger.info(`📄 Found ${matchingFiles.length} matching file(s) out of ${allFiles.length} total`);

  const stats = {
    filesScanned: 0,
    filesWithErrors: 0,
    fieldNamesFound: 0,
    lastRowsFound: 0,
    logFile: ''
  };
  let fieldNameCount = 0;
  let lastRowCount = 0;

  for (const filePath of matchingFiles) {
    logger.info(`   Processing: ${path.basename(filePath)}`);
    let workbook;
    try {
      workbook = XLSX.readFile(filePath, { type: 'file', cellDates: true });
      stats.filesScanned += 1;
    } catch (error) {
      stats.filesWithErrors += 1;
      logger.warn(`   ❌ Error reading ${filePath}: ${error.message}`);
      continue;
    }

    const sheetNames = workbook.SheetNames || [];
    logger.info(`   📊 Found ${sheetNames.length} sheet(s)`);

    for (const sheetName of sheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      const timestamp = dateTime();

      if (rows.length > 0) {
        const headerRow = rows[0];
        for (let col = 0; col < headerRow.length; col += 1) {
          const fieldName = headerRow[col] != null ? String(headerRow[col]).trim() : '';
          if (fieldName !== '') {
            logFieldName(timestamp, filePath, sheetName, fieldName);
            fieldNameCount += 1;
          }
        }
      }

      let lastMatch = null;
      let lastMatchRowIndex = -1;
      for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
        const row = rows[rowIndex];
        const colA = Array.isArray(row) ? row[0] : undefined;
        if (isColumnAOne(colA)) {
          lastMatch = row;
          lastMatchRowIndex = rowIndex + 1;
        }
      }

      if (lastMatch != null) {
        logger.info(`   ✓ Found last row with A=1 at row ${lastMatchRowIndex} in sheet "${sheetName}"`);
        const rowData = Array.isArray(lastMatch) ? lastMatch : [];
        logLastRow(timestamp, filePath, sheetName, lastMatchRowIndex, rowData);
        lastRowCount += 1;
      }
    }
  }

  stats.fieldNamesFound = fieldNameCount;
  stats.lastRowsFound = lastRowCount;

  logScanSummary({
    filesScanned: stats.filesScanned,
    filesWithErrors: stats.filesWithErrors,
    fieldNamesFound: stats.fieldNamesFound,
    lastRowsFound: stats.lastRowsFound
  });

  stats.logFile = getScanResultsLogPath();
  logger.info(`💾 Scan data logged to: ${stats.logFile}`);
  return stats;
}

// [2026-02-03] module-export: Allow service loop to import scanner logic
if (require.main === module) {
  runScan()
    .then((result) => {
      logger.info(`Scan complete: ${JSON.stringify(result)}`);
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Scan failed:', error.stack || error.message || error);
      process.exit(1);
    });
} else {
  module.exports = { runScan };
}
