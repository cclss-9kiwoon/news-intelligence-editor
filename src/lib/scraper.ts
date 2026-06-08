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

/**
 * Jina가 특정 도메인에 451(Unavailable For Legal Reasons)/403/410 반환 시 그 도메인 기록.
 * 이후 해당 도메인은 Jina 건너뛰고 프록시 우선 → 반복 451 낭비/지연 제거.
 * (topstarnews.net 등 일부 매체가 r.jina.ai에서 상시 451)
 */
const jinaBlockedDomains = new Set<string>();
const JINA_HARD_BLOCK_STATUS = new Set([451, 403, 410]);

function domainOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

/** export: 관측/테스트용 — 현재 Jina 차단된 도메인 수 */
export function getJinaBlockedDomainCount(): number {
  return jinaBlockedDomains.size;
}

/** 테스트용 — 차단 도메인 초기화 */
export function _resetJinaBlocked(): void {
  jinaBlockedDomains.clear();
}

/**
 * Domains known to block extraction (hard paywalls / JS-only walls / aggregators
 * that never yield article body). Skipped immediately — no wasted fetch/timeout.
 * Universal list only; project-specific blocks belong in the preset/source filter.
 */
const DOMAIN_BLACKLIST: readonly string[] = [
  'facebook.com', 'instagram.com', 'twitter.com', 'x.com', 't.co',
  'youtube.com', 'youtu.be', 'tiktok.com',
  'play.google.com', 'apps.apple.com',
];

function isBlacklistedDomain(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return DOMAIN_BLACKLIST.some(d => host === d || host.endsWith(`.${d}`));
  } catch {
    return true; // unparseable URL → treat as unusable
  }
}

/**
 * 매체 추출 우선순위 (교차소스 작성을 위한 순서 제어).
 * 추출은 모든 source에 시도하되, 잘 긁히는 매체(화이트)를 먼저·자주 차단되는 매체(후순위)를
 * 나중에 시도해 fullText를 빠르게 1건+ 확보한다. 하드 스킵은 DOMAIN_BLACKLIST(소셜 등)만.
 *
 * 시드 리스트 — akp-RW가 매체 화이트/블랙리스트를 주면 setMediaPriorityLists로 교체/정교화.
 */
const DEFAULT_MEDIA_WHITELIST: readonly string[] = [
  'yna.co.kr',        // 연합뉴스
  'yonhapnewstv.co.kr',
  'pstatic.net',      // 네이버뉴스 본문/이미지
  'naver.com',
  'news1.kr',
  'newsis.com',
];
// 자주 차단되는(451 등) 어그리게이터/매체 — 후순위(스킵 아님: 유일 소스일 수 있음)
const DEFAULT_MEDIA_DEPRIORITIZE: readonly string[] = [
  'topstarnews.net',
  'bizwnews',
  'gukjenews',
  'jndn',
];

let mediaWhitelist: string[] = [...DEFAULT_MEDIA_WHITELIST];
let mediaDeprioritize: string[] = [...DEFAULT_MEDIA_DEPRIORITIZE];

/** akp-RW 매체 화이트/블랙리스트 주입용. 빈 배열 전달 시 해당 목록 초기화. */
export function setMediaPriorityLists(opts: { whitelist?: string[]; deprioritize?: string[] }): void {
  if (opts.whitelist) mediaWhitelist = [...opts.whitelist];
  if (opts.deprioritize) mediaDeprioritize = [...opts.deprioritize];
}

/** 테스트/관측용 — 현재 우선순위 목록 */
export function getMediaPriorityLists(): { whitelist: string[]; deprioritize: string[] } {
  return { whitelist: [...mediaWhitelist], deprioritize: [...mediaDeprioritize] };
}

/** 테스트용 — 시드 기본값으로 복원 */
export function _resetMediaPriorityLists(): void {
  mediaWhitelist = [...DEFAULT_MEDIA_WHITELIST];
  mediaDeprioritize = [...DEFAULT_MEDIA_DEPRIORITIZE];
}

/**
 * 추출 우선순위 랭크: 0=화이트(먼저), 1=일반, 2=후순위(나중).
 * 화이트=정확/서픽스 일치. 후순위=느슨한 substring(시드라 TLD 미정 가능) + 런타임 Jina 차단 도메인 통합.
 */
export function mediaPriorityRank(url: string): 0 | 1 | 2 {
  const host = domainOf(url);
  if (!host) return 2; // 파싱 불가 → 맨 뒤
  if (mediaWhitelist.some(d => host === d || host.endsWith(`.${d}`))) return 0;
  if (jinaBlockedDomains.has(host)) return 2; // 상시 451 → 후순위로 통합
  if (mediaDeprioritize.some(d => host.includes(d))) return 2;
  return 1;
}

