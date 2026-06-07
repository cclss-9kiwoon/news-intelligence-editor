/**
 * Naver News integration module.
 *
 * 1. Search API: /v1/search/news.json via Vite dev proxy (/api/naver-search)
 * 2. Article extraction: fetch Naver news HTML via proxy (/api/naver-article),
 *    parse #dic_area for full text and images.
 *
 * In production, these proxies would be handled by Cloudflare Pages Functions.
 */

import { extractNaverArticle, type NaverExtractResult } from './extract-utils';
export { extractNaverArticle, type NaverExtractResult } from './extract-utils';

const SEARCH_TIMEOUT_MS = 8_000;

// ─── Types ──────────────────────────────────────────────────────────

export type NaverSearchItem = {
  title: string;       // HTML-encoded title
  originallink: string; // original publisher URL
  link: string;        // Naver news URL (n.news.naver.com)
  description: string; // snippet with <b> tags
  pubDate: string;
};

type NaverSearchResponse = {
  lastBuildDate: string;
  total: number;
  start: number;
  display: number;
  items: NaverSearchItem[];
};

export type SearchConnectionResult = {
  ok: boolean;
  message: string;
};

// ─── Search ─────────────────────────────────────────────────────────

/** Strip HTML tags from Naver search results */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'");
}

/**
 * Search Naver News API for articles matching the query.
 * Requires clientId & clientSecret from Naver Developer Console.
 */
export async function searchNaver(
  query: string,
  clientId: string,
  clientSecret: string,
  display: number = 10,
  sort: 'sim' | 'date' = 'sim',
): Promise<NaverSearchItem[]> {
  if (!clientId || !clientSecret) return [];

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), SEARCH_TIMEOUT_MS);

    const params = new URLSearchParams({ query, display: String(display), sort });
    const res = await fetch(`/api/naver-search?${params.toString()}`, {
      signal: ctrl.signal,
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
    });
    clearTimeout(timer);

    if (!res.ok) {
      console.warn(res.status === 404
        ? '[naver] search 404 — /api/naver-search 프록시는 dev 전용. 배포본은 검색 API 미지원(로컬 5180에서만).'
        : `[naver] search failed: HTTP ${res.status}`);
      return [];
    }

    const data = (await res.json()) as NaverSearchResponse;
    // Clean HTML entities from titles/descriptions
    return (data.items || []).map(item => ({
      ...item,
      title: stripHtml(item.title),
      description: stripHtml(item.description),
    }));
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.warn('[naver] search timeout');
    } else {
      console.warn('[naver] search error:', err.message);
    }
    return [];
  }
}

export async function testNaverConnection(
  clientId: string,
  clientSecret: string,
): Promise<SearchConnectionResult> {
  if (!clientId || !clientSecret) {
    return { ok: false, message: 'Client ID와 Secret을 입력하세요.' };
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), SEARCH_TIMEOUT_MS);
    const params = new URLSearchParams({ query: '연예', display: '1', sort: 'date' });
    const res = await fetch(`/api/naver-search?${params.toString()}`, {
      signal: ctrl.signal,
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
    });
    clearTimeout(timer);

    if (res.ok) return { ok: true, message: '연결됨' };
    if (res.status === 401 || res.status === 403) {
      return { ok: false, message: '키가 올바르지 않습니다.' };
    }
    if (res.status === 404) {
      // /api/naver-search 프록시는 Vite dev 서버 전용 → 배포(정적 호스팅)엔 없음
      return { ok: false, message: '배포본은 검색 API 미지원 — 로컬 dev(localhost:5180)에서만 동작합니다. (키 문제 아님)' };
    }
    return { ok: false, message: `검색 API 오류 (${res.status})` };
  } catch (err: any) {
    if (err?.name === 'AbortError') return { ok: false, message: '연결 시간이 초과됐습니다.' };
    return { ok: false, message: '네트워크 오류' };
  }
}

// ─── Article Extraction ─────────────────────────────────────────────

// extractNaverArticle is re-exported from ./extract-utils above

/** Check if URL is a Naver-hosted article page */
function isNaverUrl(url: string): boolean {
  return /naver\.com/.test(url);
}

// ─── Enrichment Helper ──────────────────────────────────────────────

/**
 * Find a Naver news version of an article by searching its title,
 * then extract full text from the Naver page.
 *
 * Returns null if the article can't be found or extracted.
 */
export async function enrichViaNaver(
  articleTitle: string,
  clientId: string,
  clientSecret: string,
): Promise<NaverExtractResult | null> {
  // Search Naver with the article title (truncate for better matching)
  const query = articleTitle.slice(0, 50);
  const results = await searchNaver(query, clientId, clientSecret, 5, 'sim');

  if (results.length === 0) return null;

  // Try the first result that has a Naver link
  for (const item of results) {
    if (item.link && isNaverUrl(item.link)) {
      const result = await extractNaverArticle(item.link);
      if (result.ok) return result;
    }
  }

  return null;
}

