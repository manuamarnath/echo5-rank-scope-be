const mongoose = require('mongoose');

const { Schema } = mongoose;

const urlSchema = new Schema({
  url: {
    type: String,
    required: true
  },
  statusCode: Number,
  statusText: String,
  redirectUrl: String,
  redirectChain: [String],
  contentType: String,
  title: String,
  titleLength: Number,
  metaDescription: String,
  metaDescriptionLength: Number,
  metaKeywords: [String],
  h1: [String],
  h2: [String],
  h3: [String],
  h4: [String],
  h5: [String],
  h6: [String],
  wordCount: Number,
  textRatio: Number, // text to HTML ratio
  internalLinks: [{
    url: String,
    anchorText: String,
    nofollow: Boolean,
    target: String
  }],
  externalLinks: [{
    url: String,
    anchorText: String,
    nofollow: Boolean,
    target: String
  }],
  images: [{
    src: String,
    alt: String,
    title: String,
    width: Number,
    height: Number,
    fileSize: Number
  }],
  canonicalUrl: String,
  robotsMeta: String,
  metaRobots: String,
  metaRefresh: String,
  xRobotsTag: String,
  responseTime: Number,
  contentLength: Number,
  language: String,
  hreflang: [{
    href: String,
    hreflang: String
  }],
  schemaMarkup: [{
    type: String,
    content: String
  }],
  socialMeta: {
    ogTitle: String,
    ogDescription: String,
    ogImage: String,
    ogType: String,
    ogUrl: String,
    twitterTitle: String,
    twitterDescription: String,
    twitterImage: String,
    twitterCard: String
  },
  technicalData: {
    encoding: String,
    doctype: String,
    viewport: String,
    cssFiles: Number,
    jsFiles: Number,
    inlineCSS: Number,
    inlineJS: Number
  },
  performance: {
    firstByteTime: Number,
    domContentLoaded: Number,
    loadComplete: Number
  },
  seoIssues: {
    titleMissing: Boolean,
    titleTooShort: Boolean,
    titleTooLong: Boolean,
    titleDuplicate: Boolean,
    descriptionMissing: Boolean,
    descriptionTooShort: Boolean,
    descriptionTooLong: Boolean,
    descriptionDuplicate: Boolean,
    h1Missing: Boolean,
    h1Multiple: Boolean,
    h1TooLong: Boolean,
    imagesWithoutAlt: Number,
    brokenLinks: Number,
    thinContent: Boolean,
    duplicateContent: Boolean
  },
  crawlDepth: Number,
  discoveredAt: Date
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
    enum: ['pending', 'crawling', 'completed', 'failed', 'paused'],
    default: 'pending'
  },
  crawlSettings: {
    maxPages: {
      type: Number,
      default: 500
    },
    maxDepth: {
      type: Number,
      default: 10
    },
    respectRobotsTxt: {
      type: Boolean,
      default: true
    },
    includeSubdomains: {
      type: Boolean,
      default: false
    },
    followRedirects: {
      type: Boolean,
      default: true
    },
    crawlImages: {
      type: Boolean,
      default: true
    },
    crawlCSS: {
      type: Boolean,
      default: false
    },
    crawlJS: {
      type: Boolean,
      default: false
    },
    userAgent: {
      type: String,
      default: 'RankScopeBot/1.0'
    },
    delay: {
      type: Number,
      default: 1000 // milliseconds between requests
    },
    timeout: {
      type: Number,
      default: 30000 // request timeout in milliseconds
    }
  },
  summary: {
    totalPages: Number,
    crawledPages: Number,
    errorPages: Number,
    redirectPages: Number,
    blockedPages: Number,
    averageResponseTime: Number,
    totalWordCount: Number,
    averageWordCount: Number,
    totalImages: Number,
    totalInternalLinks: Number,
    totalExternalLinks: Number,
    uniqueTitles: Number,
    uniqueDescriptions: Number,
    totalCSS: Number,
    totalJS: Number,
    duplicateContent: Number
  },
  issues: {
    missingTitles: Number,
    missingDescriptions: Number,
    duplicateTitles: Number,
    duplicateDescriptions: Number,
    titlesTooShort: Number,
    titlesTooLong: Number,
    descriptionsTooShort: Number,
    descriptionsTooLong: Number,
    missingH1: Number,
    multipleH1: Number,
    brokenLinks: Number,
    redirectChains: Number,
    slowPages: Number,
    largePages: Number,
    thinContent: Number,
    imagesWithoutAlt: Number,
    orphanedPages: Number,
    noIndexPages: Number,
    canonicalIssues: Number
  },
  crawledUrls: [urlSchema],
  robotsTxt: {
    exists: Boolean,
    content: String,
    lastModified: Date
  },
  sitemaps: [{
    url: String,
    status: String,
    lastModified: Date,
    urlCount: Number
  }],
  startTime: Date,
  endTime: Date,
  duration: Number,
  lastCrawlPage: String, // for resuming crawls
  crawlLog: [{
    timestamp: Date,
    level: String, // info, warning, error
    message: String,
    url: String
  }]
}, {
  timestamps: true
});

// Index for faster queries
siteAuditSchema.index({ userId: 1, createdAt: -1 });
siteAuditSchema.index({ clientId: 1, status: 1 });

const SiteAudit = mongoose.model('SiteAudit', siteAuditSchema);

module.exports = SiteAudit;