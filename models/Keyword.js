const mongoose = require('mongoose');

const { Schema } = mongoose;

const keywordSchema = new Schema({
  clientId: {
    type: Schema.Types.ObjectId,
    ref: 'Client',
    index: true,
    required: true
  },
  text: {
    type: String,
    required: true,
    index: true
  },
  intent: {
    type: String,
    enum: ['informational', 'transactional', 'navigational', 'local'],
    required: true
  },
  geo: String,
  allocatedTo: {
    type: String,
    enum: ['homepage', 'service', 'blog', 'local', null],
    default: null
  },
  serviceMatch: String,
  pageId: {
    type: Schema.Types.ObjectId,
    ref: 'Page'
  },
  role: {
    type: String,
    enum: ['primary', 'secondary', 'supporting', null],
    default: null
  },
  isPrimary: {
    type: Boolean,
    default: false,
    index: true
  },
  priority: {
    type: Number,
    min: 1,
    max: 10,
    default: null // Only set for primary keywords
  },
  targetLocation: String, // For location-specific primary keywords
  notes: String, // Additional notes for primary keywords
  volume: Number,
  difficulty: Number,
  // Rank tracking fields
  currentRank: {
    type: Number,
    default: null
  },
  previousRank: {
    type: Number,
    default: null
  },
  bestRank: {
    type: Number,
    default: null
  },
  worstRank: {
    type: Number,
    default: null
  },
  lastRankCheck: {
    type: Date,
    default: null
  },
  rankHistory: [{
    position: Number,
    url: String,
    searchEngine: String,
    device: String,
    location: String,
    checkedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Ensure only one primary role per page (application-level enforcement + index for quick lookup)
// Note: MongoDB partialFilterExpression requires creating the index at the DB level; we define it here for clarity.
// Enforce one primary per page at DB-level via partial unique index
keywordSchema.index(
  { pageId: 1, role: 1 },
  { unique: true, partialFilterExpression: { role: 'primary', pageId: { $type: 'objectId' } } }
);
// Helpful lookups
keywordSchema.index({ clientId: 1, text: 1 });
keywordSchema.index({ clientId: 1, pageId: 1, role: 1 });

module.exports = mongoose.model('Keyword', keywordSchema);
