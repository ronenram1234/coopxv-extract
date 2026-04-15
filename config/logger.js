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

const { Writable } = require('stream');
const { logDirectory, logRetentionDays } = require('./database');

/** Format a date in Israel timezone (Asia/Jerusalem) for all application logging. */
function formatTimestampIsrael(date = new Date()) {
  return new Date(date).toLocaleString('en-CA', {
    timeZone: 'Asia/Jerusalem',
    dateStyle: 'short',
    timeStyle: 'medium'
  });
}

/** Israel date only (YYYY-MM-DD) for filenames. */
function formatDateIsrael(date = new Date()) {
  return new Date(date).toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
}

/** Local time only (HH:mm) in Israel timezone for scan documents. */
function formatLocalTimeIsrael(date = new Date()) {
  return new Date(date).toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Jerusalem',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

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

const israelTimeFormat = winston.format((info) => {
  info.timestamp = formatTimestampIsrael(new Date());
  return info;
})();

const appFileFormat = winston.format.combine(
  israelTimeFormat,
  winston.format.printf(({ timestamp, level, message }) => `${timestamp} [${level}]: ${message}`)
);

const errorFileFormat = winston.format.combine(
  israelTimeFormat,
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack }) =>
    stack ? `${timestamp} [${level}]: ${message}\n${stack}` : `${timestamp} [${level}]: ${message}`
  )
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  israelTimeFormat,
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

// Prevent unhandled transport errors from crashing the process
logger.on('error', (err) => {
  console.error(`[winston] Logger error (non-fatal): ${err.message}`);
  if (err.stack) console.error(`[winston] Stack: ${err.stack}`);
});

// Custom MongoDB log transport — writes to log_entries using mongoose connection.
// No winston-mongodb, no separate driver, no TLS issues.
let mongoTransportAttached = false;
let logCollection = null;

function attachMongoTransport(mongooseConnection) {
  if (!mongooseConnection || !mongooseConnection.db) return;
  if (mongoTransportAttached) return;

  try {
    logCollection = mongooseConnection.db.collection('log_entries');

    // Create a writable stream that inserts into MongoDB
    const mongoStream = new Writable({
      objectMode: true,
      write(chunk, encoding, callback) {
        if (!logCollection) { callback(); return; }
        const info = typeof chunk === 'string' ? JSON.parse(chunk) : chunk;
        logCollection.insertOne({
          timestamp: new Date(),
          level: info.level || 'info',
          message: info.message || '',
          meta: info.meta || {}
        }).catch(() => {}); // fire-and-forget
        callback();
      }
    });

    const transport = new winston.transports.Stream({ stream: mongoStream, level: 'info' });
    logger.add(transport);
    mongoTransportAttached = true;
    logger.info(`ℹ️  MongoDB log transport attached (collection=log_entries, level=info, ttlDays=${logRetentionDays})`);
  } catch (err) {
    console.error(`[log-transport] Failed to attach: ${err.message}`);
  }
}

function startLogHealthCheck() {}
function stopLogHealthCheck() {}

/** Path for daily scan-results Excel file (Israel date). */
function getScanResultsExcelPath() {
  const dateStr = formatDateIsrael(new Date()).replace(/\//g, '-');
  return path.join(logDirectory, `scan-results-${dateStr}.xlsx`);
}

module.exports = logger;
module.exports.formatTimestampIsrael = formatTimestampIsrael;
module.exports.formatDateIsrael = formatDateIsrael;
module.exports.formatLocalTimeIsrael = formatLocalTimeIsrael;
module.exports.getScanResultsExcelPath = getScanResultsExcelPath;
module.exports.attachMongoTransport = attachMongoTransport;
module.exports.startLogHealthCheck = startLogHealthCheck;
module.exports.stopLogHealthCheck = stopLogHealthCheck;