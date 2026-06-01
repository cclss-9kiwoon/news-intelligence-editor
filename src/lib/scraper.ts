/**
 * Article full-text extraction module.
 *
 * Pipeline (platform-agnostic, no API key required):
 *   1. Jina Reader API (/api/extract) — works for any URL, returns structured JSON
 *   2. Fallback: HTML proxy (/api/naver-article) + DOM parsing
 *      - Naver news URLs: #dic_area selector
 *      - Other URLs: common article selectors
 *   3. Last resort: use existing description
 *
 * Images are collected at every stage and returned alongside text.
 */

import type { ArticleImage } from '../types';
import { extractNaverArticle } from './extract-utils';

const JINA_TIMEOUT_MS = 15_000;
const PROXY_TIMEOUT_MS = 12_000;
const MAX_CONCURRENT = 3;
const MIN_USEFUL_LENGTH = 100;
const MAX_RETRIES = 2;

/** Track URLs that have failed extraction, to avoid retrying indefinitely. */
const failedUrls = new Map<string, number>();

// ─── Types ──────────────────────────────────────────────────────────

export type ExtractResult = {
  ok: boolean;
  title?: string;
  text?: string;
  length?: number;
  thumbnail?: string;
  images?: ArticleImage[];
  method?: 'jina' | 'proxy' | 'naver';
  error?: string;
};

// ─── Jina Reader API response shape ─────────────────────────────────

type JinaImage = {
  src?: string;
  url?: string;
  alt?: string;
  description?: string;
};

type JinaResponse = {
  code: number;
  data?: {
    title?: string;
    content?: string;       // markdown content
    description?: string;
    images?: JinaImage[] | Record<string, JinaImage>;
  };
};

// ─── 1. Jina Reader Extraction ─────────────────────────────────────

// Simple rate limiter for Jina (free tier: 20 req/min)
let jinaLastRequestAt = 0;
const JINA_MIN_INTERVAL_MS = 3_500; // ~17 req/min, safely under limit

async function jinaRateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - jinaLastRequestAt;
  if (elapsed < JINA_MIN_INTERVAL_MS) {
    await new Promise(r => setTimeout(r, JINA_MIN_INTERVAL_MS - elapsed));
  }
  jinaLastRequestAt = Date.now();
}

/**
 * Extract article via Jina Reader API.
 * Jina returns structured JSON with title, markdown content, and images.
 * Free tier: 20 req/min, no API key needed, CORS-free.
 */
async function extractViaJina(url: string): Promise<ExtractResult> {
  try {
    await jinaRateLimit();

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), JINA_TIMEOUT_MS);

    const res = await fetch(`/api/extract?url=${encodeURIComponent(url)}`, {
      signal: ctrl.signal,
      headers: { 'Accept': 'application/json' },
    });
    clearTimeout(timer);

    if (!res.ok) {
      return { ok: false, error: `Jina HTTP ${res.status}`, method: 'jina' };
    }

    const json = (await res.json()) as JinaResponse;
    const data = json.data;
    if (!data?.content || data.content.length < MIN_USEFUL_LENGTH) {
      return { ok: false, error: 'Jina: content too short', method: 'jina' };
    }

    // Parse images from Jina response
    const images: ArticleImage[] = [];
    if (data.images) {
      const imgList = Array.isArray(data.images)
        ? data.images
        : Object.values(data.images);
      for (const img of imgList) {
        const imgUrl = img.src || img.url || '';
        if (imgUrl && !imgUrl.includes('blank.gif') && !imgUrl.includes('transparent') &&
            !imgUrl.includes('icon') && !imgUrl.includes('logo') && imgUrl.startsWith('http')) {
          images.push({
            url: imgUrl,
            alt: img.alt || undefined,
            caption: img.description || undefined,
          });
        }
      }
    }

    // Strip markdown formatting for clean text
    const text = data.content
      .replace(/^#{1,6}\s+/gm, '')        // headings
      .replace(/\*\*([^*]+)\*\*/g, '$1')   // bold
      .replace(/\*([^*]+)\*/g, '$1')       // italic
      .replace(/!\[.*?\]\(.*?\)/g, '')     // images
      .replace(/\[([^\]]+)\]\(.*?\)/g, '$1') // links → text only
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return {
      ok: true,
      title: data.title || undefined,
      text,
      length: text.length,
      thumbnail: images[0]?.url,
      images: images.length > 0 ? images : undefined,
      method: 'jina',
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { ok: false, error: 'Jina timeout', method: 'jina' };
    }
    return { ok: false, error: err.message || 'Jina error', method: 'jina' };
  }
}

