const axios = require('axios');
const cheerio = require('cheerio');
const { URL } = require('url');

/**
 * Website Analysis Service
 * Analyzes client websites to extract insights for better content generation
 */
class WebsiteAnalyzer {
  constructor() {
    this.maxPages = 10; // Limit crawling to prevent overload
    this.timeout = 10000; // 10 second timeout
  }

  /**
   * Main analysis function - analyzes a client's website
   */
  async analyzeWebsite(websiteUrl, clientData = {}) {
    try {
      console.log(`Starting website analysis for: ${websiteUrl}`);
      
      const analysis = {
        url: websiteUrl,
        analyzedAt: new Date(),
        status: 'analyzing',
        pages: [],
        insights: {},
        recommendations: []
      };

      // Step 1: Analyze homepage
      const homepageAnalysis = await this.analyzePage(websiteUrl);
      analysis.pages.push(homepageAnalysis);

      // Step 2: Discover internal pages
      const internalPages = await this.discoverPages(websiteUrl, homepageAnalysis.links);
      
      // Step 3: Analyze key internal pages
      for (let i = 0; i < Math.min(internalPages.length, this.maxPages - 1); i++) {
        try {
          const pageAnalysis = await this.analyzePage(internalPages[i]);
          analysis.pages.push(pageAnalysis);
        } catch (error) {
          console.warn(`Failed to analyze page ${internalPages[i]}:`, error.message);
        }
      }

      // Step 4: Generate comprehensive insights
      analysis.insights = await this.generateInsights(analysis.pages, clientData);
      
      // Step 5: Generate content recommendations
      analysis.recommendations = await this.generateRecommendations(analysis.insights, clientData);
      
      analysis.status = 'completed';
      console.log(`Website analysis completed for: ${websiteUrl}`);
      
      return analysis;

    } catch (error) {
      console.error('Website analysis failed:', error);
      return {
        url: websiteUrl,
        analyzedAt: new Date(),
        status: 'failed',
        error: error.message,
        pages: [],
        insights: {},
        recommendations: []
      };
    }
  }

