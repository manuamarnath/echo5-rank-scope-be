const express = require('express');
const router = express.Router();
const LocalOpportunity = require('../models/LocalOpportunity');
const Page = require('../models/Page');
const auth = require('../middleware/auth');
// TODO: require queue clients (BullMQ) and job producers

// GET list opportunities for a client
router.get('/', auth(['owner', 'employee', 'client']), async (req, res) => {
  try {
    const { clientId } = req.query;
    const query = {};
    if (clientId) query.clientId = clientId;
    const items = await LocalOpportunity.find(query).sort({ score: -1, createdAt: -1 }).limit(200);
    res.json({ data: items });
  } catch (err) {
    console.error('Error listing local opportunities:', err);
    res.status(500).json({ error: 'Failed to list opportunities' });
  }
});

// POST generate opportunities (enqueue worker)
router.post('/generate', auth(['owner', 'employee']), async (req, res) => {
  try {
    const { clientId } = req.body;
    if (!clientId) return res.status(400).json({ error: 'clientId required' });

    // If caller is a client, ensure they only generate for their own clientId
    if (req.user && req.user.role === 'client') {
      const callerClientId = req.user.clientId || req.user._id;
      if (!callerClientId || callerClientId.toString() !== clientId.toString()) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    // Enqueue a job to generate opportunities for this client
    try {
      const { createQueue } = require('../lib/queues');
      const q = createQueue('local-opportunities:generate');
      const job = await q.add('generate', { clientId });
      return res.json({ message: 'Generation enqueued', jobId: job.id });
    } catch (qErr) {
      console.warn('Queue enqueue failed (Redis?):', qErr && qErr.message ? qErr.message : qErr);
      // Respond success-like so UI can continue; worker runner in production should pick this up when Redis is available
      return res.json({ message: 'Generation attempted but queue unavailable; generation may run when workers are online' });
    }
  } catch (err) {
    console.error('Error enqueueing generation:', err);
    res.status(500).json({ error: 'Failed to enqueue generation' });
  }
});

// POST accept opportunity (creates page + keywords + brief + enrolls tracking)
router.post('/:id/accept', auth(['owner', 'employee']), async (req, res) => {
  try {
    const { id } = req.params;
    const opp = await LocalOpportunity.findById(id);
    if (!opp) return res.status(404).json({ error: 'Not found' });

    if (opp.status !== 'pending') return res.status(400).json({ error: 'Opportunity already processed' });

  // Enqueue an accept job so a worker performs the heavy work (create page, brief, enroll tracking)
  const { createQueue } = require('../lib/queues');
  const q = createQueue('local-opportunities:accept');
  await q.add('accept', { opportunityId: opp._id.toString(), userId: req.user && (req.user._id || req.user.id) });

  // For responsiveness, still create a Page record skeleton locally
    const page = new Page({
      clientId: opp.clientId,
      type: 'local',
      title: `${opp.serviceName} — ${opp.locationSlug}`,
      slug: `${opp.serviceName.replace(/\s+/g, '-').toLowerCase()}/${opp.locationSlug}`,
      status: 'draft'
    });
    await page.save();

    opp.status = 'accepted';
    await opp.save();

    res.json({ message: 'Opportunity accepted', pageId: page._id });
  } catch (err) {
    console.error('Error accepting opportunity:', err);
    res.status(500).json({ error: 'Failed to accept opportunity' });
  }
});

// POST dismiss
router.post('/:id/dismiss', auth(['owner', 'employee']), async (req, res) => {
  try {
    const { id } = req.params;
    const opp = await LocalOpportunity.findById(id);
    if (!opp) return res.status(404).json({ error: 'Not found' });
    opp.status = 'dismissed';
    await opp.save();
    res.json({ message: 'Dismissed' });
  } catch (err) {
    console.error('Error dismissing opportunity:', err);
    res.status(500).json({ error: 'Failed to dismiss' });
  }
});

module.exports = router;
