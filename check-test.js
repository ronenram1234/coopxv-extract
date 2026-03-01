const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const { MongoClient } = require('mongodb');

const TEST_URI = 'mongodb+srv://ronenchatgpt_db_user:HWCZv7853Zxaccpv@cluster0.j2tq2fq.mongodb.net/coopxv-ui-test?retryWrites=true&w=majority&appName=Cluster0';

async function check() {
  const client = new MongoClient(TEST_URI);
  await client.connect();
  const db = client.db('coopxv-ui-test');

  console.log('=== sync_watermarks ===');
  const watermarks = await db.collection('sync_watermarks').find().toArray();
  for (const w of watermarks) {
    const syncAt = w.lastSyncedAt ? new Date(w.lastSyncedAt).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }) : 'null';
    const successAt = w.lastSuccessAt ? new Date(w.lastSuccessAt).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }) : 'null';
    console.log(`  ${w.collectionName}: lastSyncedAt=${syncAt}, totalSynced=${w.totalSynced}, lastError=${w.lastError || 'none'}, lastSuccess=${successAt}`);
  }

  console.log('\n=== STG_extracted_lines ===');
  const stgTotal = await db.collection('STG_extracted_lines').countDocuments();
  const stgWithField = await db.collection('STG_extracted_lines').countDocuments({
    displayColumnNames: { $exists: true, $ne: {} }
  });
  console.log(`  Total: ${stgTotal}, with displayColumnNames: ${stgWithField}`);

  console.log('\n=== RT_extract_lines ===');
  const rtTotal = await db.collection('RT_extract_lines').countDocuments();
  const rtWithField = await db.collection('RT_extract_lines').countDocuments({
    displayColumnNames: { $exists: true, $ne: {} }
  });
  console.log(`  Total: ${rtTotal}, with displayColumnNames: ${rtWithField}`);

  if (rtWithField > 0) {
    const sample = await db.collection('RT_extract_lines').findOne(
      { displayColumnNames: { $exists: true, $ne: {} } },
      { projection: { filename: 1, lineNumber: 1, displayColumnNames: 1 } }
    );
    const keys = Object.keys(sample.displayColumnNames).slice(0, 6);
    const preview = {};
    keys.forEach(k => preview[k] = sample.displayColumnNames[k]);
    console.log(`  Sample (${sample.filename}, line ${sample.lineNumber}): ${JSON.stringify(preview)}`);
  }

  await client.close();
}

check().catch(err => { console.error(err); process.exit(1); });
