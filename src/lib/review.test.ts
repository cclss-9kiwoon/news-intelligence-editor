import { describe, it, expect } from 'vitest';
import { runRuleChecks } from './review';
import { DEFAULT_PROJECT_PROFILE } from './defaultSettings';
import type { ProjectProfile } from '../types';

const baseDraft = {
  summary: 's', headline: 'h', body: '일반 본문입니다.', tags: ['t'], sourceFacts: [] as string[],
};

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
