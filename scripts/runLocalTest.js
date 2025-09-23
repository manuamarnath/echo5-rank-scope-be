const { connectDB } = require('../database');
const Keyword = require('../models/Keyword');
const KeywordMap = require('../models/KeywordMap');
const BlogIdea = require('../models/BlogIdea');
const keywordWorker = require('../workers/keywordSuggestionsWorker');
const blogWorker = require('../workers/blogIdeasWorker');
require('dotenv').config({ path: __dirname + '/../.env' });

async function main(){
  await connectDB();
  console.log('Connected to DB, running workers directly...');

  // Pick a clientId from existing Keywords or Clients
  let clientId = null;
  const k = await Keyword.findOne().lean();
  if (k) clientId = k.clientId;

  if (!clientId) {
    console.error('No clientId found in Keywords. Please create at least one Keyword or Client.');
    process.exit(1);
  }

  console.log('Using clientId:', clientId.toString());

  const job1 = { id: `test-${Date.now()}`, data: { clientId } };
  const r1 = await keywordWorker(job1);
  console.log('keywordWorker result:', r1);

  const job2 = { id: `test-${Date.now()}`, data: { clientId } };
  const r2 = await blogWorker(job2);
  console.log('blogWorker result:', r2);

  const createdKeywords = await KeywordMap.find({ clientId }).limit(10);
  const createdIdeas = await BlogIdea.find({ clientId }).limit(10);
  console.log('Sample KeywordMap docs:', createdKeywords.map(x => x.text).slice(0,10));
  console.log('Sample BlogIdea docs:', createdIdeas.map(x => x.title).slice(0,10));

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
