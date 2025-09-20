// Express API endpoints for task management
const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const auth = require('../middleware/auth');
const { generateTaskContent } = require('../services/contentWorker');

// Create task
router.post('/tasks', auth(['owner', 'employee']), async (req, res) => {
  try {
    const task = new Task(req.body);
    await task.save();
    res.status(201).json(task);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// List tasks by client or assignedTo
router.get('/tasks', auth(), async (req, res) => {
  try {
    const { clientId, assignedTo } = req.query;
    let filter = {};
    if (clientId) filter.clientId = clientId;
    if (assignedTo) filter.assignedTo = assignedTo;
    // RBAC: client sees only their own tasks
    if (req.user.role === 'client') filter.clientId = req.user.clientId;
    const tasks = await Task.find(filter);
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update status/assignment
router.put('/tasks/:id', auth(['owner', 'employee']), async (req, res) => {
  try {
    const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete task
router.delete('/tasks/:id', auth(['owner', 'employee']), async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json({ message: 'Task deleted successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Generate content for task
router.post('/tasks/:id/generate-content', auth(), async (req, res) => {
  try {
    const task = await Task.findById(req.params.id).populate('pageId');
    if (!task) return res.status(404).json({ error: 'Task not found' });
    
    const page = task.pageId;
    if (!page || !page.type) return res.status(400).json({ error: 'Page type not available' });
    
    const content = await generateTaskContent(task.description, page.type);
    task.content = content;
    await task.save();
    
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
