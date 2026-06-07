/**
 * Daum/Kakao search integration.
 *
 * Kakao Search API is used for discovery. Full text/images are extracted
 * through the existing universal extractor so Daum is a source track, not a
 * second parsing stack.
 */

import type { Article, ArticleImage } from '../types';
import { makeArticleId } from './rss';
import { extractArticleText } from './scraper';

const SEARCH_TIMEOUT_MS = 8_000;
const MAX_CONCURRENT_EXTRACT = 3;

/**
 * 뉴스 도메인 화이트리스트.
 * 카카오 검색 API엔 뉴스 전용 엔드포인트가 없음(web/blog/cafe/image뿐) → /v2/search/web
 * 결과 중 *뉴스 매체 도메인만* 통과시키는 게 유일한 "뉴스 전용" 구현.
 * allowlist 미포함(커뮤니티/블로그/티스토리 등)은 fetchDaumArticles에서 drop.
 * 유지보수: 매체 추가는 이 배열에만. extractSourceName domainMap과 함께 본다.
 */
export const NEWS_DOMAINS: string[] = [
  // 포털 뉴스
  'news.daum.net', 'v.daum.net', 'entertain.daum.net', 'sports.daum.net',
  'news.naver.com', 'n.news.naver.com', 'entertain.naver.com', 'sports.naver.com',
  // 통신/종합
  'yna.co.kr', 'yonhapnews.co.kr', 'newsis.com', 'news1.kr', 'ytn.co.kr', 'nocutnews.co.kr',
  'chosun.com', 'joongang.co.kr', 'joins.com', 'donga.com', 'hani.co.kr', 'khan.co.kr',
  'hankyung.com', 'mk.co.kr', 'seoul.co.kr', 'kmib.co.kr', 'segye.com', 'munhwa.com',
  'hankookilbo.com', 'kyunghyang.com', 'edaily.co.kr', 'asiae.co.kr', 'heraldcorp.com',
  'mt.co.kr', 'fnnews.com', 'sedaily.com', 'pressian.com', 'ohmynews.com', 'imaeil.com',
  // 방송
  'kbs.co.kr', 'imbc.com', 'sbs.co.kr', 'jtbc.co.kr', 'ytn.co.kr', 'mbn.co.kr', 'tvchosun.com',
  // 연예/스포츠 매체
  'starnewskorea.com', 'newsen.com', 'osen.mt.co.kr', 'sportschosun.com', 'sports.chosun.com',
  'xportsnews.com', 'tenasia.hankyung.com', 'mydaily.co.kr', 'tvreport.co.kr', 'sportsseoul.com',
  'sportsworldi.com', 'isplus.com', 'joynews24.com', 'wikitree.co.kr', 'dispatch.co.kr',
  'spotvnews.co.kr', 'star.mt.co.kr', 'sportskhan.news', 'sports.donga.com', 'sportsq.co.kr',
  'mhns.co.kr', 'wowtv.co.kr', 'newsculture.press', 'entermedia.co.kr', 'topstarnews.net',
];

/** 명시적 커뮤니티/블로그 차단(allowlist 우선이지만 안전망). 부분일치. */
const COMMUNITY_BLOCK: string[] = [
  'instiz.net', 'theqoo.net', 'dcinside.com', 'pann.nate.com', 'nate.com',
  'fmkorea.com', 'ruliweb.com', 'clien.net', 'mlbpark', 'bobaedream.co.kr',
  'ppomppu.co.kr', 'inven.co.kr', 'arca.live', 'todayhumor', 'humoruniv',
  '82cook.com', 'tistory.com', 'blog.naver.com', 'blog.daum.net', 'brunch.co.kr',
  'velog.io', 'wordpress', 'medium.com', 'youtube.com', 'youtu.be',
];

/** 뉴스 매체 URL인가 — 커뮤니티/블로그면 false, NEWS_DOMAINS 호스트면 true. (네이버 isNaverUrl 미러) */
export function isNewsUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    if (COMMUNITY_BLOCK.some(b => host === b || host.endsWith(`.${b}`) || host.includes(b))) return false;
    return NEWS_DOMAINS.some(d => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

type DaumSearchDocument = {
  title: string;
  contents: string;
  url: string;
  datetime: string;
};

type DaumSearchResponse = {
  documents?: DaumSearchDocument[];
};

export type SearchConnectionResult = {
  ok: boolean;
  message: string;
};

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export async function searchDaum(
  query: string,
  restApiKey: string,
  size: number = 10,
): Promise<DaumSearchDocument[]> {
  if (!query || !restApiKey) return [];

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), SEARCH_TIMEOUT_MS);
    const params = new URLSearchParams({ query, size: String(size), sort: 'recency' });
    const res = await fetch(`/api/daum-search?${params.toString()}`, {
      signal: ctrl.signal,
      headers: {
        Authorization: `KakaoAK ${restApiKey}`,
      },
    });
    clearTimeout(timer);

    if (!res.ok) {
      console.warn(res.status === 404
        ? '[daum] search 404 — /api/daum-search 프록시는 dev 전용. 배포본은 검색 API 미지원(로컬 5180에서만).'
        : `[daum] search failed: HTTP ${res.status}`);
      return [];
    }

    const data = (await res.json()) as DaumSearchResponse;
    return (data.documents || []).map(doc => ({
      ...doc,
      title: stripHtml(doc.title),
      contents: stripHtml(doc.contents),
    }));
  } catch (err: any) {
    console.warn('[daum] search error:', err?.message || err);
    return [];
  }
}

