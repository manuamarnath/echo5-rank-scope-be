const mongoose = require('mongoose');
// Temporarily comment out mongodb-memory-server to avoid parsing issues
// const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;

const connectDB = async () => {
  try {
    // Check if MONGO_URI is set (for production/Atlas)
    if (process.env.MONGO_URI && process.env.MONGO_URI !== 'mongodb://localhost:27017/echo5-rankscope') {
      console.log('Connecting to MongoDB Atlas...');
      await mongoose.connect(process.env.MONGO_URI, {
        connectTimeoutMS: 30000,
        serverSelectionTimeoutMS: 30000,
      });
      console.log('MongoDB Atlas connected successfully');
      return;
    }

    // Try local MongoDB first
    try {
      console.log('Attempting to connect to local MongoDB...');
      await mongoose.connect('mongodb://localhost:27017/echo5-rankscope', {
        connectTimeoutMS: 5000,
        serverSelectionTimeoutMS: 5000,
      });
      console.log('Local MongoDB connected');
      return;
    } catch (localError) {
      console.log('Local MongoDB not available, error:', localError.message);
      console.log('Falling back to in-memory MongoDB...');
    }

    // Use in-memory MongoDB for development - with better error handling
    console.log('In-memory MongoDB is temporarily disabled due to configuration issues');
    console.log('Please ensure MongoDB Atlas connection is working or install MongoDB locally');
    throw new Error('No database connection available. Please check your MongoDB configuration.');
    
    /*
    try {
      mongod = await MongoMemoryServer.create({
        binary: {
          version: '6.0.0',
        },
        instance: {
          port: 27018, // Use different port to avoid conflicts
        },
      });
      const uri = mongod.getUri();
      await mongoose.connect(uri);
      console.log('In-memory MongoDB connected at:', uri);
    } catch (memoryError) {
      console.error('Failed to start in-memory MongoDB:', memoryError.message);
      throw memoryError;
    }
    */
    
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
