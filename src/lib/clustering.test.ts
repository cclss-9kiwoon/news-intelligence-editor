import { describe, it, expect } from 'vitest';
import {
  extractEntities,
  tokenize,
  jaccard,
  similarity,
  groupIntoClusters,
} from './clustering';
import type { Article } from '../types';

function art(over: Partial<Article>): Article {
  return {
    id: Math.random().toString(36).slice(2),
    title: '',
    description: '',
    link: 'https://e.com/' + Math.random(),
    pubDate: '',
    source: 's',
    inputType: 'rss',
    fetchedAt: Date.now(),
    ...over,
  };
}

describe('extractEntities', () => {
  it('extracts capitalized English entities', () => {
    const e = extractEntities('BLACKPINK announces comeback in Seoul');
    expect(e).toContain('BLACKPINK');
    expect(e).toContain('Seoul');
  });

  it('extracts Korean 2-4 char name-like tokens', () => {
    const e = extractEntities('가수 아이유, 새 앨범 발매');
    expect(e).toContain('아이유');
  });

  it('returns empty array on empty input', () => {
    expect(extractEntities('')).toEqual([]);
  });
});

describe('tokenize', () => {
  it('strips punctuation and Korean particles', () => {
    const t = tokenize('BLACKPINK이 컴백을 발표했다.');
    expect(t).toContain('BLACKPINK');
    expect(t).toContain('컴백');
    expect(t).toContain('발표');
    expect(t).not.toContain('이');
    expect(t).not.toContain('을');
  });

  it('lowercases english tokens for matching but keeps original entities', () => {
    const t = tokenize('Seoul concert announced');
    expect(t).toContain('seoul');
  });
});

describe('jaccard', () => {
  it('returns 1 for identical sets', () => {
    expect(jaccard(new Set(['a', 'b']), new Set(['a', 'b']))).toBe(1);
  });
  it('returns 0 for disjoint sets', () => {
    expect(jaccard(new Set(['a']), new Set(['b']))).toBe(0);
  });
  it('computes intersection / union', () => {
    expect(jaccard(new Set(['a', 'b', 'c']), new Set(['b', 'c', 'd']))).toBeCloseTo(2 / 4);
  });
  it('returns 0 when both empty', () => {
    expect(jaccard(new Set(), new Set())).toBe(0);
  });
});

describe('similarity', () => {
  it('high when entities + title tokens overlap', () => {
    const a = art({ title: 'BLACKPINK announces Seoul comeback' });
    const b = art({ title: 'BLACKPINK comeback set for Seoul' });
    expect(similarity(a, b)).toBeGreaterThan(0.5);
  });

  it('low when entities differ', () => {
    const a = art({ title: 'BLACKPINK announces comeback' });
    const b = art({ title: 'BTS member discharged from military' });
    expect(similarity(a, b)).toBeLessThan(0.3);
  });
});

describe('groupIntoClusters', () => {
  const now = Date.now();

  it('groups two similar articles together', () => {
    const a = art({ id: '1', title: 'BLACKPINK 컴백 발표', fetchedAt: now });
    const b = art({ id: '2', title: 'BLACKPINK 새 앨범 컴백', fetchedAt: now });
    const clusters = groupIntoClusters([a, b], { threshold: 0.3 });
    expect(clusters).toHaveLength(1);
    expect(clusters[0].articleIds).toEqual(expect.arrayContaining(['1', '2']));
  });

  it('separates unrelated articles', () => {
    const a = art({ id: '1', title: 'BLACKPINK 컴백', fetchedAt: now });
    const b = art({ id: '2', title: 'BTS 멤버 입대', fetchedAt: now });
    const clusters = groupIntoClusters([a, b], { threshold: 0.5 });
    expect(clusters).toHaveLength(2);
  });

  it('drops articles older than windowMs', () => {
    const a = art({ id: 'old', title: '오래된 기사', fetchedAt: now - 48 * 3600_000 });
    const b = art({ id: 'new', title: '최신 기사', fetchedAt: now });
    const clusters = groupIntoClusters([a, b], { windowMs: 24 * 3600_000, now });
    expect(clusters.flatMap(c => c.articleIds)).not.toContain('old');
    expect(clusters.flatMap(c => c.articleIds)).toContain('new');
  });

  it('cluster id is stable for same article set (sorted)', () => {
    const a = art({ id: 'a', title: '뉴스', fetchedAt: now });
    const b = art({ id: 'b', title: '뉴스', fetchedAt: now });
    const c1 = groupIntoClusters([a, b], { threshold: 0.1 });
    const c2 = groupIntoClusters([b, a], { threshold: 0.1 });
    expect(c1[0].id).toBe(c2[0].id);
  });

  it('representativeTitle is from the most recent article', () => {
    const older = art({ id: '1', title: 'old title', fetchedAt: now - 1000 });
    const newer = art({ id: '2', title: 'new title', fetchedAt: now });
    const clusters = groupIntoClusters([older, newer], { threshold: 0.05 });
    expect(clusters[0].representativeTitle).toBe('new title');
  });
});
