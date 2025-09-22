const express = require('express');
const router = express.Router();
const axios = require('axios');
const cheerio = require('cheerio');
const { Parser } = require('json2csv');

const SiteAudit = require('../models/SiteAudit');
const auth = require('../middleware/auth');

// GET all audits for user
router.get('/', auth(['owner', 'employee']), async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const audits = await SiteAudit.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .populate('clientId', 'name');

    const total = await SiteAudit.countDocuments({ userId: req.user._id });

    res.json({
      data: audits,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        pages: Math.ceil(total / parseInt(limit, 10))
      }
    });
  } catch (error) {
    console.error('Error fetching audits:', error);
    res.status(500).json({ error: 'Failed to fetch audits' });
  }
});

// GET single audit with detailed data
router.get('/:id', auth(['owner', 'employee']), async (req, res) => {
  try {
    const audit = await SiteAudit.findById(req.params.id)
      .populate('clientId', 'name')
      .populate('userId', 'name email');

    if (!audit) {
      return res.status(404).json({ error: 'Audit not found' });
    }

    res.json(audit);
  } catch (error) {
    console.error('Error fetching audit:', error);
    res.status(500).json({ error: 'Failed to fetch audit' });
  }
});

// POST create new audit and start crawl
router.post('/', auth(['owner', 'employee']), async (req, res) => {
  try {
    const { name, baseUrl, clientId, crawlSettings } = req.body;

    // Basic validation: name and baseUrl are required
    if (!name || !baseUrl) {
      return res.status(400).json({ error: 'Validation error', message: 'Both name and baseUrl are required' });
    }

    const userId = req.user && (req.user._id || req.user.id);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required', message: 'User id not found on token' });
    }

    const audit = new SiteAudit({
      name,
      baseUrl,
      clientId,
      userId,
      crawlSettings: {
        maxPages: crawlSettings?.maxPages || 500,
        respectRobotsTxt: crawlSettings?.respectRobotsTxt !== false,
        includeSubdomains: crawlSettings?.includeSubdomains || false,
        userAgent: crawlSettings?.userAgent || 'RankScopeBot/1.0'
      },
      status: 'pending',
      startTime: new Date()
    });

    await audit.save();

    // Start crawl process in background
    startCrawl(audit._id);

    res.status(201).json(audit);
  } catch (error) {
    console.error('Error creating audit:', error);
    // In development expose error.message to help debugging
    if (process.env.NODE_ENV !== 'production') {
      return res.status(500).json({ error: 'Failed to create audit', message: error.message });
    }
    res.status(500).json({ error: 'Failed to create audit' });
  }
});

// DELETE audit
router.delete('/:id', auth(['owner', 'employee']), async (req, res) => {
  try {
    const audit = await SiteAudit.findByIdAndDelete(req.params.id);
    if (!audit) {
      return res.status(404).json({ error: 'Audit not found' });
    }

    res.json({ message: 'Audit deleted successfully' });
  } catch (error) {
    console.error('Error deleting audit:', error);
    res.status(500).json({ error: 'Failed to delete audit' });
  }
});

