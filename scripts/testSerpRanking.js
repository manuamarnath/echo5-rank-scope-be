require('dotenv').config();
const { getSERPRanking } = require('../services/rankingService');

async function main() {
  const kw = process.argv[2] || 'plumber near me';
  const domain = process.argv[3] || 'example.com';
  console.log('Testing SERP ranking for', kw, 'domain', domain);
  const res = await getSERPRanking(kw, domain, { num: 10, location: 'United States' });
  console.log('Result:', res);
}

main().catch(err => { console.error(err); process.exit(1); });