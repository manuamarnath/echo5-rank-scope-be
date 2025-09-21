const OpenAI = require('openai');

// Check if API key is configured
if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY environment variable is not set');
}

const isOpenRouter = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.startsWith('sk-or-');
console.log(`Using ${isOpenRouter ? 'OpenRouter' : 'OpenAI'} API`);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: isOpenRouter 
    ? 'https://openrouter.ai/api/v1' 
    : 'https://api.openai.com/v1',
});

async function getEmbeddings(texts) {
  if (!Array.isArray(texts) || texts.length === 0) {
    return [];
  }

  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: texts,
    });

    return response.data.map(item => item.embedding);
  } catch (error) {
    console.error('Error generating embeddings:', error);
    throw error;
  }
}

async function generateOutline(prompt, model = 'openai/gpt-3.5-turbo') {
  try {
    const response = await openai.chat.completions.create({
      model: model,
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
  try {
    const { model = 'openai/gpt-3.5-turbo', temperature = 0.7, max_tokens = 4000 } = options;
    
    console.log(`Making request to model: ${model}`);
    
    const response = await openai.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens,
    });
    return response.choices[0].message.content;
  } catch (error) {
    console.error('Error in chatGPT:', error.message);
    console.error('Full error:', error);
    throw error;
  }
}

module.exports = { getEmbeddings, generateOutline, chatGPT };