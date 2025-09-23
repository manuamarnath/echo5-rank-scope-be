import axios from 'axios';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_BASE_URL = 'https://api.openai.com/v1';
export const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5-mini';

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

export async function chatGPT(messages: { role: string; content: string }[], options?: { model?: string; temperature?: number }) {
  const response = await axios.post(
    `${OPENAI_BASE_URL}/chat/completions`,
    {
      model: options?.model || OPENAI_MODEL,
      messages,
      temperature: options?.temperature ?? 0.7,
    },
    {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );
  return response.data.choices[0].message.content;
}
