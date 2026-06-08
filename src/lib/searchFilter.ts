/**
 * 서칭 필터 — 클러스터 점유(claim) 판정 순수 로직.
 *
 * SearchingPipeline.tsx useEffect 안에 인라인이던 필터를 순수함수로 추출.
 * 단위 테스트 가능 + 동작 동일. 컴포넌트는 shouldClaimCluster를 호출만 한다.
 *
 * 동일 사이클 내 중복 점유 방지(claimedArticleIds·entityCountToday 누적)는
 * 컴포넌트가 claim 시 합성 태스크를 existingTasks에 push해서 재현한다.
 */
import type { SourceConfig, Task, TaskSource, Cluster, Article } from '../types';
import { normalizeLink } from './rss';

const DAY_MS = 86_400_000;

/** source 문자열이 rules 중 하나라도 부분일치하는가 (대소문자 무시). rules 비면 false */
export function sourceMatches(source: string, rules: string[]): boolean {
  if (rules.length === 0) return false;
  const normalized = source.toLowerCase();
  return rules.some(rule => normalized.includes(rule.toLowerCase()));
}

/** 원문 식별 키 — utm 제거 + m. → www. 정규화 (동일 원문 중복 카운트 방지) */
export function originalKey(link: string): string {
  return normalizeLink(link).replace(/^https?:\/\/m\./, 'https://www.');
}

/** 제목 정규화 — 소문자 + 기호 제거 + 공백 단일화 (중복 판정용) */
export function normalizeTitle(t: string): string {
  return t.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim();
}

/** entityAllowlist 중 haystack(소문자)에 등장하는 첫 엔티티. 없으면 null */
export function matchEntity(haystack: string, allowlist: string[]): string | null {
  for (const e of allowlist) {
    if (e.trim() && haystack.includes(e.toLowerCase())) return e;
  }
  return null;
}

/** 점유 판정 사유 (테스트·디버깅용 식별자) */
export type ClaimReason =
  | 'already_claimed'        // 클러스터 기사 중 이미 점유된 것 존재
  | 'discarded_dup'          // 폐기/거부 원장과 중복(title/url/articleId)
  | 'no_articles'            // 소스 필터(allowed/banned) 후 기사 0건
  | 'below_min_media'        // 매체 수 < minMediaCount
  | 'no_topic_keyword'       // 포함 키워드 미등장
  | 'excluded_keyword'       // 제외 키워드 등장
  | 'excluded_topic'         // 제외 주제 등장
  | 'no_allowed_entity'      // 허용 엔티티 미등장
  | 'entity_daily_limit'     // 엔티티 일일 상한 초과
  | 'civic_noise'            // 지자체/행정 등 비-연예 노이즈 (① 사전 컷, judge 토큰 절약)
  | 'own_site_dup';          // 자체 기보도 제목과 중복

/**
 * 비-연예 노이즈 키워드 — 지자체/행정/공공 뉴스가 일반 RSS·검색으로 ①에 유입돼
 * ② judge가 비싸게 off_topic 처리하는 토큰 낭비를 막기 위한 ① 사전 컷(LLM 0).
 * 연예 엔티티(entityAllowlist)가 함께 등장하면 컷하지 않음(오컷 방지).
 * NIE = K-pop/연예 제품이라 기본 활성. searching.filterCivicNoise=false로 끌 수 있음.
 */
const CIVIC_NOISE_KEYWORDS: readonly string[] = [
  '시청', '군청', '구청', '도청', '시의회', '군의회', '구의회', '도의회', '조례', '예산안', '의정',
  '시장 당선', '당선인', '당선자', '군수', '구청장', '도지사', '시의원', '군의원',
  '추념식', '현충일', '기념식', '위령제',
  '보건소', '주민센터', '행정복지센터', '치매안심센터', '복지관', '경로당', '보건지소',
  '특강', '영양교육', '평생학습', '문해교실', '민원', '주민설명회',
  '관광객 유치', '농업박물관', '농업기술센터', '읍면동',
];

export type ClaimDecision =
  | { ok: true; sources: TaskSource[]; matchedEntity: string | null; imageCount: number }
  | { ok: false; reason: ClaimReason };

/**
 * 클러스터를 태스크로 점유할지 판정.
 * existingTasks로부터 점유/기보도/엔티티 카운트를 산출하므로 자체완결(순수).
 */
/** 폐기/거부 원장 조회 인덱스 (discardLedger.buildDiscardIndex 결과). 순수성 위해 주입받음. */
export type DiscardLookup = {
  titleSigs: Set<string>;
  urls: Set<string>;       // originalKey 정규화 URL
  articleIds: Set<string>;
};

