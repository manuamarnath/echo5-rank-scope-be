require('dotenv').config();
const axios = require('axios');
const checkModule = require('../routes/keywords');
// We can't easily call the express route handler directly, so call the rankingService instead
const { getSERPRanking } = require('../services/rankingService');

async function main() {
  const kw = process.argv[2] || 'plumber boston';
  const domain = process.argv[3] || 'echo5-rank-scope-fe-e5i4.vercel.app';
  console.log('Directly testing getSERPRanking for', kw, domain);
  const r = await getSERPRanking(kw, domain, { num: 50, location: 'United States' });
  console.log('Result:', r);
}

main().catch(err => { console.error(err); process.exit(1); });
