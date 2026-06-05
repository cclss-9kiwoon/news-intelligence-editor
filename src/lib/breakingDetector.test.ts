import { describe, it, expect } from 'vitest';
import { detect, judgeBreaking, BREAKING_KEYWORDS, generateMockBreaking } from './breakingDetector';
import type { Article } from '../types';

function art(over: Partial<Article>): Article {
  return {
    id: 'x', title: '', description: '', link: 'https://e.com',
    pubDate: '', source: 's', inputType: 'rss', fetchedAt: 0,
    ...over,
  };
}

describe('breakingDetector.detect', () => {
  it('returns null for non-breaking article', () => {
    expect(detect(art({ title: '신곡 발매', description: '새 앨범' }))).toBeNull();
  });

  it('marks [속보] prefix as critical', () => {
    const r = detect(art({ title: '[속보] 무언가 발생' }));
    expect(r?.severity).toBe('critical');
  });

  it('marks [단독] prefix as critical', () => {
    expect(detect(art({ title: '[단독] 폭로' }))?.severity).toBe('critical');
  });

  it('marks 2+ keyword matches as high', () => {
    const r = detect(art({ title: '아이돌 컴백', description: '동시에 입대 발표' }));
    expect(r?.severity).toBe('high');
    expect(r?.matchedKeywords.length).toBeGreaterThanOrEqual(2);
  });

  it('marks 1 keyword match as medium', () => {
    const r = detect(art({ title: '결혼 발표' }));
    expect(r?.severity).toBe('medium');
  });
});

describe('breakingDetector.judgeBreaking', () => {
  it('true when default detector matches', () => {
    expect(judgeBreaking(art({ title: '[속보] 발생' }))).toBe(true);
    expect(judgeBreaking(art({ title: '결혼 발표' }))).toBe(true);
  });
  it('false for plain article with no keywords', () => {
    expect(judgeBreaking(art({ title: '신곡 소개', description: '평범한 기사' }))).toBe(false);
  });
  it('true when campaign breakingKeywords match (detector miss)', () => {
    expect(judgeBreaking(art({ title: '○○ 월드투어 추가 공연', description: '' }), ['월드투어'])).toBe(true);
  });
  it('campaign keywords are trimmed + empty ignored', () => {
    expect(judgeBreaking(art({ title: '평범' }), ['', '  '])).toBe(false);
  });
});

describe('breakingDetector.generateMockBreaking', () => {
  it('returns a simulator-flagged Article with [속보]/[단독]/[긴급] prefix', () => {
    const a = generateMockBreaking();
    expect(a.inputType).toBe('simulator');
    expect(a.title.startsWith('[속보]') || a.title.startsWith('[단독]') || a.title.startsWith('[긴급]')).toBe(true);
  });

  it('exposes a non-empty keyword list', () => {
    expect(BREAKING_KEYWORDS.length).toBeGreaterThan(10);
  });
});
