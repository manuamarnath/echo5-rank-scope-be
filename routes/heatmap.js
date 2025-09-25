// Express API endpoints for keyword heatmap and manual override
const express = require('express');
const router = express.Router();
const Keyword = require('../models/Keyword');
const Page = require('../models/Page');

// Create page from unmapped keyword
router.post('/pages/from-keyword/:keywordId', async (req, res) => {
  try {
    const keyword = await Keyword.findById(req.params.keywordId);
    if (!keyword) return res.status(404).json({ error: 'Keyword not found' });
    const page = new Page({
      clientId: keyword.clientId,
      type: 'service', // or infer from keyword
      title: keyword.text,
      slug: keyword.text.replace(/\s+/g, '-').toLowerCase(),
      primaryKeywordId: keyword._id,
      status: 'draft',
    });
    await page.save();
    keyword.pageId = page._id;
    keyword.role = 'primary';
    await keyword.save();
    res.json({ page, keyword });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fix cannibalization (only 1 primary per page)
router.post('/pages/:pageId/fix-cannibalization', async (req, res) => {
  try {
    const { pageId } = req.params;
    const keywords = await Keyword.find({ pageId, role: 'primary' });
    if (keywords.length > 1) {
      // Keep first as primary, others as secondary
      for (let i = 1; i < keywords.length; i++) {
        keywords[i].role = 'secondary';
        await keywords[i].save();
      }
    }
    res.json({ fixed: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Inline edit secondary keywords
router.put('/keywords/:keywordId/role', async (req, res) => {
  try {
    const { keywordId } = req.params;
    const { role } = req.body;
    const keyword = await Keyword.findById(keywordId);
    if (!keyword) return res.status(404).json({ error: 'Keyword not found' });
    keyword.role = role;
    await keyword.save();
    res.json({ keyword });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Auto-link keywords to page and vice versa
router.post('/keywords/:keywordId/link-page/:pageId', async (req, res) => {
  try {
    const { keywordId, pageId } = req.params;
    const keyword = await Keyword.findById(keywordId);
    const page = await Page.findById(pageId);
    if (!keyword || !page) return res.status(404).json({ error: 'Not found' });
    keyword.pageId = page._id;
    await keyword.save();
    // Optionally update page's secondaryKeywordIds
    if (!page.secondaryKeywordIds.includes(keyword._id)) {
      page.secondaryKeywordIds.push(keyword._id);
      await page.save();
    }
    res.json({ keyword, page });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

// --- Heatmap: Coverage summary per page ---
router.get('/coverage', async (req, res) => {
  try {
    const { clientId, intent, geo } = req.query;
    if (!clientId) return res.status(400).json({ error: 'clientId required' });

    const keywordMatch = { clientId };
    if (intent) keywordMatch.intent = intent;
    if (geo) keywordMatch.geo = geo;

    // Aggregate keyword counts by page and role
    const byPage = await Keyword.aggregate([
      { $match: keywordMatch },
      { $group: { _id: { pageId: '$pageId', role: '$role' }, count: { $sum: 1 }, currentAvg: { $avg: '$currentRank' }, bestAvg: { $avg: '$bestRank' } } },
    ]);

    const pages = await Page.find({ clientId }).lean();
    const out = pages.map(p => ({
      pageId: p._id,
      title: p.title,
      slug: p.slug,
      type: p.type,
      status: p.status,
      counts: { primary: 0, secondary: 0, supporting: 0 },
      rankHealth: { currentAvg: null, bestAvg: null }
    }));
    const idx = new Map(out.map(x => [String(x.pageId), x]));

    for (const row of byPage) {
      const key = String(row._id.pageId || 'null');
      if (!idx.has(key)) continue;
      const bucket = idx.get(key);
      if (row._id.role === 'primary') bucket.counts.primary += row.count;
      if (row._id.role === 'secondary') bucket.counts.secondary += row.count;
      if (row._id.role === 'supporting') bucket.counts.supporting += row.count;
      // rank averages per page (coarse)
      const vals = bucket.rankHealth;
      // Use the lowest (best) of primary/secondary/supporting averages as a simple proxy
      const candidates = [vals.currentAvg, row.currentAvg].filter(v => v != null);
      bucket.rankHealth.currentAvg = candidates.length ? Math.min(...candidates) : row.currentAvg ?? null;
      const bestCandidates = [vals.bestAvg, row.bestAvg].filter(v => v != null);
      bucket.rankHealth.bestAvg = bestCandidates.length ? Math.min(...bestCandidates) : row.bestAvg ?? null;
    }

    const totals = out.reduce((acc, p) => {
      acc.primary += p.counts.primary; acc.secondary += p.counts.secondary; acc.supporting += p.counts.supporting; return acc;
    }, { primary: 0, secondary: 0, supporting: 0 });

    res.json({ pages: out, totals });
  } catch (err) {
    console.error('Error building heatmap coverage:', err);
    res.status(500).json({ error: 'Failed to build coverage' });
  }
});

// --- Heatmap: Gaps (unmapped keywords, pages without a primary) ---
router.get('/gaps', async (req, res) => {
  try {
    const { clientId, intent, geo } = req.query;
    if (!clientId) return res.status(400).json({ error: 'clientId required' });
    const kwMatch = { clientId, $or: [ { pageId: null }, { pageId: { $exists: false } } ] };
    if (intent) kwMatch.intent = intent;
    if (geo) kwMatch.geo = geo;
    const unmappedKeywords = await Keyword.find(kwMatch).sort({ createdAt: -1 }).limit(500).lean();
    const pages = await Page.find({ clientId }).lean();
    const pageIdsWithPrimary = new Set((await Keyword.find({ clientId, role: 'primary', pageId: { $ne: null } }).select('pageId')).map(k => String(k.pageId)));
    const pagesWithoutPrimary = pages.filter(p => !pageIdsWithPrimary.has(String(p._id)));
    res.json({ unmappedKeywords, pagesWithoutPrimary });
  } catch (err) {
    console.error('Error computing gaps:', err);
    res.status(500).json({ error: 'Failed to compute gaps' });
  }
});

// --- Heatmap: Trends (simple rank trend per page) ---
router.get('/trends', async (req, res) => {
  try {
    const { clientId, window = '30d' } = req.query;
    if (!clientId) return res.status(400).json({ error: 'clientId required' });
    const now = new Date();
    const days = typeof window === 'string' && window.endsWith('d') ? parseInt(window) : 30;
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    // Pull keywords with history for client
    const keywords = await Keyword.find({ clientId, pageId: { $ne: null } }).select('pageId rankHistory').lean();
    const byPage = new Map();
    for (const k of keywords) {
      const pid = String(k.pageId);
      const hist = (k.rankHistory || []).filter(h => new Date(h.checkedAt) >= since);
      if (!byPage.has(pid)) byPage.set(pid, []);
      byPage.get(pid).push(...hist);
    }
    const trendOut = [];
    for (const [pid, hist] of byPage.entries()) {
      // Bucket by day and average positions
      const buckets = new Map();
      for (const h of hist) {
        const d = new Date(h.checkedAt); d.setHours(0,0,0,0);
        const key = d.toISOString();
        if (!buckets.has(key)) buckets.set(key, []);
        if (typeof h.position === 'number') buckets.get(key).push(h.position);
      }
      const series = Array.from(buckets.entries()).sort((a,b)=>a[0].localeCompare(b[0])).map(([date, arr]) => ({ date, avgRank: arr.length ? arr.reduce((s,x)=>s+x,0)/arr.length : null }));
      trendOut.push({ pageId: pid, trend: series });
    }
    res.json({ pages: trendOut });
  } catch (err) {
    console.error('Error computing trends:', err);
    res.status(500).json({ error: 'Failed to compute trends' });
  }
});
