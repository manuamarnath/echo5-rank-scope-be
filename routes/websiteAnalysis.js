const express = require('express');
const router = express.Router();
const Client = require('../models/Client');
const WebsiteAnalyzer = require('../services/websiteAnalyzer');
const auth = require('../middleware/auth');

const analyzer = new WebsiteAnalyzer();

/**
 * @route POST /api/analysis/analyze/:clientId
 * @desc Trigger website analysis for a specific client
 * @access Private
 */
router.post('/analyze/:clientId', auth, async (req, res) => {
  try {
    const { clientId } = req.params;
    const { forceReanalyze = false } = req.body;

    // Find the client
    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    if (!client.website) {
      return res.status(400).json({ error: 'Client website URL is required for analysis' });
    }

    // Check if analysis already exists and is recent (unless forced)
    if (!forceReanalyze && client.websiteAnalysis && client.websiteAnalysis.status === 'completed') {
      const lastAnalysis = new Date(client.websiteAnalysis.analyzedAt);
      const daysSinceAnalysis = (Date.now() - lastAnalysis.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSinceAnalysis < 7) { // Don't re-analyze if done within 7 days
        return res.json({
          message: 'Recent analysis found',
          analysis: client.websiteAnalysis,
          daysSinceAnalysis: Math.round(daysSinceAnalysis)
        });
      }
    }

    // Set analysis status to analyzing
    client.websiteAnalysis = {
      url: client.website,
      analyzedAt: new Date(),
      status: 'analyzing',
      pages: [],
      insights: {},
      recommendations: []
    };
    
    await client.save();

    // Start analysis in background
    setImmediate(async () => {
      try {
        console.log(`Starting website analysis for client: ${client.name}`);
        
        const analysisResult = await analyzer.analyzeWebsite(client.website, {
          name: client.name,
          services: client.services,
          address: client.address,
          contentData: client.contentData
        });

        // Update client with analysis results
        await Client.findByIdAndUpdate(clientId, {
          websiteAnalysis: analysisResult
        });

        console.log(`Website analysis completed for client: ${client.name}`);
        
      } catch (error) {
        console.error(`Website analysis failed for client ${client.name}:`, error);
        
        // Update client with error status
        await Client.findByIdAndUpdate(clientId, {
          'websiteAnalysis.status': 'failed',
          'websiteAnalysis.error': error.message
        });
      }
    });

    res.json({
      message: 'Website analysis started',
      clientId: clientId,
      status: 'analyzing',
      estimatedTime: '2-3 minutes'
    });

  } catch (error) {
    console.error('Error starting website analysis:', error);
    res.status(500).json({ error: 'Failed to start website analysis' });
  }
});

/**
 * @route GET /api/analysis/status/:clientId
 * @desc Get website analysis status and results for a client
 * @access Private
 */
router.get('/status/:clientId', auth, async (req, res) => {
  try {
    const { clientId } = req.params;

    const client = await Client.findById(clientId).select('name website websiteAnalysis');
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    if (!client.websiteAnalysis) {
      return res.json({
        clientId: clientId,
        clientName: client.name,
        website: client.website,
        status: 'not_analyzed',
        message: 'No analysis found for this client'
      });
    }

    res.json({
      clientId: clientId,
      clientName: client.name,
      website: client.website,
      analysis: client.websiteAnalysis
    });

  } catch (error) {
    console.error('Error getting analysis status:', error);
    res.status(500).json({ error: 'Failed to get analysis status' });
  }
});

/**
 * @route GET /api/analysis/insights/:clientId
 * @desc Get detailed insights from website analysis
 * @access Private
 */
