/**
 * LLM 백엔드 추상화 — 단일 진입점.
 *
 * 모든 LLM 호출(judgeTopic/generateStory/translate/review)은 chatJson 대신 llmCall을 부른다.
 * llmCall은 모드에 따라 분기한다:
 *   - 'api'   → chatJson (gemini API 직결, 429 백오프·서킷 그대로) = 본선
 *   - 'agent' → khalaAgentCall (Khala LLM 에이전트 위임) = 테스트/dev 전용
 *
 * 추상화 지점은 여기 한 곳뿐. 파이프라인(SearchingPipeline)·게이트·카드 상태머신은 모드 무관 동일하게 동작한다.
 *
 * ⚠️ B(agent) 경로는 *테스트/dev 전용*이며 이 파일에 격리되어 있다.
 *    상용화 시: settings.llmBackend 플래그 제거 + 이 파일의 agent 분기/khalaAgentCall 삭제 →
 *    llmCall을 chatJson 별칭으로 축소하면 핵심 파이프라인에 B 흔적 없이 깔끔히 빠진다.
 *
 * 전송은 dev proxy(/api/khala/*)를 경유 → 브라우저 CORS·키 노출 회피(Khala API키는 dev 서버 env).
 */
import { chatJson, type ChatJsonArgs, OpenAIError } from './openai';
import { recordUsage } from './usageLedger';

export type LlmBackendMode = 'api' | 'agent';

export type LlmBackendConfig = {
  mode: LlmBackendMode;
  agentInboxCode?: string;  // 위임 대상 LLM 에이전트 inbox
  selfInboxCode?: string;   // 응답 수신용 우리(NIE) inbox (recv session_code)
};

export type LlmCallArgs = ChatJsonArgs & {
  backend?: LlmBackendConfig;
  stage?: string;           // 'judgeTopic' | 'generateStory' | 'review' | 'translate' — correlation/로그용
};

/** settings에서 백엔드 설정 추출 (호출부 보일러플레이트 축소) */
export function llmBackendFrom(s: {
  llmBackend?: LlmBackendMode;
  agentInboxCode?: string;
  khalaInboxCode?: string;
}): LlmBackendConfig {
  return {
    mode: s.llmBackend ?? 'api',
    agentInboxCode: s.agentInboxCode,
    selfInboxCode: s.khalaInboxCode,
  };
}

// 예산 가드 훅 — 앱이 settings(예산·단가표)+원장 기반 판정 함수를 주입.
// true 반환 시 API 호출 차단(자동 LLM 소비 정지). 미설정 = 가드 없음.
let budgetGuard: (() => boolean) | null = null;
export function setBudgetGuard(fn: (() => boolean) | null): void {
  budgetGuard = fn;
}

/** 단일 LLM 진입점. 모드에 따라 API 직결 또는 에이전트 위임 + 토큰 사용량 적립. */
export async function llmCall<T>(args: LlmCallArgs): Promise<T> {
  const stage = args.stage ?? 'unknown';

  // B(agent) = 구독 사용 → 비용 0, 예산 가드 무관.
  if (args.backend?.mode === 'agent') {
    const data = await khalaAgentCall<T>(args);
    recordUsage({ ts: Date.now(), stage, model: args.model, promptTokens: 0, completionTokens: 0, totalTokens: 0, backend: 'agent' });
    return data;
  }

  // A(api) — 예산 한도 초과면 호출 차단(기존 fail 경로로 흘러 보류/재시도).
  if (budgetGuard?.()) {
    throw new OpenAIError('예산 한도 초과 — 자동 LLM 호출 정지(예산 가드)', 0);
  }
  const { data, usage } = await chatJson<T>(args);
  recordUsage({
    ts: Date.now(),
    stage,
    model: args.model,
    promptTokens: usage?.promptTokens ?? 0,
    completionTokens: usage?.completionTokens ?? 0,
    totalTokens: usage?.totalTokens ?? 0,
    backend: 'api',
  });
  return data;
}

// ─── B(agent) 경로 — 격리 구역 (상용 시 이 아래 전부 삭제 가능) ───────────────

const KHALA_PROXY = '/api/khala';
const AGENT_TIMEOUT_MS = 180_000;  // 에이전트는 턴기반이라 길게
const AGENT_POLL_INTERVAL_MS = 3_000;

/** NIE→에이전트 요청 봉투 (LLM 무관 표준 — system/user만 주면 어떤 LLM이든 실행) */
export type NieLlmRequest = {
  type: 'nie_llm_request';
  correlationId: string;
  stage?: string;
  system: string;
  user: string;
  expects: 'json';
  replyTo: string;          // 응답 보낼 NIE inbox code
};

