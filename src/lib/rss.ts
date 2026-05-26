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

export async function fetchRss(source: RssSource): Promise<Article[]> {
  const url = `${RSS2JSON_ENDPOINT}?rss_url=${encodeURIComponent(source.url)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as Rss2JsonResponse;
    if (data.status !== 'ok' || !data.items) return [];
    const now = Date.now();
    return data.items.map((it): Article => ({
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
  } catch (err) {
    console.warn('[rss] fetch failed', source.name, err);
    return [];
  }
}