router.get('/insights/:clientId', auth, async (req, res) => {
  try {
    const { clientId } = req.params;

    const client = await Client.findById(clientId).select('name websiteAnalysis');
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    if (!client.websiteAnalysis || client.websiteAnalysis.status !== 'completed') {
      return res.status(400).json({ 
        error: 'Website analysis not completed',
        status: client.websiteAnalysis?.status || 'not_analyzed'
      });
    }

    const { insights, recommendations } = client.websiteAnalysis;

    res.json({
      clientName: client.name,
      analyzedAt: client.websiteAnalysis.analyzedAt,
      insights: insights,
      recommendations: recommendations,
      summary: {
        totalPages: client.websiteAnalysis.pages?.length || 0,
        highPriorityRecommendations: recommendations?.filter(r => r.priority === 'high').length || 0,
        seoIssues: (insights?.seo?.titleOptimization?.issues?.length || 0) + 
                   (insights?.seo?.metaDescriptions?.issues?.length || 0) +
                   (insights?.seo?.headingStructure?.issues?.length || 0),
        contentGaps: insights?.seo?.contentGaps?.length || 0,
        missingPages: insights?.opportunities?.missingPages?.length || 0
      }
    });

  } catch (error) {
    console.error('Error getting analysis insights:', error);
    res.status(500).json({ error: 'Failed to get analysis insights' });
  }
});

/**
 * @route POST /api/analysis/recommendation/:clientId/:recommendationIndex/complete
 * @desc Mark a recommendation as completed
 * @access Private
 */
router.post('/recommendation/:clientId/:recommendationIndex/complete', auth, async (req, res) => {
  try {
    const { clientId, recommendationIndex } = req.params;

    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    if (!client.websiteAnalysis || !client.websiteAnalysis.recommendations) {
      return res.status(400).json({ error: 'No recommendations found' });
    }

    const index = parseInt(recommendationIndex);
    if (index < 0 || index >= client.websiteAnalysis.recommendations.length) {
      return res.status(400).json({ error: 'Invalid recommendation index' });
    }

    client.websiteAnalysis.recommendations[index].completed = true;
    await client.save();

    res.json({
      message: 'Recommendation marked as completed',
      recommendation: client.websiteAnalysis.recommendations[index]
    });

  } catch (error) {
    console.error('Error completing recommendation:', error);
    res.status(500).json({ error: 'Failed to complete recommendation' });
  }
});

/**
 * @route GET /api/analysis/list
 * @desc Get list of all clients with their analysis status
 * @access Private
 */
router.get('/list', auth, async (req, res) => {
  try {
    const clients = await Client.find({})
      .select('name website websiteAnalysis.status websiteAnalysis.analyzedAt')
      .sort({ 'websiteAnalysis.analyzedAt': -1 });

    const clientList = clients.map(client => ({
      id: client._id,
      name: client.name,
      website: client.website,
      analysisStatus: client.websiteAnalysis?.status || 'not_analyzed',
      lastAnalyzed: client.websiteAnalysis?.analyzedAt || null,
      needsAnalysis: !client.websiteAnalysis || client.websiteAnalysis.status === 'failed' ||
                     (client.websiteAnalysis.analyzedAt && 
                      (Date.now() - new Date(client.websiteAnalysis.analyzedAt).getTime()) > (7 * 24 * 60 * 60 * 1000))
    }));

    res.json({
      clients: clientList,
      summary: {
        total: clientList.length,
        analyzed: clientList.filter(c => c.analysisStatus === 'completed').length,
        analyzing: clientList.filter(c => c.analysisStatus === 'analyzing').length,
        failed: clientList.filter(c => c.analysisStatus === 'failed').length,
        needsAnalysis: clientList.filter(c => c.needsAnalysis).length
      }
    });

  } catch (error) {
    console.error('Error getting client analysis list:', error);
    res.status(500).json({ error: 'Failed to get client analysis list' });
  }
});

/**
 * @route DELETE /api/analysis/:clientId
 * @desc Delete website analysis for a client (to force fresh analysis)
 * @access Private
 */
router.delete('/:clientId', auth, async (req, res) => {
  try {
    const { clientId } = req.params;

    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    client.websiteAnalysis = undefined;
    await client.save();

    res.json({
      message: 'Website analysis deleted successfully',
      clientId: clientId
    });

  } catch (error) {
    console.error('Error deleting website analysis:', error);
    res.status(500).json({ error: 'Failed to delete website analysis' });
  }
});

module.exports = router;