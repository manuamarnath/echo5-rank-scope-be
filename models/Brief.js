const mongoose = require('mongoose');

const { Schema } = mongoose;

const outlineItemSchema = new Schema({
  heading: { type: String, required: true },
  type: { type: String, enum: ['H1', 'H2', 'H3'], required: true }
}, { _id: false });

const faqSchema = new Schema({
  question: { type: String, required: true },
  answer: { type: String, required: true }
}, { _id: false });

const internalLinkSchema = new Schema({
  pageId: { type: Schema.Types.ObjectId, ref: 'Page', required: true },
  anchorText: { type: String, required: true }
}, { _id: false });

const briefSchema = new Schema({
  clientId: {
    type: Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
    index: true
  },
  pageId: {
    type: Schema.Types.ObjectId,
    ref: 'Page',
    required: true,
    index: true
  },
  outline: [outlineItemSchema],
  entities: [String],
  faqs: [faqSchema],
  internalLinks: [internalLinkSchema],
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Brief', briefSchema);
