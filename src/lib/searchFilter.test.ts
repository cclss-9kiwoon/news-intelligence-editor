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

  it('excludeTopics: 동기 필터에서는 적용하지 않음 (AI 주제검수 단계로 이관)', () => {
    const arts = [art('a1', 'osen', 'aespa 열애설 보도')];
    const d = shouldClaimCluster(cluster('cl1', ['a1'], 'aespa 열애설'), arts, { ...baseCfg, excludeTopics: ['열애설'] }, [], NOW);
    expect(d.ok).toBe(true);
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

  // ── 기사별 키워드 필터 (클러스터 OR 동반통과 버그 회귀) ──
  it('topicKeywords: 무관 단일 기사(OPEC)는 ①에서 컷', () => {
    const arts = [art('a1', 'yna', 'OPEC 원유 증산 합의')];
    const d = shouldClaimCluster(cluster('cl1', ['a1'], 'OPEC 원유 증산'), arts, { ...baseCfg, topicKeywords: ['컴백', '앨범', '타이틀곡'] }, [], NOW);
    expect(d).toEqual({ ok: false, reason: 'no_topic_keyword' });
  });

  it('topicKeywords: 혼합 클러스터 — 매칭 기사만 source로, 무관 기사 동반통과 안 함', () => {
    const arts = [
      art('a1', 'osen', 'aespa 정규앨범 컴백 확정'),   // 매칭(컴백)
      art('a2', 'yna', 'OPEC 원유 증산 합의'),         // 무관
      art('a3', 'hani', '농민소설 작가 별세'),          // 무관
    ];
    const d = shouldClaimCluster(cluster('cl1', ['a1', 'a2', 'a3'], 'aespa 컴백'), arts, { ...baseCfg, topicKeywords: ['컴백', '앨범'] }, [], NOW);
    expect(d.ok).toBe(true);
    if (d.ok) {
      expect(d.sources).toHaveLength(1);
      expect(d.sources[0].articleId).toBe('a1');
    }
  });

  it('excludeKeywords: 제외어 포함 기사만 제거, 깨끗한 기사 잔존 시 통과', () => {
    const arts = [
      art('a1', 'osen', 'aespa 컴백 인터뷰'),
      art('a2', 'star', 'aespa 컴백 광고 협찬 [홍보]'),  // 제외어 홍보
    ];
    const d = shouldClaimCluster(cluster('cl1', ['a1', 'a2'], 'aespa 컴백'), arts, { ...baseCfg, topicKeywords: ['컴백'], excludeKeywords: ['홍보'] }, [], NOW);
    expect(d.ok).toBe(true);
    if (d.ok) {
      expect(d.sources).toHaveLength(1);
      expect(d.sources[0].articleId).toBe('a1');
    }
  });

  it('excludeKeywords: 전부 제외어면 클러스터 폐기', () => {
    const arts = [art('a1', 'osen', 'aespa 컴백 [홍보] 광고')];
    const d = shouldClaimCluster(cluster('cl1', ['a1'], 'aespa 컴백'), arts, { ...baseCfg, topicKeywords: ['컴백'], excludeKeywords: ['홍보'] }, [], NOW);
    expect(d).toEqual({ ok: false, reason: 'excluded_keyword' });
  });
});

describe('civic noise 필터 (① 사전 컷)', () => {
  it('지자체/행정 노이즈 클러스터는 civic_noise로 컷', () => {
    const arts = [
      art('a1', 'yna', '밀양시 여름철 관광객 유치 총력'),
      art('a2', 'newsis', '창녕군치매안심센터 프로그램 운영'),
    ];
    const d = shouldClaimCluster(cluster('cl1', ['a1', 'a2'], '밀양시 관광객 유치'), arts, baseCfg, [], NOW);
    expect(d).toEqual({ ok: false, reason: 'civic_noise' });
  });

  it('당선인/추념식/특강 등 행정 키워드 컷', () => {
    const arts = [art('a1', 'yna', '평택시장 당선인 첫 행보')];
    const d = shouldClaimCluster(cluster('cl1', ['a1'], '평택시장 당선인'), arts, baseCfg, [], NOW);
    expect(d).toEqual({ ok: false, reason: 'civic_noise' });
  });

  it('연예 기사는 통과(노이즈 키워드 없음)', () => {
    const arts = [art('a1', 'osen', 'aespa 새 미니앨범 컴백')];
    const d = shouldClaimCluster(cluster('cl1', ['a1'], 'aespa 컴백'), arts, baseCfg, [], NOW);
    expect(d.ok).toBe(true);
  });

  it('노이즈 키워드 있어도 연예 엔티티 동반 시 보존(오컷 방지)', () => {
    const arts = [art('a1', 'osen', 'aespa, 서초구 주민센터 행사 출연')];
    const d = shouldClaimCluster(cluster('cl1', ['a1'], 'aespa 행사'), arts, { ...baseCfg, entityAllowlist: ['aespa'] }, [], NOW);
    expect(d.ok).toBe(true);
  });

  it('filterCivicNoise=false면 컷 안 함', () => {
    const arts = [art('a1', 'yna', '밀양시 관광객 유치')];
    const d = shouldClaimCluster(cluster('cl1', ['a1'], '밀양시 관광객 유치'), arts, { ...baseCfg, filterCivicNoise: false } as SourceConfig, [], NOW);
    expect(d.ok).toBe(true);
  });
});

describe('봇차단 단일소스 ① 제외', () => {
  it('후순위(topstarnews) 단일소스 → bot_blocked_single', () => {
    const arts = [art('a1', 'topstarnews', 'aespa 단독 보도', { link: 'https://topstarnews.net/news/1' })];
    const d = shouldClaimCluster(cluster('cl1', ['a1'], 'aespa 단독'), arts, baseCfg, [], NOW);
    expect(d).toEqual({ ok: false, reason: 'bot_blocked_single' });
  });

  it('봇차단 + 정상매체 다중소스면 보존(보강용)', () => {
    const arts = [
      art('a1', 'topstarnews', 'aespa 컴백', { link: 'https://topstarnews.net/news/1' }),
      art('a2', 'yna', 'aespa 컴백', { link: 'https://www.yna.co.kr/view/2' }),
    ];
    const d = shouldClaimCluster(cluster('cl1', ['a1', 'a2'], 'aespa 컴백'), arts, baseCfg, [], NOW);
    expect(d.ok).toBe(true);
  });

  it('정상매체 단일소스는 통과(봇차단 아님)', () => {
    const arts = [art('a1', 'yna', 'aespa 컴백', { link: 'https://www.yna.co.kr/view/1' })];
    const d = shouldClaimCluster(cluster('cl1', ['a1'], 'aespa 컴백'), arts, baseCfg, [], NOW);
    expect(d.ok).toBe(true);
  });
});
