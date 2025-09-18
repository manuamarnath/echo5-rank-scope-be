const express = require('express');
const router = express.Router();
const Client = require('../models/Client');
const auth = require('../middleware/auth');

// POST /clients - create client (owner only)
router.post('/', auth(['owner']), async (req, res) => {
  try {
    const client = new Client(req.body);
    await client.save();
    res.status(201).json(client);
  } catch (err) {
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
