// Load .env early so scripts that directly require this file get env vars
try { require('dotenv').config(); } catch (e) { /* ignore if already loaded */ }

const OpenAI = require('openai');

// Allow overriding model via env var; default to gpt-5-mini for OpenAI
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5-mini';

let openai = null;
if (process.env.OPENAI_API_KEY) {
  try {
    console.log(`Using OpenAI API, model default: ${OPENAI_MODEL}`);
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: 'https://api.openai.com/v1',
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

async function generateOutline(prompt, model = OPENAI_MODEL) {
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
    const { model = OPENAI_MODEL, temperature = 0.7, max_tokens = 4000 } = options;
    const response = await openai.chat.completions.create({ model, messages, temperature, max_tokens });
    return response.choices[0].message.content;
  } catch (error) {
    console.error('Error in chatGPT:', error && error.message ? error.message : error);
    throw error;
  }
}

module.exports = { getEmbeddings, generateOutline, chatGPT, OPENAI_MODEL };