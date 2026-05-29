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

// WARNING: Keys must match category IDs defined in defaultCategories.ts.
// If you rename or add category IDs there, update this record accordingly.
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  music: ['컴백', '신곡', '앨범', '음원', '차트', '콘서트', '투어', '뮤직비디오', 'MV', '팬미팅', '아이돌', '보이그룹', '걸그룹', 'K-pop', 'Kpop', '음악', '가수', '빌보드', '멜론', '발매', '타이틀곡', '뮤직', '래퍼', '싱어'],
  screen: ['드라마', '영화', '예능', '방영', '개봉', '시청률', '캐스팅', '촬영', '감독', '연출', '시즌', '넷플릭스', '티빙', '웨이브', '쿠팡플레이', 'OTT', '흥행', '배역', '극장', '개봉'],
  people: ['배우', '모델', '화보', '인터뷰', '근황', 'SNS', '인스타', '유튜브', '셀럽', '연예인', '스타', '소속사', '데뷔'],
  gossip: ['열애', '결별', '결혼', '이혼', '임신', '출산', '연인', '커플', '파경', '불륜', '스캔들', '사생활'],
  events: ['시상식', '수상', '후보', '페스티벌', '행사', '축제', '레드카펫', '그래미', '골든디스크', '대상', '신인상', '본상'],
};

export function classifyArticleCategory(article: { title: string; description: string }): string | undefined {
  const text = `${article.title} ${article.description}`.toLowerCase();
  let bestCategory: string | undefined;
  let bestScore = 0;

  for (const [catId, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      if (text.includes(kw.toLowerCase())) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestCategory = catId;
    }
  }

  return bestScore >= 1 ? bestCategory : undefined;
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
