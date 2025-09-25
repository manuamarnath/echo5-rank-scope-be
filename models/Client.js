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

// Enhanced address schema for comprehensive business information
const addressSchema = new Schema({
  full: String, // Complete address string
  street: String, // Street address
  city: String, // City
  state: String, // State abbreviation
  zip: String, // ZIP code
  country: {
    type: String,
    default: 'US'
  }
}, { _id: false });

// Schema for business shortcodes used in CMS
const shortcodesSchema = new Schema({
  contactForm: String, // Contact form shortcode
  reviews: String, // Reviews shortcode
  partners: String // Partner logos shortcode
}, { _id: false });

// Schema for comprehensive content generation data
const contentDataSchema = new Schema({
  businessType: String, // e.g., "family-owned cabinets and countertops store"
  locationDescription: String, // e.g., "suburb 20 minutes from downtown Tampa"
  serviceAreas: [String], // Cities/areas served
  primaryServiceArea: String, // Main city served
  usps: [String], // Unique selling points (up to 5)
  targetAudience: String, // Description of target customers
  tone: {
    type: String,
    enum: ['professional', 'casual', 'technical', 'conversational'],
    default: 'professional'
  },
  seoGoals: String, // SEO objectives and strategy
  primaryGeoKeyword: String, // Main geographic keyword
  driveTimesDescription: String, // Description of drive times from key areas
  googleMapsEmbedURL: String, // Google Maps embed URL
  socialLinks: [String], // Social media profile URLs
  shortcodes: shortcodesSchema,
  businessHours: String, // Operating hours in schema format
  businessDescription: String // Short business description for schema
}, { _id: false });

const clientSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  industry: String,
  website: String, // Client's website domain
  phone: String, // Business phone number
  address: addressSchema, // Enhanced address information
  locations: [locationSchema], // Keep existing location schema for backwards compatibility
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
  seedKeywords: [{
    keyword: String,
    searchVolume: Number,
    difficulty: Number,
    intent: {
      type: String,
      enum: ['informational', 'transactional', 'navigational', 'local']
    },
    source: {
      type: String,
      enum: ['csv', 'gsc', 'manual']
    }
  }],
  // Enhanced content generation data
  contentData: contentDataSchema,
  // Website structure for content generation
  websiteStructure: [String], // List of website pages/sections
  integrations: integrationsSchema
}, {
  timestamps: true
});

module.exports = mongoose.model('Client', clientSchema);
