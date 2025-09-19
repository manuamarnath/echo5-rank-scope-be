const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;

const connectDB = async () => {
  try {
    // Check if MONGO_URI is set (for production/Atlas)
    if (process.env.MONGO_URI && process.env.MONGO_URI !== 'mongodb://localhost:27017/echo5-rankscope') {
      await mongoose.connect(process.env.MONGO_URI);
      console.log('MongoDB Atlas connected');
      return;
    }

    // Try local MongoDB first
    try {
      await mongoose.connect('mongodb://localhost:27017/echo5-rankscope', {
        connectTimeoutMS: 5000,
        serverSelectionTimeoutMS: 5000,
      });
      console.log('Local MongoDB connected');
      return;
    } catch (localError) {
      console.log('Local MongoDB not available, starting in-memory MongoDB...');
    }

    // Use in-memory MongoDB for development
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);
    console.log('In-memory MongoDB connected at:', uri);
    
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
    }
  } catch (error) {
    console.error('Error disconnecting from database:', error);
  }
};

module.exports = { connectDB, disconnectDB };