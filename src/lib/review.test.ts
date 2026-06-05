import { describe, it, expect, vi, afterEach } from 'vitest';
import { runRuleChecks, reviewDraft } from './review';
import { DEFAULT_PROJECT_PROFILE, DEFAULT_SETTINGS } from './defaultSettings';
import type { ProjectProfile, Settings } from '../types';

const baseDraft = {
  summary: 's', headline: 'h', body: '일반 본문입니다.', tags: ['t'], sourceFacts: [] as string[],
};

const SETTINGS: Settings = { ...DEFAULT_SETTINGS, apiKey: 'k', model: 'm' };

function stubReviewLlm(resp: { findings?: unknown[]; sensitive?: unknown }) {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: JSON.stringify({ findings: [], ...resp }) } }] }),
  } as unknown as Response)));
}

describe('runRuleChecks', () => {
  it('flags <figure> when imageMarkup is img-direct (block)', () => {
    const out = runRuleChecks({ ...baseDraft, body: '<figure><img src="x"></figure>' }, DEFAULT_PROJECT_PROFILE);
    const f = out.find(x => x.ruleId === 'fmt-figure-banned');
    expect(f?.severity).toBe('block');
  });

  it('allows <figure> when imageMarkup is figure', () => {
    const profile: ProjectProfile = {
      ...DEFAULT_PROJECT_PROFILE,
      formatRules: { ...DEFAULT_PROJECT_PROFILE.formatRules, imageMarkup: 'figure' },
    };
    const out = runRuleChecks({ ...baseDraft, body: '<figure><img src="x"></figure>' }, profile);
    expect(out.find(x => x.ruleId === 'fmt-figure-banned')).toBeUndefined();
  });

  it('warns on <a href> link when artistMarkup is strong', () => {
    const out = runRuleChecks({ ...baseDraft, body: '<a href="/x">아이유</a> 컴백' }, DEFAULT_PROJECT_PROFILE);
    expect(out.find(x => x.ruleId === 'fmt-link-banned')?.severity).toBe('warn');
  });

  it('flags body over max length (text only, tags excluded)', () => {
    const profile: ProjectProfile = {
      ...DEFAULT_PROJECT_PROFILE,
      formatRules: { ...DEFAULT_PROJECT_PROFILE.formatRules, bodyMaxChars: 10 },
    };
    const out = runRuleChecks({ ...baseDraft, body: '이것은 열 글자를 훨씬 넘는 긴 본문입니다.' }, profile);
    expect(out.find(x => x.ruleId === 'fmt-len-max')).toBeDefined();
  });

  it('blocks when banned media cited', () => {
    const profile: ProjectProfile = { ...DEFAULT_PROJECT_PROFILE, bannedMedia: ['Soompi'] };
    const out = runRuleChecks({ ...baseDraft, body: 'Soompi에 따르면...' }, profile);
    expect(out.find(x => x.ruleId.startsWith('fmt-banned-media'))?.severity).toBe('block');
  });

  it('clean draft yields no rule findings', () => {
    const out = runRuleChecks(baseDraft, DEFAULT_PROJECT_PROFILE);
    expect(out).toHaveLength(0);
  });
});

describe('reviewDraft needsHuman (자율발행 안전장치)', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('민감주제면 needsHuman + 사유', async () => {
    stubReviewLlm({ sensitive: { flag: true, reason: '법적분쟁' } });
    const r = await reviewDraft(baseDraft, SETTINGS);
    expect(r.needsHuman).toBe(true);
    expect(r.needsHumanReasons?.some(x => x.includes('민감'))).toBe(true);
  });

  it('깨끗 + 비민감이면 needsHuman false', async () => {
    stubReviewLlm({ sensitive: { flag: false } });
    const r = await reviewDraft(baseDraft, SETTINGS);
    expect(r.needsHuman).toBe(false);
    expect(r.needsHumanReasons).toEqual([]);
  });

  it('block finding 있으면 needsHuman (figure 금지)', async () => {
    stubReviewLlm({ sensitive: { flag: false } });
    const r = await reviewDraft({ ...baseDraft, body: '<figure>x</figure>' }, SETTINGS);
    expect(r.passed).toBe(false);
    expect(r.needsHuman).toBe(true);
  });

  it('LLM 검수 실패(throw)면 불확실 → needsHuman', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) } as unknown as Response)));
    const r = await reviewDraft(baseDraft, SETTINGS);
    expect(r.needsHuman).toBe(true);
    expect(r.needsHumanReasons?.some(x => x.includes('불확실'))).toBe(true);
  });
});
