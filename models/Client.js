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
  
  // Enhanced GEO fields
  serviceAreaNeighborhoods: [String], // Specific neighborhoods served
  serviceAreaZipCodes: [String], // ZIP codes covered
  serviceRadiusMiles: Number, // Service radius in miles
  yearsInBusiness: Number, // Years of business experience
  localBusinessAssociations: [String], // Chamber of Commerce, etc.
  localBusinessExpertise: String, // Local market specialization
  communityInvolvement: String, // Community engagement activities
  businessLatitude: Number, // GPS coordinates
  businessLongitude: Number, // GPS coordinates
  priceRange: String, // Service pricing range (e.g., "$$")
  paymentMethods: [String], // Accepted payment methods
  
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
  integrations: integrationsSchema,
  // Schema markup and business profile data
  companyProfile: {
    logoUrl: String, // URL to company logo
    website: String, // Company website URL
    phone: String, // Primary business phone number
    email: String, // Business email address
    socialProfiles: {
      facebook: String,
      twitter: String,
      linkedin: String,
      instagram: String,
      youtube: String
    },
    businessHours: [{
      day: {
        type: String,
        enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
      },
      open: String, // e.g., "09:00"
      close: String, // e.g., "17:00"
      closed: { type: Boolean, default: false }
    }],
    founded: Number, // Year company was founded
    numberOfEmployees: String, // e.g., "10-50", "50-100"
    paymentMethods: [String], // e.g., ["Cash", "Credit Card", "PayPal"]
    priceRange: String, // e.g., "$", "$$", "$$$"
    businessType: {
      type: String,
      enum: ['Corporation', 'LLC', 'Partnership', 'Sole Proprietorship', 'Non-Profit']
    }
  },
  // Website analysis results
  websiteAnalysis: {
    url: String,
    analyzedAt: Date,
    status: {
      type: String,
      enum: ['pending', 'analyzing', 'completed', 'failed'],
      default: 'pending'
    },
    error: String,
    pages: [{
      url: String,
      title: String,
      metaDescription: String,
      h1: [String],
      h2: [String],
      h3: [String],
      wordCount: Number,
      images: [{
        src: String,
        alt: String
      }],
      links: [String],
      contentKeywords: [{
        word: String,
        count: Number
      }],
      schema: [mongoose.Schema.Types.Mixed], // Flexible schema storage
      openGraph: mongoose.Schema.Types.Mixed,
      loadTime: String,
      pageType: String,
      error: String
    }],
    insights: {
      seo: {
        titleOptimization: {
          totalPages: Number,
          optimizedTitles: Number,
          issues: [String]
        },
        metaDescriptions: {
          totalPages: Number,
          optimizedDescriptions: Number,
          issues: [String]
        },
        headingStructure: {
          pagesWithH1: Number,
          pagesWithMultipleH1: Number,
          pagesWithoutH2: Number,
          issues: [String]
        },
        contentGaps: [String]
      },
      content: {
        topKeywords: [{
          word: String,
          count: Number
        }],
        contentThemes: mongoose.Schema.Types.Mixed,
        competitorAnalysis: [String],
        localSEOOpportunities: [String]
      },
      technical: {
        schemaMarkup: {
          hasLocalBusiness: Boolean,
          hasFAQ: Boolean,
          hasService: Boolean,
          totalSchemas: Number,
          recommendations: [String]
        },
        imageOptimization: {
          totalImages: Number,
          imagesWithoutAlt: Number,
          recommendations: [String]
        },
        internalLinking: {
          totalInternalLinks: Number,
          averageLinksPerPage: Number,
          recommendations: [String]
        }
      },
      opportunities: {
        missingPages: [String],
        contentEnhancements: [String],
        localOptimizations: [String]
      }
    },
    recommendations: [{
      category: String,
      priority: {
        type: String,
        enum: ['low', 'medium', 'high']
      },
      title: String,
      description: String,
      details: [String],
      action: String,
      completed: { type: Boolean, default: false }
    }]
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Client', clientSchema);
