/**
 * Daily cleanup of scans and extracted_lines older than LOG_RETENTION_DAYS.
 * Removes old Scan documents and their ExtractedLine documents from MongoDB.
 */

const mongoose = require('mongoose');
const Scan = require('../models/Scan');
const ExtractedLine = require('../models/ExtractedLine');
const logger = require('../config/logger');

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Delete scans older than retentionDays and their extracted_lines.
 * @param {number} retentionDays - Retention window in days (e.g. from LOG_RETENTION_DAYS).
 * @returns {Promise<{ deletedScans: number, deletedLines: number }>}
 */
async function cleanupOldScansAndLines(retentionDays) {
  try {
    const cutoff = new Date(Date.now() - retentionDays * DAY_MS);

    const oldScans = await Scan.find({ timestamp: { $lt: cutoff } })
      .select('_id')
      .lean();

    if (oldScans.length === 0) {
      logger.info(`🧹 Daily cleanup: no scans older than ${retentionDays} days`);
      return { deletedScans: 0, deletedLines: 0 };
    }

    const oldScanIds = oldScans.map((s) => s._id);

    const resultLines = await ExtractedLine.deleteMany({
      scanId: { $in: oldScanIds }
    });
    const resultScans = await Scan.deleteMany({ _id: { $in: oldScanIds } });

    const deletedLines = resultLines.deletedCount ?? 0;
    const deletedScans = resultScans.deletedCount ?? 0;

    logger.info(
      `🧹 Daily cleanup: removed ${deletedScans} scans and ${deletedLines} extracted_lines older than ${retentionDays} days`
    );
    return { deletedScans, deletedLines };
  } catch (error) {
    logger.error('❌ Daily cleanup failed', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

// Standalone: run cleanup with config and one-off mongoose connect
if (require.main === module) {
  const { mongoUri, mongooseOptions, logRetentionDays } = require('../config/database');

  mongoose
    .connect(mongoUri, mongooseOptions)
    .then(() => cleanupOldScansAndLines(logRetentionDays))
    .then((result) => {
      logger.info('✅ Cleanup finished', result);
      return mongoose.disconnect();
    })
    .then(() => {
      logger.info('✅ Disconnected');
      process.exit(0);
    })
    .catch((err) => {
      logger.error('❌ Cleanup failed', { error: err.message, stack: err.stack });
      process.exit(1);
    });
}

module.exports = { cleanupOldScansAndLines };
