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
 * - Adding/Removing: N/A (new file)
 * - Projected: ~150 lines
 * - Decision: Proceed (under 200 limit)
 *
 * Related Files:
 * - config/database.js (imports logDirectory, logRetentionDays)
 * - package.json (added winston dependencies)
 */

const fs = require('fs');
const path = require('path');
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

const { logDirectory, logRetentionDays } = require('./database');

// [2026-02-03] winston-migration: Ensure log directory exists before creating transports
if (!fs.existsSync(logDirectory)) {
  fs.mkdirSync(logDirectory, { recursive: true });
}

// [2026-02-03] winston-migration: Daily rotation with 30-day retention
const dailyRotateOpts = (name, level) => ({
  dirname: logDirectory,
  filename: `${name}-%DATE%.log`,
  datePattern: 'YYYY-MM-DD',
  maxFiles: `${logRetentionDays}d`,
  maxSize: '20m',
  level,
  options: { flags: 'a', encoding: 'utf8' }
});

const appFileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message }) => `${timestamp} [${level}]: ${message}`)
);

const errorFileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack }) =>
    stack ? `${timestamp} [${level}]: ${message}\n${stack}` : `${timestamp} [${level}]: ${message}`
  )
);

// [2026-02-03] winston-migration: JSON one-line per entry for scan-results
const scanResultsFormat = winston.format.printf((info) => {
  const { level, message, timestamp, ...rest } = info;
  const out = { timestamp: info.timestamp || new Date().toISOString(), level: level || 'info', ...rest };
  return JSON.stringify(out);
});

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message }) => `${timestamp} ${level}: ${message}`)
);

const applicationTransport = new DailyRotateFile({
  ...dailyRotateOpts('application', 'info'),
  format: appFileFormat
});

const errorTransport = new DailyRotateFile({
  ...dailyRotateOpts('error', 'warn'),
  format: errorFileFormat
});

const consoleTransport = new winston.transports.Console({
  level: 'debug',
  format: consoleFormat
});

const logger = winston.createLogger({
  level: 'info',
  transports: [applicationTransport, errorTransport, consoleTransport]
});

// [2026-02-03] winston-migration: Separate logger for structured scan-results (JSON only)
const scanResultsTransport = new DailyRotateFile({
  ...dailyRotateOpts('scan-results', 'info'),
  format: scanResultsFormat
});

const scanResultsLogger = winston.createLogger({
  level: 'info',
  transports: [scanResultsTransport]
});

/** Log field name to scan-results (JSON). */
function logFieldName(dateTime, filePath, sheetName, fieldName) {
  scanResultsLogger.info('', {
    timestamp: dateTime,
    type: 'field_name',
    filePath,
    sheetName,
    fieldName
  });
}

/** Log last row to scan-results (JSON). */
function logLastRow(dateTime, filePath, sheetName, rowNumber, rowData) {
  scanResultsLogger.info('', {
    timestamp: dateTime,
    type: 'last_row',
    filePath,
    sheetName,
    rowNumber,
    rowData: Array.isArray(rowData) ? rowData : []
  });
}

/** Log scan summary to scan-results (JSON). */
function logScanSummary(stats) {
  scanResultsLogger.info('', {
    timestamp: new Date().toISOString(),
    type: 'scan_summary',
    filesScanned: stats.filesScanned ?? 0,
    filesWithErrors: stats.filesWithErrors ?? 0,
    fieldNamesFound: stats.fieldNamesFound ?? 0,
    lastRowsFound: stats.lastRowsFound ?? 0
  });
}

function getScanResultsLogPath() {
  const today = new Date().toISOString().slice(0, 10);
  return path.join(logDirectory, `scan-results-${today}.log`);
}

module.exports = logger;
module.exports.logFieldName = logFieldName;
module.exports.logLastRow = logLastRow;
module.exports.logScanSummary = logScanSummary;
module.exports.getScanResultsLogPath = getScanResultsLogPath;
