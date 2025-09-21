const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
require('dotenv').config();

async function recreateOwner() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');

    // Delete existing owner user
    await User.deleteOne({ email: 'owner@mail.com' });
    console.log('Deleted existing owner user');

    // Hash password
    const hashedPassword = await bcrypt.hash('owner123', 12);

    // Create new owner user
    const newUser = new User({
      name: 'Owner',
      email: 'owner@mail.com',
      passwordHash: hashedPassword,
      role: 'admin',
      status: 'active'
    });

    await newUser.save();
    console.log('Owner user created successfully');
    console.log('Email: owner@mail.com');
    console.log('Password: owner123');
    console.log('Role: admin');

  } catch (error) {
    console.error('Error creating owner:', error);
  } finally {
    mongoose.connection.close();
  }
}

recreateOwner();