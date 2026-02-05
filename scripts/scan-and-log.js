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
  formatLocalTimeIsrael,
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

function getLastMeaningfulIndex(rowArray) {
  const row = Array.isArray(rowArray) ? rowArray : [];
  for (let i = row.length - 1; i >= 0; i -= 1) {
    if (isMeaningfulCellValue(row[i])) {
      return i;
    }
  }
  return -1;
}

function buildDataAndMetadataFromRow(rowArray) {
  const row = Array.isArray(rowArray) ? rowArray : [];
  const columnCount = row.length;

  const lastMeaningfulIndex = getLastMeaningfulIndex(row);

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

function buildDisplayFromSheetRow(sheet, rowNumber, rowArray) {
  const row = Array.isArray(rowArray) ? rowArray : [];
  const lastMeaningfulIndex = getLastMeaningfulIndex(row);
  const maxIndexToStore = Math.max(0, lastMeaningfulIndex);
  const display = {};

  for (let i = 0; i <= maxIndexToStore; i += 1) {
    const columnLetter = indexToColumnLetter(i);
    const cellRef = `${columnLetter}${rowNumber}`;
    const cell = sheet ? sheet[cellRef] : undefined;

    if (cell && cell.w != null) {
      display[columnLetter] = String(cell.w);
    } else if (cell && cell.v != null) {
      display[columnLetter] = cellToText(cell.v);
    } else {
      display[columnLetter] = '';
    }
  }

  return display;
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

  // Find the maximum column letter present in either dataset
  const allKeys = new Set([...storedKeys, ...candidateKeys]);
  const sortedAllKeys = Array.from(allKeys).sort();

  // Compare all columns that exist in either dataset
  for (const key of sortedAllKeys) {
    const storedVal = storedDataText[key] || '';
    const candidateVal = candidateData[key] || '';
    const storedText = String(storedVal).trim();
    const candidateText = String(candidateVal).trim();

    // Skip trailing empty columns (if both are empty and this is beyond the last non-empty column)
    if (storedText === '' && candidateText === '') {
      continue;
    }

    if (storedText !== candidateText) {
      return false;
    }
  }

  return true;
}

/** Convert ExtractedLine document to Excel row array. */
function extractedLineToExcelRow(doc) {
  const dataKeys = Object.keys(doc.data || {}).sort();
  const displayData = doc.display || {};
  const row = [
    doc.filename,
    doc.sheetName,
    doc.rowNumber,
    formatTimestampIsrael(doc.timestamp)
  ];
  // Add all data columns in sorted order
  for (const key of dataKeys) {
    if (Object.prototype.hasOwnProperty.call(displayData, key)) {
      row.push(displayData[key]);
    } else {
      row.push(doc.data[key]);
    }
  }
  return row;
}

/** Generate Excel header row from inserted documents. */
function getExcelHeaderRow(insertedDocs) {
  // Collect all unique data column keys across all inserted documents
  const allDataKeys = new Set();
  for (const doc of insertedDocs) {
    if (doc.data) {
      Object.keys(doc.data).forEach((key) => allDataKeys.add(key));
    }
  }
  const sortedDataKeys = Array.from(allDataKeys).sort();
  return ['filename', 'sheetName', 'rowNumber', 'timestamp', ...sortedDataKeys];
}

/** Append ExtractedLine documents to Excel file. */
async function appendExtractedLinesToExcel(insertedDocs) {
  if (!insertedDocs || insertedDocs.length === 0) return;

  const excelPath = getScanResultsExcelPath();
  let existingRows = [];
  let hasHeader = false;

  // Read existing file if it exists
  if (fs.existsSync(excelPath)) {
    try {
      const existingWb = XLSX.readFile(excelPath, { type: 'file', cellDates: true });
      const existingWs =
        existingWb.Sheets['Scan Results'] ||
        (existingWb.SheetNames && existingWb.SheetNames.length > 0
          ? existingWb.Sheets[existingWb.SheetNames[0]]
          : null);
      if (existingWs) {
        existingRows = XLSX.utils.sheet_to_json(existingWs, { header: 1, defval: '' });
        hasHeader = existingRows.length > 0;
      }
    } catch (readErr) {
      logger.warn(`⚠️  Failed to read existing Excel log: ${readErr.message}`);
    }
  }

  // Get header row (use existing if present, otherwise generate from inserted docs)
  let headerRow = hasHeader ? existingRows[0] : getExcelHeaderRow(insertedDocs);
  const dataRows = hasHeader ? existingRows.slice(1) : [];

  // If existing header exists, merge with new documents' columns to ensure all columns are included
  if (hasHeader) {
    const newHeader = getExcelHeaderRow(insertedDocs);
    const existingHeaderSet = new Set(headerRow);
    const allHeaderKeys = new Set([...headerRow, ...newHeader]);
    headerRow = Array.from(allHeaderKeys);
  }

  // Convert inserted documents to Excel rows
  const newRows = insertedDocs.map((doc) => extractedLineToExcelRow(doc));

  // Ensure all rows have same number of columns as header
  const headerLength = headerRow.length;
  const paddedNewRows = newRows.map((row) => {
    const padded = [...row];
    while (padded.length < headerLength) {
      padded.push('');
    }
    return padded.slice(0, headerLength);
  });

  // Pad existing data rows to match new header length (in case header expanded)
  const paddedDataRows = dataRows.map((row) => {
    const padded = [...row];
    while (padded.length < headerLength) {
      padded.push('');
    }
    return padded.slice(0, headerLength);
  });

  // Combine existing data rows with new rows
  const allRows = [headerRow, ...paddedDataRows, ...paddedNewRows];

  // Write Excel file
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(allRows);
  XLSX.utils.book_append_sheet(wb, ws, 'Scan Results');
  XLSX.writeFile(wb, excelPath);

  logger.info(`💾 Appended ${insertedDocs.length} extracted line(s) to ${excelPath}`);
}

async function runScan() {
  // [2026-02-03] winston-migration: Logger ensures log dir on load
  const scanStartedAt = new Date();
  const scanStartMs = Date.now();
  const connection = mongoose.connection;
  const dbReady = connection && connection.readyState === 1;
  const dbName = connection && connection.db ? connection.db.databaseName : 'unknown';
  let scanNumber = null;

  logger.info(
    `ℹ️  runScan DB state before counting: ready=${dbReady}, readyState=${
      connection ? connection.readyState : 'none'
    }, db=${dbName}`
  );

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
    logFile: '',
    scanSaved: false,
    extractedLinesInserted: 0
  };
  let fieldNameCount = 0;
  let lastRowCount = 0;
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
      }

      const candidates = [];
      for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
        const row = rows[rowIndex];
        const colA = Array.isArray(row) ? row[0] : undefined;
        if (isColumnAOne(colA)) {
          candidates.push({
            rowNumber: rowIndex + 1,
            rowArray: row
          });
        }
      }

      if (candidates.length > 0) {
        candidates.sort((a, b) => a.rowNumber - b.rowNumber);

        let lastProcessedRowNumber = 0;
        let previous = null;

        if (dbReady) {
          try {
            previous = await ExtractedLine.findOne({ filePath, sheetName })
              .sort({ rowNumber: -1, timestamp: -1, _id: -1 })
              .lean();
            if (previous && typeof previous.rowNumber === 'number') {
              lastProcessedRowNumber = previous.rowNumber;
            }
          } catch (error) {
            logger.warn(
              `⚠️  Failed to load last processed row for ${filePath} [${sheetName}]: ${error.message}`
            );
          }
        }

        const updatedCandidate =
          lastProcessedRowNumber > 0
            ? candidates.find((c) => c.rowNumber === lastProcessedRowNumber)
            : null;
        const nextNewCandidate = candidates.find((c) => c.rowNumber > lastProcessedRowNumber);
        const next = nextNewCandidate || updatedCandidate || null;

        if (!next) {
          logger.info(
            `   ↪ No new rows with A=1 to process for sheet "${sheetName}" in file ${filename}`
          );
          continue;
        }

        const rowData = Array.isArray(next.rowArray) ? next.rowArray : [];
        logger.info(
          `   ✓ Selected next row with A=1 at row ${next.rowNumber} in sheet "${sheetName}"`
        );
        let isNewRow = true;

        // Only treat as \"not new\" when we are re-checking the same physical row
        if (dbReady && previous && next.rowNumber === previous.rowNumber) {
          try {
            const rowsEqual = areRowsEqualAsText(previous, rowData);
            if (rowsEqual) {
              isNewRow = false;
            } else {
              // Debug: Log why comparison failed for this specific file
              const { data: candidateData } = buildDataAndMetadataFromRow(rowData);
              const storedDataText = normalizeStoredDataToText(previous.data);
              logger.info(
                `   ↪ Row ${next.rowNumber} content changed for ${filename} [${sheetName}]; will insert new line`
              );
              logger.debug(
                `   Debug: stored keys: ${Object.keys(storedDataText).join(', ')}, candidate keys: ${Object.keys(candidateData).join(', ')}`
              );
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
          const display = buildDisplayFromSheetRow(sheet, next.rowNumber, rowData);
          extractedLinesToInsert.push({
            timestamp: scanStartedAt,
            filePath,
            folder,
            filename,
            sheetName,
            rowNumber: next.rowNumber,
            data,
            display,
            metadata
          });
        } else {
          logger.info(
            `   ↪ Next row with A=1 unchanged for sheet "${sheetName}" in file ${filename}; skipping insert`
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

  if (!dbReady) {
    logger.warn(
      'ℹ️  MongoDB not connected; skipping persistence to scans/extracted_lines (no Scan document will be saved)'
    );
    return stats;
  }

  if (scanNumber == null) {
    logger.warn(
      'ℹ️  scanNumber unavailable; skipping persistence to scans/extracted_lines (no Scan document will be saved)'
    );
    return stats;
  }

  logger.info(
    `ℹ️  Persisting scan #${scanNumber} for db=${dbName}: totalFiles=${totalFiles}, filesProcessed=${filesProcessed.length}, extractedLines=${extractedLinesToInsert.length}`
  );

  const duration = Date.now() - scanStartMs;
  const scanDoc = new Scan({
    timestamp: scanStartedAt,
    localTime: formatLocalTimeIsrael(scanStartedAt),
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
    stats.scanSaved = true;
    logger.info(`✅ Scan document saved with _id=${scanDoc._id}`);
  } catch (error) {
    logger.error('❌ Failed to write scan document:', {
      error: error.message,
      stack: error.stack
    });
    return stats;
  }

  if (extractedLinesToInsert.length > 0) {
    try {
      logger.info(
        `ℹ️  Inserting ${extractedLinesToInsert.length} extracted_lines for scanId=${scanDoc._id}`
      );
      const insertedDocs = await ExtractedLine.insertMany(
        extractedLinesToInsert.map((line) => ({ ...line, scanId: scanDoc._id })),
        { ordered: true }
      );
      stats.extractedLinesInserted = insertedDocs.length;
      logger.info(`✅ Inserted ${insertedDocs.length} extracted_lines document(s)`);

      // Write Excel immediately after successful MongoDB insert
      if (logExcelLinesToExtract) {
        await appendExtractedLinesToExcel(insertedDocs);
        stats.logFile = getScanResultsExcelPath();
      }
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
