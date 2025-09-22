// Worker skeleton for accepting opportunities: create page, keywords, brief, and enroll tracking.
// This should be queued by the API route when an opportunity is accepted.

const LocalOpportunity = require('../models/LocalOpportunity');
const Page = require('../models/Page');
const Keyword = require('../models/Keyword');
const Brief = require('../models/Brief');
const AIOMonitor = require('../models/AIOMonitor');

async function acceptLocalOpportunityWorker(job) {
  const { opportunityId, userId } = job.data;
  console.log('acceptLocalOpportunityWorker starting', opportunityId);

  const opp = await LocalOpportunity.findById(opportunityId);
  if (!opp) throw new Error('Opportunity not found');

  // Create Page
  const page = new Page({
    clientId: opp.clientId,
    type: 'local',
    title: `${opp.serviceName} — ${opp.locationSlug}`,
    slug: `${opp.serviceName.replace(/\s+/g, '-').toLowerCase()}-${opp.locationSlug}`,
    status: 'draft'
  });
  await page.save();

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

  // Create secondary/localized keywords
  const secondaryIds = [];
  const localizedIds = [];
  for (const t of (opp.secondaryKeywords || [])) {
    const kw = new Keyword({ clientId: opp.clientId, text: t, intent: 'informational', allocatedTo: 'local', role: 'secondary' });
    await kw.save();
    secondaryIds.push(kw._id);
  }
  for (const t of (opp.localizedKeywords || [])) {
    const kw = new Keyword({ clientId: opp.clientId, text: t, intent: 'local', allocatedTo: 'local', role: 'supporting', targetLocation: opp.locationSlug });
    await kw.save();
    localizedIds.push(kw._id);
  }

  // Attach keywords to page
  page.primaryKeywordId = primaryKw._id;
  page.secondaryKeywordIds = secondaryIds;
  await page.save();

  // Create Brief with AEO/GEO-ready blocks (Answer card, FAQs, citations, media plan)
  const brief = new Brief({
    clientId: opp.clientId,
    pageId: page._id,
    goals: `Local SEO brief for ${opp.primaryKeyword} in ${opp.locationSlug}`,
    businessContext: '',
    targetAudience: '',
    keyMessages: [],
    toneOfVoice: 'professional',
    keywords: [opp.primaryKeyword].concat(opp.secondaryKeywords || []).concat(opp.localizedKeywords || []),
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
    createdBy: userId
  });
  await brief.save();

  // Enroll AIO monitoring (create AIOMonitor record with default queries)
  const queries = [];
  // E.g., build queries from primary + localized variants (top 5)
  queries.push(opp.primaryKeyword);
  for (const lk of (opp.localizedKeywords || []).slice(0, 4)) queries.push(lk);

  const monitor = new AIOMonitor({ clientId: opp.clientId, pageId: page._id, queries });
  await monitor.save();

  // Mark opportunity accepted
  opp.status = 'accepted';
  await opp.save();

  // TODO: enqueue rank tracking and weekly AIO check jobs; integrate screenshot capture and store S3 key in AIOMonitor.lastResult.screenshotKey

  return { ok: true };
}

module.exports = acceptLocalOpportunityWorker;
