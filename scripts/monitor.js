const dns = require('dns');
dns.setServers(['8.8.8.8']);
const mongoose = require('mongoose');
const uri = 'mongodb+srv://ronenchatgpt_db_user:techdb@cluster0.j2tq2fq.mongodb.net/coopxv-prod?retryWrites=true&w=majority&appName=Cluster0';

async function check() {
  const now = new Date().toLocaleTimeString('en-GB', {timeZone:'Asia/Jerusalem'});
  console.log(`\n========== MONITOR CHECK ${now} ==========`);
  const db = mongoose.connection.db;
  const since5 = new Date(Date.now() - 5*60*1000);
  const since60 = new Date(Date.now() - 60*60*1000);

  // Errors last hour
  const errors = await db.collection('log_entries').find({ level:'error', timestamp:{$gte:since60} }).sort({timestamp:-1}).toArray();
  console.log(`\nERRORS (1h): ${errors.length}`);
  for (const e of errors) {
    const t = new Date(e.timestamp).toLocaleTimeString('en-GB',{timeZone:'Asia/Jerusalem'});
    console.log(`  ${t} ${(e.message||'').substring(0,120)}`);
  }

  // Latest scan
  const scan = await db.collection('scans').find().sort({timestamp:-1}).limit(1).toArray();
  if (scan[0]) {
    const t = new Date(scan[0].timestamp).toLocaleTimeString('en-GB',{timeZone:'Asia/Jerusalem'});
    console.log(`\nLATEST SCAN: #${scan[0].scanNumber} at ${t} | files: ${scan[0].statistics?.successfulFiles}/${scan[0].statistics?.totalFiles}`);
  }

  // Flock status freshness
  const oldestFlock = await db.collection('flock_status').find().sort({lastScanAt:1}).limit(1).project({filename:1,lastScanAt:1}).toArray();
  if (oldestFlock[0]) {
    const t = new Date(oldestFlock[0].lastScanAt).toLocaleString('en-GB',{timeZone:'Asia/Jerusalem'});
    console.log(`FLOCK_STATUS oldest: ${oldestFlock[0].filename} last updated ${t}`);
  }

  // Recent log activity
  const recent = await db.collection('log_entries').countDocuments({timestamp:{$gte:since5}});
  console.log(`LOG_ENTRIES (5 min): ${recent} new entries`);
}

mongoose.connect(uri).then(async () => {
  await check();
  setInterval(check, 5*60*1000);
}).catch(e => { console.error(e.message); process.exit(1); });
