import type { Article, Cluster } from '../types';

const KOREAN_PARTICLES = new Set([
  '은', '는', '이', '가', '을', '를', '의', '에', '와', '과', '로', '으로',
  '도', '만', '에서', '에게', '한', '하다', '했다', '했', '한다', '되었다',
]);

const STOPWORDS_EN = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'of', 'in', 'on', 'at',
  'for', 'to', 'and', 'or', 'but', 'with', 'by', 'as', 'from', 'that',
  'this', 'these', 'those', 'be', 'has', 'have', 'had',
]);

export function extractEntities(text: string): string[] {
  if (!text) return [];
  const out = new Set<string>();
  const englishCaps = text.match(/\b[A-Z][A-Za-z]{1,}\b/g) || [];
  englishCaps.forEach(t => out.add(t));
  const koreanNames = text.match(/[가-힣]{2,4}/g) || [];
  koreanNames.forEach(t => {
    if (!KOREAN_PARTICLES.has(t) && t.length >= 2 && t.length <= 4) out.add(t);
  });
  return [...out];
}

export function tokenize(text: string): string[] {
  if (!text) return [];
  const cleaned = text
    .replace(/[\[\](){}<>『』「」"',.!?·…—-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const out: string[] = [];
  for (const raw of cleaned.split(/\s+/)) {
    if (!raw) continue;
    const isKorean = /[가-힣]/.test(raw);
    if (isKorean) {
      const stripped = raw.replace(/(은|는|이|가|을|를|의|에|와|과|로|으로|도|만|에서|에게|했다|한다|됐다|되었다|이다|이라고|라고|에서는)$/, '');
      if (stripped && stripped.length >= 2 && !KOREAN_PARTICLES.has(stripped)) {
        out.push(stripped);
      }
    } else {
      const lower = raw.toLowerCase();
      if (lower.length >= 2 && !STOPWORDS_EN.has(lower)) {
        out.push(lower);
      }
    }
  }
  return out;
}

export function jaccard<T>(a: Set<T>, b: Set<T>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

const ENTITY_WEIGHT = 0.6;
const TITLE_WEIGHT = 0.4;

export function similarity(a: Article, b: Article): number {
  const entA = new Set(extractEntities(`${a.title} ${a.description}`));
  const entB = new Set(extractEntities(`${b.title} ${b.description}`));
  const titleA = new Set(tokenize(a.title));
  const titleB = new Set(tokenize(b.title));
  const entSim = jaccard(entA, entB);
  const titleSim = jaccard(titleA, titleB);
  return ENTITY_WEIGHT * entSim + TITLE_WEIGHT * titleSim;
}

export type ClusterOptions = {
  threshold?: number;
  windowMs?: number;
  now?: number;
};

const DEFAULTS = {
  threshold: 0.35,
  windowMs: 24 * 3600_000,
};

function clusterId(articleIds: string[]): string {
  const sorted = [...articleIds].sort();
  let h = 2166136261;
  for (const id of sorted) {
    for (let i = 0; i < id.length; i++) {
      h ^= id.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    h ^= 124;
  }
  return 'c-' + (h >>> 0).toString(16);
}

export function groupIntoClusters(articles: Article[], opts: ClusterOptions = {}): Cluster[] {
  const threshold = opts.threshold ?? DEFAULTS.threshold;
  const windowMs = opts.windowMs ?? DEFAULTS.windowMs;
  const now = opts.now ?? Date.now();

  const fresh = articles.filter(a => now - a.fetchedAt <= windowMs);
  const buckets: Article[][] = [];

  for (const a of fresh) {
    let placed = false;
    for (const bucket of buckets) {
      const head = bucket[0];
      if (similarity(a, head) >= threshold) {
        bucket.push(a);
        placed = true;
        break;
      }
    }
    if (!placed) buckets.push([a]);
  }

  return buckets.map(bucket => {
    const sortedByRecency = [...bucket].sort((x, y) => y.fetchedAt - x.fetchedAt);
    const articleIds = bucket.map(a => a.id);
    const entitySet = new Set<string>();
    for (const a of bucket) extractEntities(`${a.title} ${a.description}`).forEach(e => entitySet.add(e));
    return {
      id: clusterId(articleIds),
      articleIds,
      representativeTitle: sortedByRecency[0].title,
      entities: [...entitySet],
      createdAt: sortedByRecency[0].fetchedAt,
    };
  });
}
