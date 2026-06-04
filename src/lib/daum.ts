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

type DaumSearchDocument = {
  title: string;
  contents: string;
  url: string;
  datetime: string;
};

type DaumSearchResponse = {
  documents?: DaumSearchDocument[];
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
      console.warn(`[daum] search failed: HTTP ${res.status}`);
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
  for (const results of allResults) {
    for (const item of results) {
      if (!item.url || seen.has(item.url)) continue;
      seen.add(item.url);
      items.push(item);
    }
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
