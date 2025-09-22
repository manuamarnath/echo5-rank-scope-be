const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/../.env' });
const Client = require('../models/Client');
const { connectDB } = require('../database');

async function main(){
  await connectDB();
  const c = await Client.findOne().lean();
  if (!c) { console.log('No client found'); process.exit(0); }
  console.log('clientId:', c._id.toString());
  process.exit(0);
}

main().catch(err=>{ console.error(err); process.exit(1); });
