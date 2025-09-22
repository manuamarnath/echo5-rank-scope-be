const mongoose = require('mongoose');

const { Schema } = mongoose;

const urlSchema = new Schema({
  url: {
    type: String,
    required: true
  },
  statusCode: Number,
  contentType: String,
  title: String,
  metaDescription: String,
  metaKeywords: [String],
  h1: [String],
  h2: [String],
  h3: [String],
  h4: [String],
  h5: [String],
  h6: [String],
  wordCount: Number,
  internalLinks: [{
    url: String,
    anchorText: String,
    nofollow: Boolean
  }],
  externalLinks: [{
    url: String,
    anchorText: String,
    nofollow: Boolean
  }],
  images: [{
    src: String,
    alt: String,
    width: Number,
    height: Number
  }],
  canonicalUrl: String,
  robotsMeta: String,
  responseTime: Number,
  contentLength: Number,
  language: String,
  schemaMarkup: [String],
  socialMeta: {
    ogTitle: String,
    ogDescription: String,
    ogImage: String,
    twitterTitle: String,
    twitterDescription: String,
    twitterImage: String
  }
});

const siteAuditSchema = new Schema({
  clientId: {
    type: Schema.Types.ObjectId,
    ref: 'Client',
    index: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  baseUrl: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'crawling', 'completed', 'failed'],
    default: 'pending'
  },
  crawlSettings: {
    maxPages: {
      type: Number,
      default: 500
    },
    respectRobotsTxt: {
      type: Boolean,
      default: true
    },
    includeSubdomains: {
      type: Boolean,
      default: false
    },
    userAgent: {
      type: String,
      default: 'RankScopeBot/1.0'
    }
  },
  summary: {
    totalPages: Number,
    crawledPages: Number,
    errorPages: Number,
    redirectPages: Number,
    averageResponseTime: Number,
    totalWordCount: Number,
    averageWordCount: Number,
    totalImages: Number,
    totalInternalLinks: Number,
    totalExternalLinks: Number
  },
  issues: {
    missingTitles: Number,
    missingDescriptions: Number,
    duplicateTitles: Number,
    duplicateDescriptions: Number,
    missingH1: Number,
    multipleH1: Number,
    brokenLinks: Number,
    redirectChains: Number,
    slowPages: Number,
    largePages: Number
  },
  crawledUrls: [urlSchema],
  startTime: Date,
  endTime: Date,
  duration: Number
}, {
  timestamps: true
});

// Index for faster queries
siteAuditSchema.index({ userId: 1, createdAt: -1 });
siteAuditSchema.index({ clientId: 1, status: 1 });

const SiteAudit = mongoose.model('SiteAudit', siteAuditSchema);

module.exports = SiteAudit;