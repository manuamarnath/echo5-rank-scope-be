const mongoose = require('mongoose');

const KeywordMapSchema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  pageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Page', index: true, default: null },
  text: { type: String, required: true, index: true },
  intent: { type: String, enum: ['informational','transactional','navigational','commercial'], default: 'informational' },
  geo: { type: String, default: null },
  score: { type: Number, default: 0 },
  source: { type: String, default: 'suggestion' },
  suggestedByJobId: { type: String, default: null, index: true },
  status: { type: String, enum: ['pending','accepted','dismissed'], default: 'pending' },
  notes: { type: String, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

// Compound index for quick lookups and to avoid exact duplicate suggestions
KeywordMapSchema.index({ clientId: 1, pageId: 1, text: 1 }, { unique: false });

module.exports = mongoose.model('KeywordMap', KeywordMapSchema);