/** 추출 후보를 우선순위로 안정 정렬(화이트 먼저, 후순위 나중). 원본 불변. */
export function orderByMediaPriority<T extends { link: string }>(items: T[]): T[] {
  return items
    .map((item, i) => ({ item, i, rank: mediaPriorityRank(item.link) }))
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .map(x => x.item);
}

/**
 * Reject non-article images by URL pattern: tracking pixels, sprites, icons,
 * logos, watermark/badge overlays, avatars, emoji, data URIs.
 * Visual watermark detection (pixel analysis) is out of scope — URL heuristics only.
 */
const JUNK_IMAGE_RE = /blank\.gif|transparent|spacer|1x1|pixel|sprite|watermark|wm[-_]|logo|icon|favicon|avatar|profile|emoji|badge|btn[-_]|button/i;

function isJunkImage(url: string): boolean {
  if (!url || !url.startsWith('http')) return true;
  return JUNK_IMAGE_RE.test(url);
}

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
  status?: number;   // HTTP status (Jina/proxy 실패 진단용 — 451 등)
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
      return { ok: false, error: `Jina HTTP ${res.status}`, method: 'jina', status: res.status };
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
        if (!isJunkImage(imgUrl)) {
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
      if (!isJunkImage(src)) {
        const figCaption = img.closest('figure')?.querySelector('figcaption, em, .img_desc');
        images.push({
          url: src,
          alt: img.getAttribute('alt') || undefined,
          caption: figCaption?.textContent?.trim() || undefined,
        });
      }
    }

    // og:image (대표/리드 이미지) — 본문 첫 <img>보다 우선해 thumbnail로. 중복/정크 제외.
    const ogImage = doc.querySelector('meta[property="og:image"], meta[name="og:image"]')
      ?.getAttribute('content')?.trim() || '';
    if (ogImage && !isJunkImage(ogImage) && !images.some(im => im.url === ogImage)) {
      images.unshift({ url: ogImage });
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
  // Skip blacklisted domains immediately — never extract usable article body
  if (isBlacklistedDomain(url)) {
    return { ok: false, error: 'skipped (blacklisted domain)' };
  }

  // Skip URLs that have already failed MAX_RETRIES times
  const prevFailures = failedUrls.get(url) || 0;
  if (prevFailures >= MAX_RETRIES) {
    return { ok: false, error: 'skipped (max retries)' };
  }

  const host = domainOf(url);
  // Jina가 상시 차단(451 등)하는 도메인은 한국사이트와 동일하게 프록시 우선 → Jina 낭비 제거
  const jinaBlocked = jinaBlockedDomains.has(host);

  // 헬퍼: Jina 실패 status가 hard-block(451/403/410)이면 도메인 기록(다음부터 skip)
  const noteJinaBlock = (r: ExtractResult) => {
    if (host && r.status != null && JINA_HARD_BLOCK_STATUS.has(r.status)) {
      if (!jinaBlockedDomains.has(host)) {
        console.warn(`[scraper] Jina hard-block ${r.status} for ${host} — 이후 프록시 우선`);
      }
      jinaBlockedDomains.add(host);
    }
  };

  // proxy-first 경로: 한국사이트 or Jina 차단 도메인
  if (isKoreanSite(url) || jinaBlocked) {
    const proxyResult = await extractViaProxy(url);
    if (proxyResult.ok) return proxyResult;

    // Jina 차단 도메인이면 Jina 재시도 무의미 → 프록시 결과로 종료
    if (jinaBlocked) {
      console.warn(`[scraper] All extraction failed for ${url} (jina-blocked domain, proxy도 실패)`);
      failedUrls.set(url, prevFailures + 1);
      return proxyResult;
    }

    // Proxy failed — try Jina
    const jinaResult = await extractViaJina(url);
    if (jinaResult.ok) return jinaResult;
    noteJinaBlock(jinaResult);

    console.warn(`[scraper] All extraction failed for ${url}`);
    failedUrls.set(url, prevFailures + 1);
    return proxyResult;
  }

  // Non-Korean: Jina first
  const jinaResult = await extractViaJina(url);
  if (jinaResult.ok) return jinaResult;
  noteJinaBlock(jinaResult);

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
      !a.link.startsWith('simulator://') &&
      !isBlacklistedDomain(a.link),
  );
  const blocked = eligible.filter(a => (failedUrls.get(a.link) || 0) >= MAX_RETRIES).length;
  // 매체 우선순위로 정렬: 잘 긁히는 화이트 매체 먼저 추출 → 교차소스 fullText 빠르게 확보.
  const candidates = orderByMediaPriority(eligible.filter(a => (failedUrls.get(a.link) || 0) < MAX_RETRIES));

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
