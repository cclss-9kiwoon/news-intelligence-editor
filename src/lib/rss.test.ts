import { describe, it, expect } from 'vitest';
import { dedupeAndMerge, normalizeLink, makeArticleId, getRssBackoffUntil, RSS_BACKOFF_MS } from './rss';
import type { Article } from '../types';

const BACKOFF_PREFIX = 'nie:rss-backoff:';

function fakeArticle(over: Partial<Article>): Article {
  return {
    id: 'x',
    title: 't',
    description: 'd',
    link: 'https://e.com/a',
    pubDate: '2026-01-01',
    source: 's',
    inputType: 'rss',
    fetchedAt: 0,
    ...over,
  };
}

describe('rss.normalizeLink', () => {
  it('strips utm_* params', () => {
    expect(normalizeLink('https://e.com/a?utm_source=x&id=1')).toBe('https://e.com/a?id=1');
  });
  it('handles links with no params', () => {
    expect(normalizeLink('https://e.com/a')).toBe('https://e.com/a');
  });
  it('preserves non-utm params', () => {
    expect(normalizeLink('https://e.com/a?id=1&page=2')).toBe('https://e.com/a?id=1&page=2');
  });
});

describe('rss.makeArticleId', () => {
  it('returns the same id for the same normalized link', () => {
    const a = makeArticleId('https://e.com/a?utm_source=x');
    const b = makeArticleId('https://e.com/a');
    expect(a).toBe(b);
  });
});

describe('rss.dedupeAndMerge', () => {
  it('merges new items into existing, removing duplicates by id', () => {
    const existing: Article[] = [fakeArticle({ id: '1', title: 'old' })];
    const incoming: Article[] = [
      fakeArticle({ id: '1', title: 'updated' }),
      fakeArticle({ id: '2', title: 'new' }),
    ];
    const merged = dedupeAndMerge(existing, incoming, 200);
    expect(merged).toHaveLength(2);
    expect(merged.find(a => a.id === '1')!.title).toBe('old');
  });

  it('caps the merged list at maxSize (FIFO)', () => {
    const existing: Article[] = Array.from({ length: 200 }, (_, i) =>
      fakeArticle({ id: `e${i}`, fetchedAt: i })
    );
    const incoming: Article[] = [fakeArticle({ id: 'new', fetchedAt: 999 })];
    const merged = dedupeAndMerge(existing, incoming, 200);
    expect(merged).toHaveLength(200);
    expect(merged.find(a => a.id === 'new')).toBeTruthy();
    expect(merged.find(a => a.id === 'e0')).toBeFalsy();
  });

  it('sorts by fetchedAt desc (newest first)', () => {
    const merged = dedupeAndMerge(
      [],
      [
        fakeArticle({ id: '1', fetchedAt: 1 }),
        fakeArticle({ id: '2', fetchedAt: 3 }),
        fakeArticle({ id: '3', fetchedAt: 2 }),
      ],
      10
    );
    expect(merged.map(a => a.id)).toEqual(['2', '3', '1']);
  });
});

describe('rss.getRssBackoffUntil', () => {
  it('returns null when no backoff set', () => {
    localStorage.removeItem(BACKOFF_PREFIX + 'src1');
    expect(getRssBackoffUntil('src1')).toBeNull();
  });

  it('returns expiry timestamp when within backoff window', () => {
    const now = Date.now();
    localStorage.setItem(BACKOFF_PREFIX + 'src2', String(now));
    const until = getRssBackoffUntil('src2');
    expect(until).not.toBeNull();
    expect(until! - now).toBeGreaterThan(RSS_BACKOFF_MS - 5_000);
    expect(until! - now).toBeLessThanOrEqual(RSS_BACKOFF_MS);
    localStorage.removeItem(BACKOFF_PREFIX + 'src2');
  });

  it('returns null when backoff window already elapsed', () => {
    localStorage.setItem(BACKOFF_PREFIX + 'src3', String(Date.now() - RSS_BACKOFF_MS - 1000));
    expect(getRssBackoffUntil('src3')).toBeNull();
    localStorage.removeItem(BACKOFF_PREFIX + 'src3');
  });
});