// ─── 2. HTML Proxy Extraction (fallback) ────────────────────────────

/** Common article body selectors, tried in order */
const ARTICLE_SELECTORS = [
  '#dic_area',                    // Naver news
  '#newsct_article',              // Naver news alt
  '.newsct_body',                 // Naver news alt
  'article',                      // semantic HTML
  '[itemprop="articleBody"]',     // schema.org
  '.article-body',
  '.article_body',
  '.article-content',
  '.article_content',
  '.story-body',
  '.post-content',
  '#article-body',
  '.entry-content',
  'main',
];

/** Extract via HTML proxy + DOM parsing. Used as fallback when Jina fails. */
async function extractViaProxy(url: string): Promise<ExtractResult> {
  // For Naver news URLs, use the specialized extractor
  if (url.includes('news.naver.com') || url.includes('n.news.naver.com')) {
    const result = await extractNaverArticle(url);
    const images: ArticleImage[] = (result.images || []).map(img => ({
      url: img.url,
      alt: img.alt,
      caption: img.caption,
    }));
    return {
      ok: result.ok,
      title: result.title,
      text: result.text,
      length: result.text?.length,
      thumbnail: images[0]?.url,
      images: images.length > 0 ? images : undefined,
      method: 'naver',
      error: result.error,
    };
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), PROXY_TIMEOUT_MS);

    const res = await fetch(`/api/naver-article?url=${encodeURIComponent(url)}`, {
      signal: ctrl.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      return { ok: false, error: `Proxy HTTP ${res.status}`, method: 'proxy' };
    }

    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');

    // Try each selector until we find article content
    let articleEl: Element | null = null;
    for (const sel of ARTICLE_SELECTORS) {
      articleEl = doc.querySelector(sel);
      if (articleEl && (articleEl.textContent || '').trim().length > MIN_USEFUL_LENGTH) break;
      articleEl = null;
    }

    if (!articleEl) {
      articleEl = doc.body;
    }

    if (!articleEl) {
      return { ok: false, error: 'No article content found', method: 'proxy' };
    }

    // Extract all article images before removing noise elements
    const images: ArticleImage[] = [];
    const imgElements = articleEl.querySelectorAll('img');
    for (const img of Array.from(imgElements)) {
      const src = img.getAttribute('data-src') || img.getAttribute('src') || '';
      if (src && !src.includes('blank.gif') && !src.includes('transparent') &&
          !src.includes('icon') && !src.includes('logo') && src.startsWith('http')) {
        const figCaption = img.closest('figure')?.querySelector('figcaption, em, .img_desc');
        images.push({
          url: src,
          alt: img.getAttribute('alt') || undefined,
          caption: figCaption?.textContent?.trim() || undefined,
        });
      }
    }

    // Remove noise elements
    articleEl.querySelectorAll(
      'script, style, nav, footer, header, aside, .ad, .advertisement, .social-share, .related-articles, .comments',
    ).forEach(el => el.remove());

    const text = (articleEl.textContent || '')
      .replace(/\s+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (text.length < MIN_USEFUL_LENGTH) {
      return { ok: false, error: 'Text too short', method: 'proxy' };
    }

    // Extract title
    const titleEl = doc.querySelector('h1, title, .article-title, .article_title');
    const title = titleEl?.textContent?.trim() || '';

    return {
      ok: true,
      title,
      text,
      length: text.length,
      thumbnail: images[0]?.url,
      images: images.length > 0 ? images : undefined,
      method: 'proxy',
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { ok: false, error: 'Proxy timeout', method: 'proxy' };
    }
    return { ok: false, error: err.message || 'Proxy error', method: 'proxy' };
  }
}

// ─── Main Extraction Entry Point ────────────────────────────────────

/**
 * Extract article text and images from any URL.
 *
 * Pipeline:
 *   1. Jina Reader API (universal, no API key needed)
 *   2. Fallback: HTML proxy + DOM parsing (Naver #dic_area or generic selectors)
 *
 * This is the single entry point — all callers should use this function.
 */
