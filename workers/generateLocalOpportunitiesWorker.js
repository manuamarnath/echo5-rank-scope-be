// Worker skeleton for generating local opportunities
// TODO: wire up BullMQ/Redis and add producer in the API route. This worker should:
// - pull client services and client locations
// - compute score for each service x location pair (see scoring formula)
// - fetch optional GSC impressions for queries (plug in later)
// - write LocalOpportunity documents
// - emit progress logs

const LocalOpportunity = require('../models/LocalOpportunity');
const Client = require('../models/Client');

// Simple scoring heuristic:
// score = normalized(seedKeywordVolume) * 0.6 + (1 - competitionFactor) * 0.3 + locationPriority * 0.1
// Where competitionFactor is approximated by number of competitor domains provided / 10
function computeScore({ seedVolume = 0, competitors = 0, locationPriority = 1 }) {
  const volNorm = Math.min(seedVolume / 1000, 1); // assume 1000+ is high
  const compFactor = Math.min(competitors / 10, 1);
  const score = (volNorm * 0.6) + ((1 - compFactor) * 0.3) + (Math.min(locationPriority, 3) / 3 * 0.1);
  return Math.max(0, Math.min(1, score));
}

async function generateLocalOpportunitiesWorker(job) {
  const { clientId } = job.data;
  console.log('generateLocalOpportunitiesWorker started for', clientId);

  if (!clientId) throw new Error('clientId required');

  const client = await Client.findById(clientId).lean();
  if (!client) throw new Error('Client not found');

  const services = (client.services || []).map(s => ({ name: s, slug: s.replace(/\s+/g, '-').toLowerCase() }));
  const locations = (client.locations || []).map((l, idx) => ({
    city: l.city || `loc${idx}`,
    slug: (l.city || `loc${idx}`).replace(/\s+/g, '-').toLowerCase(),
    priority: 1
  }));

  // Seed keywords from client's seedKeywords (if any) to estimate volume
  const seedMap = {};
  for (const sk of (client.seedKeywords || [])) {
    const key = sk.keyword.toLowerCase();
    seedMap[key] = { volume: sk.searchVolume || 0, difficulty: sk.difficulty || 0 };
  }

  const created = [];

  for (const service of services) {
    for (const loc of locations) {
      const primary = `${service.name} ${loc.city}`;

      // simple heuristic: try to find a seed keyword matching the primary phrase
      const seed = seedMap[primary.toLowerCase()] || { volume: 0, difficulty: 0 };
      const competitors = (client.competitors || []).length || 0;
      const score = computeScore({ seedVolume: seed.volume, competitors, locationPriority: loc.priority });

      // Idempotency: skip if an identical suggestion exists
      const existing = await LocalOpportunity.findOne({ clientId, serviceName: service.name, locationSlug: loc.slug, primaryKeyword: primary });
      if (existing) {
        // update score if changed
        if (Math.abs((existing.score || 0) - score) > 0.01) {
          existing.score = score;
          existing.metadata = existing.metadata || {};
          existing.metadata.generatedAt = new Date();
          await existing.save();
        }
        continue;
      }

      const suggestedUrl = `/services/${service.slug}/${loc.slug}`;
      const doc = await LocalOpportunity.create({ clientId, serviceName: service.name, serviceId: null, locationSlug: loc.slug, suggestedUrl, primaryKeyword: primary, secondaryKeywords: [], localizedKeywords: [], score, status: 'pending', metadata: { seed, competitors } });
      created.push(doc);
    }
  }

  console.log(`generateLocalOpportunitiesWorker created ${created.length} opportunities for ${clientId}`);

  return { ok: true, created: created.length };
}

module.exports = generateLocalOpportunitiesWorker;
