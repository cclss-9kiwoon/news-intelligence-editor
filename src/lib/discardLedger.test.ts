import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordDiscard, loadDiscarded, clearDiscarded, makeDiscardEntry, buildDiscardIndex,
} from './discardLedger';
import { shouldClaimCluster } from './searchFilter';
import type { Cluster, Article, SourceConfig } from '../types';

beforeEach(() => { localStorage.clear(); });

const NOW = 1_700_000_000_000;
const DAY = 86_400_000;

describe('discardLedger', () => {
  it('record→load 왕복', () => {
    recordDiscard(makeDiscardEntry({ title: '에스파 컴백', urls: ['https://a.com/x'], articleIds: ['id1'] }), NOW);
    const all = loadDiscarded(NOW);
    expect(all).toHaveLength(1);
    expect(all[0].titleSig).toBe('에스파 컴백');
    expect(all[0].articleIds).toEqual(['id1']);
  });

  it('30일 만료 항목 제외', () => {
    recordDiscard(makeDiscardEntry({ title: '오래된 건' }), NOW - 31 * DAY);
    recordDiscard(makeDiscardEntry({ title: '최근 건' }), NOW - 1 * DAY);
    const all = loadDiscarded(NOW);
    expect(all.map(e => e.titleSig)).toEqual(['최근 건']);
  });

  it('clearDiscarded 비우기', () => {
    recordDiscard(makeDiscardEntry({ title: 'x' }), NOW);
    clearDiscarded();
    expect(loadDiscarded(NOW)).toHaveLength(0);
  });

  it('buildDiscardIndex — titleSig/url(정규화)/articleId 집합', () => {
    recordDiscard(makeDiscardEntry({ title: 'A 사건', urls: ['https://m.news.com/1?utm_source=x'], articleIds: ['a1'] }), NOW);
    const idx = buildDiscardIndex(loadDiscarded(NOW));
    expect(idx.titleSigs.has('a 사건')).toBe(true);   // normalizeTitle 소문자
    expect(idx.articleIds.has('a1')).toBe(true);
    expect(idx.urls.size).toBe(1);
  });
});

// ── shouldClaimCluster 원장 연동 ──
function cluster(over: Partial<Cluster> = {}): Cluster {
  return { id: 'c1', representativeTitle: '에스파 신곡 발표', articleIds: ['art1', 'art2'], ...over } as Cluster;
}
function article(id: string, link: string): Article {
  return { id, title: 't', description: '', link, pubDate: '', source: '매체A', inputType: 'rss', fetchedAt: NOW } as Article;
}
const SEARCHING = { minMediaCount: 1, topicKeywords: [], excludeKeywords: [] } as unknown as SourceConfig;

describe('shouldClaimCluster + 폐기 원장', () => {
  const arts = [article('art1', 'https://x.com/1'), article('art2', 'https://y.com/2')];

  it('discarded 없으면 정상 점유', () => {
    const r = shouldClaimCluster(cluster(), arts, SEARCHING, [], NOW);
    expect(r.ok).toBe(true);
  });

  it('title 시그니처 일치 → discarded_dup (다른 URL 같은 사건 차단)', () => {
    recordDiscard(makeDiscardEntry({ title: '에스파 신곡 발표' }), NOW);
    const idx = buildDiscardIndex(loadDiscarded(NOW));
    const r = shouldClaimCluster(cluster(), arts, SEARCHING, [], NOW, idx);
    expect(r).toMatchObject({ ok: false, reason: 'discarded_dup' });
  });

  it('URL 일치 → discarded_dup', () => {
    recordDiscard(makeDiscardEntry({ title: '무관제목', urls: ['https://x.com/1'] }), NOW);
    const idx = buildDiscardIndex(loadDiscarded(NOW));
    const r = shouldClaimCluster(cluster(), arts, SEARCHING, [], NOW, idx);
    expect(r).toMatchObject({ ok: false, reason: 'discarded_dup' });
  });

  it('articleId 일치 → discarded_dup', () => {
    recordDiscard(makeDiscardEntry({ title: '무관', articleIds: ['art2'] }), NOW);
    const idx = buildDiscardIndex(loadDiscarded(NOW));
    const r = shouldClaimCluster(cluster(), arts, SEARCHING, [], NOW, idx);
    expect(r).toMatchObject({ ok: false, reason: 'discarded_dup' });
  });
});
