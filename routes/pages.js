const express = require('express');
const router = express.Router();

const Page = require('../models/Page');

// GET all pages
router.get('/', async (req, res) => {
  try {
    const pages = await Page.find().sort({ createdAt: -1 });
    res.json(pages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET a single page
router.get('/:id', async (req, res) => {
  try {
    const page = await Page.findById(req.params.id);
    if (!page) {
      return res.status(404).json({ message: 'Page not found' });
    }
    res.json(page);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// CREATE a new page
router.post('/', async (req, res) => {
  const page = new Page({
    title: req.body.title,
    content: req.body.content,
    // Add other fields as per model
  });
  try {
    const newPage = await page.save();
    res.status(201).json(newPage);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// UPDATE a page
router.put('/:id', async (req, res) => {
  try {
    const allowed = ['title','slug','type','status','rankEnrollment','primaryKeywordId','secondaryKeywordIds'];
    const update = {};
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) update[key] = req.body[key];
    }
    const updatedPage = await Page.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true }
    );
    if (!updatedPage) {
      return res.status(404).json({ message: 'Page not found' });
    }
    res.json(updatedPage);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE a page
router.delete('/:id', async (req, res) => {
  try {
    const deletedPage = await Page.findByIdAndDelete(req.params.id);
    if (!deletedPage) {
      return res.status(404).json({ message: 'Page not found' });
    }
    res.json({ message: 'Page deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
