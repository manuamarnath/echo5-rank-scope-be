// Worker for accepting opportunities: create page, expand keywords, generate brief, and enroll tracking.
const LocalOpportunity = require('../models/LocalOpportunity');
const Page = require('../models/Page');
const Keyword = require('../models/Keyword');
const Brief = require('../models/Brief');
const AIOMonitor = require('../models/AIOMonitor');
const { chatGPT } = require('../services/openai');

async function expandKeywords(promptText) {
  if (!process.env.OPENAI_API_KEY) return [];
  try {
    const userPrompt = `Generate 10 high-quality secondary keywords and 10 localized keyword variants for: ${promptText}. Return JSON { "secondary": [..], "localized": [..] }`;
    const response = await chatGPT([{ role: 'system', content: 'You are a helpful SEO assistant.' }, { role: 'user', content: userPrompt }], { model: 'openai/gpt-3.5-turbo', max_tokens: 600 });
    // Try to parse JSON out of response
    const jsonStart = response.indexOf('{');
    const json = jsonStart >= 0 ? response.slice(jsonStart) : response;
    const parsed = JSON.parse(json);
    return { secondary: parsed.secondary || [], localized: parsed.localized || [] };
  } catch (err) {
    console.warn('Keyword expansion failed:', err && err.message ? err.message : err);
    return { secondary: [], localized: [] };
  }
}

async function generateAnswerCard(promptText) {
  if (!process.env.OPENAI_API_KEY) return '';
  try {
    const assistantPrompt = `Write a concise AEO-friendly answer card (50-80 words) for: ${promptText}`;
    const answer = await chatGPT([{ role: 'system', content: 'You are an expert SEO content writer focusing on local services.' }, { role: 'user', content: assistantPrompt }], { model: 'openai/gpt-3.5-turbo', max_tokens: 200 });
    return answer.trim();
  } catch (err) {
    console.warn('Answer card generation failed:', err && err.message ? err.message : err);
    return '';
  }
}

async function acceptLocalOpportunityWorker(job) {
  const { opportunityId, userId } = job.data;
  console.log('acceptLocalOpportunityWorker starting', opportunityId);

  const opp = await LocalOpportunity.findById(opportunityId);
  if (!opp) throw new Error('Opportunity not found');

  // Create Page
  let page = new Page({
    clientId: opp.clientId,
    type: 'local',
    title: `${opp.serviceName} — ${opp.locationSlug}`,
    slug: `${opp.serviceName.replace(/\s+/g, '-').toLowerCase()}-${opp.locationSlug}`,
    status: 'draft'
  });
  try {
    await page.save();
  } catch (err) {
    // If slug already exists, reuse the existing page instead of failing
    if (err && err.code === 11000) {
      console.warn('Page slug conflict, reusing existing page for client', opp.clientId);
      const existing = await Page.findOne({ clientId: opp.clientId, slug: page.slug });
      if (existing) {
        // reuse the existing Mongoose document instead of trying to insert a duplicate
        page = existing;
        console.log('Reusing page id', page._id.toString());
      } else {
        throw err; // unexpected - rethrow
      }
    } else {
      throw err;
    }
  }

  // Create primary Keyword
  const primaryKw = new Keyword({
    clientId: opp.clientId,
    text: opp.primaryKeyword,
    intent: 'local',
    allocatedTo: 'local',
    role: 'primary',
    isPrimary: true,
    targetLocation: opp.locationSlug
  });
  await primaryKw.save();

  // Expand keywords using OpenAI (best-effort)
  let expanded = { secondary: [], localized: [] };
  try {
    expanded = await expandKeywords(opp.primaryKeyword + ' in ' + opp.locationSlug);
  } catch (e) {
    expanded = { secondary: [], localized: [] };
  }

  // Persist secondary/localized keywords (limit to 10 each)
  const secondaryIds = [];
  const localizedIds = [];
  const toSecondary = (expanded.secondary && expanded.secondary.slice(0, 10)) || (opp.secondaryKeywords || []).slice(0, 10);
  const toLocalized = (expanded.localized && expanded.localized.slice(0, 10)) || (opp.localizedKeywords || []).slice(0, 10);

  for (const t of toSecondary) {
    try {
      const kw = new Keyword({ clientId: opp.clientId, text: t, intent: 'informational', allocatedTo: 'local', role: 'secondary' });
      await kw.save();
      secondaryIds.push(kw._id);
    } catch (e) {
      console.warn('failed to save secondary kw', e && e.message ? e.message : e);
    }
  }
  for (const t of toLocalized) {
    try {
      const kw = new Keyword({ clientId: opp.clientId, text: t, intent: 'local', allocatedTo: 'local', role: 'supporting', targetLocation: opp.locationSlug });
      await kw.save();
      localizedIds.push(kw._id);
    } catch (e) {
      console.warn('failed to save localized kw', e && e.message ? e.message : e);
    }
  }

  // Attach keywords to page
  page.primaryKeywordId = primaryKw._id;
  page.secondaryKeywordIds = secondaryIds;
  await page.save();

  // Generate answer card and brief content (best-effort)
  const answerCard = await generateAnswerCard(opp.primaryKeyword + ' in ' + opp.locationSlug);

  const brief = new Brief({
    clientId: opp.clientId,
    pageId: page._id,
    goals: `Local SEO brief for ${opp.primaryKeyword} in ${opp.locationSlug}`,
    businessContext: '',
    targetAudience: '',
    keyMessages: [],
    toneOfVoice: 'professional',
    keywords: [opp.primaryKeyword].concat(toSecondary).concat(toLocalized),
    seoFocus: opp.primaryKeyword,
    uniqueSellingPoints: [],
    outline: [
      { heading: 'Answer card', type: 'H2' },
      { heading: 'Service Overview', type: 'H2' },
      { heading: 'Pricing', type: 'H2' },
      { heading: 'Coverage', type: 'H2' },
      { heading: 'Why Us', type: 'H2' },
      { heading: 'FAQs', type: 'H2' }
    ],
    faqs: [],
    internalLinks: [],
    createdBy: userId,
    answerCard: answerCard
  });
  await brief.save();

  // Enroll AIO monitoring (create AIOMonitor record with default queries)
  const queries = [];
  queries.push(opp.primaryKeyword);
  for (const lk of toLocalized.slice(0, 4)) queries.push(lk);

  const monitor = new AIOMonitor({ clientId: opp.clientId, pageId: page._id, queries });
  await monitor.save();

  // Mark opportunity accepted
  opp.status = 'accepted';
  await opp.save();

  // TODO: enqueue rank tracking and weekly AIO check jobs; integrate screenshot capture and store S3 key in AIOMonitor.lastResult.screenshotKey

  return { ok: true };
}

module.exports = acceptLocalOpportunityWorker;
