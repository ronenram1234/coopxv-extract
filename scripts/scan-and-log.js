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
const mongoose = require('mongoose');

const {
  environment,
  rootDirectory,
  filePattern,
  logDirectory,
  logExcelLinesToExtract
} = require('../config/database');
const logger = require('../config/logger');
const {
  formatTimestampIsrael,
  getScanResultsExcelPath
} = require('../config/logger');
const Scan = require('../models/Scan');
const ExtractedLine = require('../models/ExtractedLine');

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

/** Timestamp in Israel timezone for scan/Excel. */
function dateTime() {
  return formatTimestampIsrael(new Date());
}

/** Convert 0-based column index to Excel column letters (0->A, 25->Z, 26->AA, ...). */
function indexToColumnLetter(index) {
  if (!Number.isInteger(index) || index < 0) {
    throw new Error(`Invalid column index: ${index}`);
  }
  let n = index + 1;
  let result = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

function isMeaningfulCellValue(value) {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  return true;
}

function cellToText(value) {
  if (value == null) return '';
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}

function buildDataAndMetadataFromRow(rowArray) {
  const row = Array.isArray(rowArray) ? rowArray : [];
  const columnCount = row.length;

  let lastMeaningfulIndex = -1;
  for (let i = row.length - 1; i >= 0; i -= 1) {
    if (isMeaningfulCellValue(row[i])) {
      lastMeaningfulIndex = i;
      break;
    }
  }

  const hasData = row.some((v) => isMeaningfulCellValue(v));
  const maxIndexToStore = Math.max(0, lastMeaningfulIndex);

  const data = {};
  for (let i = 0; i <= maxIndexToStore; i += 1) {
    data[indexToColumnLetter(i)] = cellToText(row[i]);
  }

  const metadata = {
    columnCount,
    firstColumn: 'A',
    lastColumn: indexToColumnLetter(maxIndexToStore),
    hasData
  };

  return { data, metadata };
}

function normalizeStoredDataToText(data) {
  if (!data || typeof data !== 'object') {
    return {};
  }
  const normalized = {};
  for (const [key, value] of Object.entries(data)) {
    normalized[key] = cellToText(value);
  }
  return normalized;
}

function areRowsEqualAsText(storedDoc, candidateRowArray) {
  const storedDataText = normalizeStoredDataToText(storedDoc && storedDoc.data);
  const { data: candidateData } = buildDataAndMetadataFromRow(candidateRowArray);

  const storedKeys = Object.keys(storedDataText).sort();
  const candidateKeys = Object.keys(candidateData).sort();

  if (storedKeys.length !== candidateKeys.length) {
    return false;
  }

  for (let i = 0; i < storedKeys.length; i += 1) {
    const key = storedKeys[i];
    if (key !== candidateKeys[i]) {
      return false;
    }
    if (storedDataText[key] !== cellToText(candidateData[key])) {
      return false;
    }
  }

  return true;
}

async function runScan() {
  // [2026-02-03] winston-migration: Logger ensures log dir on load
  const scanStartedAt = new Date();
  const scanStartMs = Date.now();
  const dbReady = mongoose.connection && mongoose.connection.readyState === 1;
  let scanNumber = null;

  if (dbReady) {
    try {
      scanNumber = (await Scan.countDocuments()) + 1;
    } catch (error) {
      logger.warn(`⚠️  Failed to compute scanNumber: ${error.message}`);
    }
  }

  logger.info('📂 Ensuring log directory exists...');
  logger.info(`🔍 Scanning directory: ${rootDirectory}`);
  logger.info(`🔍 Looking for pattern: ${filePattern}`);

  const regex = patternToRegex(filePattern);
  const allFiles = walkSync(rootDirectory);
  const logDirNormalized =
    typeof logDirectory === 'string' && logDirectory
      ? path.resolve(logDirectory).toLowerCase()
      : null;

  const matchingFiles = allFiles
    // Exclude any file under LOG_DIRECTORY
    .filter((file) => {
      if (!logDirNormalized) return true;
      const normalizedFile = path.resolve(file).toLowerCase();
      return !normalizedFile.startsWith(logDirNormalized);
    })
    // Apply FILE_PATTERN
    .filter((file) => matchesPattern(file, regex))
    // Exclude scan*.xlsx files (e.g. scan-results-YYYY-MM-DD.xlsx)
    .filter((file) => {
      const base = path.basename(file).toLowerCase();
      return !(base.startsWith('scan') && base.endsWith('.xlsx'));
    });
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
  const excelRows = [];
  const filesProcessed = [];
  const extractedLinesToInsert = [];
  const totalFiles = matchingFiles.length;
  let successfulFiles = 0;
  let errorFiles = 0;

  for (const filePath of matchingFiles) {
    const folder = path.dirname(filePath);
    const filename = path.basename(filePath);
    logger.info(`   Processing: ${filename}`);

    let workbook;
    try {
      workbook = XLSX.readFile(filePath, { type: 'file', cellDates: true });
      stats.filesScanned += 1;
      successfulFiles += 1;
    } catch (error) {
      stats.filesWithErrors += 1;
      errorFiles += 1;
      logger.warn(`   ❌ Error reading ${filePath}: ${error.message}`);
      filesProcessed.push({
        folder,
        filename,
        fullPath: filePath,
        status: 'error',
        rowsExtracted: 0,
        error: error.message
      });
      continue;
    }

    const sheetNames = workbook.SheetNames || [];
    logger.info(`   📊 Found ${sheetNames.length} sheet(s)`);
    let rowsExtractedForFile = 0;

    for (const sheetName of sheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      const timestamp = dateTime();

      if (logExcelLinesToExtract) {
        excelRows.push([filename, timestamp]);
      }

      if (rows.length > 0) {
        const headerRow = rows[0];
        const fieldNames = [];
        for (let col = 0; col < headerRow.length; col += 1) {
          const fieldName = headerRow[col] != null ? String(headerRow[col]).trim() : '';
          if (fieldName !== '') {
            fieldNames.push(fieldName);
            fieldNameCount += 1;
          }
        }
        if (logExcelLinesToExtract && fieldNames.length > 0) {
          excelRows.push(fieldNames);
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
        if (logExcelLinesToExtract) {
          excelRows.push(rowData);
        }
        let isNewRow = true;

        if (dbReady) {
          try {
            const previous = await ExtractedLine.findOne({ filePath, sheetName })
              .sort({ timestamp: -1, _id: -1 })
              .lean();
            if (previous && areRowsEqualAsText(previous, rowData)) {
              isNewRow = false;
            }
          } catch (error) {
            logger.warn(
              `⚠️  Failed to compare with last stored row for ${filePath} [${sheetName}]: ${error.message}`
            );
          }
        }

        if (isNewRow) {
          rowsExtractedForFile += 1;
          lastRowCount += 1;

          const { data, metadata } = buildDataAndMetadataFromRow(rowData);
          extractedLinesToInsert.push({
            timestamp: scanStartedAt,
            filePath,
            folder,
            filename,
            sheetName,
            rowNumber: lastMatchRowIndex,
            data,
            metadata
          });
        } else {
          logger.info(
            `   ↪ Last row with A=1 unchanged for sheet "${sheetName}" in file ${filename}; skipping insert`
          );
        }
      }
    }

    filesProcessed.push({
      folder,
      filename,
      fullPath: filePath,
      status: rowsExtractedForFile > 0 ? 'success' : 'no_data',
      rowsExtracted: rowsExtractedForFile,
      error: null
    });
  }

  stats.fieldNamesFound = fieldNameCount;
  stats.lastRowsFound = lastRowCount;

  if (logExcelLinesToExtract && excelRows.length > 0) {
    try {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(excelRows);
      XLSX.utils.book_append_sheet(wb, ws, 'Scan Results');
      const excelPath = getScanResultsExcelPath();
      XLSX.writeFile(wb, excelPath);
      stats.logFile = excelPath;
      logger.info(`💾 Scan data logged to: ${stats.logFile}`);
    } catch (error) {
      logger.warn(`⚠️  Failed to write Excel: ${error.message}`);
    }
  }

  if (!dbReady) {
    logger.info('ℹ️  MongoDB not connected; skipping persistence to scans/extracted_lines');
    return stats;
  }

  if (scanNumber == null) {
    logger.info('ℹ️  scanNumber unavailable; skipping persistence to scans/extracted_lines');
    return stats;
  }

  const duration = Date.now() - scanStartMs;
  const scanDoc = new Scan({
    timestamp: scanStartedAt,
    scanNumber,
    environment,
    statistics: {
      totalFiles,
      successfulFiles,
      errorFiles,
      fieldNamesFound: fieldNameCount,
      lastRowsFound: lastRowCount
    },
    filesProcessed,
    duration
  });

  try {
    await scanDoc.save();
  } catch (error) {
    logger.error('❌ Failed to write scan document:', {
      error: error.message,
      stack: error.stack
    });
    return stats;
  }

  if (extractedLinesToInsert.length > 0) {
    try {
      await ExtractedLine.insertMany(
        extractedLinesToInsert.map((line) => ({ ...line, scanId: scanDoc._id })),
        { ordered: true }
      );
    } catch (error) {
      logger.error('❌ Failed to write extracted_lines documents:', {
        error: error.message,
        stack: error.stack
      });
    }
  }

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