  /**
   * Analyzes a single page for SEO and content insights
   */
  async analyzePage(url) {
    try {
      const response = await axios.get(url, {
        timeout: this.timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      const $ = cheerio.load(response.data);
      
      const pageAnalysis = {
        url: url,
        title: $('title').text() || '',
        metaDescription: $('meta[name="description"]').attr('content') || '',
        h1: $('h1').map((i, el) => $(el).text().trim()).get(),
        h2: $('h2').map((i, el) => $(el).text().trim()).get(),
        h3: $('h3').map((i, el) => $(el).text().trim()).get(),
        wordCount: this.getWordCount($('body').text()),
        images: $('img').map((i, el) => ({
          src: $(el).attr('src'),
          alt: $(el).attr('alt') || ''
        })).get(),
        links: $('a[href]').map((i, el) => $(el).attr('href')).get(),
        contentKeywords: this.extractKeywords($('body').text()),
        schema: this.extractSchema($),
        openGraph: this.extractOpenGraph($),
        loadTime: response.headers['x-response-time'] || 'unknown',
        pageType: this.identifyPageType(url, $)
      };

      return pageAnalysis;

    } catch (error) {
      console.error(`Failed to analyze page ${url}:`, error.message);
      return {
        url: url,
        error: error.message,
        title: '',
        metaDescription: '',
        h1: [],
        h2: [],
        h3: [],
        wordCount: 0,
        images: [],
        links: [],
        contentKeywords: [],
        schema: {},
        openGraph: {},
        pageType: 'unknown'
      };
    }
  }

  /**
   * Discovers internal pages from homepage links
   */
  async discoverPages(baseUrl, links) {
    const baseHost = new URL(baseUrl).hostname;
    const internalPages = [];

    for (const link of links) {
      try {
        let fullUrl = link;
        
        // Handle relative URLs
        if (link.startsWith('/')) {
          fullUrl = new URL(link, baseUrl).href;
        } else if (!link.startsWith('http')) {
          continue; // Skip non-HTTP links
        }

        const linkHost = new URL(fullUrl).hostname;
        
        // Only include internal pages
        if (linkHost === baseHost && !internalPages.includes(fullUrl) && fullUrl !== baseUrl) {
          internalPages.push(fullUrl);
        }
      } catch (error) {
        // Skip invalid URLs
        continue;
      }
    }

    return internalPages.slice(0, this.maxPages - 1); // Reserve one slot for homepage
  }

  /**
   * Generates comprehensive insights from page analysis
   */
  async generateInsights(pages, clientData) {
    const insights = {
      seo: {
        titleOptimization: this.analyzeTitles(pages),
        metaDescriptions: this.analyzeMetaDescriptions(pages),
        headingStructure: this.analyzeHeadings(pages),
        contentGaps: this.identifyContentGaps(pages, clientData)
      },
      content: {
        topKeywords: this.getTopKeywords(pages),
        contentThemes: this.identifyContentThemes(pages),
        competitorAnalysis: this.analyzeCompetitors(pages),
        localSEOOpportunities: this.identifyLocalSEOOpportunities(pages, clientData)
      },
      technical: {
        schemaMarkup: this.analyzeSchemaMarkup(pages),
        imageOptimization: this.analyzeImages(pages),
        internalLinking: this.analyzeInternalLinking(pages)
      },
      opportunities: {
        missingPages: this.identifyMissingPages(pages, clientData),
        contentEnhancements: this.suggestContentEnhancements(pages, clientData),
        localOptimizations: this.suggestLocalOptimizations(pages, clientData)
      }
    };

    return insights;
  }

  /**
   * Generates actionable recommendations based on insights
   */
  async generateRecommendations(insights, clientData) {
    const recommendations = [];

    // SEO Recommendations
    if (insights.seo.titleOptimization.issues.length > 0) {
      recommendations.push({
        category: 'SEO',
        priority: 'high',
        title: 'Optimize Page Titles',
        description: 'Several pages have title tag issues that affect search rankings',
        details: insights.seo.titleOptimization.issues,
        action: 'Update title tags to be 50-60 characters with primary keywords'
      });
    }

    // Content Recommendations
    if (insights.seo?.contentGaps && insights.seo.contentGaps.length > 0) {
      recommendations.push({
        category: 'Content',
        priority: 'high',
        title: 'Fill Content Gaps',
        description: 'Missing content opportunities identified based on your services',
        details: insights.content.contentGaps,
        action: 'Create new pages or sections covering these topics'
      });
    }

    // Local SEO Recommendations
    if (insights.content.localSEOOpportunities.length > 0) {
      recommendations.push({
        category: 'Local SEO',
        priority: 'medium',
        title: 'Enhance Local Optimization',
        description: 'Opportunities to improve local search visibility',
        details: insights.content.localSEOOpportunities,
        action: 'Add location-specific content and local business information'
      });
    }

    // Technical Recommendations
    if (!insights.technical.schemaMarkup.hasLocalBusiness) {
      recommendations.push({
        category: 'Technical',
        priority: 'high',
        title: 'Implement LocalBusiness Schema',
        description: 'Missing structured data for local business information',
        details: ['No LocalBusiness schema markup found'],
        action: 'Add comprehensive LocalBusiness schema markup to improve local search'
      });
    }

    return recommendations;
  }

  // Helper methods for analysis
  getWordCount(text) {
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }

  extractKeywords(text) {
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3);
    
    const frequency = {};
    words.forEach(word => {
      frequency[word] = (frequency[word] || 0) + 1;
    });

    return Object.entries(frequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 20)
      .map(([word, count]) => ({ word, count }));
  }

  extractSchema($) {
    const schemas = [];
    $('script[type="application/ld+json"]').each((i, el) => {
      try {
        const schema = JSON.parse($(el).html());
        schemas.push(schema);
      } catch (error) {
        // Skip invalid JSON-LD
      }
    });
    return schemas;
  }

  extractOpenGraph($) {
    const og = {};
    $('meta[property^="og:"]').each((i, el) => {
      const property = $(el).attr('property').replace('og:', '');
      const content = $(el).attr('content');
      og[property] = content;
    });
    return og;
  }

  identifyPageType(url, $) {
    const path = new URL(url).pathname.toLowerCase();
    const title = $('title').text().toLowerCase();
    
    if (path === '/' || path === '/home') return 'homepage';
    if (path.includes('/about')) return 'about';
    if (path.includes('/service') || path.includes('/services')) return 'services';
    if (path.includes('/contact')) return 'contact';
    if (path.includes('/blog') || path.includes('/news')) return 'blog';
    if (title.includes('service') || title.includes('services')) return 'services';
    
    return 'other';
  }

  analyzeTitles(pages) {
    const issues = [];
    const analysis = {
      totalPages: pages.length,
      optimizedTitles: 0,
      issues: []
    };

    pages.forEach(page => {
      if (!page.title) {
        issues.push(`Missing title tag: ${page.url}`);
      } else if (page.title.length < 30) {
        issues.push(`Title too short (${page.title.length} chars): ${page.url}`);
      } else if (page.title.length > 60) {
        issues.push(`Title too long (${page.title.length} chars): ${page.url}`);
      } else {
        analysis.optimizedTitles++;
      }
    });

    analysis.issues = issues;
    return analysis;
  }

  analyzeMetaDescriptions(pages) {
    const issues = [];
    const analysis = {
      totalPages: pages.length,
      optimizedDescriptions: 0,
      issues: []
    };

    pages.forEach(page => {
      if (!page.metaDescription) {
        issues.push(`Missing meta description: ${page.url}`);
      } else if (page.metaDescription.length < 120) {
        issues.push(`Meta description too short: ${page.url}`);
      } else if (page.metaDescription.length > 160) {
        issues.push(`Meta description too long: ${page.url}`);
      } else {
        analysis.optimizedDescriptions++;
      }
    });

    analysis.issues = issues;
    return analysis;
  }

  analyzeHeadings(pages) {
    const analysis = {
      pagesWithH1: 0,
      pagesWithMultipleH1: 0,
      pagesWithoutH2: 0,
      issues: []
    };

    pages.forEach(page => {
      if (page.h1 && page.h1.length > 0) {
        analysis.pagesWithH1++;
        if (page.h1.length > 1) {
          analysis.pagesWithMultipleH1++;
          analysis.issues.push(`Multiple H1 tags found: ${page.url}`);
        }
      } else {
        analysis.issues.push(`Missing H1 tag: ${page.url}`);
      }

      if (!page.h2 || page.h2.length === 0) {
        analysis.pagesWithoutH2++;
        analysis.issues.push(`No H2 tags found: ${page.url}`);
      }
    });

    return analysis;
  }

  identifyContentGaps(pages, clientData) {
    const gaps = [];
    const services = clientData.services || [];
    const existingContent = pages.map(p => p.title + ' ' + p.h1.join(' ') + ' ' + p.h2.join(' ')).join(' ').toLowerCase();

    services.forEach(service => {
      if (!existingContent.includes(service.toLowerCase())) {
        gaps.push(`Missing dedicated page/content for: ${service}`);
      }
    });

    // Check for common business pages
    const commonPages = ['about', 'services', 'contact', 'testimonials', 'portfolio', 'blog'];
    const existingPageTypes = pages.map(p => p.pageType);

    commonPages.forEach(pageType => {
      if (!existingPageTypes.includes(pageType)) {
        gaps.push(`Missing ${pageType} page`);
      }
    });

    return gaps;
  }

  getTopKeywords(pages) {
    const allKeywords = [];
    pages.forEach(page => {
      allKeywords.push(...page.contentKeywords);
    });

    const combined = {};
    allKeywords.forEach(kw => {
      combined[kw.word] = (combined[kw.word] || 0) + kw.count;
    });

    return Object.entries(combined)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 50)
      .map(([word, count]) => ({ word, count }));
  }

