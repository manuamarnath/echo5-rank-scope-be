const mongoose = require('mongoose');

const { Schema } = mongoose;

const userSchema = new Schema({
  clientId: {
    type: Schema.Types.ObjectId,
    ref: 'Client',
    index: true,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    index: true
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
    default: 'active',
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);
