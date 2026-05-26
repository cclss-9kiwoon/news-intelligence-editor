import type { Article, RssSource } from '../types';

const RSS2JSON_ENDPOINT = 'https://api.rss2json.com/v1/api.json';

export function normalizeLink(link: string): string {
  try {
    const u = new URL(link);
    const toRemove: string[] = [];
    u.searchParams.forEach((_, k) => {
      if (k.toLowerCase().startsWith('utm_')) toRemove.push(k);
    });
    toRemove.forEach(k => u.searchParams.delete(k));
    return u.toString();
  } catch {
    return link;
  }
}

export function makeArticleId(link: string): string {
  const normalized = normalizeLink(link);
  let h = 2166136261;
  for (let i = 0; i < normalized.length; i++) {
    h ^= normalized.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

export function dedupeAndMerge(existing: Article[], incoming: Article[], maxSize: number): Article[] {
  const seen = new Set<string>();
  const out: Article[] = [];
  for (const a of existing) {
    if (!seen.has(a.id)) { seen.add(a.id); out.push(a); }
  }
  for (const a of incoming) {
    if (!seen.has(a.id)) { seen.add(a.id); out.push(a); }
  }
  out.sort((a, b) => b.fetchedAt - a.fetchedAt);
  return out.slice(0, maxSize);
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

type Rss2JsonItem = {
  title: string;
  link: string;
  description?: string;
  content?: string;
  pubDate?: string;
  thumbnail?: string;
  categories?: string[];
};

type Rss2JsonResponse = {
  status: string;
  feed?: { title?: string };
  items?: Rss2JsonItem[];
  message?: string;
};

const CACHE_TTL_MS = 5 * 60_000;
const BACKOFF_MS = 30 * 60_000;
const CACHE_PREFIX = 'nie:rss-cache:';
const BACKOFF_PREFIX = 'nie:rss-backoff:';

type CachedFeed = { ts: number; articles: Article[] };

function readCache(sourceId: string): Article[] | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + sourceId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedFeed;
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
    return parsed.articles;
  } catch { return null; }
}

function writeCache(sourceId: string, articles: Article[]) {
  try {
    localStorage.setItem(CACHE_PREFIX + sourceId, JSON.stringify({ ts: Date.now(), articles }));
  } catch { /* quota */ }
}

function isBackedOff(sourceId: string): boolean {
  try {
    const raw = localStorage.getItem(BACKOFF_PREFIX + sourceId);
    if (!raw) return false;
    const ts = parseInt(raw, 10);
    if (!ts || Date.now() - ts > BACKOFF_MS) {
      localStorage.removeItem(BACKOFF_PREFIX + sourceId);
      return false;
    }
    return true;
  } catch { return false; }
}

function setBackoff(sourceId: string) {
  try { localStorage.setItem(BACKOFF_PREFIX + sourceId, String(Date.now())); } catch { /* ignore */ }
}

export async function fetchRss(source: RssSource, apiKey?: string): Promise<Article[]> {
  const cached = readCache(source.id);
  if (cached) return cached;

  if (isBackedOff(source.id)) {
    console.warn('[rss] backed off (429 within last 30min), skipping:', source.name);
    return [];
  }

  let url = `${RSS2JSON_ENDPOINT}?rss_url=${encodeURIComponent(source.url)}`;
  if (apiKey && apiKey.trim()) {
    url += `&api_key=${encodeURIComponent(apiKey.trim())}`;
  }
  try {
    const res = await fetch(url);
    if (res.status === 429) {
      setBackoff(source.id);
      console.warn('[rss] 429 rate-limit, backing off 30min:', source.name);
      return [];
    }
    if (!res.ok) return [];
    const data = (await res.json()) as Rss2JsonResponse;
    if (data.status !== 'ok' || !data.items) return [];
    const now = Date.now();
    const articles = data.items.map((it): Article => ({
      id: makeArticleId(it.link),
      title: stripHtml(it.title || ''),
      description: stripHtml(it.description || it.content || ''),
      link: it.link,
      pubDate: it.pubDate || '',
      source: source.name,
      inputType: 'rss',
      category: it.categories?.[0],
      thumbnail: it.thumbnail || undefined,
      fetchedAt: now,
    }));
    writeCache(source.id, articles);
    return articles;
  } catch (err) {
    console.warn('[rss] fetch failed', source.name, err);
    return [];
  }
}