  identifyContentThemes(pages) {
    const themes = {};
    const topKeywords = this.getTopKeywords(pages);

    // Group keywords into themes
    topKeywords.forEach(kw => {
      const theme = this.categorizeKeyword(kw.word);
      themes[theme] = themes[theme] || [];
      themes[theme].push(kw);
    });

    return themes;
  }

  categorizeKeyword(keyword) {
    if (keyword.includes('service') || keyword.includes('repair') || keyword.includes('install')) return 'services';
    if (keyword.includes('about') || keyword.includes('company') || keyword.includes('team')) return 'company';
    if (keyword.includes('contact') || keyword.includes('phone') || keyword.includes('address')) return 'contact';
    if (keyword.includes('home') || keyword.includes('house') || keyword.includes('residential')) return 'residential';
    if (keyword.includes('commercial') || keyword.includes('business') || keyword.includes('office')) return 'commercial';
    return 'general';
  }

  analyzeCompetitors(pages) {
    // Basic competitor analysis based on external links and references
    const competitors = [];
    pages.forEach(page => {
      page.links.forEach(link => {
        if (link.includes('http') && !link.includes(page.url)) {
          // This is a basic implementation - could be enhanced with more sophisticated competitor detection
          const domain = new URL(link).hostname;
          if (domain.includes('competitor') || domain.includes('similar-business')) {
            competitors.push(domain);
          }
        }
      });
    });

    return [...new Set(competitors)];
  }

  identifyLocalSEOOpportunities(pages, clientData) {
    const opportunities = [];
    const location = clientData.address?.city || '';
    const allContent = pages.map(p => (p.title + ' ' + p.contentKeywords.map(k => k.word).join(' ')).toLowerCase()).join(' ');

    if (location && !allContent.includes(location.toLowerCase())) {
      opportunities.push(`Add location targeting for ${location}`);
    }

    // Check for NAP (Name, Address, Phone) consistency
    const hasName = allContent.includes(clientData.name?.toLowerCase() || '');
    const hasAddress = allContent.includes('address') || allContent.includes('location');
    const hasPhone = allContent.includes('phone') || allContent.includes('call');

    if (!hasName) opportunities.push('Add business name mentions throughout content');
    if (!hasAddress) opportunities.push('Add address/location information');
    if (!hasPhone) opportunities.push('Add phone number and call-to-actions');

    return opportunities;
  }

