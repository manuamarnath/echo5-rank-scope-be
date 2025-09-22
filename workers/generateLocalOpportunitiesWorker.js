// Enhanced worker for generating local opportunities
const axios = require('axios');
const LocalOpportunity = require('../models/LocalOpportunity');
const Client = require('../models/Client');
const Page = require('../models/Page');

// If user provided SERP API key (SerpApi), use it for competitor count
const SERPAPI_KEY = process.env.SERPAPI_KEY || process.env.SERPAPI || process.env.SERP_API_KEY || process.env.SERP_API;
if (SERPAPI_KEY) console.log('SerpApi key detected via env');

function haversineMiles(lat1, lon1, lat2, lon2) {
  const toRad = v => (v * Math.PI) / 180;
  const R = 3958.8; // miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Enhanced scoring with optional factors
function computeScore({ seedVolume = 0, serpCompetitors = 0, distanceMiles = null, coverageGap = true }) {
  // base weights
  const wVolume = 0.55;
  const wCompetitors = 0.25;
  const wDistance = 0.05;
  const wCoverage = 0.15;

  const volNorm = Math.min(seedVolume / 1000, 1);
  const compFactor = Math.min(serpCompetitors / 10, 1);
  const distanceFactor = distanceMiles == null ? 1 : Math.max(0, 1 - Math.min(distanceMiles / 100, 1));
  const coverageFactor = coverageGap ? 1 : 0.3;

  const score = (volNorm * wVolume) + ((1 - compFactor) * wCompetitors) + (distanceFactor * wDistance) + (coverageFactor * wCoverage);
  return Math.max(0, Math.min(1, score));
}

async function getSerpCompetitorCount(query, clientDomain) {
  if (!SERPAPI_KEY) return null;
  try {
    const resp = await axios.get('https://serpapi.com/search.json', {
      params: { engine: 'google', q: query, api_key: SERPAPI_KEY, num: 10 }
    });
    const results = resp.data.organic_results || [];
    const domains = new Set();
    for (const r of results) {
      try {
        const url = new URL(r.link);
        const d = url.hostname.replace(/^www\./, '');
        if (!clientDomain || (d && clientDomain && !d.includes(clientDomain))) domains.add(d);
      } catch (e) {
        // ignore parse errors
      }
    }
    return domains.size;
  } catch (err) {
    console.warn('SerpApi error', err && err.message ? err.message : err);
    return null;
  }
}

async function generateLocalOpportunitiesWorker(job) {
  const { clientId } = job.data;
  console.log('generateLocalOpportunitiesWorker started for', clientId);

  if (!clientId) throw new Error('clientId required');

  const client = await Client.findById(clientId).lean();
  if (!client) throw new Error('Client not found');

  const clientDomain = client.website ? (new URL(client.website).hostname.replace(/^www\./, '')) : null;

  const services = (client.services || []).map(s => ({ name: s, slug: s.replace(/\s+/g, '-').toLowerCase() }));
  const locations = (client.locations || []).map((l, idx) => ({
    city: l.city || `loc${idx}`,
    slug: (l.city || `loc${idx}`).replace(/\s+/g, '-').toLowerCase(),
    priority: l.priority || 1,
    lat: l.lat || null,
    lon: l.lon || null
  }));

  // Fallbacks: if no explicit services, derive from primaryKeywords or seedKeywords
  if (!services.length) {
    if (client.primaryKeywords && client.primaryKeywords.length) {
      for (const pk of client.primaryKeywords) {
        const name = pk.keyword.split(/ in | near | for /i)[0] || pk.keyword;
        services.push({ name: name.trim(), slug: name.trim().replace(/\s+/g, '-').toLowerCase() });
      }
      console.log('Derived services from primaryKeywords:', services.map(s => s.name));
    } else if (client.seedKeywords && client.seedKeywords.length) {
      for (const sk of client.seedKeywords.slice(0, 5)) {
        const name = sk.keyword.split(/ in | near | for /i)[0] || sk.keyword;
        services.push({ name: name.trim(), slug: name.trim().replace(/\s+/g, '-').toLowerCase() });
      }
      console.log('Derived services from seedKeywords:', services.map(s => s.name));
    }
  }

  // If still no services, add a generic fallback so we can surface one opportunity
  if (!services.length) {
    services.push({ name: 'General Service', slug: 'general-service' });
    console.log('No services found for client — using fallback service');
  }

  // Ensure at least one location exists (use client's first location or default HQ)
  if (!locations.length) {
    const fallbackCity = (client.locations && client.locations[0] && client.locations[0].city) || 'Headquarters';
    locations.push({ city: fallbackCity, slug: (fallbackCity).replace(/\s+/g, '-').toLowerCase(), priority: 1, lat: null, lon: null });
    console.log('No locations found for client — using fallback location:', fallbackCity);
  }

  // Seed keywords from client's seedKeywords (if any) to estimate volume
  const seedMap = {};
  for (const sk of (client.seedKeywords || [])) {
    const key = sk.keyword.toLowerCase();
    seedMap[key] = { volume: sk.searchVolume || 0, difficulty: sk.difficulty || 0 };
  }

  const created = [];

  for (const service of services) {
    for (const loc of locations) {
      const primaryPhrase = `${service.name} ${loc.city}`;

      const seed = seedMap[primaryPhrase.toLowerCase()] || { volume: 0, difficulty: 0 };

      // Get competitor count from SERP (top 10)
      let serpCompetitors = null;
      try {
        serpCompetitors = await getSerpCompetitorCount(primaryPhrase, clientDomain);
      } catch (e) {
        serpCompetitors = null;
      }

      // Coverage gap: check if a Page already exists for the suggested URL
      const suggestedUrl = `/services/${service.slug}/${loc.slug}`;
      const existingPage = await Page.findOne({ clientId, slug: { $in: [suggestedUrl, `${service.slug}-${loc.slug}`, `${service.slug}/${loc.slug}`] } });
      const coverageGap = !existingPage;

      // Distance factor (if client has hq or location coords)
      let distanceMiles = null;
      if (client.locations && client.locations.length && client.locations[0].lat && loc.lat) {
        distanceMiles = haversineMiles(client.locations[0].lat, client.locations[0].lon, loc.lat, loc.lon);
      }

      const score = computeScore({ seedVolume: seed.volume || 0, serpCompetitors: serpCompetitors || 0, distanceMiles, coverageGap });

      // Idempotency: skip if an identical suggestion exists
      const existing = await LocalOpportunity.findOne({ clientId, serviceName: service.name, locationSlug: loc.slug, primaryKeyword: primaryPhrase });
      if (existing) {
        if (Math.abs((existing.score || 0) - score) > 0.01) {
          existing.score = score;
          existing.metadata = existing.metadata || {};
          existing.metadata.generatedAt = new Date();
          existing.metadata.serpCompetitors = serpCompetitors;
          existing.metadata.coverageGap = coverageGap;
          existing.metadata.seed = seed;
          await existing.save();
        }
        continue;
      }

      const doc = await LocalOpportunity.create({
        clientId,
        serviceName: service.name,
        serviceId: null,
        locationSlug: loc.slug,
        suggestedUrl,
        primaryKeyword: primaryPhrase,
        secondaryKeywords: [],
        localizedKeywords: [],
        score,
        status: 'pending',
        metadata: { seed, serpCompetitors, coverageGap, distanceMiles }
      });
      // highlight flag for UI convenience
      doc.metadata = doc.metadata || {};
      doc.metadata.highlight = score >= 0.65;
      await doc.save();
      created.push(doc);
    }
  }

  console.log(`generateLocalOpportunitiesWorker created ${created.length} opportunities for ${clientId}`);
  return { ok: true, created: created.length };
}

module.exports = generateLocalOpportunitiesWorker;
