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

// Prevent unhandled transport errors from crashing the process
logger.on('error', (err) => {
  console.error(`[winston] Logger error (non-fatal): ${err.message}`);
});

// Attach MongoDB transport at runtime (after Mongoose connects)
let mongoTransportAttached = false;
let currentMongoTransport = null;
let reconnectionListenersAttached = false;
let healthCheckIntervalHandle = null;
let lastKnownLogWrite = null;

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
    const mongoTransport = new MongoDB({
      // Native MongoDB Db instance from mongoose connection
      db: mongooseConnection.db,
      collection: 'log_entries',
      level: 'info', // info, warn, error → enough to see each run
      expireAfterSeconds: ttlSeconds && ttlSeconds > 0 ? ttlSeconds : undefined,
      // Store additional structured data under `meta` if provided
      metaKey: 'meta'
    });

    // Prevent winston-mongodb connection errors from crashing the process
    mongoTransport.on('error', (err) => {
      if (!mongoTransport._errorLogged) {
        mongoTransport._errorLogged = true;
        console.error(`[winston-mongodb] Transport error (further errors suppressed): ${err.message}`);
        // Reset flag after 5 minutes so we log again if the problem persists
        setTimeout(() => { mongoTransport._errorLogged = false; }, 5 * 60 * 1000);
      }
    });

    logger.add(mongoTransport);
    currentMongoTransport = mongoTransport;
    mongoTransportAttached = true;
    logger.info(
      `ℹ️  MongoDB log transport attached (collection=log_entries, level=info, ttlDays=${logRetentionDays})`
    );

    // Write a visible startup message to MongoDB so it appears in UI logs
    setTimeout(async () => {
      try {
        await mongooseConnection.db.collection('log_entries').insertOne({
          timestamp: new Date(),
          level: 'info',
          message: '🚀 CoopXV Extract service started - Winston MongoDB transport active',
          meta: {
            event: 'service_start',
            environment: process.env.NODE_ENV || 'production',
            startedAt: new Date().toISOString()
          }
        });
      } catch (err) {
        // Ignore write errors on startup
      }
    }, 2000);

    // Setup automatic recovery: reattach transport when mongoose reconnects
    if (!reconnectionListenersAttached) {
      mongooseConnection.on('disconnected', () => {
        logger.warn('⚠️  MongoDB disconnected — winston transport will recover on reconnection');
        mongoTransportAttached = false;
        // Remove failed transport
        if (currentMongoTransport) {
          try {
            logger.remove(currentMongoTransport);
            currentMongoTransport = null;
          } catch (err) {
            // Ignore removal errors
          }
        }
      });

      mongooseConnection.on('reconnected', () => {
        logger.info('🔄 MongoDB reconnected — reattaching winston transport...');
        mongoTransportAttached = false;
        // Wait a bit for connection to stabilize
        setTimeout(async () => {
          try {
            attachMongoTransport(mongooseConnection);
            logger.info('✅ Winston MongoDB transport recovered successfully');

            // Write a visible recovery log directly to MongoDB so it appears in the UI
            try {
              await mongooseConnection.db.collection('log_entries').insertOne({
                timestamp: new Date(),
                level: 'info',
                message: '🔄 Winston MongoDB transport auto-recovered after disconnection',
                meta: {
                  event: 'winston_recovery',
                  recoveredAt: new Date().toISOString()
                }
              });
            } catch (dbErr) {
              // If direct write fails, just log to console
              console.log('Note: Recovery log write to DB failed, but transport is restored');
            }
          } catch (err) {
            logger.error('❌ Failed to recover winston transport:', err.message);
          }
        }, 1000);
      });

      reconnectionListenersAttached = true;
      logger.info('🔄 MongoDB reconnection recovery enabled for winston transport');
    }
  } catch (error) {
    logger.warn('⚠️  Failed to attach MongoDB log transport; DB logging disabled', {
      error: error.message
    });
  }
}

/**
 * Periodically verify that the Winston MongoDB transport is still writing to log_entries.
 * If no writes detected within the check interval, remove and re-attach the transport.
 *
 * @param {import('mongoose').Connection} mongooseConnection
 * @param {number} checkIntervalMs — how often to run the health check (default: 5 min)
 */
function startLogHealthCheck(mongooseConnection, checkIntervalMs = 5 * 60 * 1000) {
  if (healthCheckIntervalHandle) {
    clearInterval(healthCheckIntervalHandle);
  }

  lastKnownLogWrite = new Date();

  healthCheckIntervalHandle = setInterval(async () => {
    if (!mongooseConnection || mongooseConnection.readyState !== 1) {
      return; // DB not connected, skip check
    }

    try {
      const latest = await mongooseConnection.db
        .collection('log_entries')
        .find()
        .sort({ timestamp: -1 })
        .limit(1)
        .project({ timestamp: 1 })
        .toArray();

      if (!latest.length) return;

      const latestTimestamp = new Date(latest[0].timestamp);
      const staleSince = Date.now() - latestTimestamp.getTime();
      const staleThresholdMs = checkIntervalMs * 2; // 2x the interval = stale

      if (staleSince > staleThresholdMs) {
        console.warn(
          `[log-health-check] log_entries stale for ${Math.round(staleSince / 60000)}min — reattaching Winston MongoDB transport`
        );

        // Remove dead transport
        if (currentMongoTransport) {
          try {
            logger.remove(currentMongoTransport);
          } catch (_) { /* ignore */ }
          currentMongoTransport = null;
        }
        mongoTransportAttached = false;

        // Re-attach
        attachMongoTransport(mongooseConnection);

        if (mongoTransportAttached) {
          // Write a recovery marker directly so it's visible in UI
          try {
            await mongooseConnection.db.collection('log_entries').insertOne({
              timestamp: new Date(),
              level: 'warn',
              message: '🔧 Winston MongoDB transport recovered by health check (was stale)',
              meta: { event: 'health_check_recovery', staleSinceMs: staleSince }
            });
          } catch (_) { /* ignore */ }
          console.log('[log-health-check] Transport re-attached successfully');
        }
      } else {
        lastKnownLogWrite = latestTimestamp;
      }
    } catch (err) {
      console.warn(`[log-health-check] Check failed: ${err.message}`);
    }
  }, checkIntervalMs);

  // Don't let the health check keep the process alive on shutdown
  if (healthCheckIntervalHandle.unref) {
    healthCheckIntervalHandle.unref();
  }

  logger.info(`🩺 Log health check enabled (interval: ${checkIntervalMs / 60000}min)`);
}

/** Stop the log health check interval. */
function stopLogHealthCheck() {
  if (healthCheckIntervalHandle) {
    clearInterval(healthCheckIntervalHandle);
    healthCheckIntervalHandle = null;
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
module.exports.startLogHealthCheck = startLogHealthCheck;
module.exports.stopLogHealthCheck = stopLogHealthCheck;