/** Check if URL is a Korean site that our proxy handles well */
function isKoreanSite(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return hostname.endsWith('.kr') || hostname.includes('naver.com') ||
      hostname.includes('daum.net') || hostname.includes('chosun.com') ||
      hostname.includes('donga.com') || hostname.includes('hankyung.com') ||
      hostname.includes('hani.co.kr') || hostname.includes('joongang.co.kr');
  } catch {
    return false;
  }
}

export async function extractArticleText(url: string): Promise<ExtractResult> {
  // Skip URLs that have already failed MAX_RETRIES times
  const prevFailures = failedUrls.get(url) || 0;
  if (prevFailures >= MAX_RETRIES) {
    return { ok: false, error: 'skipped (max retries)' };
  }

  // Korean sites: proxy first (better parsing, no rate limit), Jina fallback
  // Other sites: Jina first (universal), proxy fallback
  if (isKoreanSite(url)) {
    const proxyResult = await extractViaProxy(url);
    if (proxyResult.ok) return proxyResult;

    // Proxy failed — try Jina
    const jinaResult = await extractViaJina(url);
    if (jinaResult.ok) return jinaResult;

    console.warn(`[scraper] All extraction failed for ${url}`);
    failedUrls.set(url, prevFailures + 1);
    return proxyResult;
  }

  // Non-Korean: Jina first
  const jinaResult = await extractViaJina(url);
  if (jinaResult.ok) return jinaResult;

  // Fallback to proxy
  console.log(`[scraper] Jina failed for ${url} (${jinaResult.error}), trying proxy`);
  const proxyResult = await extractViaProxy(url);
  if (proxyResult.ok) return proxyResult;

  console.warn(`[scraper] All extraction failed for ${url}`);
  failedUrls.set(url, prevFailures + 1);
  return proxyResult;
}

// ─── Enrichment tracking ───────────────────────────────────────────

export type EnrichMethod = 'naver' | 'jina' | 'none';

let lastEnrichMethod: EnrichMethod = 'none';

export function getLastEnrichMethod(): EnrichMethod {
  return lastEnrichMethod;
}

export type EnrichResult = {
  enriched: number;
  failed: number;
  skipped: number;
  blocked: number;
  total: number;
  updates: Map<string, { fullText: string; images?: ArticleImage[] }>;
};

// ─── Main Enrichment Pipeline ───────────────────────────────────────

/**
 * Enrich articles with full text and return immutable update patches.
 *
 * Pipeline:
 *   1. Jina Reader (universal, no API key)
 *   2. Fallback: HTML proxy
 */
export async function enrichArticlesWithFullText(
  articles: { title: string; link: string; fullText?: string; description: string; images?: ArticleImage[] }[],
  _naverClientId?: string,
  _naverClientSecret?: string,
  onProgress?: (done: number, total: number) => void,
): Promise<EnrichResult> {
  const eligible = articles.filter(
    a =>
      !a.fullText &&
      a.link &&
      a.link.startsWith('http') &&
      !a.link.startsWith('manual://') &&
      !a.link.startsWith('simulator://'),
  );
  const blocked = eligible.filter(a => (failedUrls.get(a.link) || 0) >= MAX_RETRIES).length;
  const candidates = eligible.filter(a => (failedUrls.get(a.link) || 0) < MAX_RETRIES);

  if (candidates.length === 0) {
    return {
      enriched: 0,
      failed: 0,
      skipped: articles.length - eligible.length,
      blocked,
      total: eligible.length,
      updates: new Map(),
    };
  }

  let enriched = 0;
  let failed = 0;
  const skipped = articles.length - eligible.length;

  // Collect updates as a map (link → patch) instead of mutating in place
  const updates = new Map<string, { fullText: string; images?: ArticleImage[] }>();

  for (let i = 0; i < candidates.length; i += MAX_CONCURRENT) {
    const batch = candidates.slice(i, i + MAX_CONCURRENT);
    await Promise.allSettled(
      batch.map(async article => {
        const result = await extractArticleText(article.link);
        if (result.ok && result.text) {
          updates.set(article.link, {
            fullText: result.text,
            ...(result.images ? { images: result.images } : {}),
          });
          lastEnrichMethod = result.method === 'jina' ? 'jina' : 'naver';
          enriched++;
        } else {
          failed++;
        }
      }),
    );
    onProgress?.(enriched + failed + blocked, eligible.length);
  }

  return { enriched, failed, skipped, blocked, total: eligible.length, updates };
}
