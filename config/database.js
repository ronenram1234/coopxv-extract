/**
 * UAVTradeZone Modification Record
 *
 * Change ID:    COOPXV-DB-003
 * Date:         2026-02-03
 * Modified By:  Cursor AI
 *
 * Description:
 * Centralized database configuration for CoopXV-extract. Loads .env, selects
 * MongoDB URI by NODE_ENV, validates required vars, exports config and mongoose options.
 *
 * Related Files:
 * - scripts/setup-env.js
 * - scripts/test-connection.js
 */

const path = require('path');
const fs = require('fs');
const dns = require('dns');

const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}
// Use Google DNS for mongodb+srv SRV lookup when system DNS fails (e.g. ECONNREFUSED)
dns.setServers(['8.8.8.8', '8.8.4.4']);

const environment = (process.env.NODE_ENV || 'development').toLowerCase();
const isProd = environment === 'production';

function getMongoUri() {
  const uri = isProd ? process.env.MONGODB_URI_PROD : process.env.MONGODB_URI_DEV;
  if (!uri || typeof uri !== 'string' || !uri.startsWith('mongodb')) {
    throw new Error(
      'Missing or invalid MongoDB URI. Set MONGODB_URI_DEV and MONGODB_URI_PROD in .env'
    );
  }
  return uri;
}

function getNumber(name, defaultValue) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return defaultValue;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) return defaultValue;
  return n;
}

function getString(name, defaultValue) {
  const v = process.env[name];
  if (v === undefined || v === '') return defaultValue;
  return String(v).trim();
}

const mongoUri = getMongoUri();
const scanInterval = getNumber('SCAN_INTERVAL_MINUTES', 5);
const rootDirectory = getString('ROOT_DIRECTORY', 'C:\\CoopXV');
const filePattern = getString('FILE_PATTERN', 'cxv*.xlsx');
const logDirectory = getString('LOG_DIRECTORY', path.join(process.cwd(), 'logs'));
const logRetentionDays = getNumber('LOG_RETENTION_DAYS', 30);

const mongooseOptions = {
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
  retryWrites: true
};

if (environment !== 'test') {
  const SEPARATOR = '='.repeat(50);
  const maskUri = (uri) => {
    try {
      const u = new URL(uri.replace('mongodb+srv://', 'https://'));
      const host = u.hostname || 'cluster';
      const db = (u.pathname || '').replace(/^\//, '') || 'default';
      return `mongodb+srv://***:***@${host}/${db}`;
    } catch {
      return '***';
    }
  };
  console.log('\n' + SEPARATOR);
  console.log('🔧 Database configuration loaded');
  console.log('   Environment:', environment);
  console.log('   MongoDB:', maskUri(mongoUri));
  console.log('   Scan interval (min):', scanInterval);
  console.log('   Root directory:', rootDirectory);
  console.log('   File pattern:', filePattern);
  console.log('   Log directory:', logDirectory);
  console.log('   Log retention (days):', logRetentionDays);
  console.log(SEPARATOR + '\n');
}

module.exports = {
  mongoUri,
  environment,
  scanInterval,
  rootDirectory,
  filePattern,
  logDirectory,
  logRetentionDays,
  mongooseOptions
};
