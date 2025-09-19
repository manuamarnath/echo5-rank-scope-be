const mongoose = require('mongoose');

const { Schema } = mongoose;

const locationSchema = new Schema({
  city: String,
  state: String,
  country: String,
  zip: String,
  radius: {
    type: Number,
    default: 25, // Default radius in miles/km
    min: 1,
    max: 500
  },
  radiusUnit: {
    type: String,
    enum: ['miles', 'km'],
    default: 'miles'
  }
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
  primaryKeywords: [{
    keyword: {
      type: String,
      required: true
    },
    priority: {
      type: Number,
      min: 1,
      max: 10,
      default: 5
    },
    targetLocation: String, // Optional - for location-specific keywords
    notes: String // Optional - any specific notes about this primary keyword
  }],
  integrations: integrationsSchema
}, {
  timestamps: true
});

module.exports = mongoose.model('Client', clientSchema);
