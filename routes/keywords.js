const express = require('express');
const router = express.Router();
const Keyword = require('../models/Keyword');

// GET all keywords for a client
router.get('/', async (req, res) => {
  try {
    const { clientId } = req.query;
    
    if (!clientId) {
      return res.status(400).json({ error: 'clientId is required' });
    }

    const keywords = await Keyword.find({ clientId })
      .populate('pageId', 'title url')
      .sort({ createdAt: -1 });

    res.json(keywords);
  } catch (error) {
    console.error('Error fetching keywords:', error);
    res.status(500).json({ error: 'Failed to fetch keywords' });
  }
});

// POST bulk import keywords
router.post('/bulk-import', async (req, res) => {
  try {
    const { clientId, keywords } = req.body;

    if (!clientId || !Array.isArray(keywords) || keywords.length === 0) {
      return res.status(400).json({ 
        error: 'clientId and keywords array are required' 
      });
    }

    // Validate and prepare keywords for insertion
    const keywordDocs = keywords.map(keyword => {
      if (!keyword.text || keyword.text.trim() === '') {
        throw new Error('All keywords must have text');
      }

      return {
        clientId,
        text: keyword.text.trim().toLowerCase(),
        intent: keyword.intent || 'informational',
        geo: keyword.geo || null,
        volume: keyword.searchVolume || null,
        difficulty: keyword.difficulty || null,
        allocatedTo: null,
        serviceMatch: null,
        pageId: null,
        role: null
      };
    });

    // Remove duplicates by text within the same client
    const existingKeywords = await Keyword.find({ 
      clientId,
      text: { $in: keywordDocs.map(k => k.text) }
    }).select('text');

    const existingTexts = new Set(existingKeywords.map(k => k.text));
    const newKeywords = keywordDocs.filter(k => !existingTexts.has(k.text));

    if (newKeywords.length === 0) {
      return res.status(200).json({ 
        message: 'No new keywords to import - all keywords already exist',
        imported: 0,
        skipped: keywords.length
      });
    }

    // Bulk insert new keywords
    const insertedKeywords = await Keyword.insertMany(newKeywords);

    res.status(201).json({
      message: `Successfully imported ${insertedKeywords.length} keywords`,
      imported: insertedKeywords.length,
      skipped: keywords.length - insertedKeywords.length,
      keywords: insertedKeywords
    });

  } catch (error) {
    console.error('Error importing keywords:', error);
    res.status(500).json({ 
      error: 'Failed to import keywords',
      details: error.message 
    });
  }
});

// POST single keyword
router.post('/', async (req, res) => {
  try {
    const { clientId, text, intent, geo, volume, difficulty } = req.body;

    if (!clientId || !text) {
      return res.status(400).json({ 
        error: 'clientId and text are required' 
      });
    }

    // Check if keyword already exists for this client
    const existingKeyword = await Keyword.findOne({ 
      clientId, 
      text: text.trim().toLowerCase() 
    });

    if (existingKeyword) {
      return res.status(409).json({ 
        error: 'Keyword already exists for this client' 
      });
    }

    const keyword = new Keyword({
      clientId,
      text: text.trim().toLowerCase(),
      intent: intent || 'informational',
      geo: geo || null,
      volume: volume || null,
      difficulty: difficulty || null
    });

    await keyword.save();
    
    const populatedKeyword = await Keyword.findById(keyword._id)
      .populate('pageId', 'title url');

    res.status(201).json(populatedKeyword);

  } catch (error) {
    console.error('Error creating keyword:', error);
    res.status(500).json({ error: 'Failed to create keyword' });
  }
});

// PUT update keyword allocation
router.put('/:id/allocate', async (req, res) => {
  try {
    const { id } = req.params;
    const { allocatedTo, serviceMatch, pageId, role } = req.body;

    const keyword = await Keyword.findByIdAndUpdate(
      id,
      {
        allocatedTo: allocatedTo || null,
        serviceMatch: serviceMatch || null,
        pageId: pageId || null,
        role: role || null
      },
      { new: true }
    ).populate('pageId', 'title url');

    if (!keyword) {
      return res.status(404).json({ error: 'Keyword not found' });
    }

    res.json(keyword);

  } catch (error) {
    console.error('Error updating keyword allocation:', error);
    res.status(500).json({ error: 'Failed to update keyword allocation' });
  }
});

