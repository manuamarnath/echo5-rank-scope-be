const express = require('express');
const router = express.Router();

const Brief = require('../models/Brief');
const authMiddleware = require('../middleware/auth');

// GET all briefs
router.get('/', authMiddleware(), async (req, res) => {
  try {
    const briefs = await Brief.find().populate('clientId pageId createdBy').sort({ createdAt: -1 });
    res.json(briefs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET a single brief
router.get('/:id', authMiddleware(), async (req, res) => {
  try {
    const brief = await Brief.findById(req.params.id).populate('clientId pageId createdBy');
    if (!brief) {
      return res.status(404).json({ message: 'Brief not found' });
    }
    res.json(brief);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// CREATE a new brief
router.post('/', authMiddleware(['admin', 'manager']), async (req, res) => {
  try {
    const newBrief = new Brief({
      clientId: req.body.clientId,
      pageId: req.body.pageId,
      outline: req.body.outline,
      entities: req.body.entities,
      faqs: req.body.faqs,
      internalLinks: req.body.internalLinks,
      createdBy: req.user.id
    });
    const savedBrief = await newBrief.save();
    res.status(201).json(savedBrief);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// UPDATE a brief
router.put('/:id', authMiddleware(['admin', 'manager']), async (req, res) => {
  try {
    const updatedBrief = await Brief.findByIdAndUpdate(
      req.params.id,
      {
        outline: req.body.outline,
        entities: req.body.entities,
        faqs: req.body.faqs,
        internalLinks: req.body.internalLinks
      },
      { new: true }
    ).populate('clientId pageId createdBy');
    if (!updatedBrief) {
      return res.status(404).json({ message: 'Brief not found' });
    }
    res.json(updatedBrief);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE a brief
router.delete('/:id', authMiddleware(['admin']), async (req, res) => {
  try {
    const deletedBrief = await Brief.findByIdAndDelete(req.params.id);
    if (!deletedBrief) {
      return res.status(404).json({ message: 'Brief not found' });
    }
    res.json({ message: 'Brief deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
