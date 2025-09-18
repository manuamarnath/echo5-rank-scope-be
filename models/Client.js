const mongoose = require('mongoose');

const { Schema } = mongoose;

const locationSchema = new Schema({
  city: String,
  state: String,
  country: String,
  zip: String
}, { _id: false });

const integrationsSchema = new Schema({
  gsc: {
    clientId: String,
    clientSecret: String,
    refreshToken: String
  },
  ga4: {
    propertyId: String,
    accessToken: String,
    refreshToken: String
  },
  gbp: {
    accountId: String,
    locationIds: [String]
  }
}, { _id: false });

const clientSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  industry: String,
  locations: [locationSchema],
  services: [String],
  competitors: [String], // Array of URLs
  integrations: integrationsSchema
}, {
  timestamps: true
});

module.exports = mongoose.model('Client', clientSchema);