// DELETE keyword
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const keyword = await Keyword.findByIdAndDelete(id);

    if (!keyword) {
      return res.status(404).json({ error: 'Keyword not found' });
    }

    res.json({ message: 'Keyword deleted successfully' });

  } catch (error) {
    console.error('Error deleting keyword:', error);
    res.status(500).json({ error: 'Failed to delete keyword' });
  }
});

// GET keyword allocation summary
router.get('/allocation-summary', async (req, res) => {
  try {
    const { clientId } = req.query;
    
    if (!clientId) {
      return res.status(400).json({ error: 'clientId is required' });
    }

    const summary = await Keyword.aggregate([
      { $match: { clientId: require('mongoose').Types.ObjectId(clientId) } },
      {
        $group: {
          _id: '$allocatedTo',
          count: { $sum: 1 },
          keywords: { $push: '$text' }
        }
      }
    ]);

    const formattedSummary = {
      total: await Keyword.countDocuments({ clientId }),
      allocated: summary.reduce((acc, item) => {
        acc[item._id || 'unallocated'] = {
          count: item.count,
          keywords: item.keywords
        };
        return acc;
      }, {})
    };

    res.json(formattedSummary);

  } catch (error) {
    console.error('Error fetching allocation summary:', error);
    res.status(500).json({ error: 'Failed to fetch allocation summary' });
  }
});

// POST bulk import primary keywords from client onboarding
router.post('/bulk-import-primary', async (req, res) => {
  try {
    const { clientId, primaryKeywords } = req.body;

    if (!clientId || !Array.isArray(primaryKeywords) || primaryKeywords.length === 0) {
      return res.status(400).json({ 
        error: 'clientId and primaryKeywords array are required' 
      });
    }

    // Validate and prepare primary keywords for insertion
    const primaryKeywordDocs = primaryKeywords.map(keyword => {
      if (!keyword.keyword || keyword.keyword.trim() === '') {
        throw new Error('All primary keywords must have text');
      }

      return {
        clientId,
        text: keyword.keyword.trim().toLowerCase(),
        intent: 'transactional', // Default for primary keywords
        geo: keyword.targetLocation || null,
        volume: null,
        difficulty: null,
        allocatedTo: null,
        serviceMatch: null,
        pageId: null,
        role: 'primary',
        isPrimary: true,
        priority: keyword.priority || 5,
        targetLocation: keyword.targetLocation || null,
        notes: keyword.notes || null
      };
    });

    // Remove duplicates by text within the same client
    const existingKeywords = await Keyword.find({ 
      clientId,
      text: { $in: primaryKeywordDocs.map(k => k.text) }
    }).select('text isPrimary');

    // Update existing keywords to be primary or create new ones
    const existingTexts = new Map();
    existingKeywords.forEach(k => existingTexts.set(k.text, k));

    const newKeywords = [];
    const updatePromises = [];

    primaryKeywordDocs.forEach(keyword => {
      const existing = existingTexts.get(keyword.text);
      if (existing) {
        // Update existing keyword to be primary
        updatePromises.push(
          Keyword.findByIdAndUpdate(existing._id, {
            isPrimary: true,
            role: 'primary',
            priority: keyword.priority,
            targetLocation: keyword.targetLocation,
            notes: keyword.notes
          })
        );
      } else {
        // Add new primary keyword
        newKeywords.push(keyword);
      }
    });

    // Execute updates and inserts
    await Promise.all(updatePromises);
    const insertedKeywords = newKeywords.length > 0 ? await Keyword.insertMany(newKeywords) : [];

    res.status(201).json({
      message: `Successfully processed ${primaryKeywordDocs.length} primary keywords`,
      created: insertedKeywords.length,
      updated: updatePromises.length,
      keywords: [...insertedKeywords]
    });

  } catch (error) {
    console.error('Error importing primary keywords:', error);
    res.status(500).json({ 
      error: 'Failed to import primary keywords',
      details: error.message 
    });
  }
});

// GET primary keywords for a client
router.get('/primary', async (req, res) => {
  try {
    const { clientId } = req.query;
    
    if (!clientId) {
      return res.status(400).json({ error: 'clientId is required' });
    }

    const primaryKeywords = await Keyword.find({ 
      clientId, 
      isPrimary: true 
    })
      .populate('pageId', 'title url')
      .sort({ priority: -1, createdAt: -1 });

    res.json(primaryKeywords);
  } catch (error) {
    console.error('Error fetching primary keywords:', error);
    res.status(500).json({ error: 'Failed to fetch primary keywords' });
  }
});

