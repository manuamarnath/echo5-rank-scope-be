const { connectDB } = require('../database');
const Keyword = require('../models/Keyword');
const KeywordMap = require('../models/KeywordMap');
require('dotenv').config({ path: __dirname + '/../.env' });

async function main(){
  await connectDB();
  console.log('Backfill: scanning keywords...');
  const keywords = await Keyword.find({}).limit(10000);
  let created = 0;
  for (const k of keywords) {
    try {
      const exists = await KeywordMap.findOne({ clientId: k.clientId, text: k.text });
      if (exists) continue;
      const doc = new KeywordMap({ clientId: k.clientId, pageId: k.pageId || null, text: k.text, intent: k.intent || 'informational', score: 80, source: 'backfill' });
      await doc.save();
      created++;
    } catch (err) {
      console.warn('backfill error:', err && err.message ? err.message : err);
    }
  }
  console.log(`Backfill complete. Created ${created} KeywordMap documents.`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
