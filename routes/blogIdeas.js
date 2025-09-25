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

// Create blog ideas from selected keywords
router.post('/plan-from-keywords', auth(['owner','employee']), async (req, res) => {
  try {
    const { clientId, keywordIds = [], titleTemplate } = req.body;
    if (!clientId) return res.status(400).json({ error: 'clientId required' });
    if (!Array.isArray(keywordIds) || keywordIds.length === 0) return res.status(400).json({ error: 'keywordIds required' });

    const Keyword = require('../models/Keyword');
    const kws = await Keyword.find({ _id: { $in: keywordIds }, clientId }).lean();
    if (kws.length === 0) return res.status(404).json({ error: 'No keywords found' });

    // Build titles using simple heuristic or template
    const buildTitle = (text) => {
      if (titleTemplate && typeof titleTemplate === 'string') {
        return titleTemplate.replace(/\{keyword\}/g, text);
      }
      // Default: Capitalize and add value angle
      const cap = text.charAt(0).toUpperCase() + text.slice(1);
      return `${cap}: Tips, Use Cases, and FAQs`;
    };

    // Dedupe by (clientId, title) at application level
    const titles = kws.map(k => buildTitle(k.text));
    const existing = await BlogIdea.find({ clientId, title: { $in: titles } }).select('title').lean();
    const existingSet = new Set(existing.map(e => e.title));

    const toCreate = [];
    for (const k of kws) {
      const title = buildTitle(k.text);
      if (existingSet.has(title)) continue;
      toCreate.push({ clientId, title, keywords: [k.text], status: 'idea' });
    }

    if (toCreate.length === 0) {
      return res.status(200).json({ message: 'No new ideas to create', data: [] });
    }

    const created = await BlogIdea.insertMany(toCreate);
    res.status(201).json({ data: created });
  } catch (err) {
    console.error('Error planning ideas from keywords:', err);
    res.status(500).json({ error: 'Failed to plan ideas' });
  }
});
