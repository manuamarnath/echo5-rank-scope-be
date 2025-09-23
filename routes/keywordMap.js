const express = require('express');
const router = express.Router();
const KeywordMap = require('../models/KeywordMap');
const auth = require('../middleware/auth');

// List suggestions for client
router.get('/', auth(['owner','employee','client']), async (req, res) => {
  try {
    const { clientId, status = 'pending', limit = 200 } = req.query;
    if (!clientId) return res.status(400).json({ error: 'clientId required' });
    const items = await KeywordMap.find({ clientId, status }).sort({ score: -1, createdAt: -1 }).limit(parseInt(limit));
    res.json({ data: items });
  } catch (err) {
    console.error('Error listing keyword suggestions:', err);
    res.status(500).json({ error: 'Failed to list suggestions' });
  }
});

// Enqueue generation of suggestions
router.post('/generate', auth(['owner','employee']), async (req, res) => {
  try {
    const { clientId } = req.body;
    if (!clientId) return res.status(400).json({ error: 'clientId required' });
    const { createQueue } = require('../lib/queues');
    const q = createQueue('keyword-suggestions:generate');
    const job = await q.add('generate', { clientId });
    res.json({ message: 'Keyword suggestion generation enqueued', jobId: job.id });
  } catch (err) {
    console.warn('Failed to enqueue keyword suggestions:', err && err.message ? err.message : err);
    res.json({ message: 'Attempted to enqueue; queue may be unavailable' });
  }
});

// Accept a suggestion (mark as accepted and optionally create Keyword)
router.post('/:id/accept', auth(['owner','employee']), async (req, res) => {
  try {
    const { id } = req.params;
    const suggestion = await KeywordMap.findById(id);
    if (!suggestion) return res.status(404).json({ error: 'Not found' });
    if (suggestion.status !== 'pending') return res.status(400).json({ error: 'Already processed' });
    suggestion.status = 'accepted';
    await suggestion.save();

    // Create a Keyword record if desired
    const Keyword = require('../models/Keyword');
    const k = new Keyword({ clientId: suggestion.clientId, text: suggestion.text, intent: suggestion.intent, geo: suggestion.geo });
    await k.save();

    res.json({ message: 'Accepted', keywordId: k._id });
  } catch (err) {
    console.error('Error accepting suggestion:', err);
    res.status(500).json({ error: 'Failed to accept suggestion' });
  }
});

// Dismiss
router.post('/:id/dismiss', auth(['owner','employee']), async (req, res) => {
  try {
    const { id } = req.params;
    const suggestion = await KeywordMap.findById(id);
    if (!suggestion) return res.status(404).json({ error: 'Not found' });
    suggestion.status = 'dismissed';
    await suggestion.save();
    res.json({ message: 'Dismissed' });
  } catch (err) {
    console.error('Error dismissing suggestion:', err);
    res.status(500).json({ error: 'Failed to dismiss suggestion' });
  }
});

module.exports = router;
