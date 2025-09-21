const { chatGPT } = require('./openai.js');

// Stronger system prompt that instructs the model to avoid verbatim copying and
// to produce original, paraphrased content. We append a short originality
// declaration to the generated article so callers can see the author's note.
const CONTENT_GENERATION_SYSTEM_PROMPT = `You are an expert SEO content writer. Expand the following blog outline into a full, engaging, SEO-optimized article. Make it comprehensive, around 1500-2000 words, with natural keyword integration. Structure it with headings, subheadings, and include an introduction and conclusion. IMPORTANT: Do NOT reproduce text verbatim from competitor sources or other external materials. Produce original phrasing, paraphrase ideas when necessary, and add unique examples or perspectives. Where you must reference a specific claim or direct quote, mark it clearly and include a short attribution.`;

async function generateArticleFromOutline(outline, topic) {
  try {
    const userPrompt = `Topic: ${topic}\n\nOutline:\n${outline}\n\nExpand this into a complete blog post. Ensure the writing is original and not copied verbatim from other sources. If you reuse ideas from competitors, paraphrase them and add unique examples or commentary. At the end of the article, append an "Originality Declaration:" section (2-3 sentences) stating that the content is original and noting any direct quotes or attributions.`;

    const messages = [
      { role: 'system', content: CONTENT_GENERATION_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt }
    ];

    const articleContent = await chatGPT(messages, { model: 'meta-llama/llama-3.3-70b-instruct:free', temperature: 0.7 });
    // The returned content will include the Originality Declaration as requested above.
    return articleContent;
  } catch (error) {
    console.error('Error generating article:', error);
    throw error;
  }
}

async function generateTaskContent(taskDescription, pageType) {
  try {
    const SYSTEM_PROMPT = `You are an expert at generating high-quality content tailored to specific tasks and page types. Create relevant, engaging, and optimized content based on the task description and page requirements. IMPORTANT: Ensure content is original, avoid copying full paragraphs from other sources, and paraphrase competitor ideas; add unique examples or actionable steps.`;

    const userPrompt = `Task Description: ${taskDescription}\n\nPage Type: ${pageType}\n\nGenerate comprehensive, original content for this task and page type. If you include any direct quotes or specific facts from external sources, mark them and include a short attribution. At the end, append an "Originality Declaration:" (1-2 sentences) confirming the content is original.`;

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt }
    ];

    const content = await chatGPT(messages, { model: 'openai/gpt-4', temperature: 0.7 });
    return content;
  } catch (error) {
    console.error('Error generating task content:', error);
    throw error;
  }
}

module.exports = { generateArticleFromOutline, generateTaskContent };