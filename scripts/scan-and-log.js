/**
 * Recursively scan ROOT_DIRECTORY for FILE_PATTERN (.xlsx), extract field names
 * and last row where column A is 1, write to a timestamped log in LOG_DIRECTORY.
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const {
  rootDirectory,
  filePattern,
  logDirectory
} = require('../config/database');

/** Convert glob pattern (e.g. *.xlsx) to a RegExp for matching basenames. */
function patternToRegex(glob) {
  const escaped = glob
    .replace(/\\/g, '\\\\')
    .replace(/\*\*/g, '\u0000')
    .replace(/\*/g, '[^/]*')
    .replace(/\u0000/g, '.*')
    .replace(/\./g, '\\.')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`, 'i');
}

/** Recursively list all file paths under dir. */
function walkSync(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walkSync(full, fileList);
    } else if (ent.isFile()) {
      fileList.push(full);
    }
  }
  return fileList;
}

/** Return true if file path matches FILE_PATTERN (by basename). */
function matchesPattern(filePath, regex) {
  return regex.test(path.basename(filePath));
}

/** Check if value in column A equals 1 (numeric or string). */
function isColumnAOne(value) {
  if (value === 1) return true;
  if (typeof value === 'string' && value.trim() === '1') return true;
  if (value === '1') return true;
  return false;
}

/** ISO 8601 timestamp for log lines. */
function dateTime() {
  return new Date().toISOString();
}

/** Ensure log directory exists. */
function ensureLogDir() {
  if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory, { recursive: true });
  }
}

/** Timestamped log file path (one file per run). */
function logFilePath() {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return path.join(logDirectory, `field-scan-${ts}.log`);
}

/** Serialize row to a stable string (tab-separated, empty for undefined). */
function serializeRow(row) {
  if (!Array.isArray(row)) return '';
  return row.map((c) => (c == null ? '' : String(c))).join('\t');
}

function main() {
  ensureLogDir();
  const regex = patternToRegex(filePattern);
  const allFiles = walkSync(rootDirectory).filter((f) => matchesPattern(f, regex));

  const fieldNameEntries = [];
  const lastRowEntries = [];

  for (const filePath of allFiles) {
    let workbook;
    try {
      workbook = XLSX.readFile(filePath, { type: 'file', cellDates: true });
    } catch (err) {
      console.error('Error reading', filePath, err.message);
      continue;
    }

    const sheetNames = workbook.SheetNames || [];
    for (const sheetName of sheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      const dt = dateTime();

      if (rows.length > 0) {
        const headerRow = rows[0];
        for (let col = 0; col < headerRow.length; col++) {
          const fieldName = headerRow[col] != null ? String(headerRow[col]).trim() : '';
          if (fieldName !== '') {
            fieldNameEntries.push({ date_time: dt, file_path: filePath, sheet_name: sheetName, field_name: fieldName });
          }
        }
      }

      let lastMatch = null;
      let lastMatchRowIndex = -1;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const colA = Array.isArray(row) ? row[0] : undefined;
        if (isColumnAOne(colA)) {
          lastMatch = row;
          lastMatchRowIndex = i + 1;
        }
      }
      if (lastMatch != null) {
        lastRowEntries.push({
          date_time: dt,
          file_path: filePath,
          sheet_name: sheetName,
          row_number: lastMatchRowIndex,
          full_row: lastMatch
        });
      }
    }
  }

  const logPath = logFilePath();
  const lines = [];

  lines.push('# Field names (date_time | file_path | sheet_name | field_name)');
  lines.push('');
  for (const e of fieldNameEntries) {
    lines.push(`${e.date_time} | ${e.file_path} | ${e.sheet_name} | ${e.field_name}`);
  }

  lines.push('');
  lines.push('# Last row where column A is 1 (date_time | file_path | sheet_name | row_number | full_row_content)');
  lines.push('');
  for (const e of lastRowEntries) {
    const rowStr = serializeRow(e.full_row);
    lines.push(`${e.date_time} | ${e.file_path} | ${e.sheet_name} | ${e.row_number} | ${rowStr}`);
  }

  fs.writeFileSync(logPath, lines.join('\n'), 'utf8');
  console.log('Log written to', logPath);
  console.log('  Field name entries:', fieldNameEntries.length);
  console.log('  Last-row (column A = 1) entries:', lastRowEntries.length);
  console.log('  Files scanned:', allFiles.length);
}

main();
