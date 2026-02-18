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
 * - Current: 138 lines
 * - Adding/Removing: ~0 lines
 * - Projected: ~138 lines
 * - Decision: Proceed (under limit)
 *
 * Related Files:
 * - config/database.js
 * - config/logger.js
 * - scripts/scan-and-log.js
 */

const mongoose = require('mongoose');
const {
  environment,
  scanInterval,
  logRetentionDays,
  mongoUri,
  mongooseOptions
} = require('./config/database');
const { runScan } = require('./scripts/scan-and-log');
const { cleanupOldScansAndLines } = require('./scripts/cleanup-old-scans');
// [2026-02-03] winston-migration: Replace console.log with structured logging
const logger = require('./config/logger');
const { formatTimestampIsrael, attachMongoTransport } = require('./config/logger');

const SEPARATOR = '='.repeat(70);
// [2026-02-03] statistics-tracking: Track total scans for shutdown message
let scanCount = 0;
let scanLoopAborted = false;
let cleanupIntervalHandle = null;
let shuttingDown = false;

function logBanner() {
  logger.info(SEPARATOR);
  logger.info('🚀 CoopXV-Extract Service Starting');
  logger.info(SEPARATOR);
  logger.info(`📅 Started at: ${formatTimestampIsrael()}`);
  logger.info(`🔧 Environment: ${environment}`);
  logger.info(`⏱️  Scan interval: ${scanInterval} minute(s)`);
  logger.info(SEPARATOR + '\n');
}

async function executeScan() {
  // [2026-02-03] scanner-integration: Call scanner module every interval
  const startedAt = new Date();
  scanCount += 1;

  logger.info(SEPARATOR);
  logger.info(`🔄 Scan #${scanCount} started at ${formatTimestampIsrael(startedAt)}`);
  logger.info(SEPARATOR + '\n');

  try {
    const stats = await runScan();
    logger.info('✅ Scan completed successfully:');
    logger.info(`   📁 Files scanned: ${stats.filesScanned}`);
    logger.info(`   🛑 Files with errors: ${stats.filesWithErrors}`);
    logger.info(`   📝 Field names found: ${stats.fieldNamesFound}`);
    logger.info(`   📊 Last rows (A=1): ${stats.lastRowsFound}`);
    logger.info(`   🗄️ Scan document saved: ${Boolean(stats.scanSaved)}`);
    logger.info(`   📥 Extracted lines inserted: ${stats.extractedLinesInserted || 0}`);
    if (stats.logFile) {
      logger.info(`   💾 Log file: ${stats.logFile}`);
    }
  } catch (error) {
    logger.error('❌ Scan failed:', { error: error.message, stack: error.stack });
  } finally {
    logger.info('\n' + SEPARATOR);
    logger.info(`⏰ Next scan in ${scanInterval} minute(s)`);
    logger.info(SEPARATOR + '\n');
  }
}

/** Wait up to ms, but exit early if shutdown requested. */
function interruptibleDelay(ms) {
  const chunk = 1000;
  return new Promise((resolve) => {
    let remaining = ms;
    const tick = () => {
      if (scanLoopAborted || remaining <= 0) {
        resolve();
        return;
      }
      const wait = Math.min(chunk, remaining);
      remaining -= wait;
      setTimeout(tick, wait);
    };
    tick();
  });
}

/** Sequential scan loop: next scan starts only after previous finishes + interval. */
async function runScanLoop() {
  const intervalMs = scanInterval * 60 * 1000;
  while (!scanLoopAborted) {
    await executeScan();
    if (scanLoopAborted) break;
    await interruptibleDelay(intervalMs);
  }
}

async function main() {
  logBanner();

  logger.info('📡 Connecting to MongoDB...');
  try {
    await mongoose.connect(mongoUri, mongooseOptions);
    logger.info('✅ MongoDB connected successfully');
    const connection = mongoose.connection;
    const dbName = connection && connection.db ? connection.db.databaseName : 'unknown';
    const readyState = connection ? connection.readyState : 'none';
    logger.info(`📊 Connected DB name: ${dbName}`);
    logger.info(`📊 Mongoose readyState: ${readyState}`);

    // Attach MongoDB log transport so application/error logs are also written to the database
    if (typeof attachMongoTransport === 'function') {
      attachMongoTransport(connection);
    }
  } catch (error) {
    const details =
      (error && (error.stack || error.message)) || JSON.stringify(error, null, 2) || String(error);
    logger.error(`❌ MongoDB connection failed: ${details}`);
    process.exit(1);
  }

  logger.info('\n🏁 Running initial scan...\n');
  // [2026-02-03] immediate-scan: Run first scan immediately on startup
  await executeScan();

  logger.info(`✅ Service is now running. Scanning sequentially every ${scanInterval} minute(s) after each scan.`);
  logger.info('Press Ctrl+C to stop.\n');

  runScanLoop().catch((err) => {
    logger.error('❌ Scan loop failure:', err.stack || err.message || err);
  });

  // Daily cleanup: remove scans and extracted_lines older than LOG_RETENTION_DAYS
  function runCleanup() {
    cleanupOldScansAndLines(logRetentionDays).catch((err) => {
      logger.error('❌ Daily cleanup error:', err.message || err);
    });
  }
  setTimeout(runCleanup, 60 * 1000);
  cleanupIntervalHandle = setInterval(runCleanup, 24 * 60 * 60 * 1000);
  logger.info(`🧹 Daily cleanup scheduled (retention: ${logRetentionDays} days). First run in 1 min.\n`);

  registerShutdownHandlers();
}

function registerShutdownHandlers() {
  ['SIGINT', 'SIGTERM'].forEach((signal) => {
    process.on(signal, () => {
      handleShutdown(signal);
    });
  });
}

async function handleShutdown(signal) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  logger.warn(`\n⚠️  Shutdown signal received (${signal})`);
  scanLoopAborted = true;
  if (cleanupIntervalHandle) {
    clearInterval(cleanupIntervalHandle);
  }
  logger.info(`📊 Total scans completed: ${scanCount}`);
  logger.info('🔌 Disconnecting from MongoDB...');

  try {
    await mongoose.disconnect();
    logger.info('✅ MongoDB disconnected');
  } catch (error) {
    logger.error('❌ Error during MongoDB disconnect:', error.stack || error.message || error);
  } finally {
    logger.info('👋 Service stopped gracefully');
    process.exit(0);
  }
}

main().catch((error) => {
  logger.error('❌ Service initialization failed:', error.stack || error.message || error);
  process.exit(1);
});