// POST check keyword ranks
router.post('/check-ranks', async (req, res) => {
  try {
    const { clientId, keywordIds, domain, searchEngine = 'google', device = 'desktop', location = '' } = req.body;

    if (!clientId || !keywordIds || !Array.isArray(keywordIds) || keywordIds.length === 0 || !domain) {
      return res.status(400).json({ 
        error: 'clientId, keywordIds array, and domain are required' 
      });
    }

    // Fetch the keywords to check
    const keywords = await Keyword.find({
      _id: { $in: keywordIds },
      clientId
    });

    if (keywords.length === 0) {
      return res.status(404).json({ error: 'No keywords found' });
    }

    const results = [];
    
    // Process each keyword
    for (const keyword of keywords) {
      try {
        // Simulate rank checking (replace with actual rank checking service)
        const rankResult = await checkKeywordRank(keyword.text, domain, searchEngine, device, location);
        
        // Update keyword with new rank data
        const previousRank = keyword.currentRank;
        keyword.previousRank = previousRank;
        keyword.currentRank = rankResult.position;
        keyword.lastRankCheck = new Date();
        
        // Update best/worst ranks
        if (rankResult.position) {
          if (!keyword.bestRank || rankResult.position < keyword.bestRank) {
            keyword.bestRank = rankResult.position;
          }
          if (!keyword.worstRank || rankResult.position > keyword.worstRank) {
            keyword.worstRank = rankResult.position;
          }
        }
        
        // Add to rank history
        keyword.rankHistory.push({
          position: rankResult.position,
          url: rankResult.url,
          searchEngine,
          device,
          location,
          checkedAt: new Date()
        });
        
        // Keep only last 100 rank history entries
        if (keyword.rankHistory.length > 100) {
          keyword.rankHistory = keyword.rankHistory.slice(-100);
        }
        
        await keyword.save();
        
        results.push({
          keyword: keyword.text,
          keywordId: keyword._id,
          position: rankResult.position,
          url: rankResult.url,
          searchEngine,
          device,
          location,
          checkedAt: new Date().toISOString()
        });
      } catch (error) {
        console.error(`Error checking rank for keyword ${keyword.text}:`, error);
        results.push({
          keyword: keyword.text,
          keywordId: keyword._id,
          position: null,
          url: null,
          searchEngine,
          device,
          location,
          checkedAt: new Date().toISOString(),
          error: error.message
        });
      }
    }

    res.json(results);

  } catch (error) {
    console.error('Error checking keyword ranks:', error);
    res.status(500).json({ error: 'Failed to check keyword ranks' });
  }
});

// Helper function to simulate rank checking (replace with actual service)
async function checkKeywordRank(keyword, domain, searchEngine, device, location) {
  // This is a mock implementation - replace with actual rank checking service
  // You could integrate with services like SERPApi, DataForSEO, or build custom scrapers
  
  return new Promise((resolve) => {
    setTimeout(() => {
      // Simulate random rank results for demo
      const hasRank = Math.random() > 0.3; // 70% chance of having a rank
      const position = hasRank ? Math.floor(Math.random() * 100) + 1 : null;
      const url = hasRank ? `https://${domain}/sample-page` : null;
      
      resolve({
        position,
        url,
        searchEngine,
        device,
        location
      });
    }, 1000 + Math.random() * 2000); // Simulate 1-3 second delay
  });
}

// GET rank history for a keyword
router.get('/:id/rank-history', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 30 } = req.query;

    const keyword = await Keyword.findById(id);
    if (!keyword) {
      return res.status(404).json({ error: 'Keyword not found' });
    }

    // Get recent rank history
    const rankHistory = keyword.rankHistory
      .sort((a, b) => new Date(b.checkedAt) - new Date(a.checkedAt))
      .slice(0, parseInt(limit));

    res.json({
      keyword: keyword.text,
      currentRank: keyword.currentRank,
      previousRank: keyword.previousRank,
      bestRank: keyword.bestRank,
      worstRank: keyword.worstRank,
      lastRankCheck: keyword.lastRankCheck,
      rankHistory
    });

  } catch (error) {
    console.error('Error fetching rank history:', error);
    res.status(500).json({ error: 'Failed to fetch rank history' });
  }
});

module.exports = router;
