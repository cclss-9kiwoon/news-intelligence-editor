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

// ─── 글로벌 LLM 동시 호출 상한 (throughput vs 429) ──────────────────
// 모든 LLM 호출(generateStory/reviewDraft/translate/judge…)이 chatJson을
// 통과하므로, 여기 세마포어 하나로 전 파이프라인 동시성을 제한한다.
// 동시 MAX_CONCURRENT_LLM개만 실행, 초과분은 FIFO 큐로 대기.
//
// 기본 8 (유료 키 RPM 여유 → ②판단·③작성·④검수 직렬화 병목 완화). 순간 429는
// 위 429 지수백오프가 흡수. VITE_MAX_CONCURRENT_LLM로 빌드시 조정, setMaxConcurrentLlm로 런타임 조정.
const DEFAULT_MAX_CONCURRENT_LLM = 8;
function envMaxConcurrent(): number {
  try {
    const v = Number((import.meta as any)?.env?.VITE_MAX_CONCURRENT_LLM);
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : DEFAULT_MAX_CONCURRENT_LLM;
  } catch {
    return DEFAULT_MAX_CONCURRENT_LLM;
  }
}
export let MAX_CONCURRENT_LLM = envMaxConcurrent();

/** 런타임 동시성 상한 조정(설정 UI/튜닝용). 1 미만 무시. */
export function setMaxConcurrentLlm(n: number): void {
  if (Number.isFinite(n) && n >= 1) MAX_CONCURRENT_LLM = Math.floor(n);
}
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

// ─── 429 인-콜 지수 백오프 재시도 ───────────────────────────────────
// 순간 동시폭주로 인한 일시적 429를 흡수(유료키여도 burst 시 발생).
// 1s→2s→4s, 최대 3회. Retry-After 헤더 존중(있으면 우선, cap 내). 재시도 소진 시에만 서킷 트립.
const MAX_429_RETRIES = 3;
const RETRY_BASE_MS = 1_000;
const RETRY_CAP_MS = 8_000;

// sleep 주입 가능(테스트는 즉시 resolve로 대체). 기본 실시간.
let sleepFn: (ms: number) => Promise<void> = (ms) => new Promise(r => setTimeout(r, ms));
export function _setSleepFn(fn: (ms: number) => Promise<void>) { sleepFn = fn; } // 테스트 전용

/** Retry-After 헤더(초 또는 HTTP-date) → ms. 파싱 불가 시 null. */
function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const secs = Number(header);
  if (!Number.isNaN(secs)) return Math.max(0, secs * 1000);
  const date = Date.parse(header);
  if (!Number.isNaN(date)) return Math.max(0, date - nowFn());
  return null;
}

/** attempt(0-based)별 대기 — Retry-After 우선, 없으면 지수백오프. cap 적용. */
function retryDelayMs(attempt: number, retryAfter: number | null): number {
  const backoff = Math.min(RETRY_BASE_MS * 2 ** attempt, RETRY_CAP_MS);
  if (retryAfter != null) return Math.min(Math.max(retryAfter, backoff), RETRY_CAP_MS);
  return backoff;
}

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
    // 429 시 지수백오프로 재시도(슬롯 유지 = 동시성 자연 throttle). 소진 시에만 서킷 트립.
    for (let attempt = 0; ; attempt++) {
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
        if (res.status === 429 && attempt < MAX_429_RETRIES) {
          // 일시적 429 — Retry-After/백오프 후 재시도 (서킷 아직 트립 안 함)
          const raHeader = (res.headers && typeof res.headers.get === 'function')
            ? res.headers.get('retry-after') : null;
          const delay = retryDelayMs(attempt, parseRetryAfter(raHeader));
          console.warn(`[openai] 429 — ${delay}ms 후 재시도 (${attempt + 1}/${MAX_429_RETRIES})`);
          await sleepFn(delay);
          continue;
        }
        // 429 재시도 소진 → 서킷 트립(이후 cooldown 동안 전 호출 차단). 그 외 상태는 서킷 영향 없음.
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
    }
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