// ─── Main Collection (Naver as primary source) ──────────────────────

import type { Article, ArticleImage } from '../types';
import { makeArticleId } from './rss';
import { extractArticleText } from './scraper';

const MAX_CONCURRENT_EXTRACT = 3;

/**
 * Fetch articles from Naver News as the primary source.
 *
 * For each query:
 * 1. Search Naver News API (sort=date for freshness)
 * 2. Filter to results with Naver news links (n.news.naver.com)
 * 3. Extract full text from each via #dic_area
 *
 * Returns Article[] with fullText already populated.
 */
export async function fetchNaverArticles(
  queries: string[],
  clientId: string,
  clientSecret: string,
  displayPerQuery: number = 15,
): Promise<Article[]> {
  if (!clientId || !clientSecret || queries.length === 0) return [];

  // 1. Search all queries in parallel
  const allResults = await Promise.all(
    queries.map(q => searchNaver(q, clientId, clientSecret, displayPerQuery, 'date')),
  );

  // 2. Dedupe by link — same article can appear in multiple query results
  const seen = new Set<string>();
  const naverItems: NaverSearchItem[] = [];
  for (const results of allResults) {
    for (const item of results) {
      const key = item.originallink || item.link;
      if (key && !seen.has(key)) {
        seen.add(key);
        naverItems.push(item);
      }
    }
  }

  if (naverItems.length === 0) return [];

  const now = Date.now();
  const articles: Article[] = [];

  // 3. Extract full text in batches (concurrency limited)
  for (let i = 0; i < naverItems.length; i += MAX_CONCURRENT_EXTRACT) {
    const batch = naverItems.slice(i, i + MAX_CONCURRENT_EXTRACT);
    const results = await Promise.allSettled(
      batch.map(async (item) => {
        const sourceName = extractSourceName(item.originallink || item.link);
        let fullText: string | undefined;
        let title = item.title;
        let thumbnail: string | undefined;
        let images: ArticleImage[] | undefined;

        // Try Jina first (universal), then Naver/proxy fallback
        if (isNaverUrl(item.link)) {
          const extracted = await extractNaverArticle(item.link);
          if (extracted.ok) {
            fullText = extracted.text;
            if (extracted.title) title = extracted.title;
            images = (extracted.images || []).map((img: { url: string; alt?: string; caption?: string }) => ({
              ...img, source: sourceName,
            }));
            if (images.length > 0) thumbnail = images[0].url;
          }
        }

        // Fallback: universal extraction (Jina → proxy) on original link
        if (!fullText && item.originallink) {
          const generic = await extractArticleText(item.originallink);
          if (generic.ok) {
            fullText = generic.text;
            if (generic.title) title = generic.title;
            if (!thumbnail && generic.thumbnail) thumbnail = generic.thumbnail;
            if (!images && generic.images) {
              images = generic.images.map(img => ({ ...img, source: sourceName }));
            }
          }
        }

        const art: Article = {
          id: makeArticleId(item.originallink || item.link),
          title,
          description: item.description,
          fullText,
          link: item.originallink || item.link,
          pubDate: item.pubDate || '',
          source: sourceName,
          inputType: 'rss' as const,
          fetchedAt: now,
          thumbnail,
          images,
        };
        return art;
      }),
    );

    for (const r of results) {
      if (r.status === 'fulfilled') articles.push(r.value);
    }
  }

  const withThumb = articles.filter(a => a.thumbnail).length;
  console.log(`[naver] collected ${articles.length} articles (${articles.filter(a => a.fullText).length} with full text, ${withThumb} with thumbnail)`);
  return articles;
}

/** Extract publisher name from original article URL */
function extractSourceName(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    const domainMap: Record<string, string> = {
      'yna.co.kr': '연합뉴스',
      'news.jtbc.co.kr': 'JTBC',
      'www.sbs.co.kr': 'SBS',
      'entertain.naver.com': '네이버 연예',
      'sports.chosun.com': '스포츠조선',
      'starnewskorea.com': '스타뉴스',
      'newsen.com': '뉴센',
      'tenasia.hankyung.com': '텐아시아',
      'xportsnews.com': '엑스포츠뉴스',
      'mydaily.co.kr': '마이데일리',
      'osen.mt.co.kr': 'OSEN',
      'news.heraldcorp.com': '헤럴드',
      'newsis.com': '뉴시스',
      'mk.co.kr': '매일경제',
      'sedaily.com': '서울경제',
      'hankookilbo.com': '한국일보',
      'khan.co.kr': '경향신문',
      'hani.co.kr': '한겨레',
      'chosun.com': '조선일보',
      'donga.com': '동아일보',
      'joongang.co.kr': '중앙일보',
      'sportsseoul.com': '스포츠서울',
      'spotvnews.co.kr': 'SPOTV',
    };
    return domainMap[hostname] || hostname;
  } catch {
    return '네이버 뉴스';
  }
}
