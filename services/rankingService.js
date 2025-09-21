const axios = require('axios');
const { Page } = require('../models/Page');
const { Keyword } = require('../models/Keyword');

// Assuming SERP API integration
async function getSERPRanking(keyword, domain) {
  try {
    const response = await axios.get('https://serpapi.com/search', {
      params: {
        engine: 'google',
        q: keyword,
        api_key: process.env.SERPAPI_KEY,
        num: 100, // Get top 100 results
        location: 'United States' // Adjust as needed
      }
    });

    const results = response.data.organic_results;
    for (let i = 0; i < results.length; i++) {
      if (results[i].link.includes(domain)) {
        return i + 1; // Ranking position
      }
    }
    return null; // Not found in top 100
  } catch (error) {
    console.error('Error fetching SERP ranking:', error);
    return null;
  }
}

async function updatePageRankings(pageId) {
  try {
    const page = await Page.findById(pageId).populate('keywords');
    if (!page) return;

    const domain = new URL(page.url).hostname;

    for (const keywordInstance of page.keywords) {
      const keyword = keywordInstance.keyword; // Assuming keyword is the model instance
      const currentRank = await getSERPRanking(keyword.name, domain);

      await keywordInstance.updateOne({ rank: currentRank });
    }

    await page.save();
  } catch (error) {
    console.error('Error updating page rankings:', error);
  }
}

async function updateAllRankings() {
  try {
    const pages = await Page.find({}).populate('keywords');
    for (const page of pages) {
      await updatePageRankings(page._id);
    }
    console.log('All rankings updated successfully.');
  } catch (error) {
    console.error('Error in batch update rankings:', error);
  }
}

module.exports = { updateAllRankings, updatePageRankings, getSERPRanking };