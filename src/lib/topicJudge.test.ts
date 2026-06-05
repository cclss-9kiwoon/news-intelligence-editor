import { describe, it, expect, vi, afterEach } from 'vitest';
import { judgeTopicAdequacy } from './topicJudge';
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

afterEach(() => { vi.unstubAllGlobals(); });

describe('judgeTopicAdequacy', () => {
  it('빈 intent면 LLM 호출 없이 adequate=true (게이트 비활성)', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const r = await judgeTopicAdequacy(subject, '   ', SETTINGS);
    expect(r.adequate).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('apiKey 없으면 fail-open (호출 없이 true)', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const r = await judgeTopicAdequacy(subject, 'K-pop 컴백', { ...SETTINGS, apiKey: '' });
    expect(r.adequate).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('LLM adequate=false면 부적합 + reason', async () => {
    stubLlm({ adequate: false, reason: '주제 범위 밖' });
    const r = await judgeTopicAdequacy(subject, 'K-pop 컴백', SETTINGS);
    expect(r.adequate).toBe(false);
    expect(r.reason).toBe('주제 범위 밖');
  });

  it('LLM adequate=true면 통과', async () => {
    stubLlm({ adequate: true });
    const r = await judgeTopicAdequacy(subject, 'K-pop 컴백', SETTINGS);
    expect(r.adequate).toBe(true);
  });

  it('응답 누락/파싱불가는 fail-open (true)', async () => {
    stubLlm({ foo: 'bar' });
    const r = await judgeTopicAdequacy(subject, 'K-pop 컴백', SETTINGS);
    expect(r.adequate).toBe(true);
  });

  it('호출 실패(throw)면 fail-open (true)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) } as unknown as Response)));
    const r = await judgeTopicAdequacy(subject, 'K-pop 컴백', SETTINGS);
    expect(r.adequate).toBe(true);
  });
});
