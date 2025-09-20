const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
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

async function generateOutline(prompt, model = 'gpt-3.5-turbo') {
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
    const { model = 'gpt-3.5-turbo', temperature = 0.7, max_tokens = 4000 } = options;
    const response = await openai.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens,
    });
    return response.choices[0].message.content;
  } catch (error) {
    console.error('Error in chatGPT:', error);
    throw error;
  }
}

module.exports = { getEmbeddings, generateOutline, chatGPT };