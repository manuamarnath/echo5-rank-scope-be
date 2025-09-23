// Load .env early so scripts that directly require this file get env vars
try { require('dotenv').config(); } catch (e) { /* ignore if already loaded */ }

const OpenAI = require('openai');

// Allow overriding model via env var; default to gpt-4o-mini for OpenAI (gpt-5-mini may not be available)
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

let openai = null;
if (process.env.OPENAI_API_KEY) {
  try {
    // Support for both OpenAI and OpenRouter
    const baseURL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    const isOpenRouter = baseURL.includes('openrouter.ai');
    
    console.log(`Using ${isOpenRouter ? 'OpenRouter' : 'OpenAI'} API, model default: ${OPENAI_MODEL}`);
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: baseURL,
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
    const completionParams = {
      model,
      messages: [
        { role: 'system', content: 'You are an expert SEO content strategist helping generate detailed blog outlines.' },
        { role: 'user', content: prompt }
      ],
    };
    
    // Some models don't support custom temperature, only use temperature for models that support it
    if (!model.includes('o1')) {  // Only o1 models don't support temperature
      completionParams.temperature = 0.7;
    }
    
    // Use max_completion_tokens for newer models that don't support max_tokens
    if (model.includes('o1')) {  // Only o1 models use max_completion_tokens
      completionParams.max_completion_tokens = 1000;
    } else {
      completionParams.max_tokens = 1000;
    }
    
    const response = await openai.chat.completions.create(completionParams);
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
    console.log(`Making request to model: ${model}`);
    
    // Use max_completion_tokens for newer models that don't support max_tokens
    const completionParams = { 
      model, 
      messages
    };
    
    // Some models don't support custom temperature, only use temperature for models that support it
    if (!model.includes('o1')) {  // Only o1 models don't support temperature
      completionParams.temperature = temperature;
    }
    
    // Try max_completion_tokens first, fallback to max_tokens for older models
    if (model.includes('o1')) {  // Only o1 models use max_completion_tokens
      completionParams.max_completion_tokens = max_tokens;
    } else {
      completionParams.max_tokens = max_tokens;
    }
    
    const response = await openai.chat.completions.create(completionParams);
    return response.choices[0].message.content;
  } catch (error) {
    console.error('Error in chatGPT:', error && error.message ? error.message : error);
    throw error;
  }
}

module.exports = { getEmbeddings, generateOutline, chatGPT, OPENAI_MODEL };