export function shouldClaimCluster(
  cluster: Cluster,
  articles: Article[],
  searching: SourceConfig,
  existingTasks: Task[],
  now: number,
  discarded?: DiscardLookup,
): ClaimDecision {
  const {
    minMediaCount, topicKeywords, excludeKeywords, allowedSources = [], bannedSources = [],
    entityAllowlist = [], maxPerEntityPerDay = 0, ownSiteDedupe = false,
  } = searching;

  // 이미 점유된 기사 id
  const claimedArticleIds = new Set<string>();
  existingTasks.forEach(t => t.sources.forEach(s => claimedArticleIds.add(s.articleId)));
  if (cluster.articleIds.some(id => claimedArticleIds.has(id))) {
    return { ok: false, reason: 'already_claimed' };
  }

  // 폐기/거부 원장 대조 — title 시그니처 / URL / articleId 중 하나라도 일치 시 재유입 차단.
  // (영구삭제로 task가 사라져도 원장은 잔존 → 재claim 방지. title로 다른 URL 같은 사건도 차단.)
  if (discarded) {
    if (cluster.representativeTitle && discarded.titleSigs.has(normalizeTitle(cluster.representativeTitle))) {
      return { ok: false, reason: 'discarded_dup' };
    }
    if (cluster.articleIds.some(id => discarded.articleIds.has(id))) {
      return { ok: false, reason: 'discarded_dup' };
    }
    const clusterUrls = articles
      .filter(a => cluster.articleIds.includes(a.id))
      .map(a => originalKey(a.link));
    if (clusterUrls.some(u => discarded.urls.has(u))) {
      return { ok: false, reason: 'discarded_dup' };
    }
  }

  // 소스 필터
  const sourceFiltered = articles
    .filter(a => cluster.articleIds.includes(a.id))
    .filter(a => allowedSources.length === 0 || sourceMatches(a.source, allowedSources))
    .filter(a => !sourceMatches(a.source, bannedSources));
  if (sourceFiltered.length === 0) return { ok: false, reason: 'no_articles' };

  // 키워드 필터 — 클러스터 합본 OR가 아니라 *기사별*로 적용.
  // (이전: 합친 haystack에 .some() → 무관 기사가 매칭 기사와 한 클러스터에 묶이면 동반 통과)
  // topicKeywords: 매칭 기사만 남김 / excludeKeywords: 매칭 기사 제거. 남는 기사 0이면 클러스터 폐기.
  const artHay = (a: Article) => `${a.title} ${a.description}`.toLowerCase();
  let clusterArticles = sourceFiltered;
  if (topicKeywords.length > 0) {
    const kws = topicKeywords.map(k => k.toLowerCase());
    clusterArticles = clusterArticles.filter(a => { const h = artHay(a); return kws.some(k => h.includes(k)); });
    if (clusterArticles.length === 0) return { ok: false, reason: 'no_topic_keyword' };
  }
  if (excludeKeywords.length > 0) {
    const kws = excludeKeywords.map(k => k.toLowerCase());
    clusterArticles = clusterArticles.filter(a => { const h = artHay(a); return !kws.some(k => h.includes(k)); });
    if (clusterArticles.length === 0) return { ok: false, reason: 'excluded_keyword' };
  }
  // 지자체/행정 노이즈 ① 사전 컷 (기본 활성, filterCivicNoise=false로 해제).
  // 연예 엔티티가 함께 있으면 보존(오컷 방지) — 순수 행정 기사만 제거 → ② judge 토큰 절약.
  if ((searching as { filterCivicNoise?: boolean }).filterCivicNoise !== false) {
    const allow = entityAllowlist.map(e => e.toLowerCase()).filter(Boolean);
    clusterArticles = clusterArticles.filter(a => {
      const h = artHay(a);
      const isNoise = CIVIC_NOISE_KEYWORDS.some(k => h.includes(k));
      if (!isNoise) return true;
      return allow.length > 0 && allow.some(e => h.includes(e)); // 노이즈여도 연예 엔티티 있으면 유지
    });
    if (clusterArticles.length === 0) return { ok: false, reason: 'civic_noise' };
  }
  // excludeTopics는 의미 판단(AI)이라 동기 필터에서 처리하지 않음.
  // 주제 검수 단계(SearchingPipeline)에서 judgeTopic(적합+제외 통합)으로 게이트.

  // 매체 수 하한 (키워드 필터 후 남은 기사 기준 — 무관 기사는 매체 다양성에 안 셈)
  const distinctOriginalCount = new Set(clusterArticles.map(a => originalKey(a.link))).size;
  const mediaCount = new Set(clusterArticles.map(a => a.source)).size;
  if (Math.min(mediaCount, distinctOriginalCount) < minMediaCount) {
    return { ok: false, reason: 'below_min_media' };
  }

  const haystack = clusterArticles.map(a => `${a.title} ${a.description}`).join(' ').toLowerCase();

  // entityAllowlist: 허용 엔티티 미등장 제외
  const matchedEntity = entityAllowlist.length > 0 ? matchEntity(haystack, entityAllowlist) : null;
  if (entityAllowlist.length > 0 && !matchedEntity) {
    return { ok: false, reason: 'no_allowed_entity' };
  }

  // maxPerEntityPerDay: 오늘 생성분의 엔티티별 카운트 상한
  if (maxPerEntityPerDay > 0 && matchedEntity) {
    let countToday = 0;
    for (const t of existingTasks) {
      if (now - t.createdAt > DAY_MS) continue;
      if (matchEntity(t.title.toLowerCase(), entityAllowlist) === matchedEntity) countToday++;
    }
    if (countToday >= maxPerEntityPerDay) return { ok: false, reason: 'entity_daily_limit' };
  }

  // ownSiteDedupe: 기보도/제작 제목과 중복 제외
  if (ownSiteDedupe) {
    const publishedTitles = new Set(
      existingTasks.filter(t => t.published || t.status === 'final_review' || !!t.draft)
        .map(t => normalizeTitle(t.title)),
    );
    if (publishedTitles.has(normalizeTitle(cluster.representativeTitle))) {
      return { ok: false, reason: 'own_site_dup' };
    }
  }

  const sources: TaskSource[] = clusterArticles.map(a => ({
    articleId: a.id, title: a.title, source: a.source, hasFullText: !!a.fullText,
  }));
  const imageCount = clusterArticles.reduce((n, a) => n + (a.images?.length ?? 0), 0);

  return { ok: true, sources, matchedEntity, imageCount };
}
