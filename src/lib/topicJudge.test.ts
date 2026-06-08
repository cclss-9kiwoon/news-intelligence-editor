import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { judgeTopicAdequacy, judgeTopic } from './topicJudge';
import { resetLlmCircuit, _setSleepFn } from './openai';
import { DEFAULT_SETTINGS } from './defaultSettings';
import type { Settings } from '../types';

const SETTINGS: Settings = { ...DEFAULT_SETTINGS, apiKey: 'k', model: 'm' };
const subject = { title: 'aespa 컴백', snippets: ['새 미니앨범 발매'] };

function stubLlm(resp: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: JSON.stringify(resp) } }] }),
  } as unknown as Response)));
}

beforeEach(() => { _setSleepFn(async () => {}); });   // 429 백오프 즉시 통과(테스트 가속)
afterEach(() => { vi.unstubAllGlobals(); resetLlmCircuit(); });

describe('judgeTopicAdequacy (fail-closed)', () => {
  it('빈 intent면 게이트 비활성 → adequate=true, decided=true', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const r = await judgeTopicAdequacy(subject, '   ', SETTINGS);
    expect(r).toMatchObject({ adequate: true, decided: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('apiKey 없으면 보류 (decided=false, fail-closed)', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const r = await judgeTopicAdequacy(subject, 'K-pop 컴백', { ...SETTINGS, apiKey: '' });
    expect(r).toMatchObject({ adequate: false, decided: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('LLM 명확 부합 → adequate=true, decided=true', async () => {
    stubLlm({ adequate: true });
    const r = await judgeTopicAdequacy(subject, 'K-pop 컴백', SETTINGS);
    expect(r).toMatchObject({ adequate: true, decided: true });
  });

  it('LLM 명확 부적합 → adequate=false, decided=true + reason', async () => {
    stubLlm({ adequate: false, reason: '금융 기사' });
    const r = await judgeTopicAdequacy(subject, 'K-pop 컴백', SETTINGS);
    expect(r).toMatchObject({ adequate: false, decided: true, reason: '금융 기사' });
  });

  it('응답에 adequate 불리언 없으면 보류 (decided=false)', async () => {
    stubLlm({ foo: 'bar' });
    const r = await judgeTopicAdequacy(subject, 'K-pop 컴백', SETTINGS);
    expect(r).toMatchObject({ adequate: false, decided: false });
  });

  it('호출 실패(throw)면 보류 (decided=false, 통과 금지)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) } as unknown as Response)));
    const r = await judgeTopicAdequacy(subject, 'K-pop 컴백', SETTINGS);
    expect(r).toMatchObject({ adequate: false, decided: false });
  });

  it('429로 서킷 open이면 호출 안 하고 즉시 보류', async () => {
    // 먼저 429로 서킷 트립
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 429, json: async () => ({}) } as unknown as Response)));
    await judgeTopicAdequacy(subject, 'K-pop 컴백', SETTINGS); // 트립
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const r = await judgeTopicAdequacy(subject, 'K-pop 컴백', SETTINGS);
    expect(r.decided).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled(); // 서킷 open → 호출 스킵
  });
});

describe('judgeTopic (통합 — 적합+제외 1콜, fail-closed)', () => {
  it('intent·excludeTopics 모두 비면 LLM 콜 없이 통과', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const r = await judgeTopic(subject, '  ', ['  ', ''], SETTINGS);
    expect(r).toMatchObject({ decided: true, adequate: true, excluded: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('단일 콜로 적합·제외 동시 판정 (적합&비제외 → 통과)', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({ adequate: true, excluded: false }) } }] }),
    } as unknown as Response));
    vi.stubGlobal('fetch', fetchMock);
    const r = await judgeTopic(subject, 'K-pop 컴백', ['열애설'], SETTINGS);
    expect(r).toMatchObject({ decided: true, adequate: true, excluded: false });
    expect(fetchMock).toHaveBeenCalledTimes(1); // 2콜→1콜
  });

  it('제외 주제 해당 → excluded=true, matched 채움', async () => {
    stubLlm({ adequate: true, excluded: true, matched: '열애설' });
    const r = await judgeTopic(subject, 'K-pop 컴백', ['열애설'], SETTINGS);
    expect(r).toMatchObject({ decided: true, excluded: true, excludedMatch: '열애설' });
  });

  it('부적합 → adequate=false + reason', async () => {
    stubLlm({ adequate: false, reason: '금융 기사' });
    const r = await judgeTopic(subject, 'K-pop 컴백', ['열애설'], SETTINGS);
    expect(r).toMatchObject({ decided: true, adequate: false, reason: '금융 기사' });
  });

  it('intent 비고 excludeTopics만 → 적합 자동통과, 제외만 판정', async () => {
    stubLlm({ excluded: false });
    const r = await judgeTopic(subject, '', ['열애설'], SETTINGS);
    expect(r).toMatchObject({ decided: true, adequate: true, excluded: false });
  });

  it('excludeTopics 비고 intent만 → 제외 스킵(excluded=false)', async () => {
    stubLlm({ adequate: true });
    const r = await judgeTopic(subject, 'K-pop 컴백', [], SETTINGS);
    expect(r).toMatchObject({ decided: true, adequate: true, excluded: false });
  });

  it('apiKey 없으면 보류 (decided=false, fail-closed)', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const r = await judgeTopic(subject, 'K-pop 컴백', ['열애설'], { ...SETTINGS, apiKey: '' });
    expect(r).toMatchObject({ decided: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('intent 활성인데 adequate 불리언 없으면 보류 (decided=false)', async () => {
    stubLlm({ excluded: false });
    const r = await judgeTopic(subject, 'K-pop 컴백', ['열애설'], SETTINGS);
    expect(r).toMatchObject({ decided: false });
  });

  it('호출 실패(throw)면 보류 (decided=false, 통과 금지)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) } as unknown as Response)));
    const r = await judgeTopic(subject, 'K-pop 컴백', ['열애설'], SETTINGS);
    expect(r).toMatchObject({ decided: false });
  });
});
