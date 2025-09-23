const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/../.env' });
const User = require('../models/User');
const { connectDB } = require('../database');

async function main(){
  await connectDB();
  const u = await User.findOne().lean();
  if (!u) { console.log('No user found'); process.exit(0); }
  console.log('user:', u.email, 'role:', u.role, 'id:', u._id.toString());
  process.exit(0);
}

main().catch(err=>{ console.error(err); process.exit(1); });
