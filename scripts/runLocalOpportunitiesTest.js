const { connectDB } = require('../database');
const Client = require('../models/Client');
const LocalOpportunity = require('../models/LocalOpportunity');
const genWorker = require('../workers/generateLocalOpportunitiesWorker');
const acceptWorker = require('../workers/acceptLocalOpportunityWorker');
require('dotenv').config({ path: __dirname + '/../.env' });

async function main(){
  await connectDB();
    require('dotenv').config();
    const client = await Client.findOne();
  if (!client) { console.error('No client found'); process.exit(1); }
  const clientId = client._id.toString();
  console.log('Testing generateLocalOpportunitiesWorker for client', clientId);
  const genRes = await genWorker({ data: { clientId } });
  console.log('Generate result:', genRes);

  const opp = await LocalOpportunity.findOne({ clientId }).sort({ createdAt: -1 });
  if (!opp) { console.error('No opportunity created'); process.exit(1); }
  console.log('Found opportunity', opp._id.toString(), opp.primaryKeyword, 'score', opp.score);

  console.log('Testing acceptLocalOpportunityWorker for opp', opp._id.toString());
    let accRes;
    try {
      accRes = await acceptWorker({ data: { opportunityId: opp._id.toString(), userId: null } });
    } catch (err) {
      console.error('Accept worker failed:', err && err.message ? err.message : err);
      console.error('Proceeding despite accept failure (this script is tolerant of missing API keys)');
    }
  console.log('Accept result:', accRes);

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
