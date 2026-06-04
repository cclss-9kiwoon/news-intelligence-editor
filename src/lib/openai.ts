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
  const parsed = parseJsonLoose<T>(content);
  if (parsed === undefined) {
    throw new OpenAIError('Response was not valid JSON: ' + content.slice(0, 200), 0);
  }
  return parsed;
}

/**
 * 느슨한 JSON 파싱. OpenAI json_object 모드는 순수 JSON이지만,
 * OpenAI 호환 endpoint(Gemini 등)는 ```json 코드펜스나 앞뒤 텍스트를
 * 붙일 수 있음. 코드펜스 제거 + 첫 '{' ~ 마지막 '}' 추출로 대응.
 */
function parseJsonLoose<T>(content: string): T | undefined {
  const raw = content.trim();
  try { return JSON.parse(raw) as T; } catch { /* fall through */ }

  // 코드펜스 추출
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    try { return JSON.parse(fence[1].trim()) as T; } catch { /* fall through */ }
  }

  // 첫 { ~ 마지막 } 추출
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(raw.slice(start, end + 1)) as T; } catch { /* fall through */ }
  }

  return undefined;
}
