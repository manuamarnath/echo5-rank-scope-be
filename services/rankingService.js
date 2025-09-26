const axios = require('axios');
const Page = require('../models/Page');
const Keyword = require('../models/Keyword');

// Support multiple env var names for SerpApi
const SERPAPI_KEY = process.env.SERPAPI_KEY || process.env.SERPAPI || process.env.SERP_API_KEY || process.env.SERP_API;
if (SERPAPI_KEY) console.log('rankingService: SerpApi key detected via env');

// ScrapingDog API key
const SCRAPINGDOG_API_KEY = process.env.SCRAPINGDOG_API_KEY || process.env.SCRAPING_DOG_API_KEY || process.env.SCRAPINGDOG;
if (SCRAPINGDOG_API_KEY) console.log('rankingService: ScrapingDog key detected via env');

function normalizeDomain(d) {
  try {
    return d.replace(/^https?:\/\//, '').replace(/^www\./, '').trim();
  } catch {
    return d;
  }
}

async function getSerpApiRanking(keyword, domain, opts = {}) {
  if (!SERPAPI_KEY) {
    return { position: null, provider: 'serpapi', error: 'SERPAPI_KEY not configured' };
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
  }
  if (opts.gl) params.gl = opts.gl; // country code
  if (opts.hl) params.hl = opts.hl; // language code

  // Device mapping: map 'desktop'|'mobile' to SerpApi params when supported
  if (opts.device) {
    params.device = opts.device === 'mobile' ? 'mobile' : 'desktop';
  }

  // Retry with exponential backoff for transient errors
  const maxRetries = typeof opts.retries === 'number' ? opts.retries : 3;
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      const resp = await axios.get('https://serpapi.com/search.json', { params, timeout: opts.timeout || 15000 });
      const results = resp.data.organic_results || resp.data.orgics || resp.data.organic || [];

      const target = normalizeDomain(domain || '');
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        const url = r.link || r.url || r.displayed_link || r.displayed_link_raw || '';
        if (!url) continue;
        try {
          const hostname = new URL(url).hostname.replace(/^www\./, '');
          if (target && hostname && hostname.includes(target)) {
            return { position: i + 1, url, snippet: r.snippet || r.snippet_text || '', provider: 'serpapi' };
          }
        } catch {
          // ignore URL parse errors
        }
      }

      // Not found in results
      return { position: null, provider: 'serpapi' };
    } catch (err) {
      attempt += 1;
      const message = err && err.message ? err.message : String(err);
      // if we've exhausted retries, return null result and log
      if (attempt >= maxRetries) {
        console.warn(`getSerpApiRanking failed after ${attempt} attempts:`, message);
        return { position: null, error: message, provider: 'serpapi' };
      }

      // Only retry on network/timeouts/5xx errors; don't retry on 4xx client errors
      const status = err && err.response && err.response.status;
      if (status && status >= 400 && status < 500) {
        // Client error likely won't succeed on retry
        console.warn('getSerpApiRanking client error, not retrying:', message);
        return { position: null, error: message, provider: 'serpapi' };
      }

      // Exponential backoff with jitter
      const backoffMs = Math.pow(2, attempt) * 250 + Math.floor(Math.random() * 200);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
      // loop and retry
    }
  }
}

async function getScrapingDogRanking(keyword, domain, opts = {}) {
  if (!SCRAPINGDOG_API_KEY) {
    return { position: null, provider: 'scrapingdog', error: 'SCRAPINGDOG_API_KEY not configured' };
  }

  const target = normalizeDomain(domain || '');
  const max = opts.num || 100;
  const perPage = Math.min(10, max); // ScrapingDog defaults often 10 per page
  const maxPages = Math.ceil(max / perPage);
  const country = (opts.gl || (opts.location && opts.location.split(',').pop().trim()) || 'us').toString().toLowerCase();
  const device = opts.device === 'mobile' ? 'mobile' : 'desktop';

  // Iterate pages until found or limit reached
  for (let page = 0; page < maxPages; page++) {
    try {
      const params = {
        api_key: SCRAPINGDOG_API_KEY,
        query: keyword,
        results: perPage,
        country,
        page,
      };
      if (device === 'mobile') params.device = 'mobile';

      const resp = await axios.get('https://api.scrapingdog.com/google', { params, timeout: opts.timeout || 15000 });
      const data = resp.data || {};
      const list = data.organic_data || data.organic_results || data.organic || [];

      for (let i = 0; i < list.length; i++) {
        const r = list[i];
        const url = r.link || r.url || '';
        if (!url) continue;
        try {
          const hostname = new URL(url).hostname.replace(/^www\./, '');
          if (target && hostname && hostname.includes(target)) {
            const absoluteIndex = page * perPage + i + 1;
            return { position: absoluteIndex, url, snippet: r.snippet || r.description || '', provider: 'scrapingdog' };
          }
        } catch {
          // ignore URL parse errors
        }
      }

      // If fewer than perPage results returned, we're at the end
      if (!Array.isArray(list) || list.length < perPage) break;
    } catch (err) {
      const message = err && err.message ? err.message : String(err);
      // For 4xx errors, don't continue paging
      const status = err && err.response && err.response.status;
      if (status && status >= 400 && status < 500) {
        console.warn('getScrapingDogRanking client error:', message);
        return { position: null, error: message, provider: 'scrapingdog' };
      }
      // For transient errors, try next page/backoff
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  return { position: null, provider: 'scrapingdog' };
}

// Unified entry: prefer ScrapingDog when configured, else SerpApi
async function getSERPRanking(keyword, domain, opts = {}) {
  // Primary: ScrapingDog
  if (SCRAPINGDOG_API_KEY) {
    const sd = await getScrapingDogRanking(keyword, domain, opts);
    if (typeof sd.position !== 'undefined' && (sd.position !== null || !SERPAPI_KEY)) {
      return sd;
    }
  }

  // Fallback: SerpApi
  return await getSerpApiRanking(keyword, domain, opts);
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

module.exports = { updateAllRankings, updatePageRankings, getSERPRanking, getScrapingDogRanking, getSerpApiRanking };