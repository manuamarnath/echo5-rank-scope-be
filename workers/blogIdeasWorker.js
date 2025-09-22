const BlogIdea = require('../models/BlogIdea');
const Keyword = require('../models/Keyword');

/**
 * Job payload: { clientId }
 * Generates blog post ideas by combining primary keywords and simple templates.
 */
module.exports = async function(job) {
  const { clientId } = job.data;
  console.log(`blogIdeasWorker: generating for client ${clientId}`);

  const primaryKeywords = await Keyword.find({ clientId, isPrimary: true }).limit(50);
  const ideas = [];

  primaryKeywords.forEach(pk => {
    const title = `How to ${pk.text} in ${pk.geo || 'your area'}`;
    ideas.push({ clientId, title, summary: `A practical guide focused on ${pk.text}`, keywords: [pk.text], priority: 5, suggestedByJobId: job.id });
    ideas.push({ clientId, title: `Top tips for ${pk.text}`, summary: `Quick tips to improve ${pk.text}`, keywords: [pk.text], priority: 6, suggestedByJobId: job.id });
  });

  for (const idea of ideas) {
    try {
      const exists = await BlogIdea.findOne({ clientId: idea.clientId, title: idea.title });
      if (exists) continue;
      const doc = new BlogIdea(idea);
      await doc.save();
    } catch (err) {
      console.warn('Failed to save blog idea:', err && err.message ? err.message : err);
    }
  }

  console.log(`blogIdeasWorker: created ${ideas.length} ideas for client ${clientId}`);
  return { created: ideas.length };
};
