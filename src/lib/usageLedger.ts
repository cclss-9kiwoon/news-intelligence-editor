/**
 * LLM 토큰 사용량 원장 + 비용 환산 + 예산 가드.
 *
 * - llmCall이 호출마다 토큰을 recordUsage로 적립(원시 토큰만 — usd는 읽을 때 단가표로 환산).
 * - aggregate로 오늘/누적·단계별·모델별·시간당 소비율 집계(대시보드).
 * - budgetStatus로 일/시간 한도 초과 판정(예산 가드 — 자동진행 정지/배너의 근거).
 * - B(agent) 모드는 구독 사용 → cost 0("위임(무료)") 구분.
 *
 * 분담: 본 파일(NIE) = 적립·환산·가드 로직. Engineer = 대시보드/예산설정 UI·배너.
 */
import type { LlmUsage } from './openai';

// ─── 단가표 (USD per 1M tokens) ─────────────────────────────────────
export type ModelPrice = { inputPer1M: number; outputPer1M: number };
export type PriceTable = Record<string, ModelPrice>;

// Google 공식 published price(2025) 시드 — 설정에서 사용자가 덮어쓸 수 있음.
export const DEFAULT_PRICE_TABLE: PriceTable = {
  'gemini-2.5-flash': { inputPer1M: 0.30, outputPer1M: 2.50 },
  'gemini-2.5-pro': { inputPer1M: 1.25, outputPer1M: 10.00 },
};

/** model 단가 환산. 단가표에 없거나 usage 없으면 0. */
export function costOf(model: string, usage: LlmUsage | undefined, table: PriceTable = DEFAULT_PRICE_TABLE): number {
  if (!usage) return 0;
  const p = table[model];
  if (!p) return 0;
  return (usage.promptTokens / 1e6) * p.inputPer1M + (usage.completionTokens / 1e6) * p.outputPer1M;
}

// ─── 원장 ───────────────────────────────────────────────────────────
export type LlmBackendKind = 'api' | 'agent';

export type UsageEntry = {
  ts: number;             // epoch ms
  stage: string;          // judgeTopic | generateStory | review | translate
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  backend: LlmBackendKind; // agent = 구독(비용 0)
};

const entries: UsageEntry[] = [];
let persistFn: ((all: readonly UsageEntry[]) => void) | null = null;

/** 영속 저장 훅 등록(앱이 storage 연동). 미설정 시 메모리만. */
export function setUsagePersist(fn: ((all: readonly UsageEntry[]) => void) | null): void {
  persistFn = fn;
}

/** 영속 저장분 로드(앱 시작 시). */
export function loadUsageEntries(init: UsageEntry[]): void {
  entries.splice(0, entries.length, ...init);
}

export function recordUsage(e: UsageEntry): void {
  entries.push(e);
  persistFn?.(entries);
}

export function getUsageEntries(): readonly UsageEntry[] {
  return entries;
}

/** 테스트용 — 원장 초기화 */
export function _resetUsage(): void {
  entries.length = 0;
}

// ─── 집계 ───────────────────────────────────────────────────────────
export type UsageWindow = { tokens: number; usd: number };

function startOfDay(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function windowSum(sinceTs: number, table: PriceTable): UsageWindow {
  let tokens = 0;
  let usd = 0;
  for (const e of entries) {
    if (e.ts < sinceTs) continue;
    tokens += e.totalTokens;
    if (e.backend === 'api') {
      usd += costOf(e.model, { promptTokens: e.promptTokens, completionTokens: e.completionTokens, totalTokens: e.totalTokens }, table);
    }
    // agent = 구독 → usd 0
  }
  return { tokens, usd };
}

export type UsageAggregate = {
  today: UsageWindow;
  total: UsageWindow;
  byStage: Record<string, UsageWindow>;
  byModel: Record<string, UsageWindow>;
  hourlyUsd: number;   // 최근 1시간 소비(소진속도)
};

export function aggregate(now: number, table: PriceTable = DEFAULT_PRICE_TABLE): UsageAggregate {
  const byStage: Record<string, UsageWindow> = {};
  const byModel: Record<string, UsageWindow> = {};
  const total: UsageWindow = { tokens: 0, usd: 0 };
  const dayStart = startOfDay(now);
  const today: UsageWindow = { tokens: 0, usd: 0 };
  const hourAgo = now - 3_600_000;
  let hourlyUsd = 0;

  for (const e of entries) {
    const usd = e.backend === 'api'
      ? costOf(e.model, { promptTokens: e.promptTokens, completionTokens: e.completionTokens, totalTokens: e.totalTokens }, table)
      : 0;
    total.tokens += e.totalTokens; total.usd += usd;
    (byStage[e.stage] ??= { tokens: 0, usd: 0 });
    byStage[e.stage].tokens += e.totalTokens; byStage[e.stage].usd += usd;
    (byModel[e.model] ??= { tokens: 0, usd: 0 });
    byModel[e.model].tokens += e.totalTokens; byModel[e.model].usd += usd;
    if (e.ts >= dayStart) { today.tokens += e.totalTokens; today.usd += usd; }
    if (e.ts >= hourAgo) hourlyUsd += usd;
  }
  return { today, total, byStage, byModel, hourlyUsd };
}

// ─── 예산 가드 ──────────────────────────────────────────────────────
export type BudgetConfig = {
  dailyUsd?: number;   // 0/undefined = 무제한
  hourlyUsd?: number;  // 0/undefined = 무제한
};

export type BudgetStatus = {
  tripped: boolean;
  scope?: 'day' | 'hour';
  daySpentUsd: number;
  hourSpentUsd: number;
  dayLimitUsd: number;
  hourLimitUsd: number;
};

/** 누적 소비 기준 예산 초과 판정(잔량 API 없음). 일 또는 시간 한도 도달 시 tripped. */
export function budgetStatus(now: number, cfg: BudgetConfig, table: PriceTable = DEFAULT_PRICE_TABLE): BudgetStatus {
  const daySpentUsd = windowSum(startOfDay(now), table).usd;
  const hourSpentUsd = windowSum(now - 3_600_000, table).usd;
  const dayLimitUsd = cfg.dailyUsd ?? 0;
  const hourLimitUsd = cfg.hourlyUsd ?? 0;
  const dayOver = dayLimitUsd > 0 && daySpentUsd >= dayLimitUsd;
  const hourOver = hourLimitUsd > 0 && hourSpentUsd >= hourLimitUsd;
  return {
    tripped: dayOver || hourOver,
    scope: dayOver ? 'day' : hourOver ? 'hour' : undefined,
    daySpentUsd, hourSpentUsd, dayLimitUsd, hourLimitUsd,
  };
}
