const express = require('express');
const router = express.Router();
const { connection } = require('../lib/queues');

router.get('/', async (req, res) => {
  try {
    const status = connection ? connection.status : 'no-connection';
    let ping = null;
    try {
      if (connection && typeof connection.ping === 'function') {
        ping = await connection.ping();
      }
    } catch (err) {
      ping = `ping-error: ${err && err.message ? err.message : String(err)}`;
    }

    res.json({ redis: { status, ping } });
  } catch (err) {
    console.error('Queue health check failed', err);
    res.status(500).json({ error: 'Health check failed' });
  }
});

module.exports = router;