  analyzeSchemaMarkup(pages) {
    const analysis = {
      hasLocalBusiness: false,
      hasFAQ: false,
      hasService: false,
      totalSchemas: 0,
      recommendations: []
    };

    pages.forEach(page => {
      if (page.schema && page.schema.length > 0) {
        analysis.totalSchemas += page.schema.length;
        
        page.schema.forEach(schema => {
          if (schema['@type'] === 'LocalBusiness') analysis.hasLocalBusiness = true;
          if (schema['@type'] === 'FAQPage') analysis.hasFAQ = true;
          if (schema['@type'] === 'Service') analysis.hasService = true;
        });
      }
    });

    if (!analysis.hasLocalBusiness) {
      analysis.recommendations.push('Add LocalBusiness schema markup');
    }
    if (!analysis.hasFAQ) {
      analysis.recommendations.push('Add FAQ schema markup for voice search');
    }
    if (!analysis.hasService) {
      analysis.recommendations.push('Add Service schema markup for service pages');
    }

    return analysis;
  }

  analyzeImages(pages) {
    const analysis = {
      totalImages: 0,
      imagesWithoutAlt: 0,
      recommendations: []
    };

    pages.forEach(page => {
      analysis.totalImages += page.images.length;
      page.images.forEach(img => {
        if (!img.alt || img.alt.trim() === '') {
          analysis.imagesWithoutAlt++;
        }
      });
    });

    if (analysis.imagesWithoutAlt > 0) {
      analysis.recommendations.push(`Add alt text to ${analysis.imagesWithoutAlt} images for accessibility and SEO`);
    }

    return analysis;
  }

  analyzeInternalLinking(pages) {
    const analysis = {
      totalInternalLinks: 0,
      averageLinksPerPage: 0,
      recommendations: []
    };

    let totalLinks = 0;
    pages.forEach(page => {
      const internalLinks = page.links.filter(link => {
        try {
          const linkUrl = new URL(link, page.url);
          const pageUrl = new URL(page.url);
          return linkUrl.hostname === pageUrl.hostname;
        } catch {
          return false;
        }
      });
      totalLinks += internalLinks.length;
    });

    analysis.totalInternalLinks = totalLinks;
    analysis.averageLinksPerPage = pages.length > 0 ? Math.round(totalLinks / pages.length) : 0;

    if (analysis.averageLinksPerPage < 3) {
      analysis.recommendations.push('Improve internal linking between pages for better SEO');
    }

    return analysis;
  }

  identifyMissingPages(pages, clientData) {
    const missing = [];
    const existingPageTypes = pages.map(p => p.pageType);
    
    const essentialPages = ['about', 'services', 'contact'];
    essentialPages.forEach(pageType => {
      if (!existingPageTypes.includes(pageType)) {
        missing.push(`${pageType.charAt(0).toUpperCase() + pageType.slice(1)} page`);
      }
    });

    // Service-specific pages
    if (clientData.services) {
      clientData.services.forEach(service => {
        const serviceFound = pages.some(page => 
          page.title.toLowerCase().includes(service.toLowerCase()) ||
          page.h1.some(h => h.toLowerCase().includes(service.toLowerCase()))
        );
        
        if (!serviceFound) {
          missing.push(`Dedicated page for ${service}`);
        }
      });
    }

    return missing;
  }

  suggestContentEnhancements(pages, clientData) {
    const suggestions = [];

    pages.forEach(page => {
      if (page.wordCount < 300) {
        suggestions.push(`Expand content on ${page.url} (currently ${page.wordCount} words)`);
      }

      if (page.h2.length < 2) {
        suggestions.push(`Add more H2 headings to ${page.url} for better structure`);
      }

      if (!page.metaDescription) {
        suggestions.push(`Add meta description to ${page.url}`);
      }
    });

    return suggestions;
  }

  suggestLocalOptimizations(pages, clientData) {
    const suggestions = [];
    const location = clientData.address?.city;

    if (location) {
      const hasLocationInTitles = pages.some(page => 
        page.title.toLowerCase().includes(location.toLowerCase())
      );

      if (!hasLocationInTitles) {
        suggestions.push(`Include "${location}" in page titles for local SEO`);
      }

      const hasLocalSchema = pages.some(page =>
        page.schema.some(schema => schema['@type'] === 'LocalBusiness')
      );

      if (!hasLocalSchema) {
        suggestions.push('Add LocalBusiness schema markup with address and contact info');
      }
    }

    suggestions.push('Add customer testimonials with location mentions');
    suggestions.push('Create location-specific landing pages');
    suggestions.push('Add local business directory listings');

    return suggestions;
  }
}

module.exports = WebsiteAnalyzer;