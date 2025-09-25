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
    const { role = null, acceptedBy = 'user' } = req.body || {};
    const suggestion = await KeywordMap.findById(id);
    if (!suggestion) return res.status(404).json({ error: 'Not found' });
    if (suggestion.status !== 'pending') return res.status(400).json({ error: 'Already processed' });
    suggestion.status = 'accepted';
    if (role) suggestion.role = role;
    suggestion.acceptedBy = acceptedBy;
    await suggestion.save();

    // Create a Keyword record if desired
    const Keyword = require('../models/Keyword');
    const k = new Keyword({ clientId: suggestion.clientId, text: suggestion.text, intent: suggestion.intent, geo: suggestion.geo, role: role === 'primary' ? 'secondary' : 'supporting' });
    await k.save();

    res.json({ message: 'Accepted', keywordId: k._id });
  } catch (err) {
    console.error('Error accepting suggestion:', err);
    res.status(500).json({ error: 'Failed to accept suggestion' });
  }
});

// Generate supporting variations for a page's primary keyword (simple heuristic)
router.post('/generate-supporting', auth(['owner','employee']), async (req, res) => {
  try {
    const { clientId, pageId, count = 8 } = req.body;
    if (!clientId || !pageId) return res.status(400).json({ error: 'clientId and pageId required' });
    const Keyword = require('../models/Keyword');
    const Page = require('../models/Page');
    const page = await Page.findById(pageId).lean();
    if (!page) return res.status(404).json({ error: 'Page not found' });
    const primary = await Keyword.findOne({ clientId, pageId, role: 'primary' }).lean();
    if (!primary) return res.status(400).json({ error: 'No primary keyword on page' });
    const base = primary.text;
    const variants = ['guide','tips','best','vs','pricing','cost','checklist','template','examples','benefits','mistakes','how to'].slice(0, Math.max(5, Math.min(12, count)));
    const docs = [];
    for (const v of variants) {
      docs.push({ clientId, pageId, text: `${base} ${v}`, intent: 'informational', score: 10, source: 'supporting:heuristic', role: 'supporting', acceptedBy: 'ai' });
    }
    // Deduplicate against existing suggestions
    const toInsert = [];
    for (const d of docs) {
      const exists = await KeywordMap.findOne({ clientId, pageId, text: d.text });
      if (!exists) toInsert.push(d);
    }
    if (toInsert.length) await KeywordMap.insertMany(toInsert);
    res.json({ created: toInsert.length });
  } catch (err) {
    console.error('generate-supporting error:', err);
    res.status(500).json({ error: 'Failed to generate supporting suggestions' });
  }
});

// Generate localized variants for a page
router.post('/generate-localized', auth(['owner','employee']), async (req, res) => {
  try {
    const { clientId, pageId, locations = [], count = 8 } = req.body;
    if (!clientId || !pageId) return res.status(400).json({ error: 'clientId and pageId required' });
    const Keyword = require('../models/Keyword');
    const Page = require('../models/Page');
    const primary = await Keyword.findOne({ clientId, pageId, role: 'primary' }).lean();
    if (!primary) return res.status(400).json({ error: 'No primary keyword on page' });
    const locs = Array.isArray(locations) && locations.length ? locations : ['near me','[city]','[zip]'];
    const docs = [];
    for (const l of locs.slice(0, Math.max(5, Math.min(12, count))) ) {
      docs.push({ clientId, pageId, text: `${primary.text} ${l}`, intent: 'local', score: 12, source: 'localized:heuristic', role: 'localized', acceptedBy: 'ai' });
    }
    const toInsert = [];
    for (const d of docs) {
      const exists = await KeywordMap.findOne({ clientId, pageId, text: d.text });
      if (!exists) toInsert.push(d);
    }
    if (toInsert.length) await KeywordMap.insertMany(toInsert);
    res.json({ created: toInsert.length });
  } catch (err) {
    console.error('generate-localized error:', err);
    res.status(500).json({ error: 'Failed to generate localized suggestions' });
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
