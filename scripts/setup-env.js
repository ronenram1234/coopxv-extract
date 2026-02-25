/**
 * UAVTradeZone Modification Record
 *
 * Change ID:    COOPXV-ENV-001
 * Date:         2026-02-03
 * Modified By:  Cursor AI
 *
 * Description:
 * Interactive script to create/update .env file with MongoDB Atlas configuration.
 * Backs up existing .env, creates from template, offers connection test.
 *
 * Related Files:
 * - scripts/test-connection.js
 * - config/database.js
 * - .env
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ENV_TEMPLATE = `# =============================================================================
# MongoDB Atlas Configuration
# =============================================================================

# Development Environment
MONGODB_URI_DEV=mongodb+srv://ronenchatgpt_db_user:HWCZv7853Zxaccpv@cluster0.j2tq2fq.mongodb.net/coopxv-dev?retryWrites=true&w=majority

# Production Environment
MONGODB_URI_PROD=mongodb+srv://ronenchatgpt_db_user:HWCZv7853Zxaccpv@cluster0.j2tq2fq.mongodb.net/coopxv-prod?retryWrites=true&w=majority

# =============================================================================
# Active Environment
# =============================================================================
# Uncomment ONE of these lines:

NODE_ENV=development
# NODE_ENV=production

# =============================================================================
# Application Configuration
# =============================================================================

# File Monitoring
SCAN_INTERVAL_MINUTES=5
ROOT_DIRECTORY=C:\\\\CoopXV
FILE_PATTERN=cxv*.xlsx

# Logging
# LOG_RETENTION_DAYS is hardcoded to 3 in config/database.js
`;

const SEPARATOR = '='.repeat(50);
const ENV_PATH = path.join(process.cwd(), '.env');

function createInterface() {
  return readline.createInterface({ input: process.stdin, output: process.stdout });
}

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

function backupEnv() {
  if (!fs.existsSync(ENV_PATH)) return null;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupPath = path.join(process.cwd(), `.env.backup.${timestamp}`);
  fs.copyFileSync(ENV_PATH, backupPath);
  return backupPath;
}

function writeEnv(content) {
  fs.writeFileSync(ENV_PATH, content, 'utf8');
}

function runConnectionTest() {
  return new Promise((resolve) => {
    const { spawn } = require('child_process');
    const child = spawn('node', [path.join(__dirname, 'test-connection.js')], {
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'development' }
    });
    child.on('close', (code) => resolve(code === 0));
  });
}

async function main() {
  console.log(`\n${SEPARATOR}`);
  console.log('🔧 CoopXV-extract Environment Setup');
  console.log(SEPARATOR);

  const rl = createInterface();

  if (fs.existsSync(ENV_PATH)) {
    console.log('\n⚠️  .env file already exists.');
    const overwrite = await ask(rl, 'Overwrite? (y/N): ');
    if (overwrite.toLowerCase() !== 'y' && overwrite.toLowerCase() !== 'yes') {
      console.log('\n💡 Setup cancelled. Existing .env unchanged.');
      rl.close();
      process.exit(0);
    }
    const backupPath = backupEnv();
    if (backupPath) {
      console.log(`\n📁 Backup created: ${path.basename(backupPath)}`);
    }
  }

  rl.close();

  try {
    writeEnv(ENV_TEMPLATE);
    console.log('\n✅ .env file created/updated successfully.');
  } catch (err) {
    console.error('\n❌ Failed to write .env:', err.message);
    process.exit(1);
  }

  console.log('\n' + SEPARATOR);
  console.log('💡 Next steps:');
  console.log('   1. Edit .env if you need to change ROOT_DIRECTORY or FILE_PATTERN');
  console.log('   2. Set NODE_ENV=development or NODE_ENV=production');
  console.log('   3. Run: npm run test:connection');
  console.log('   4. Run: npm run dev (or npm run prod)');
  console.log(SEPARATOR + '\n');

  const rl2 = createInterface();
  const test = await ask(rl2, 'Test MongoDB connection now? (Y/n): ');
  rl2.close();

  if (test.toLowerCase() !== 'n' && test.toLowerCase() !== 'no') {
    console.log('\n🧪 Running connection test...\n');
    require('dotenv').config({ path: ENV_PATH });
    const ok = await runConnectionTest();
    if (!ok) {
      console.log('\n⚠️  Connection test had issues. Check credentials and network.');
      process.exit(1);
    }
    console.log('\n✅ Setup and connection test complete.');
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ Setup failed:', err.message);
  process.exit(1);
});
