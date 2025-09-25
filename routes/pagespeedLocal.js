const express = require('express');
const router = express.Router();
// Lighthouse v12 is ESM; use the CommonJS bridge entry to get a callable function
const lighthouse = require('lighthouse/core/index.cjs');
const chromeLauncher = require('chrome-launcher');
const auth = require('../middleware/auth');
const Client = require('../models/Client');

// GET /api/pagespeed-local/lighthouse?url=...&strategy=mobile|desktop
router.get('/lighthouse', auth(['owner', 'employee', 'client']), async (req, res) => {
  const { url, strategy = 'mobile' } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'Missing required query parameter: url' });
  }

  // Normalize URL
  const normalizeUrl = (site) => {
    let u = String(site).trim();
    if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
    try {
      new URL(u); // validate
      return u;
    } catch (e) {
      return null;
    }
  };

  const targetUrl = normalizeUrl(url);
  if (!targetUrl) return res.status(400).json({ error: 'Invalid URL' });

  let chrome;
  try {
    chrome = await chromeLauncher.launch({ chromeFlags: ['--headless', '--no-sandbox', '--disable-gpu'] });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to launch Chrome. Ensure Chrome/Chromium is installed.' });
  }

  try {
    const flags = { port: chrome.port, logLevel: 'error', output: 'json' };
    const formFactor = (String(strategy).toLowerCase() === 'desktop') ? 'desktop' : 'mobile';
    const screenEmulation = formFactor === 'mobile'
      ? { mobile: true, width: 360, height: 640, deviceScaleFactor: 2, disabled: false }
      : { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false };

    const config = {
      extends: 'lighthouse:default',
      settings: {
        onlyCategories: ['performance'],
        formFactor,
        screenEmulation,
      }
    };

    const runnerResult = await lighthouse(targetUrl, flags, config);
    const lhr = runnerResult.lhr || {};
    const audits = lhr.audits || {};

    const metrics = {
      url: lhr.finalDisplayedUrl || targetUrl,
      strategy: formFactor,
      performanceScore: Math.round(((lhr.categories?.performance?.score || 0) * 100)),
      firstContentfulPaint: audits['first-contentful-paint']?.numericValue || null,
      largestContentfulPaint: audits['largest-contentful-paint']?.numericValue || null,
      cumulativeLayoutShift: audits['cumulative-layout-shift']?.numericValue || null,
      totalBlockingTime: audits['total-blocking-time']?.numericValue || null,
      speedIndex: audits['speed-index']?.numericValue || null,
      timeToInteractive: audits['interactive']?.numericValue || null,
      fetchedAt: lhr.fetchTime || new Date().toISOString(),
    };

    return res.json({ metrics, raw: process.env.NODE_ENV === 'production' ? undefined : lhr });
  } catch (error) {
    console.error('Lighthouse run failed:', error);
    return res.status(500).json({ error: 'Lighthouse run failed', message: error.message });
  } finally {
    try { await chrome.kill(); } catch (e) { /* ignore */ }
  }
});

module.exports = router;

// GET /api/pagespeed-local/batch?strategy=mobile|desktop&clientId=&limit=
// Runs Lighthouse sequentially for clients' homepages without requiring PSI keys
router.get('/batch', auth(['owner', 'employee', 'client']), async (req, res) => {
  try {
    const { strategy = 'mobile', clientId, limit } = req.query;

    // Build visibility filter for clients
    const filter = {};
    if (req.user.role === 'client') {
      filter._id = req.user.clientId;
    }
    if (clientId) {
      filter._id = clientId;
    }

    const max = limit ? Math.max(1, parseInt(limit, 10)) : undefined;
    const clients = await Client.find(filter).select('name website').limit(max || 0);

    const normalizeUrl = (site) => {
      if (!site) return null;
      let u = String(site).trim();
      if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
      try { return new URL(u).origin; } catch { return null; }
    };

    const results = [];

    const runLighthouseOnce = async (targetUrl, strat) => {
      let chrome;
      try {
        chrome = await chromeLauncher.launch({ chromeFlags: ['--headless', '--no-sandbox', '--disable-gpu'] });
        const flags = { port: chrome.port, logLevel: 'error', output: 'json' };
        const formFactor = (String(strat).toLowerCase() === 'desktop') ? 'desktop' : 'mobile';
        const screenEmulation = formFactor === 'mobile'
          ? { mobile: true, width: 360, height: 640, deviceScaleFactor: 2, disabled: false }
          : { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false };
        const config = { extends: 'lighthouse:default', settings: { onlyCategories: ['performance'], formFactor, screenEmulation } };
        const rr = await lighthouse(targetUrl, flags, config);
        const lhr = rr.lhr || {};
        const audits = lhr.audits || {};
        return {
          url: lhr.finalDisplayedUrl || targetUrl,
          strategy: formFactor,
          performanceScore: Math.round(((lhr.categories?.performance?.score || 0) * 100)),
          firstContentfulPaint: audits['first-contentful-paint']?.numericValue || null,
          largestContentfulPaint: audits['largest-contentful-paint']?.numericValue || null,
          cumulativeLayoutShift: audits['cumulative-layout-shift']?.numericValue || null,
          totalBlockingTime: audits['total-blocking-time']?.numericValue || null,
          speedIndex: audits['speed-index']?.numericValue || null,
          timeToInteractive: audits['interactive']?.numericValue || null,
          fetchedAt: lhr.fetchTime || new Date().toISOString(),
        };
      } finally {
        try { if (chrome) await chrome.kill(); } catch {}
      }
    };

    for (const c of clients) {
      const site = normalizeUrl(c.website);
      if (!site) {
        results.push({ clientId: c._id, clientName: c.name, website: c.website || '', error: 'Invalid or missing website URL' });
        continue;
      }
      try {
        const metrics = await runLighthouseOnce(site, strategy);
        results.push({ clientId: c._id, clientName: c.name, website: site, metrics });
      } catch (err) {
        results.push({ clientId: c._id, clientName: c.name, website: site, error: err?.message || 'Lighthouse run failed' });
      }
      // brief delay between runs
      await new Promise(r => setTimeout(r, 200));
    }

    res.json({ count: results.length, results });
  } catch (error) {
    console.error('Local Lighthouse batch error:', error);
    res.status(500).json({ error: 'Failed to run Lighthouse batch' });
  }
});
