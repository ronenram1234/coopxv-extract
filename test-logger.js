/**
 * Temporary test script for Winston logger configuration.
 * Run: node test-logger.js
 * Delete this file after verification.
 */
const logger = require('./config/logger');

logger.info('Test info message');
logger.warn('Test warning message');
logger.error('Test error message');
