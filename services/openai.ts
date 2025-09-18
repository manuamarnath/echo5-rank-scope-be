import axios from 'axios';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_BASE_URL = 'https://api.openai.com/v1';

export async function getEmbeddings(input: string | string[]) {
  const response = await axios.post(
    `${OPENAI_BASE_URL}/embeddings`,
    {
      input,
      model: 'text-embedding-ada-002',
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
      model: options?.model || 'gpt-3.5-turbo',
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
