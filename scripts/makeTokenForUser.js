const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/../.env' });
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { connectDB } = require('../database');

async function main(email) {
  await connectDB();
  const user = await User.findOne({ email });
  if (!user) { console.error('User not found'); process.exit(2); }
  const payload = { id: user._id.toString(), role: user.role };
  const token = jwt.sign(payload, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '7d' });
  console.log(token);
  process.exit(0);
}

const email = process.argv[2];
if (!email) { console.error('Usage: node makeTokenForUser.js <email>'); process.exit(1); }
main(email).catch(err=>{ console.error(err); process.exit(1); });
