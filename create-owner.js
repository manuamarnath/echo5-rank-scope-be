const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Client = require('./models/Client');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI;

async function createOwner() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB connected');

    const existing = await User.findOne({ email: 'owner@mail.com' });
    if (existing) {
      console.log('Owner already exists:', existing.email);
      await mongoose.connection.close();
      return;
    }

    // Ensure a client exists for owner
    let ownerClient = await Client.findOne({ name: 'Owner Organization' });
    if (!ownerClient) {
      ownerClient = new Client({
        name: 'Owner Organization',
        domain: 'owner.example.com',
        industry: 'Technology'
      });
      await ownerClient.save();
    }

    const password = 'owner123';
    const hashedPassword = await bcrypt.hash(password, 12);

    const newUser = new User({
      clientId: ownerClient._id,
      name: 'Owner',
      email: 'owner@mail.com',
      passwordHash: hashedPassword,
      role: 'owner',
      status: 'active'
    });

    await newUser.save();
    console.log('Owner user created successfully');
    console.log('Email: owner@mail.com');
    console.log('Password:', password);

  } catch (err) {
    console.error('Error creating owner:', err);
  } finally {
    await mongoose.connection.close();
  }
}

createOwner();