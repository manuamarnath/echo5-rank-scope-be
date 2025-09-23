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
