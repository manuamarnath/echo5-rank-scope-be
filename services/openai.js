// Load .env early so scripts that directly require this file get env vars
try { require('dotenv').config(); } catch (e) { /* ignore if already loaded */ }

const OpenAI = require('openai');

const isOpenRouter = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.startsWith('sk-or-');

let openai = null;
if (process.env.OPENAI_API_KEY) {
  try {
    console.log(`Using ${isOpenRouter ? 'OpenRouter' : 'OpenAI'} API`);
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: isOpenRouter ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1',
    });
  } catch (err) {
    console.warn('OpenAI client initialization failed:', err && err.message ? err.message : err);
    openai = null;
  }
} else {
  console.warn('OPENAI_API_KEY not set — OpenAI-powered features disabled');
}

async function getEmbeddings(texts) {
  if (!openai) return [];
  if (!Array.isArray(texts) || texts.length === 0) return [];
  try {
    const response = await openai.embeddings.create({ model: 'text-embedding-ada-002', input: texts });
    return response.data.map(item => item.embedding);
  } catch (error) {
    console.error('Error generating embeddings:', error);
    throw error;
  }
}

async function generateOutline(prompt, model = 'openai/gpt-3.5-turbo') {
  if (!openai) throw new Error('OpenAI not configured');
  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'You are an expert SEO content strategist helping generate detailed blog outlines.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 1000,
      temperature: 0.7,
    });
    return response.choices[0].message.content;
  } catch (error) {
    console.error('Error generating outline:', error);
    throw error;
  }
}

async function chatGPT(messages, options = {}) {
  if (!openai) throw new Error('OpenAI not configured');
  try {
    const { model = 'openai/gpt-3.5-turbo', temperature = 0.7, max_tokens = 4000 } = options;
    const response = await openai.chat.completions.create({ model, messages, temperature, max_tokens });
    return response.choices[0].message.content;
  } catch (error) {
    console.error('Error in chatGPT:', error && error.message ? error.message : error);
    throw error;
  }
}

module.exports = { getEmbeddings, generateOutline, chatGPT };