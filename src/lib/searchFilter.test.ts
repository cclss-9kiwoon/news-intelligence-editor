import { describe, it, expect } from 'vitest';
import { shouldClaimCluster, matchEntity, normalizeTitle } from './searchFilter';
import type { Article, Cluster, SourceConfig, Task } from '../types';

const NOW = 1_700_000_000_000;

function art(id: string, source: string, title: string, opts: Partial<Article> = {}): Article {
  return {
    id, title, description: '', link: `https://www.${source}.com/${id}`, pubDate: '',
    source, inputType: 'rss', fetchedAt: NOW, ...opts,
  };
}

function cluster(id: string, articleIds: string[], title: string): Cluster {
  return { id, articleIds, representativeTitle: title, entities: [], createdAt: NOW };
}

function task(over: Partial<Task> = {}): Task {
  return {
    id: 't1', campaignId: 'c1', status: 'searching', title: 't', clusterId: 'x',
    sources: [], imageCount: 0, createdAt: NOW, updatedAt: NOW, ...over,
  };
}

const baseCfg: SourceConfig = {
  apiEnabled: true, rssEnabled: true, rssSources: [], searchProviders: [],
  naverQueries: [], daumQueries: [], allowedSources: [], bannedSources: [],
  articleWindow: '24h', clusterThreshold: 0.35,
  topicKeywords: [], excludeKeywords: [], minMediaCount: 1,
  entityAllowlist: [], excludeTopics: [], maxPerEntityPerDay: 0,
  ownSiteDedupe: false, imageSourcePolicy: '',
};

describe('helpers', () => {
  it('matchEntity finds first allowlisted entity (case-insensitive)', () => {
    expect(matchEntity('aespa 컴백 소식', ['IVE', 'aespa'])).toBe('aespa');
    expect(matchEntity('no match here', ['IVE'])).toBeNull();
  });
  it('normalizeTitle strips symbols + lowercases', () => {
    expect(normalizeTitle('  [속보] aespa, 컴백!! ')).toBe('속보 aespa 컴백');
  });
});

describe('shouldClaimCluster', () => {
  it('claims a clean cluster (ok)', () => {
    const arts = [art('a1', 'osen', '뉴스'), art('a2', 'starnews', '뉴스')];
    const d = shouldClaimCluster(cluster('cl1', ['a1', 'a2'], '뉴스'), arts, { ...baseCfg, minMediaCount: 2 }, [], NOW);
    expect(d.ok).toBe(true);
    if (d.ok) expect(d.sources).toHaveLength(2);
  });

  it('rejects when an article is already claimed by an existing task', () => {
    const arts = [art('a1', 'osen', '뉴스')];
    const existing = [task({ sources: [{ articleId: 'a1', title: '뉴스', source: 'osen', hasFullText: true }] })];
    const d = shouldClaimCluster(cluster('cl1', ['a1'], '뉴스'), arts, baseCfg, existing, NOW);
    expect(d).toEqual({ ok: false, reason: 'already_claimed' });
  });

  it('rejects below minMediaCount', () => {
    const arts = [art('a1', 'osen', '뉴스')];
    const d = shouldClaimCluster(cluster('cl1', ['a1'], '뉴스'), arts, { ...baseCfg, minMediaCount: 2 }, [], NOW);
    expect(d).toEqual({ ok: false, reason: 'below_min_media' });
  });

  it('entityAllowlist: rejects cluster without allowed entity', () => {
    const arts = [art('a1', 'osen', 'BTS 신곡')];
    const d = shouldClaimCluster(cluster('cl1', ['a1'], 'BTS 신곡'), arts, { ...baseCfg, entityAllowlist: ['aespa'] }, [], NOW);
    expect(d).toEqual({ ok: false, reason: 'no_allowed_entity' });
  });

  it('entityAllowlist: claims + reports matchedEntity', () => {
    const arts = [art('a1', 'osen', 'aespa 컴백')];
    const d = shouldClaimCluster(cluster('cl1', ['a1'], 'aespa 컴백'), arts, { ...baseCfg, entityAllowlist: ['aespa'] }, [], NOW);
    expect(d.ok).toBe(true);
    if (d.ok) expect(d.matchedEntity).toBe('aespa');
  });

  it('excludeTopics: rejects cluster containing excluded phrase', () => {
    const arts = [art('a1', 'osen', 'aespa 열애설 보도')];
    const d = shouldClaimCluster(cluster('cl1', ['a1'], 'aespa 열애설'), arts, { ...baseCfg, excludeTopics: ['열애설'] }, [], NOW);
    expect(d).toEqual({ ok: false, reason: 'excluded_topic' });
  });

  it('maxPerEntityPerDay: rejects once daily cap reached for that entity', () => {
    const arts = [art('a1', 'osen', 'aespa 신곡')];
    const existing = [
      task({ id: 'e1', title: 'aespa 활동', createdAt: NOW }),
      task({ id: 'e2', title: 'aespa 화보', createdAt: NOW }),
    ];
    const cfg = { ...baseCfg, entityAllowlist: ['aespa'], maxPerEntityPerDay: 2 };
    const d = shouldClaimCluster(cluster('cl1', ['a1'], 'aespa 신곡'), arts, cfg, existing, NOW);
    expect(d).toEqual({ ok: false, reason: 'entity_daily_limit' });
  });

  it('maxPerEntityPerDay: ignores tasks older than 24h', () => {
    const arts = [art('a1', 'osen', 'aespa 신곡')];
    const existing = [task({ id: 'old', title: 'aespa 활동', createdAt: NOW - 2 * 86_400_000 })];
    const cfg = { ...baseCfg, entityAllowlist: ['aespa'], maxPerEntityPerDay: 1 };
    const d = shouldClaimCluster(cluster('cl1', ['a1'], 'aespa 신곡'), arts, cfg, existing, NOW);
    expect(d.ok).toBe(true);
  });

  it('ownSiteDedupe: rejects when a produced task has same normalized title', () => {
    const arts = [art('a1', 'osen', '뉴스')];
    const existing = [task({ id: 'pub', title: 'aespa, 컴백!!', status: 'final_review' })];
    const d = shouldClaimCluster(cluster('cl1', ['a1'], '[속보] aespa 컴백'), arts, { ...baseCfg, ownSiteDedupe: true }, existing, NOW);
    // normalizeTitle('aespa, 컴백!!') = 'aespa 컴백', normalizeTitle('[속보] aespa 컴백') = '속보 aespa 컴백' → 다름 → 통과
    expect(d.ok).toBe(true);
  });

  it('ownSiteDedupe: rejects exact normalized-title duplicate', () => {
    const arts = [art('a1', 'osen', '뉴스')];
    const existing = [task({ id: 'pub', title: 'aespa 컴백', status: 'final_review' })];
    const d = shouldClaimCluster(cluster('cl1', ['a1'], 'aespa, 컴백!'), arts, { ...baseCfg, ownSiteDedupe: true }, existing, NOW);
    expect(d).toEqual({ ok: false, reason: 'own_site_dup' });
  });

  it('bannedSources: filters out banned, then fails min media', () => {
    const arts = [art('a1', 'soompi', '뉴스'), art('a2', 'osen', '뉴스')];
    const d = shouldClaimCluster(cluster('cl1', ['a1', 'a2'], '뉴스'), arts, { ...baseCfg, bannedSources: ['soompi'], minMediaCount: 2 }, [], NOW);
    expect(d).toEqual({ ok: false, reason: 'below_min_media' });
  });
});