export async function testDaumConnection(restApiKey: string): Promise<SearchConnectionResult> {
  if (!restApiKey) {
    return { ok: false, message: 'REST API 키를 입력하세요.' };
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), SEARCH_TIMEOUT_MS);
    const params = new URLSearchParams({ query: '연예', size: '1', sort: 'recency' });
    const res = await fetch(`/api/daum-search?${params.toString()}`, {
      signal: ctrl.signal,
      headers: {
        Authorization: `KakaoAK ${restApiKey}`,
      },
    });
    clearTimeout(timer);

    if (res.ok) return { ok: true, message: '연결됨' };
    if (res.status === 401 || res.status === 403) {
      return { ok: false, message: '키가 올바르지 않습니다.' };
    }
    if (res.status === 404) {
      return { ok: false, message: '배포본은 검색 API 미지원 — 로컬 dev(localhost:5180)에서만 동작합니다. (키 문제 아님)' };
    }
    return { ok: false, message: `검색 API 오류 (${res.status})` };
  } catch (err: any) {
    if (err?.name === 'AbortError') return { ok: false, message: '연결 시간이 초과됐습니다.' };
    return { ok: false, message: '네트워크 오류' };
  }
}

export async function fetchDaumArticles(
  queries: string[],
  restApiKey: string,
  displayPerQuery: number = 10,
): Promise<Article[]> {
  if (!restApiKey || queries.length === 0) return [];

  const allResults = await Promise.all(
    queries.map(q => searchDaum(q, restApiKey, displayPerQuery)),
  );

  const seen = new Set<string>();
  const items: DaumSearchDocument[] = [];
  let droppedNonNews = 0;
  for (const results of allResults) {
    for (const item of results) {
      if (!item.url || seen.has(item.url)) continue;
      seen.add(item.url);
      // 뉴스 전용: allowlist 미포함(커뮤니티/블로그/티스토리 등) drop
      if (!isNewsUrl(item.url)) { droppedNonNews++; continue; }
      items.push(item);
    }
  }
  if (droppedNonNews > 0) {
    console.log(`[daum] dropped ${droppedNonNews} non-news results (커뮤니티/블로그 — NEWS_DOMAINS allowlist 외)`);
  }

  const now = Date.now();
  const articles: Article[] = [];

  for (let i = 0; i < items.length; i += MAX_CONCURRENT_EXTRACT) {
    const batch = items.slice(i, i + MAX_CONCURRENT_EXTRACT);
    const results = await Promise.allSettled(
      batch.map(async (item) => {
        const sourceName = extractSourceName(item.url);
        let title = item.title;
        let fullText: string | undefined;
        let thumbnail: string | undefined;
        let images: ArticleImage[] | undefined;

        const extracted = await extractArticleText(item.url);
        if (extracted.ok) {
          fullText = extracted.text;
          if (extracted.title) title = extracted.title;
          if (extracted.thumbnail) thumbnail = extracted.thumbnail;
          if (extracted.images) {
            images = extracted.images.map(img => ({ ...img, source: sourceName }));
            if (!thumbnail) thumbnail = images[0]?.url;
          }
        }

        return {
          id: makeArticleId(item.url),
          title,
          description: item.contents,
          fullText,
          link: item.url,
          pubDate: item.datetime,
          source: sourceName,
          inputType: 'rss' as const,
          fetchedAt: now,
          thumbnail,
          images,
        };
      }),
    );

    for (const r of results) {
      if (r.status === 'fulfilled') articles.push(r.value);
    }
  }

  console.log(`[daum] collected ${articles.length} articles (${articles.filter(a => a.fullText).length} with full text)`);
  return articles;
}

function extractSourceName(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    const domainMap: Record<string, string> = {
      'news.daum.net': '다음뉴스',
      'v.daum.net': '다음뉴스',
      'entertain.daum.net': '다음연예',
      'sports.daum.net': '다음스포츠',
      'starnewskorea.com': '스타뉴스',
      'newsen.com': '뉴센',
      'osen.mt.co.kr': 'OSEN',
      'sportschosun.com': '스포츠조선',
      'sports.chosun.com': '스포츠조선',
      'xportsnews.com': '엑스포츠뉴스',
      'tenasia.hankyung.com': '텐아시아',
    };
    return domainMap[hostname] || hostname;
  } catch {
    return '다음 검색';
  }
}
