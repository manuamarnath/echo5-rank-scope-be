const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Environment variables
const MONGO_URI = 'mongodb+srv://rank-scope:rank-scope@cluster0.rxzsush.mongodb.net/echo5-rankscope?retryWrites=true&w=majority&appName=Cluster0';

// User schema (matching the model)
const userSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: function() { return this.role !== 'owner'; } // Not required for owners
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  role: {
    type: String,
    enum: ['owner', 'employee', 'client'],
    required: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'blocked'],
    default: 'active'
  }
}, {
  timestamps: true
});

const User = mongoose.model('User', userSchema);

const createOwnerUser = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB connected');
    
    // Check if user already exists
    const existingUser = await User.findOne({ email: 'owner@mail.com' });
    if (existingUser) {
      console.log('User already exists');
      await mongoose.connection.close();
      process.exit(0);
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('owner123', salt);
    
    // Create user
    const newUser = new User({
      name: 'Owner',
      email: 'owner@mail.com',
      passwordHash: hashedPassword,
      role: 'admin',
      status: 'active'
    });
    
    await user.save();
    console.log('Owner user created successfully:', {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    });
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error creating user:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

createOwnerUser();