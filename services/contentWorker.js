const { chatGPT } = require('./openai.js');

const CONTENT_GENERATION_SYSTEM_PROMPT = `You are an expert SEO content writer. Expand the following blog outline into a full, engaging, SEO-optimized article. Make it comprehensive, around 1500-2000 words, with natural keyword integration. Structure it with headings, subheadings, and include an introduction and conclusion.`;

async function generateArticleFromOutline(outline, topic) {
  try {
    const userPrompt = `Topic: ${topic}\n\nOutline:\n${outline}\n\nExpand this into a complete blog post.`;

    const messages = [
      { role: 'system', content: CONTENT_GENERATION_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt }
    ];

    const articleContent = await chatGPT(messages, { model: 'meta-llama/llama-3.3-70b-instruct:free', temperature: 0.7 });
    return articleContent;
  } catch (error) {
    console.error('Error generating article:', error);
    throw error;
  }
}

async function generateTaskContent(taskDescription, pageType) {
  try {
    const SYSTEM_PROMPT = `You are an expert at generating high-quality content tailored to specific tasks and page types. Create relevant, engaging, and optimized content based on the task description and page requirements.`;

    const userPrompt = `Task Description: ${taskDescription}\n\nPage Type: ${pageType}\n\nGenerate comprehensive content for this task and page type.`;

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