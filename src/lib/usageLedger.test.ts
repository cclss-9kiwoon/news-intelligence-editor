import { describe, it, expect, beforeEach } from 'vitest';
import {
  costOf, recordUsage, aggregate, budgetStatus, _resetUsage, DEFAULT_PRICE_TABLE,
} from './usageLedger';

beforeEach(() => { _resetUsage(); });

const flash = 'gemini-2.5-flash';

describe('costOf', () => {
  it('입력/출력 토큰 × 단가($/1M)', () => {
    // flash: in 0.30, out 2.50 per 1M
    const usd = costOf(flash, { promptTokens: 1_000_000, completionTokens: 1_000_000, totalTokens: 2_000_000 });
    expect(usd).toBeCloseTo(0.30 + 2.50, 6);
  });
  it('단가표에 없는 모델 → 0', () => {
    expect(costOf('unknown', { promptTokens: 1e6, completionTokens: 0, totalTokens: 1e6 })).toBe(0);
  });
  it('usage 없으면 0', () => {
    expect(costOf(flash, undefined)).toBe(0);
  });
});

describe('aggregate', () => {
  it('단계별·모델별·총합 집계 + agent는 비용 0', () => {
    const now = 1_700_000_000_000;
    recordUsage({ ts: now, stage: 'judgeTopic', model: flash, promptTokens: 1e6, completionTokens: 0, totalTokens: 1e6, backend: 'api' });
    recordUsage({ ts: now, stage: 'generateStory', model: flash, promptTokens: 0, completionTokens: 1e6, totalTokens: 1e6, backend: 'api' });
    recordUsage({ ts: now, stage: 'generateStory', model: flash, promptTokens: 5e5, completionTokens: 5e5, totalTokens: 1e6, backend: 'agent' }); // 무료

    const a = aggregate(now + 1000);
    expect(a.total.tokens).toBe(3e6);
    expect(a.total.usd).toBeCloseTo(0.30 + 2.50, 6); // agent 제외
    expect(a.byStage.judgeTopic.usd).toBeCloseTo(0.30, 6);
    expect(a.byStage.generateStory.usd).toBeCloseTo(2.50, 6); // api분만
    expect(a.byModel[flash].tokens).toBe(3e6);
  });
});

describe('budgetStatus (예산 가드)', () => {
  it('일 한도 누적 도달 시 tripped(scope=day)', () => {
    const now = 1_700_000_000_000;
    // flash out 2.5/1M → 2M completion = $5
    recordUsage({ ts: now, stage: 'generateStory', model: flash, promptTokens: 0, completionTokens: 2e6, totalTokens: 2e6, backend: 'api' });
    const s = budgetStatus(now + 1000, { dailyUsd: 4 });
    expect(s.tripped).toBe(true);
    expect(s.scope).toBe('day');
    expect(s.daySpentUsd).toBeCloseTo(5, 6);
  });
  it('한도 0(무제한)이면 tripped 안 함', () => {
    const now = 1_700_000_000_000;
    recordUsage({ ts: now, stage: 'review', model: flash, promptTokens: 1e7, completionTokens: 1e7, totalTokens: 2e7, backend: 'api' });
    expect(budgetStatus(now + 1000, { dailyUsd: 0, hourlyUsd: 0 }).tripped).toBe(false);
  });
  it('agent(무료)만이면 비용 0 → tripped 안 함', () => {
    const now = 1_700_000_000_000;
    recordUsage({ ts: now, stage: 'generateStory', model: flash, promptTokens: 1e7, completionTokens: 1e7, totalTokens: 2e7, backend: 'agent' });
    expect(budgetStatus(now + 1000, { dailyUsd: 1 }).tripped).toBe(false);
  });
});

describe('DEFAULT_PRICE_TABLE', () => {
  it('gemini 2.5 flash/pro 시드 존재', () => {
    expect(DEFAULT_PRICE_TABLE['gemini-2.5-flash']).toBeTruthy();
    expect(DEFAULT_PRICE_TABLE['gemini-2.5-pro']).toBeTruthy();
  });
});
