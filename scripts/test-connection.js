/**
 * UAVTradeZone Modification Record
 *
 * Change ID:    COOPXV-CONN-002
 * Date:         2026-02-03
 * Modified By:  Cursor AI
 *
 * Description:
 * Standalone script to verify MongoDB Atlas connection. Loads .env, tests connect,
 * lists collections, performs test write/cleanup, then disconnects.
 *
 * Related Files:
 * - scripts/setup-env.js
 * - config/database.js
 */

const path = require('path');
const dns = require('dns');
const SEPARATOR = '='.repeat(50);
const TEST_COLLECTION = '_connection_test';
const CONNECT_TIMEOUT_MS = 10000;

function loadEnv() {
  const fs = require('fs');
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    console.error('\n❌ .env file not found at', envPath);
    console.error('💡 Run: node scripts/setup-env.js');
    process.exit(1);
  }
  // Load from resolved path (Windows-safe)
  require('dotenv').config({ path: envPath });
  // Also try default .env in cwd if URI still missing (e.g. different cwd)
  if (!process.env.MONGODB_URI_DEV && !process.env.MONGODB_URI_PROD) {
    require('dotenv').config();
  }
}

function getMongoUri() {
  const env = (process.env.NODE_ENV || 'development').toLowerCase();
  const uri = env === 'production' ? process.env.MONGODB_URI_PROD : process.env.MONGODB_URI_DEV;
  if (!uri) {
    console.error('\n❌ Missing MongoDB URI for NODE_ENV=', process.env.NODE_ENV);
    console.error('💡 Set MONGODB_URI_DEV and MONGODB_URI_PROD in .env');
    process.exit(1);
  }
  return uri;
}

function maskUri(uri) {
  try {
    const u = new URL(uri.replace('mongodb+srv://', 'https://'));
    const host = u.hostname || 'cluster';
    const db = (u.pathname || '').replace(/^\//, '') || 'default';
    return `mongodb+srv://***:***@${host}/${db}`;
  } catch {
    return 'mongodb+srv://***:***@***';
  }
}

async function run() {
  console.log(`\n${SEPARATOR}`);
  console.log('🧪 MongoDB Atlas Connection Test');
  console.log(SEPARATOR);

  loadEnv();
  // Use Google DNS for SRV lookup when system DNS fails (e.g. ECONNREFUSED)
  dns.setServers(['8.8.8.8', '8.8.4.4']);

  const uri = getMongoUri();
  console.log('\n🔧 NODE_ENV:', process.env.NODE_ENV || 'development');
  console.log('📊 Connection:', maskUri(uri));

  const mongoose = require('mongoose');
  mongoose.set('strictQuery', true);

  const opts = {
    serverSelectionTimeoutMS: CONNECT_TIMEOUT_MS,
    connectTimeoutMS: CONNECT_TIMEOUT_MS
  };

  try {
    await mongoose.connect(uri, opts);
    console.log('\n✅ Connected to MongoDB Atlas');
  } catch (err) {
    console.error('\n❌ Connection failed:', err.message);
    if (err.message && err.message.includes('auth')) {
      console.error('💡 Authentication error → Check username/password in .env');
    } else if (err.code === 'ENOTFOUND') {
      console.error('💡 ENOTFOUND → Check cluster URL (e.g. cluster0.xxxxx.mongodb.net)');
    } else if (err.message && (err.message.includes('timeout') || err.message.includes('timed out'))) {
      console.error('💡 Timeout → Check network/firewall and Atlas IP access list');
    }
    process.exit(1);
  }

  const db = mongoose.connection.db;
  const dbName = db.databaseName;
  console.log('📊 Database:', dbName);

  try {
    const collections = await db.listCollections().toArray();
    const names = collections.map((c) => c.name);
    if (names.length === 0) {
      console.log('📊 Collections: (none yet)');
    } else {
      console.log('📊 Collections:', names.join(', '));
    }
  } catch (e) {
    console.log('⚠️  Could not list collections:', e.message);
  }

  try {
    const doc = { _test: true, createdAt: new Date() };
    await db.collection(TEST_COLLECTION).insertOne(doc);
    console.log('\n✅ Test write succeeded');
    const deleted = await db.collection(TEST_COLLECTION).deleteMany({ _test: true });
    console.log('✅ Test data cleaned up (removed', deleted.deletedCount, 'documents)');
  } catch (e) {
    console.error('\n❌ Test write/cleanup failed:', e.message);
    await mongoose.disconnect();
    process.exit(1);
  }

  await mongoose.disconnect();
  console.log('\n✅ Disconnected gracefully');
  console.log(SEPARATOR + '\n');
  process.exit(0);
}

run().catch((err) => {
  console.error('\n❌ Test failed:', err.message);
  process.exit(1);
});
