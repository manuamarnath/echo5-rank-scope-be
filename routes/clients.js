const express = require('express');
const router = express.Router();
const axios = require('axios');
const Client = require('../models/Client');
const Keyword = require('../models/Keyword');
const auth = require('../middleware/auth');





// GET /clients - list clients (owner/employee only)
router.get('/', auth(['owner', 'employee']), async (req, res) => {
  try {
    // Owner/employee: see all, client: see only their own
    let filter = {};
    if (req.user.role === 'client') {
      filter._id = req.user.clientId;
    }
    const clients = await Client.find(filter);
    res.json(clients);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /clients/pagespeed - batch PageSpeed Insights for accessible clients
// Query: strategy (mobile|desktop, default mobile), category (default performance), clientId (optional filter), limit (optional)
router.get('/pagespeed', auth(['owner', 'employee', 'client']), async (req, res) => {
  try {
    const { strategy = 'mobile', category = 'performance', clientId, limit } = req.query;

    // Visibility filter
    const filter = {};
    if (req.user.role === 'client') {
      filter._id = req.user.clientId;
    }
    if (clientId) {
      filter._id = clientId;
    }

    const max = limit ? Math.max(1, parseInt(limit, 10)) : undefined;
    const clients = await Client.find(filter).select('name website').limit(max || 0);

    const normalizeUrl = (site) => {
      if (!site) return null;
      let u = site.trim();
      if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
      try {
        const parsed = new URL(u);
        return parsed.origin;
      } catch (e) {
        return null;
      }
    };

    const API = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
    const results = [];

    for (const c of clients) {
      const site = normalizeUrl(c.website);
      if (!site) {
        results.push({ clientId: c._id, clientName: c.name, website: c.website || '', error: 'Invalid or missing website URL' });
        continue;
      }

      const params = new URLSearchParams({
        url: site,
        strategy: Array.isArray(strategy) ? strategy[0] : String(strategy),
        category: Array.isArray(category) ? category[0] : String(category),
      });
      if (process.env.PSI_API_KEY) params.append('key', process.env.PSI_API_KEY);

      try {
        const target = `${API}?${params.toString()}`;
        const resp = await axios.get(target, { timeout: 30000 });
        const data = resp.data || {};
        const lh = data.lighthouseResult || {};
        const audits = lh.audits || {};
        const metrics = {
          url: data.id || site,
          strategy: Array.isArray(strategy) ? strategy[0] : String(strategy),
          performanceScore: Math.round(((lh.categories?.performance?.score || 0) * 100)),
          firstContentfulPaint: audits['first-contentful-paint']?.numericValue || null,
          largestContentfulPaint: audits['largest-contentful-paint']?.numericValue || null,
          cumulativeLayoutShift: audits['cumulative-layout-shift']?.numericValue || null,
          totalBlockingTime: audits['total-blocking-time']?.numericValue || null,
          speedIndex: audits['speed-index']?.numericValue || null,
          timeToInteractive: audits['interactive']?.numericValue || null,
          fetchedAt: lh.fetchTime || new Date().toISOString(),
        };
        results.push({ clientId: c._id, clientName: c.name, website: site, metrics });
      } catch (err) {
        const status = err.response?.status;
        const message = err.response?.data?.error?.message || err.message || 'PSI request failed';
        results.push({ clientId: c._id, clientName: c.name, website: site, error: { status, message } });
      }

      // courtesy delay
      await new Promise(r => setTimeout(r, 300));
    }

    res.json({ count: results.length, results });
  } catch (error) {
    console.error('Batch PageSpeed error:', error);
    res.status(500).json({ error: 'Failed to fetch PageSpeed metrics for clients' });
  }
});

// GET /clients/demo - list clients without auth (development only)
router.get('/demo', async (req, res) => {
  try {
    const clients = await Client.find({});
    res.json(clients);
  } catch (err) {
    console.error('Error fetching demo clients:', err);
    res.status(400).json({ error: err.message });
  }
});

// POST /clients - create client (owner only)
router.post('/', auth(['owner']), async (req, res) => {
  try {
    const clientData = req.body;
    
    // Create the client first
    const client = new Client(clientData);
    await client.save();
    
    // Process and create keyword records from onboarding data
    await processOnboardingKeywords(client);
    
    res.status(201).json(client);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /clients/demo - create client without auth (development only)
router.post('/demo', async (req, res) => {
  try {
    console.log('Creating demo client with data:', req.body);
    const clientData = req.body;
    
    // Create the client first
    const client = new Client(clientData);
    await client.save();
    
    console.log('Client saved successfully:', client._id);
    
    // Process and create keyword records from onboarding data
    await processOnboardingKeywords(client);
    
    res.status(201).json(client);
  } catch (err) {
    console.error('Error creating demo client:', err);
    res.status(400).json({ error: err.message });
  }
});

// Helper function to process onboarding keywords
async function processOnboardingKeywords(client) {
  const keywordsToCreate = [];
  console.log('processOnboardingKeywords called for client:', client._id, client.name);
  console.log('Primary keywords:', client.primaryKeywords);
  console.log('Seed keywords:', client.seedKeywords);

  // Process primary keywords
  if (client.primaryKeywords && client.primaryKeywords.length > 0) {
    for (const primaryKeyword of client.primaryKeywords) {
      keywordsToCreate.push({
        clientId: client._id,
        text: primaryKeyword.keyword?.trim().toLowerCase(),
        intent: 'transactional', // Default for primary keywords
        geo: primaryKeyword.targetLocation || null,
        volume: null,
        difficulty: null,
        allocatedTo: null,
        serviceMatch: null,
        pageId: null,
        role: 'primary',
        isPrimary: true,
        priority: primaryKeyword.priority || 5,
        targetLocation: primaryKeyword.targetLocation || null,
        notes: primaryKeyword.notes || null
      });
    }
  }

  // Process seed keywords
  if (client.seedKeywords && client.seedKeywords.length > 0) {
    for (const seedKeyword of client.seedKeywords) {
      // Skip if already exists as primary keyword
      const isDuplicate = keywordsToCreate.some(k => 
        k.text === seedKeyword.keyword?.trim().toLowerCase()
      );

      if (!isDuplicate) {
        keywordsToCreate.push({
          clientId: client._id,
          text: seedKeyword.keyword?.trim().toLowerCase(),
          intent: seedKeyword.intent || 'informational',
          geo: null,
          volume: seedKeyword.searchVolume || null,
          difficulty: seedKeyword.difficulty || null,
          allocatedTo: null,
          serviceMatch: null,
          pageId: null,
          role: null,
          isPrimary: false,
          priority: null,
          targetLocation: null,
          notes: `Imported from ${seedKeyword.source || 'onboarding'}`
        });
      }
    }
  }

  console.log('Prepared keywords to create:', keywordsToCreate);

  // Bulk create keywords if any exist
  if (keywordsToCreate.length > 0) {
    try {
      await Keyword.insertMany(keywordsToCreate);
      console.log(`Created ${keywordsToCreate.length} keywords for client ${client.name}`);
    } catch (error) {
      console.error('Error creating keywords for client:', error);
    }
  } else {
    console.log('No keywords to create for client:', client._id);
  }
}



// GET /clients/:id - get client by id (auth required, client can only access their own)
router.get('/:id', auth(), async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ error: 'Client not found' });
    if (req.user.role === 'client' && String(client._id) !== String(req.user.clientId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json(client);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /clients/:id - update client (owner only)
router.put('/:id', auth(['owner']), async (req, res) => {
  try {
    const client = await Client.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!client) return res.status(404).json({ error: 'Client not found' });
    res.json(client);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /clients/demo/:id - update client without auth (development only)
router.put('/demo/:id', async (req, res) => {
  try {
    console.log('Updating demo client:', req.params.id, 'with data:', req.body);
    const client = await Client.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!client) return res.status(404).json({ error: 'Client not found' });
    res.json(client);
  } catch (err) {
    console.error('Error updating demo client:', err);
    res.status(400).json({ error: err.message });
  }
});

// DELETE /clients/:id - delete client (owner only)
router.delete('/:id', auth(['owner']), async (req, res) => {
  try {
    const client = await Client.findByIdAndDelete(req.params.id);
    if (!client) return res.status(404).json({ error: 'Client not found' });
    res.json({ message: 'Client deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /clients/demo/:id - delete client without auth (development only)
router.delete('/demo/:id', async (req, res) => {
  try {
    console.log('Deleting demo client:', req.params.id);
    const client = await Client.findByIdAndDelete(req.params.id);
    if (!client) return res.status(404).json({ error: 'Client not found' });
    res.json({ message: 'Client deleted' });
  } catch (err) {
    console.error('Error deleting demo client:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
