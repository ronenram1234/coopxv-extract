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

// Attach MongoDB transport at runtime (after Mongoose connects)
let mongoTransportAttached = false;

/**
 * Attach a MongoDB Winston transport so logs are also written to the `log_entries` collection.
 * Call this AFTER mongoose.connect, passing in mongoose.connection.
 *
 * @param {import('mongoose').Connection} mongooseConnection
 */
function attachMongoTransport(mongooseConnection) {
  if (!mongooseConnection || !mongooseConnection.db) {
    return;
  }
  if (mongoTransportAttached) {
    return;
  }

  let MongoDB;
  try {
    // Dynamic require avoids loading the transport when not needed (e.g. during tests)
    MongoDB = require('winston-mongodb').MongoDB;
  } catch (error) {
    // If the transport cannot be loaded, keep file/console logging working
    logger.warn('⚠️  Failed to load winston-mongodb transport; DB logging disabled', {
      error: error.message
    });
    return;
  }

  const ttlSeconds = Number.isFinite(logRetentionDays)
    ? logRetentionDays * 24 * 60 * 60
    : undefined;

  try {
    logger.add(
      new MongoDB({
        // Native MongoDB Db instance from mongoose connection
        db: mongooseConnection.db,
        collection: 'log_entries',
        level: 'info', // info, warn, error → enough to see each run
        expireAfterSeconds: ttlSeconds && ttlSeconds > 0 ? ttlSeconds : undefined,
        // Store additional structured data under `meta` if provided
        metaKey: 'meta'
      })
    );
    mongoTransportAttached = true;
    logger.info(
      `ℹ️  MongoDB log transport attached (collection=log_entries, level=info, ttlDays=${logRetentionDays})`
    );
  } catch (error) {
    logger.warn('⚠️  Failed to attach MongoDB log transport; DB logging disabled', {
      error: error.message
    });
  }
}

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