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
  volume: Number,
  difficulty: Number
}, {
  timestamps: true
});

module.exports = mongoose.model('Keyword', keywordSchema);
