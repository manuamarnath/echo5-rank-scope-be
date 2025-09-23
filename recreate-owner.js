const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Client = require('./models/Client');
require('dotenv').config();

async function recreateOwner() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');

    // Delete existing owner user
    await User.deleteOne({ email: 'owner@mail.com' });
    console.log('Deleted existing owner user');

    // Create or find owner client
    let ownerClient = await Client.findOne({ name: 'Owner Organization' });
    if (!ownerClient) {
      ownerClient = new Client({
        name: 'Owner Organization',
        domain: 'owner.example.com',
        industry: 'Technology',
        targetLocation: {
          city: 'New York',
          state: 'NY',
          country: 'USA'
        },
        businessInfo: {
          description: 'Owner organization for system administration'
        }
      });
      await ownerClient.save();
      console.log('Created owner client organization');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash('owner123', 12);

    // Create new owner user
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
    console.log('Password: owner123');
    console.log('Role: owner');
    console.log('Client ID:', ownerClient._id);

  } catch (error) {
    console.error('Error creating owner:', error);
  } finally {
    mongoose.connection.close();
  }
}

recreateOwner();