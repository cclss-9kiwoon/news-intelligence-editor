import type { ModelId } from '../types';

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

function buildEndpoint(baseUrl: string): string {
  const trimmed = (baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
  return `${trimmed}/chat/completions`;
}

export class OpenAIError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'OpenAIError';
    this.status = status;
  }
}

export type ChatJsonArgs = {
  apiKey: string;
  model: ModelId;
  system: string;
  user: string;
  temperature?: number;
  baseUrl?: string;
};

export async function chatJson<T = unknown>(args: ChatJsonArgs): Promise<T> {
  if (!args.apiKey) throw new OpenAIError('API key is empty', 0);

  const res = await fetch(buildEndpoint(args.baseUrl || DEFAULT_BASE_URL), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${args.apiKey}`,
    },
    body: JSON.stringify({
      model: args.model,
      temperature: args.temperature ?? 0.5,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: args.system },
        { role: 'user', content: args.user },
      ],
    }),
  });

  if (!res.ok) {
    let body: { error?: { message?: string } } = {};
    try { body = await res.json(); } catch { /* ignore */ }
    throw new OpenAIError(body.error?.message || `HTTP ${res.status}`, res.status);
  }

  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content ?? '';
  try {
    return JSON.parse(content) as T;
  } catch {
    throw new OpenAIError('Response was not valid JSON: ' + content.slice(0, 200), 0);
  }
}
