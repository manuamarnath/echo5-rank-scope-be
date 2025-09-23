const KeywordMap = require('../models/KeywordMap');
const Keyword = require('../models/Keyword');
const Page = require('../models/Page');

/**
 * Job payload: { clientId }
 * Generates keyword suggestions for a client by looking at pages and primary keywords.
 * This is a lightweight heuristic implementation to be replaced by an AI-driven generator.
 */
module.exports = async function(job) {
  const { clientId } = job.data;
  console.log(`keywordSuggestionsWorker: generating for client ${clientId}`);

  // Find primary keywords from Keyword collection
  const primaryKeywords = await Keyword.find({ clientId, isPrimary: true }).limit(200);

  // Find pages for the client to contextualize suggestions
  const pages = await Page.find({ clientId }).limit(200);

  const suggestions = [];

  primaryKeywords.forEach(pk => {
    // Create 2 variations per primary keyword as simple example
    suggestions.push({ clientId, text: `${pk.text} near me`, intent: pk.intent || 'informational', score: 50, source: 'primary-variant', suggestedByJobId: job.id });
    suggestions.push({ clientId, text: `${pk.text} ${pk.geo || ''}`.trim(), intent: pk.intent || 'informational', score: 40, source: 'primary-geo-variant', suggestedByJobId: job.id });
  });

  // For each page, create a few localized suggestions
  pages.forEach(p => {
    const titleWords = (p.title || '').split(/\s+/).slice(0,3).join(' ');
    if (titleWords) {
      suggestions.push({ clientId, pageId: p._id, text: `${titleWords} ${p.type || ''}`.trim(), intent: 'informational', score: 30, source: 'page-context', suggestedByJobId: job.id });
    }
  });

  // Insert suggestions into KeywordMap, avoiding exact duplicates
  for (const s of suggestions) {
    try {
      // Deduplicate: do not insert if an identical suggestion exists recently
      const exists = await KeywordMap.findOne({ clientId: s.clientId, text: s.text, pageId: s.pageId || null });
      if (exists) continue;
      const doc = new KeywordMap(s);
      await doc.save();
    } catch (err) {
      console.warn('Failed to save suggestion:', err && err.message ? err.message : err);
    }
  }

  console.log(`keywordSuggestionsWorker: created ${suggestions.length} suggestion candidates for client ${clientId}`);
  return { created: suggestions.length };
};