/** 에이전트→NIE 응답 봉투 */
export type NieLlmResponse = {
  type: 'nie_llm_response';
  correlationId: string;
  ok: boolean;
  json?: unknown;
  error?: string;
};

// correlationId → resolver. 단일 폴러가 recv를 드레인해 라우팅.
const pendingResolvers = new Map<string, (resp: NieLlmResponse) => void>();
const earlyResponses = new Map<string, NieLlmResponse>(); // 등록 전 먼저 도착한 응답 버퍼
let pollerActive = false;

function makeCorrelationId(stage?: string): string {
  const rand = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  return `${stage ?? 'llm'}-${rand}`;
}

async function khalaSend(body: unknown): Promise<void> {
  const res = await fetch(`${KHALA_PROXY}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new OpenAIError(`Khala send 실패 HTTP ${res.status}`, res.status);
}

/** 단일 폴러: recv를 반복 드레인해 nie_llm_response를 correlationId로 라우팅. */
async function ensurePoller(selfInboxCode: string): Promise<void> {
  if (pollerActive) return;
  pollerActive = true;
  try {
    while (pendingResolvers.size > 0) {
      let msg: { body?: string } | null = null;
      try {
        const res = await fetch(`${KHALA_PROXY}/recv?session_code=${encodeURIComponent(selfInboxCode)}`);
        if (res.ok) {
          const data = await res.json() as { data?: { message?: { body?: string } | null } };
          msg = data?.data?.message ?? null;
        }
      } catch { /* 네트워크 일시 오류 → 다음 폴링 */ }

      if (msg?.body) {
        const resp = parseResponse(msg.body);
        if (resp) {
          const resolve = pendingResolvers.get(resp.correlationId);
          if (resolve) {
            pendingResolvers.delete(resp.correlationId);
            resolve(resp);
          } else {
            earlyResponses.set(resp.correlationId, resp); // 아직 대기 등록 전 → 버퍼
          }
        }
        continue; // 메시지 있었으면 즉시 다음 recv (백로그 빠르게 비움)
      }
      await delay(AGENT_POLL_INTERVAL_MS);
    }
  } finally {
    pollerActive = false;
  }
}

function parseResponse(body: string): NieLlmResponse | null {
  try {
    const obj = JSON.parse(body) as NieLlmResponse;
    if (obj && obj.type === 'nie_llm_response' && typeof obj.correlationId === 'string') return obj;
  } catch { /* JSON 아님 → 무시 */ }
  return null;
}

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function khalaAgentCall<T>(args: LlmCallArgs): Promise<T> {
  const { backend, system, user, stage } = args;
  const agentInboxCode = backend?.agentInboxCode?.trim();
  const selfInboxCode = backend?.selfInboxCode?.trim();
  if (!agentInboxCode || !selfInboxCode) {
    throw new OpenAIError('agent 백엔드 미설정 — 위임 에이전트 inbox + 우리 inbox code 필요', 0);
  }

  const correlationId = makeCorrelationId(stage);
  const request: NieLlmRequest = {
    type: 'nie_llm_request',
    correlationId,
    stage,
    system,
    user,
    expects: 'json',
    replyTo: selfInboxCode,
  };

  // Khala REST /api/send는 session_code 네이밍 요구(MCP 툴의 inbox_code와 다름).
  await khalaSend({
    sender_session_code: selfInboxCode,
    recipient_session_code: agentInboxCode,
    body: JSON.stringify(request),
  });

  const resp = await waitForResponse(selfInboxCode, correlationId);
  if (!resp.ok || resp.json == null) {
    throw new OpenAIError(`agent 응답 실패: ${resp.error ?? '빈 응답'}`, 0);
  }
  return resp.json as T;
}

function waitForResponse(selfInboxCode: string, correlationId: string): Promise<NieLlmResponse> {
  // 등록 전 이미 도착한 응답이 버퍼에 있으면 즉시 반환
  const early = earlyResponses.get(correlationId);
  if (early) {
    earlyResponses.delete(correlationId);
    return Promise.resolve(early);
  }
  return new Promise<NieLlmResponse>((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingResolvers.delete(correlationId);
      reject(new OpenAIError(`agent 응답 타임아웃 (${AGENT_TIMEOUT_MS}ms) — ${correlationId}`, 0));
    }, AGENT_TIMEOUT_MS);

    pendingResolvers.set(correlationId, (resp) => {
      clearTimeout(timer);
      resolve(resp);
    });
    void ensurePoller(selfInboxCode);
  });
}

/** 테스트용 — 대기/버퍼 상태 초기화 */
export function _resetAgentState(): void {
  pendingResolvers.clear();
  earlyResponses.clear();
  pollerActive = false;
}
