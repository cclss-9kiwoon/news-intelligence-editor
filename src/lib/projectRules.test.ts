import { describe, it, expect } from 'vitest';
import { buildProjectRulesText } from './projectRules';
import { DEFAULT_PROJECT_PROFILE } from './defaultSettings';
import type { ProjectProfile } from '../types';

describe('buildProjectRulesText', () => {
  it('emits quote rules from default profile', () => {
    const txt = buildProjectRulesText(DEFAULT_PROJECT_PROFILE);
    expect(txt).toContain('곡명/트랙명은 큰따옴표');
    expect(txt).toContain('앨범/EP/쇼/드라마/투어명은 작은따옴표');
  });

  it('reflects strong artist markup + img-direct image rule', () => {
    const txt = buildProjectRulesText(DEFAULT_PROJECT_PROFILE);
    expect(txt).toContain('<strong>이름</strong>');
    expect(txt).toContain('<figure> 태그는 쓰지 않는다');
  });

  it('includes banned media and freeform style guide', () => {
    const profile: ProjectProfile = {
      ...DEFAULT_PROJECT_PROFILE,
      bannedMedia: ['Soompi', 'Koreaboo'],
      styleGuide: 'News Article URL 필드는 비운다.',
    };
    const txt = buildProjectRulesText(profile);
    expect(txt).toContain('금지 소스 매체: Soompi, Koreaboo');
    expect(txt).toContain('News Article URL 필드는 비운다.');
  });

  it('emits length range only when set', () => {
    const noLen = buildProjectRulesText(DEFAULT_PROJECT_PROFILE);
    expect(noLen).not.toContain('본문 길이는');

    const withLen = buildProjectRulesText({
      ...DEFAULT_PROJECT_PROFILE,
      formatRules: { ...DEFAULT_PROJECT_PROFILE.formatRules, bodyMinChars: 800, bodyMaxChars: 1200 },
    });
    expect(withLen).toContain('본문 길이는 800~1200자');
  });

  it('switches quote style when configured', () => {
    const txt = buildProjectRulesText({
      ...DEFAULT_PROJECT_PROFILE,
      formatRules: { ...DEFAULT_PROJECT_PROFILE.formatRules, quoteSong: 'single' },
    });
    expect(txt).toContain("곡명/트랙명은 작은따옴표('')");
  });
});
