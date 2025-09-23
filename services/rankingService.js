const axios = require('axios');
const Page = require('../models/Page');
const Keyword = require('../models/Keyword');

// Support multiple env var names for SerpApi
const SERPAPI_KEY = process.env.SERPAPI_KEY || process.env.SERPAPI || process.env.SERP_API_KEY || process.env.SERP_API;
if (SERPAPI_KEY) console.log('rankingService: SerpApi key detected via env');

async function getSERPRanking(keyword, domain, opts = {}) {
  if (!SERPAPI_KEY) {
    console.warn('getSERPRanking: SERP API key not configured');
    return { position: null };
  }

  const params = {
    engine: 'google',
    q: keyword,
    api_key: SERPAPI_KEY,
    num: opts.num || 100
  };

  // Location / locale mapping: SerpApi supports 'location', 'gl' (country code) and 'hl' (language)
  if (opts.location) {
    params.location = opts.location; // e.g. "Boston, Massachusetts, United States"
    const parts = opts.location.split(',').map(p => p.trim());
    const country = parts.length ? parts[parts.length - 1] : null;
    if (country) {
      // gl expects a two-letter country code; we accept common country names or codes
      // If the caller provides a code (e.g., 'US' or 'us'), pass through
      const maybeCode = country.length === 2 ? country.toLowerCase() : undefined;
      if (maybeCode) params.gl = maybeCode;
    }
    // Allow explicit gl/hl override
    if (opts.gl) params.gl = opts.gl;
    if (opts.hl) params.hl = opts.hl;
  }

  // Device mapping: map 'desktop'|'mobile' to SerpApi params when supported
  if (opts.device) {
    if (opts.device === 'mobile') params.device = 'mobile';
    else params.device = 'desktop';
  }

  // Retry with exponential backoff for transient errors
  const maxRetries = typeof opts.retries === 'number' ? opts.retries : 3;
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      const resp = await axios.get('https://serpapi.com/search.json', { params, timeout: opts.timeout || 15000 });
      const results = resp.data.organic_results || resp.data.orgics || resp.data.organic || [];

      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        const url = r.link || r.url || r.displayed_link || r.displayed_link_raw || '';
        if (!url) continue;
        try {
          const hostname = new URL(url).hostname.replace(/^www\./, '');
          if (domain && hostname && hostname.includes(domain.replace(/^www\./, ''))) {
            return { position: i + 1, url, snippet: r.snippet || r.snippet_text || '' };
          }
        } catch (e) {
          // ignore URL parse errors
        }
      }

      // Not found in results
      return { position: null };
    } catch (err) {
      attempt += 1;
      const message = err && err.message ? err.message : String(err);
      // if we've exhausted retries, return null result and log
      if (attempt >= maxRetries) {
        console.warn(`getSERPRanking failed after ${attempt} attempts:`, message);
        return { position: null, error: message };
      }

      // Only retry on network/timeouts/5xx errors; don't retry on 4xx client errors
      const status = err && err.response && err.response.status;
      if (status && status >= 400 && status < 500) {
        // Client error likely won't succeed on retry
        console.warn('getSERPRanking client error, not retrying:', message);
        return { position: null, error: message };
      }

      // Exponential backoff with jitter
      const backoffMs = Math.pow(2, attempt) * 250 + Math.floor(Math.random() * 200);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
      // loop and retry
    }
  }
}

async function updatePageRankings(pageId) {
  try {
    const page = await Page.findById(pageId).populate('keywords');
    if (!page) return;

    const domain = page.url ? (new URL(page.url).hostname.replace(/^www\./, '')) : null;

    for (const keywordInstance of page.keywords || []) {
      const keywordText = keywordInstance.text || keywordInstance.keyword || keywordInstance.name;
      const res = await getSERPRanking(keywordText, domain, { num: 100 });
      await Keyword.updateOne({ _id: keywordInstance._id }, { $set: { rank: res.position } });
    }

    return true;
  } catch (error) {
    console.error('Error updating page rankings:', error && error.message ? error.message : error);
    return false;
  }
}

async function updateAllRankings() {
  try {
    const pages = await Page.find({}).populate('keywords');
    for (const page of pages) await updatePageRankings(page._id);
    console.log('All rankings updated successfully.');
  } catch (error) {
    console.error('Error in batch update rankings:', error && error.message ? error.message : error);
  }
}

module.exports = { updateAllRankings, updatePageRankings, getSERPRanking };