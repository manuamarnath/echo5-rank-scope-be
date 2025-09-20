const mongoose = require('mongoose');
const { Schema } = mongoose;

const keywordAnalyticsSchema = new Schema({
  keywordId: {
    type: Schema.Types.ObjectId,
    ref: 'Keyword',
    required: true,
    index: true
  },
  clientId: {
    type: Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
    index: true
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  searchVolume: {
    type: Number,
    default: 0,
    min: 0
  },
  position: {
    type: Number,
    default: 0,
    min: 0
  },
  trafficEstimate: {
    type: Number,
    default: 0,
    min: 0
  },
  impressions: {
    type: Number,
    default: 0,
    min: 0
  },
  clicks: {
    type: Number,
    default: 0,
    min: 0
  },
  ctr: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  competitorPositions: [{
    domain: String,
    position: Number
  }],
  location: {
    type: String,
    default: 'global'
  },
  device: {
    type: String,
    enum: ['desktop', 'mobile', 'tablet'],
    default: 'desktop'
  }
}, { timestamps: true });

module.exports = mongoose.model('KeywordAnalytics', keywordAnalyticsSchema);