const express = require('express');
const router = express.Router();
const Client = require('../models/Client');
const Keyword = require('../models/Keyword');
const auth = require('../middleware/auth');

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

// GET /clients/demo - list clients without auth (development only)
router.get('/demo', async (req, res) => {
  try {
    const clients = await Client.find({});
    console.log(`Found ${clients.length} clients`);
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
  
  // Process primary keywords
  if (client.primaryKeywords && client.primaryKeywords.length > 0) {
    for (const primaryKeyword of client.primaryKeywords) {
      keywordsToCreate.push({
        clientId: client._id,
        text: primaryKeyword.keyword.trim().toLowerCase(),
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
        k.text === seedKeyword.keyword.trim().toLowerCase()
      );
      
      if (!isDuplicate) {
        keywordsToCreate.push({
          clientId: client._id,
          text: seedKeyword.keyword.trim().toLowerCase(),
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
  
  // Bulk create keywords if any exist
  if (keywordsToCreate.length > 0) {
    try {
      await Keyword.insertMany(keywordsToCreate);
      console.log(`Created ${keywordsToCreate.length} keywords for client ${client.name}`);
    } catch (error) {
      console.error('Error creating keywords for client:', error);
    }
  }
}

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
    res.status(500).json({ error: err.message });
  }
});

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

module.exports = router;
