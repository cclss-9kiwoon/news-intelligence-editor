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

// ─── 글로벌 LLM 동시 호출 상한 (429 완화) ───────────────────────────
// 모든 LLM 호출(generateStory/reviewDraft/translate/judge…)이 chatJson을
// 통과하므로, 여기 세마포어 하나로 전 파이프라인 동시성을 제한한다.
// 동시 MAX_CONCURRENT_LLM개만 실행, 초과분은 FIFO 큐로 대기.
export const MAX_CONCURRENT_LLM = 3;
let activeLlm = 0;
const llmQueue: Array<() => void> = [];

function acquireLlmSlot(): Promise<void> {
  if (activeLlm < MAX_CONCURRENT_LLM) {
    activeLlm++;
    return Promise.resolve();
  }
  return new Promise<void>(resolve => llmQueue.push(resolve));
}

function releaseLlmSlot(): void {
  const next = llmQueue.shift();
  if (next) next();      // 대기자에게 슬롯 양도 (activeLlm 유지)
  else activeLlm--;      // 대기자 없으면 슬롯 반납
}

/** 테스트/관측용 — 현재 실행 중 + 대기 중 카운트 */
export function getLlmConcurrency(): { active: number; queued: number } {
  return { active: activeLlm, queued: llmQueue.length };
}

// ─── 429 글로벌 서킷브레이커 (총량 폭주 차단) ───────────────────────
// 동시상한은 동시성만 묶음(총 호출량 X). quota 소진(429)이 시작되면
// 모든 chatJson을 cooldown 동안 즉시 차단(호출 안 함) → 444 폭주 원천 차단.
// 연속 429마다 cooldown 지수 증가. 성공 1회면 리셋.
const BASE_COOLDOWN_MS = 60_000;        // 첫 429 후 60초
const MAX_COOLDOWN_MS = 15 * 60_000;    // 상한 15분
let circuitOpenUntil = 0;
let consecutive429 = 0;
// Date.now 대신 주입 가능(테스트). 기본은 실시간.
let nowFn: () => number = () => Date.now();
export function _setNowFn(fn: () => number) { nowFn = fn; } // 테스트 전용

function isCircuitOpen(): boolean { return nowFn() < circuitOpenUntil; }
function trip429(): void {
  consecutive429++;
  const cooldown = Math.min(BASE_COOLDOWN_MS * 2 ** (consecutive429 - 1), MAX_COOLDOWN_MS);
  circuitOpenUntil = nowFn() + cooldown;
}
function resetCircuit(): void { consecutive429 = 0; circuitOpenUntil = 0; }

/** 관측용 — 서킷 상태(차단 여부/해제 시각/연속 429). UI 배너·일시정지용 */
export function getLlmCircuitState(): { open: boolean; until: number; consecutive429: number } {
  return { open: isCircuitOpen(), until: circuitOpenUntil, consecutive429 };
}
export function resetLlmCircuit(): void { resetCircuit(); } // 테스트/수동 해제용

export async function chatJson<T = unknown>(args: ChatJsonArgs): Promise<T> {
  if (!args.apiKey) throw new OpenAIError('API key is empty', 0);

  // 서킷 차단 중이면 호출조차 안 함 (444 폭주 차단). 슬롯도 안 잡음.
  if (isCircuitOpen()) {
    const secs = Math.ceil((circuitOpenUntil - nowFn()) / 1000);
    throw new OpenAIError(`LLM 한도 소진 — ${secs}초 후 재시도 (rate limit cooldown)`, 429);
  }

  await acquireLlmSlot();
  try {
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
      // 429 → 서킷 트립(이후 cooldown 동안 전 호출 차단). 그 외는 서킷 영향 없음.
      if (res.status === 429) trip429();
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
    resetCircuit();   // 성공 → 서킷 리셋
    return parsed;
  } finally {
    releaseLlmSlot();
  }
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
