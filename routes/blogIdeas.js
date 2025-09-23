const express = require('express');
const router = express.Router();
const BlogIdea = require('../models/BlogIdea');
const auth = require('../middleware/auth');

router.get('/', auth(['owner','employee','client']), async (req, res) => {
  try {
    const { clientId, status = 'idea', limit = 200 } = req.query;
    if (!clientId) return res.status(400).json({ error: 'clientId required' });
    const items = await BlogIdea.find({ clientId }).sort({ priority: -1, createdAt: -1 }).limit(parseInt(limit));
    res.json({ data: items });
  } catch (err) {
    console.error('Error listing blog ideas:', err);
    res.status(500).json({ error: 'Failed to list blog ideas' });
  }
});

router.post('/generate', auth(['owner','employee']), async (req, res) => {
  try {
    const { clientId } = req.body;
    if (!clientId) return res.status(400).json({ error: 'clientId required' });
    const { createQueue } = require('../lib/queues');
    const q = createQueue('blog-ideas:generate');
    const job = await q.add('generate', { clientId });
    res.json({ message: 'Blog idea generation enqueued', jobId: job.id });
  } catch (err) {
    console.warn('Failed to enqueue blog ideas:', err && err.message ? err.message : err);
    res.json({ message: 'Attempted to enqueue; queue may be unavailable' });
  }
});

module.exports = router;
