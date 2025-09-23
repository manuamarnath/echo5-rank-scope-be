import axios from 'axios';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
export const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

export async function getEmbeddings(input: string | string[]) {
  const response = await axios.post(
    `${OPENAI_BASE_URL}/embeddings`,
    {
      input,
      model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-ada-002',
    },
    {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );
  return response.data.data.map((d: any) => d.embedding);
}

export async function chatGPT(messages: { role: string; content: string }[], options?: { model?: string; temperature?: number; max_tokens?: number }) {
  const model = options?.model || OPENAI_MODEL;
  const requestBody: any = {
    model,
    messages,
  };
  
  // Some models don't support custom temperature, only use temperature for models that support it
  if (!model.includes('o1')) {  // Only o1 models don't support temperature
    requestBody.temperature = options?.temperature ?? 0.7;
  }
  
  // Use max_completion_tokens for newer models that don't support max_tokens
  const maxTokens = options?.max_tokens || 4000;
  if (model.includes('o1')) {  // Only o1 models use max_completion_tokens
    requestBody.max_completion_tokens = maxTokens;
  } else {
    requestBody.max_tokens = maxTokens;
  }
  
  const response = await axios.post(
    `${OPENAI_BASE_URL}/chat/completions`,
    requestBody,
    {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );
  return response.data.choices[0].message.content;
}
