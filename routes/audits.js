const express = require('express');
const router = express.Router();
const axios = require('axios');
const cheerio = require('cheerio');
const { Parser } = require('json2csv');

const SiteAudit = require('../models/SiteAudit');
const Client = require('../models/Client');
const auth = require('../middleware/auth');

// GET all audits with filtering and pagination
router.get('/', auth(['owner', 'employee']), async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      clientId, 
      status, 
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    
    // Build filter object
    const filter = { userId: req.user._id };
    if (clientId) filter.clientId = clientId;
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { baseUrl: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const audits = await SiteAudit.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit, 10))
      .populate('clientId', 'name website')
      .select('-crawledUrls -crawlLog'); // Exclude large fields for list view

    const total = await SiteAudit.countDocuments(filter);

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

// GET audits dashboard stats
router.get('/dashboard', auth(['owner', 'employee']), async (req, res) => {
  try {
    const { clientId } = req.query;
    const filter = { userId: req.user._id };
    if (clientId) filter.clientId = clientId;

    const stats = await SiteAudit.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalAudits: { $sum: 1 },
          completedAudits: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          runningAudits: {
            $sum: { $cond: [{ $eq: ['$status', 'crawling'] }, 1, 0] }
          },
          failedAudits: {
            $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
          },
          totalPagesCrawled: { $sum: '$summary.crawledPages' },
          totalIssuesFound: {
            $sum: {
              $add: [
                { $ifNull: ['$issues.missingTitles', 0] },
                { $ifNull: ['$issues.missingDescriptions', 0] },
                { $ifNull: ['$issues.brokenLinks', 0] },
                { $ifNull: ['$issues.duplicateTitles', 0] }
              ]
            }
          }
        }
      }
    ]);

    // Get recent audits
    const recentAudits = await SiteAudit.find(filter)
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('clientId', 'name website')
      .select('name baseUrl status summary.crawledPages issues createdAt');

    // Get client breakdown
    const clientBreakdown = await SiteAudit.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$clientId',
          auditCount: { $sum: 1 },
          totalPages: { $sum: '$summary.crawledPages' },
          totalIssues: {
            $sum: {
              $add: [
                { $ifNull: ['$issues.missingTitles', 0] },
                { $ifNull: ['$issues.missingDescriptions', 0] },
                { $ifNull: ['$issues.brokenLinks', 0] }
              ]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'clients',
          localField: '_id',
          foreignField: '_id',
          as: 'client'
        }
      },
      { $unwind: '$client' },
      {
        $project: {
          clientName: '$client.name',
          auditCount: 1,
          totalPages: 1,
          totalIssues: 1
        }
      }
    ]);

    res.json({
      stats: stats[0] || {
        totalAudits: 0,
        completedAudits: 0,
        runningAudits: 0,
        failedAudits: 0,
        totalPagesCrawled: 0,
        totalIssuesFound: 0
      },
      recentAudits,
      clientBreakdown
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// GET single audit with detailed data
router.get('/:id', auth(['owner', 'employee']), async (req, res) => {
  try {
    const audit = await SiteAudit.findById(req.params.id)
      .populate('clientId', 'name website')
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

// GET audit pages with filtering and pagination
router.get('/:id/pages', auth(['owner', 'employee']), async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50,
      statusCode,
      issueType,
      search,
      sortBy = 'url',
      sortOrder = 'asc'
    } = req.query;

    const audit = await SiteAudit.findById(req.params.id);
    if (!audit) {
      return res.status(404).json({ error: 'Audit not found' });
    }

    let pages = audit.crawledUrls;

    // Apply filters
    if (statusCode) {
      const codes = Array.isArray(statusCode) ? statusCode : [statusCode];
      pages = pages.filter(page => codes.includes(page.statusCode?.toString()));
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      pages = pages.filter(page => 
        searchRegex.test(page.url) || 
        searchRegex.test(page.title) || 
        searchRegex.test(page.metaDescription)
      );
    }

    if (issueType) {
      switch (issueType) {
        case 'missing-title':
          pages = pages.filter(p => !p.title || p.title.trim() === '');
          break;
        case 'missing-description':
          pages = pages.filter(p => !p.metaDescription || p.metaDescription.trim() === '');
          break;
        case 'missing-h1':
          pages = pages.filter(p => !p.h1 || p.h1.length === 0);
          break;
        case 'multiple-h1':
          pages = pages.filter(p => p.h1 && p.h1.length > 1);
          break;
        case 'broken-links':
          pages = pages.filter(p => p.statusCode >= 400);
          break;
        case 'slow-pages':
          pages = pages.filter(p => p.responseTime > 3000);
          break;
        case 'large-pages':
          pages = pages.filter(p => p.contentLength > 5000000);
          break;
        case 'images-without-alt':
          pages = pages.filter(p => p.images && p.images.some(img => !img.alt));
          break;
        case 'title-too-long':
          pages = pages.filter(p => p.title && p.title.length > 60);
          break;
        case 'title-too-short':
          pages = pages.filter(p => p.title && p.title.length < 30);
          break;
        case 'description-too-long':
          pages = pages.filter(p => p.metaDescription && p.metaDescription.length > 160);
          break;
        case 'description-too-short':
          pages = pages.filter(p => p.metaDescription && p.metaDescription.length < 120);
          break;
      }
    }

    // Sort pages
    pages.sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];
      
      if (sortBy === 'url') {
        aVal = a.url || '';
        bVal = b.url || '';
      } else if (sortBy === 'statusCode') {
        aVal = a.statusCode || 0;
        bVal = b.statusCode || 0;
      } else if (sortBy === 'responseTime') {
        aVal = a.responseTime || 0;
        bVal = b.responseTime || 0;
      } else if (sortBy === 'wordCount') {
        aVal = a.wordCount || 0;
        bVal = b.wordCount || 0;
      }

      if (sortOrder === 'desc') {
        return bVal > aVal ? 1 : -1;
      }
      return aVal > bVal ? 1 : -1;
    });

    // Paginate
    const total = pages.length;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const paginatedPages = pages.slice(skip, skip + parseInt(limit, 10));

    res.json({
      data: paginatedPages,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        pages: Math.ceil(total / parseInt(limit, 10))
      }
    });
  } catch (error) {
    console.error('Error fetching audit pages:', error);
    res.status(500).json({ error: 'Failed to fetch audit pages' });
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
        maxDepth: crawlSettings?.maxDepth || 10,
        respectRobotsTxt: crawlSettings?.respectRobotsTxt !== false,
        includeSubdomains: crawlSettings?.includeSubdomains || false,
        followRedirects: crawlSettings?.followRedirects !== false,
        crawlImages: crawlSettings?.crawlImages !== false,
        crawlCSS: crawlSettings?.crawlCSS || false,
        crawlJS: crawlSettings?.crawlJS || false,
        userAgent: crawlSettings?.userAgent || 'RankScopeBot/1.0',
        delay: crawlSettings?.delay || 1000,
        timeout: crawlSettings?.timeout || 30000
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

// POST pause audit
router.post('/:id/pause', auth(['owner', 'employee']), async (req, res) => {
  try {
    const audit = await SiteAudit.findById(req.params.id);
    if (!audit) {
      return res.status(404).json({ error: 'Audit not found' });
    }

    if (audit.status !== 'crawling') {
      return res.status(400).json({ error: 'Audit is not currently running' });
    }

    audit.status = 'paused';
    await audit.save();

    res.json({ message: 'Audit paused successfully', audit });
  } catch (error) {
    console.error('Error pausing audit:', error);
    res.status(500).json({ error: 'Failed to pause audit' });
  }
});

// POST resume audit
router.post('/:id/resume', auth(['owner', 'employee']), async (req, res) => {
  try {
    const audit = await SiteAudit.findById(req.params.id);
    if (!audit) {
      return res.status(404).json({ error: 'Audit not found' });
    }

    if (audit.status !== 'paused') {
      return res.status(400).json({ error: 'Audit is not paused' });
    }

    audit.status = 'crawling';
    await audit.save();

    // Resume crawl process
    startCrawl(audit._id);

    res.json({ message: 'Audit resumed successfully', audit });
  } catch (error) {
    console.error('Error resuming audit:', error);
    res.status(500).json({ error: 'Failed to resume audit' });
  }
});

// POST stop audit
router.post('/:id/stop', auth(['owner', 'employee']), async (req, res) => {
  try {
    const audit = await SiteAudit.findById(req.params.id);
    if (!audit) {
      return res.status(404).json({ error: 'Audit not found' });
    }

    if (!['crawling', 'paused'].includes(audit.status)) {
      return res.status(400).json({ error: 'Audit is not currently running or paused' });
    }

    audit.status = 'completed';
    audit.endTime = new Date();
    audit.duration = audit.endTime.getTime() - audit.startTime.getTime();
    await audit.save();

    res.json({ message: 'Audit stopped successfully', audit });
  } catch (error) {
    console.error('Error stopping audit:', error);
    res.status(500).json({ error: 'Failed to stop audit' });
  }
});

// GET export audit as CSV
router.get('/:id/export', auth(['owner', 'employee']), async (req, res) => {
  try {
    const audit = await SiteAudit.findById(req.params.id);
    
    if (!audit) {
      return res.status(404).json({ error: 'Audit not found' });
    }

    const fields = [
      { label: 'URL', value: 'url' },
      { label: 'Status Code', value: 'statusCode' },
      { label: 'Title', value: 'title' },
      { label: 'Title Length', value: 'titleLength' },
      { label: 'Meta Description', value: 'metaDescription' },
      { label: 'Meta Description Length', value: 'metaDescriptionLength' },
      { label: 'H1 Count', value: 'h1.length' },
      { label: 'Word Count', value: 'wordCount' },
      { label: 'Internal Links', value: 'internalLinks.length' },
      { label: 'External Links', value: 'externalLinks.length' },
      { label: 'Images', value: 'images.length' },
      { label: 'Response Time (ms)', value: 'responseTime' },
      { label: 'Content Length', value: 'contentLength' },
      { label: 'Canonical URL', value: 'canonicalUrl' },
      { label: 'Meta Robots', value: 'robotsMeta' },
      { label: 'Crawl Depth', value: 'crawlDepth' }
    ];

    const parser = new Parser({ fields });
    const csv = parser.parse(audit.crawledUrls);

    res.header('Content-Type', 'text/csv');
    res.attachment(`audit-${audit.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`);
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