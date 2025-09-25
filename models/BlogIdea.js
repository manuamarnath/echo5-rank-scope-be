const mongoose = require('mongoose');

const BlogIdeaSchema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  title: { type: String, required: true },
  slug: { type: String, default: null },
  summary: { type: String, default: null },
  keywords: [{ type: String }],
  priority: { type: Number, default: 5 },
  status: { type: String, enum: ['idea','planned','in-progress','published','discarded'], default: 'idea' },
  suggestedByJobId: { type: String, default: null, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

// Helpful index for dedupe checks
BlogIdeaSchema.index({ clientId: 1, title: 1 });

module.exports = mongoose.model('BlogIdea', BlogIdeaSchema);
