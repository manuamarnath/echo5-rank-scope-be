const mongoose = require('mongoose');

const { Schema } = mongoose;

const localOpportunitySchema = new Schema({
  clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
  // Note: Service model may not exist in all setups; serviceId is optional.
  serviceId: { type: Schema.Types.ObjectId, ref: 'Service', index: true },
  serviceName: { type: String },
  locationSlug: { type: String, required: true },
  suggestedUrl: { type: String, required: true },
  primaryKeyword: { type: String, required: true },
  secondaryKeywords: [{ type: String }],
  localizedKeywords: [{ type: String }],
  score: { type: Number, min: 0, max: 1, default: 0 },
  status: { type: String, enum: ['pending', 'accepted', 'dismissed'], default: 'pending' },
  metadata: { type: Schema.Types.Mixed }, // optional extra scoring data (GSC impressions etc.)
}, { timestamps: true });

module.exports = mongoose.model('LocalOpportunity', localOpportunitySchema);