// GET export audit as CSV
router.get('/:id/export/csv', auth(['owner', 'employee']), async (req, res) => {
  try {
    const audit = await SiteAudit.findById(req.params.id);
    
    if (!audit) {
      return res.status(404).json({ error: 'Audit not found' });
    }

    const fields = [
      'url',
      'statusCode',
      'title',
      'metaDescription',
      'wordCount',
      'h1.length',
      'internalLinks.length',
      'externalLinks.length',
      'images.length'
    ];

    const parser = new Parser({ fields });
    const csv = parser.parse(audit.crawledUrls);

    res.header('Content-Type', 'text/csv');
    res.attachment(`audit-${audit.name}-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting audit:', error);
    res.status(500).json({ error: 'Failed to export audit' });
  }
});

// GET audit summary statistics
router.get('/:id/summary', auth(['owner', 'employee']), async (req, res) => {
  try {
    const audit = await SiteAudit.findById(req.params.id);
    
    if (!audit) {
      return res.status(404).json({ error: 'Audit not found' });
    }

    const summary = {
      totalPages: audit.crawledUrls.length,
      statusCodes: audit.crawledUrls.reduce((acc, url) => {
        acc[url.statusCode] = (acc[url.statusCode] || 0) + 1;
        return acc;
      }, {}),
      missingTitles: audit.crawledUrls.filter(url => !url.title || url.title.trim() === '').length,
      missingDescriptions: audit.crawledUrls.filter(url => !url.metaDescription || url.metaDescription.trim() === '').length,
      missingH1: audit.crawledUrls.filter(url => !url.h1 || url.h1.length === 0).length,
      averageWordCount: Math.round(audit.crawledUrls.reduce((sum, url) => sum + (url.wordCount || 0), 0) / audit.crawledUrls.length),
      totalImages: audit.crawledUrls.reduce((sum, url) => sum + (url.images?.length || 0), 0),
      totalInternalLinks: audit.crawledUrls.reduce((sum, url) => sum + (url.internalLinks?.length || 0), 0),
      totalExternalLinks: audit.crawledUrls.reduce((sum, url) => sum + (url.externalLinks?.length || 0), 0)
    };

    res.json(summary);
  } catch (error) {
    console.error('Error fetching audit summary:', error);
    res.status(500).json({ error: 'Failed to fetch audit summary' });
  }
});

// Helper function to crawl website
async function startCrawl(auditId) {
  try {
    const audit = await SiteAudit.findById(auditId);
    if (!audit) return;

    audit.status = 'crawling';
    await audit.save();

    const crawledUrls = [];
    const visitedUrls = new Set();
    // Normalize starting URL by stripping fragments
    const normalize = (u) => {
      try {
        const parsed = new URL(u);
        return parsed.origin + parsed.pathname + parsed.search; // remove hash/fragment
      } catch (e) {
        return u;
      }
    };
    const queue = [normalize(audit.baseUrl)];

    // Simple delay helper
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Fetch with retries and exponential backoff
    const fetchWithRetries = async (url, opts = {}, retries = 3, backoff = 500) => {
      for (let attempt = 1; attempt <= retries; attempt += 1) {
        try {
          return await axios.get(url, opts);
        } catch (err) {
          const isLast = attempt === retries;
          const code = err.code || err.response?.status;
          console.warn(`Fetch attempt ${attempt} for ${url} failed:`, err.message || code);
          if (isLast) throw err;
          // exponential backoff
          await delay(backoff * attempt);
        }
      }
    };

    while (queue.length > 0 && crawledUrls.length < audit.crawlSettings.maxPages) {
      // Pull and normalize current URL (strip fragments)
      let currentUrl = queue.shift();
      currentUrl = normalize(currentUrl);

      if (visitedUrls.has(currentUrl)) continue;
      visitedUrls.add(currentUrl);

      try {
        const startTime = Date.now();
        // polite delay between requests to avoid rate-limiting
        await delay(200);
        const response = await fetchWithRetries(currentUrl, {
          timeout: 20000, // increased timeout
          maxRedirects: 5,
          headers: {
            'User-Agent': audit.crawlSettings.userAgent
          }
        }, 3, 700);
        const responseTime = Date.now() - startTime;

        const $ = cheerio.load(response.data);
        
        const urlData = {
          url: currentUrl,
          statusCode: response.status,
          contentType: response.headers['content-type'],
          title: $('title').text().trim(),
          metaDescription: $('meta[name="description"]').attr('content') || '',
          metaKeywords: ($('meta[name="keywords"]').attr('content') || '').split(',').map((k) => k.trim()).filter((k) => k),
          h1: $('h1').map((i, el) => $(el).text().trim()).get(),
          h2: $('h2').map((i, el) => $(el).text().trim()).get(),
          h3: $('h3').map((i, el) => $(el).text().trim()).get(),
          h4: $('h4').map((i, el) => $(el).text().trim()).get(),
          h5: $('h5').map((i, el) => $(el).text().trim()).get(),
          h6: $('h6').map((i, el) => $(el).text().trim()).get(),
          wordCount: $('body').text().split(/\s+/).filter((word) => word.length > 0).length,
          internalLinks: [],
          externalLinks: [],
          images: [],
          canonicalUrl: $('link[rel="canonical"]').attr('href') || '',
          robotsMeta: $('meta[name="robots"]').attr('content') || '',
          responseTime: responseTime,
          contentLength: parseInt(response.headers['content-length'] || '0', 10) || 0,
          language: $('html').attr('lang') || '',
          schemaMarkup: $('script[type="application/ld+json"]').map((i, el) => $(el).text()).get(),
          socialMeta: {
            ogTitle: $('meta[property="og:title"]').attr('content') || '',
            ogDescription: $('meta[property="og:description"]').attr('content') || '',
            ogImage: $('meta[property="og:image"]').attr('content') || '',
            twitterTitle: $('meta[name="twitter:title"]').attr('content') || '',
            twitterDescription: $('meta[name="twitter:description"]').attr('content') || '',
            twitterImage: $('meta[name="twitter:image"]').attr('content') || ''
          }
        };

        // Extract internal and external links
        $('a[href]').each((i, el) => {
          const href = $(el).attr('href');
          if (!href) return;

          try {
            // Normalize and strip fragments from discovered links
            const abs = new URL(href, currentUrl);
            const absoluteUrl = abs.origin + abs.pathname + abs.search;
            const baseHostname = new URL(audit.baseUrl).hostname;
            const isInternal = absoluteUrl.includes(baseHostname);
            
            const linkData = {
              url: absoluteUrl,
              anchorText: $(el).text().trim(),
              nofollow: $(el).attr('rel')?.includes('nofollow') || false
            };

            if (isInternal) {
              urlData.internalLinks.push(linkData);
              if (!visitedUrls.has(absoluteUrl) && !queue.includes(absoluteUrl)) {
                queue.push(absoluteUrl);
              }
            } else {
              urlData.externalLinks.push(linkData);
            }
          } catch (error) {
            console.error(`Error parsing URL ${href}:`, error.message || error);
          }
        });

        // Extract images
        $('img').each((i, el) => {
          const src = $(el).attr('src');
          if (src) {
            const absoluteSrc = new URL(src, currentUrl).href;
            urlData.images.push({
              src: absoluteSrc,
              alt: $(el).attr('alt') || '',
              width: $(el).attr('width') ? parseInt($(el).attr('width'), 10) : null,
              height: $(el).attr('height') ? parseInt($(el).attr('height'), 10) : null
            });
          }
        });

        crawledUrls.push(urlData);

      } catch (error) {
        console.error(`Error crawling ${currentUrl}:`, error.message);
        crawledUrls.push({
          url: currentUrl,
          statusCode: error.response?.status || 0,
          error: error.message
        });
      }
    }

    // Update audit with results
    audit.crawledUrls = crawledUrls;
    audit.status = 'completed';
    audit.endTime = new Date();
    audit.duration = audit.endTime - audit.startTime;
    
    // Calculate summary statistics
    audit.summary = {
      totalPages: crawledUrls.length,
      crawledPages: crawledUrls.filter(url => url.statusCode === 200).length,
      errorPages: crawledUrls.filter(url => url.statusCode >= 400).length,
      redirectPages: crawledUrls.filter(url => url.statusCode >= 300 && url.statusCode < 400).length,
      averageResponseTime: crawledUrls.length > 0 ? Math.round(crawledUrls.reduce((sum, url) => sum + (url.responseTime || 0), 0) / crawledUrls.length) : 0,
      totalWordCount: crawledUrls.reduce((sum, url) => sum + (url.wordCount || 0), 0),
      averageWordCount: crawledUrls.length > 0 ? Math.round(crawledUrls.reduce((sum, url) => sum + (url.wordCount || 0), 0) / crawledUrls.length) : 0,
      totalImages: crawledUrls.reduce((sum, url) => sum + (url.images?.length || 0), 0),
      totalInternalLinks: crawledUrls.reduce((sum, url) => sum + (url.internalLinks?.length || 0), 0),
      totalExternalLinks: crawledUrls.reduce((sum, url) => sum + (url.externalLinks?.length || 0), 0)
    };

    // Calculate issues
    audit.issues = {
      missingTitles: crawledUrls.filter(url => !url.title || url.title.trim() === '').length,
      missingDescriptions: crawledUrls.filter(url => !url.metaDescription || url.metaDescription.trim() === '').length,
      duplicateTitles: findDuplicates(crawledUrls.map(url => url.title)).length,
      duplicateDescriptions: findDuplicates(crawledUrls.map(url => url.metaDescription)).length,
      missingH1: crawledUrls.filter(url => !url.h1 || url.h1.length === 0).length,
      multipleH1: crawledUrls.filter(url => url.h1 && url.h1.length > 1).length,
      brokenLinks: crawledUrls.filter(url => url.statusCode >= 400).length,
      redirectChains: 0, // Would need more sophisticated tracking
      slowPages: crawledUrls.filter(url => url.responseTime > 3000).length,
      largePages: crawledUrls.filter(url => url.contentLength > 5000000).length
    };

    await audit.save();

  } catch (error) {
    console.error('Error in crawl process:', error);
    const audit = await SiteAudit.findById(auditId);
    if (audit) {
      audit.status = 'failed';
      audit.endTime = new Date();
      await audit.save();
    }
  }
}

function findDuplicates(arr) {
  const seen = new Set();
  const duplicates = new Set();
  
  arr.forEach(item => {
    if (seen.has(item)) {
      duplicates.add(item);
    } else {
      seen.add(item);
    }
  });
  
  return Array.from(duplicates);
}

module.exports = router;