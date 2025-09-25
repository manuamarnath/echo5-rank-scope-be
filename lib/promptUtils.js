/**
 * Utility functions for replacing placeholders in the content generation prompt (Node.js version)
 */

const { CONTENT_GENERATION_PROMPT } = require('./prompts/contentGeneration');

/**
 * Allocates keywords to a specific page based on page focus and keyword relevance
 */
function allocateKeywords(keywords, pageName) {
  const pageNameLower = pageName.toLowerCase();
  const pageWords = pageNameLower.split(/\s+/);
  
  // Score keywords based on relevance to page
  const scoredKeywords = keywords.map(kw => {
    const keywordLower = kw.keyword.toLowerCase();
    let score = 0;
    
    // Exact page name match gets highest score
    if (keywordLower.includes(pageNameLower)) {
      score += 10;
    }
    
    // Check for individual word matches
    pageWords.forEach(word => {
      if (keywordLower.includes(word) && word.length > 2) {
        score += 3;
      }
    });
    
    // Service-related keywords
    if (pageNameLower.includes('service') && keywordLower.includes('service')) {
      score += 5;
    }
    
    // Product-related keywords
    if (pageNameLower.includes('product') && keywordLower.includes('product')) {
      score += 5;
    }
    
    // Common business terms
    const businessTerms = ['solution', 'consultation', 'expert', 'professional', 'quality'];
    businessTerms.forEach(term => {
      if (keywordLower.includes(term)) {
        score += 1;
      }
    });
    
    return { keyword: kw.keyword, score };
  });
  
  // Sort by score and return top 8 keywords
  return scoredKeywords
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(item => item.keyword);
}

/**
 * Replaces all placeholders in the prompt template with actual client data
 */
function preparePrompt(clientData, pageData) {
  let prompt = CONTENT_GENERATION_PROMPT;
  
  // Basic business information
  prompt = prompt.replace(/\[Business Name\]/g, clientData.name);
  prompt = prompt.replace(/\[Website URL\]/g, clientData.website);
  prompt = prompt.replace(/\[Business Address\]/g, clientData.address.full);
  prompt = prompt.replace(/\[Business Street Address\]/g, clientData.address.street);
  prompt = prompt.replace(/\[Business Location City\]/g, clientData.address.city);
  prompt = prompt.replace(/\[Business State\]/g, clientData.address.state);
  prompt = prompt.replace(/\[Business Zip\]/g, clientData.address.zip);
  prompt = prompt.replace(/\[Business Phone\]/g, clientData.phone || '');
  
  // Content data
  const contentData = clientData.contentData;
  prompt = prompt.replace(/\[Business Type\]/g, contentData.businessType);
  prompt = prompt.replace(/\[Location Description\]/g, contentData.locationDescription || '');
  prompt = prompt.replace(/\[Service Areas\]/g, contentData.serviceAreas.join(', '));
  prompt = prompt.replace(/\[Primary Service Area\]/g, contentData.primaryServiceArea);
  prompt = prompt.replace(/\[Target Audience\]/g, contentData.targetAudience);
  prompt = prompt.replace(/\[Tone\]/g, contentData.tone);
  prompt = prompt.replace(/\[SEO Goals\]/g, contentData.seoGoals);
  prompt = prompt.replace(/\[Primary GEO Keyword\]/g, contentData.primaryGeoKeyword);
  
  // Enhanced GEO data
  prompt = prompt.replace(/\[Service Area Neighborhoods\]/g, contentData.serviceAreaNeighborhoods?.join(', ') || contentData.primaryServiceArea);
  prompt = prompt.replace(/\[Service Area ZIP Codes\]/g, contentData.serviceAreaZipCodes?.join(', ') || '');
  prompt = prompt.replace(/\[Service Radius Miles\]/g, contentData.serviceRadiusMiles?.toString() || '25');
  prompt = prompt.replace(/\[Years In Business\]/g, contentData.yearsInBusiness?.toString() || '10+');
  prompt = prompt.replace(/\[Local Business Associations\]/g, contentData.localBusinessAssociations?.join(', ') || `${clientData.address.city} Chamber of Commerce`);
  prompt = prompt.replace(/\[Local Business Expertise\]/g, contentData.localBusinessExpertise || `Serving ${clientData.address.city} area`);
  prompt = prompt.replace(/\[Community Involvement\]/g, contentData.communityInvolvement || `Active in ${clientData.address.city} community`);
  prompt = prompt.replace(/\[Business Latitude\]/g, contentData.businessLatitude?.toString() || '0');
  prompt = prompt.replace(/\[Business Longitude\]/g, contentData.businessLongitude?.toString() || '0');
  prompt = prompt.replace(/\[Price Range\]/g, contentData.priceRange || '$$');
  prompt = prompt.replace(/\[Payment Methods\]/g, contentData.paymentMethods?.join(', ') || 'Cash, Check, Credit Cards');
  
  // USPs (Unique Selling Points)
  for (let i = 0; i < 5; i++) {
    const uspKey = `[USP${i + 1}]`;
    const uspValue = contentData.usps[i] || '';
    prompt = prompt.replace(new RegExp(uspKey, 'g'), uspValue);
  }
  
  // Services and website structure
  prompt = prompt.replace(/\[Services\]/g, clientData.services.join(', '));
  prompt = prompt.replace(/\[Website Structure\]/g, clientData.websiteStructure.join(', '));
  
  // Keywords
  const keywordList = clientData.seedKeywords
    .map((kw, i) => `${i + 1}. ${kw.keyword}`)
    .join('\\n');
  prompt = prompt.replace(/\[Insert Client's 25\+ Keywords Here\]/g, keywordList);
  
  // Assigned keywords for this specific page
  const assignedKeywords = allocateKeywords(clientData.seedKeywords, pageData.pageName);
  prompt = prompt.replace(/\[Assigned Keywords\]/g, assignedKeywords.join(', '));
  
  // Page-specific data
  prompt = prompt.replace(/\[Page Name\]/g, pageData.pageName);
  prompt = prompt.replace(/\[Page URL\]/g, pageData.pageURL);
  prompt = prompt.replace(/\[Service\]/g, pageData.service);
  
  return prompt;
}

/**
 * Validates that all required client data is present for content generation
 */
function validateClientData(clientData) {
  const errors = [];
  
  if (!clientData.name) errors.push('Business name is required');
  if (!clientData.website) errors.push('Website URL is required');
  if (!clientData.address?.full) errors.push('Business address is required');
  if (!clientData.address?.city) errors.push('Business city is required');
  if (!clientData.services?.length) errors.push('At least one service is required');
  if (!clientData.seedKeywords?.length) errors.push('Keywords are required');
  
  if (!clientData.contentData) {
    errors.push('Content data is required');
  } else {
    const cd = clientData.contentData;
    if (!cd.businessType) errors.push('Business type is required');
    if (!cd.primaryServiceArea) errors.push('Primary service area is required');
    if (!cd.targetAudience) errors.push('Target audience is required');
    if (!cd.businessDescription) errors.push('Business description is required');
    if (!cd.usps?.length) errors.push('At least one USP is required');
  }
  
  return errors;
}

module.exports = {
  preparePrompt,
  allocateKeywords,
  validateClientData
};