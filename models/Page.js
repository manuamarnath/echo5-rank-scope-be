const mongoose = require('mongoose');

const { Schema } = mongoose;

const pageSchema = new Schema({
  clientId: {
    type: Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['homepage', 'service', 'blog', 'local'],
    required: true
  },
  title: String,
  slug: {
    type: String,
    required: true,
    unique: false // Unique per client, custom validation below
  },
  primaryKeywordId: {
    type: Schema.Types.ObjectId,
    ref: 'Keyword'
  },
  secondaryKeywordIds: [{
    type: Schema.Types.ObjectId,
    ref: 'Keyword'
  }],
  status: {
    type: String,
    enum: ['draft', 'published'],
    default: 'draft',
    required: true
  }
}, {
  timestamps: true
});

// Unique slug per client
pageSchema.index({ clientId: 1, slug: 1 }, { unique: true });

module.exports = mongoose.model('Page', pageSchema);
