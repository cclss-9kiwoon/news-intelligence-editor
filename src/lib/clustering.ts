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

/**
 * 엔티티에서 제외할 흔한 한글 일반명사/부사/동사 (인물·그룹명이 아닌 노이즈).
 * extractEntities가 모든 2~4글자 한글을 잡으면 매체 간 우연한 공통어가 가짜 엔티티 매칭을
 * 만들어 클러스터링이 부정확해진다. 이 stoplist로 노이즈를 걷어 핵심 고유명사만 남긴다.
 */
const KOREAN_ENTITY_STOPWORDS = new Set([
  '기자', '뉴스', '사진', '영상', '오늘', '어제', '내일', '지난', '이번', '다음', '당시', '최근', '현재', '이후', '이전',
  '공개', '발표', '발매', '활동', '모습', '관련', '통해', '위해', '대한', '이날', '그녀', '우리', '자신', '모든', '가장',
  '무대', '현장', '소식', '인기', '화제', '진행', '출연', '참석', '예정', '계획', '시작', '함께', '모두', '각각', '입장',
  '생각', '이야기', '마음', '사람', '여러', '정도', '경우', '부분', '상황', '결과', '과정', '문제', '이상', '이하', '동안',
  '때문', '통한', '대해', '밝혔', '전했', '말했', '보도', '기사', '내용', '사실', '확인', '예상', '전망', '계속', '직접',
  // 흔한 K-pop/연예 이벤트·포맷 일반명사 — 매 기사에 등장해 엔티티 매칭을 오염시킴(아티스트/그룹명만 핵심 신호로).
  '컴백', '신곡', '앨범', '음원', '차트', '콘서트', '투어', '데뷔', '공연', '신보', '싱글', '타이틀', '수록곡',
  '뮤비', '예능', '드라마', '영화', '방송', '화보', '인터뷰', '근황', '열애', '결혼', '미니앨범',
]);

/** 엔티티에서 제외할 흔한 영문 캡 단어(문장 첫 단어 등 — 고유명사 아님) */
const ENGLISH_ENTITY_STOPWORDS = new Set([
  'the', 'this', 'that', 'these', 'those', 'and', 'but', 'for', 'with', 'from',
  'her', 'his', 'its', 'our', 'new', 'after', 'before', 'how', 'why', 'what', 'when',
]);

/**
 * 핵심 엔티티(인물/그룹/작품명) 추출.
 * @param text 제목+요약
 * @param allowlist 캠페인 엔티티 허용목록(아티스트/그룹명 사전). 주어지면 매칭된 항목을 항상 포함(노이즈 stoplist 우회).
 *
 * 정밀화: 흔한 일반명사·부사(stoplist) 제외 → 매체 간 우연한 공통어로 인한 가짜 매칭 감소.
 */
export function extractEntities(text: string, allowlist?: string[]): string[] {
  if (!text) return [];
  const out = new Set<string>();

  // allowlist 우선 — text에 등장하는 허용 엔티티는 stoplist 무관하게 포함(핵심 신호)
  if (allowlist && allowlist.length > 0) {
    for (const e of allowlist) {
      const term = e.trim();
      if (term && text.includes(term)) out.add(term);
    }
  }

  const englishCaps = text.match(/\b[A-Z][A-Za-z]{1,}\b/g) || [];
  englishCaps.forEach(t => {
    if (!ENGLISH_ENTITY_STOPWORDS.has(t.toLowerCase())) out.add(t);
  });
  const koreanNames = text.match(/[가-힣]{2,5}/g) || [];
  koreanNames.forEach(raw => {
    // 조사/어미 제거(tokenize와 동일) — '뉴진스가'→'뉴진스', '신곡을'→'신곡'. 미제거 시 가짜 엔티티로 매칭 오염.
    const t = raw.replace(/(은|는|이|가|을|를|의|에|와|과|로|으로|도|만|에서|에게|했다|한다|됐다|되었다|이다|이라고|라고|에서는)$/, '');
    if (t.length >= 2 && t.length <= 4 && !KOREAN_PARTICLES.has(t) && !KOREAN_ENTITY_STOPWORDS.has(t)) {
      out.add(t);
    }
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

/**
 * 겹침 계수(overlap coefficient) = |교집합| / min(|A|, |B|).
 * 엔티티 유사도에 사용 — 같은 사건 다매체는 매체별로 잡히는 엔티티 수가 제각각이라
 * (예: 한 매체는 "뉴진스"만, 다른 매체는 "NewJeans/Returns/Single/뉴진스") jaccard는 분모가 커져
 * 점수가 깎인다. 겹침 계수는 공유 핵심 엔티티를 그대로 반영해 교차매체 병합을 살린다.
 */
export function overlapCoeff<T>(a: Set<T>, b: Set<T>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / Math.min(a.size, b.size);
}

// 엔티티(같은 인물/그룹) 가중을 높임 — 같은 사건의 다른 매체는 제목 토큰이 제각각이라
// titleJaccard가 낮다. 핵심 신호는 공유 엔티티이므로 가중을 ENTITY 쪽으로 옮긴다.
const ENTITY_WEIGHT = 0.7;
const TITLE_WEIGHT = 0.3;

export function similarity(a: Article, b: Article, allowlist?: string[]): number {
  const entA = new Set(extractEntities(`${a.title} ${a.description}`, allowlist));
  const entB = new Set(extractEntities(`${b.title} ${b.description}`, allowlist));
  const titleA = new Set(tokenize(a.title));
  const titleB = new Set(tokenize(b.title));
  const entSim = overlapCoeff(entA, entB);
  const titleSim = jaccard(titleA, titleB);
  return ENTITY_WEIGHT * entSim + TITLE_WEIGHT * titleSim;
}

export type ClusterOptions = {
  threshold?: number;
  windowMs?: number;
  now?: number;
  entityAllowlist?: string[];   // 캠페인 허용 엔티티(아티스트/그룹 사전) — 매칭 정밀화
  requireSharedEntity?: boolean; // 병합 시 공유 엔티티 ≥1 필수(과병합 방지). 기본 true
};

// threshold 완화: 같은 사건 다매체가 묶이도록 0.35→0.3. 과병합은 엔티티 교집합 ≥1 필수로 방지.
const DEFAULTS = {
  threshold: 0.3,
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
  const allowlist = opts.entityAllowlist;
  const requireSharedEntity = opts.requireSharedEntity ?? true;

  const fresh = articles.filter(a => now - a.fetchedAt <= windowMs);

  // 엔티티·제목 토큰 1회 선계산 (병합 비교 시 재계산 방지)
  const entityOf = new Map<string, Set<string>>();
  const titleOf = new Map<string, Set<string>>();
  for (const a of fresh) {
    entityOf.set(a.id, new Set(extractEntities(`${a.title} ${a.description}`, allowlist)));
    titleOf.set(a.id, new Set(tokenize(a.title)));
  }
  const sharesEntity = (a: Article, b: Article): boolean => {
    const ea = entityOf.get(a.id)!, eb = entityOf.get(b.id)!;
    for (const x of ea) if (eb.has(x)) return true;
    return false;
  };
  const sim = (a: Article, b: Article): number =>
    ENTITY_WEIGHT * overlapCoeff(entityOf.get(a.id)!, entityOf.get(b.id)!)
    + TITLE_WEIGHT * jaccard(titleOf.get(a.id)!, titleOf.get(b.id)!);

  const buckets: Article[][] = [];

  for (const a of fresh) {
    let placed = false;
    for (const bucket of buckets) {
      const head = bucket[0];
      // 과병합 방지: 공유 핵심 엔티티 ≥1 필수 + 임계값 충족.
      // (같은 사건 다매체는 제목이 달라도 인물/그룹을 공유 — 엔티티 교집합이 핵심 신호)
      if (requireSharedEntity && !sharesEntity(a, head)) continue;
      if (sim(a, head) >= threshold) {
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
    for (const a of bucket) (entityOf.get(a.id) ?? new Set()).forEach(e => entitySet.add(e));
    return {
      id: clusterId(articleIds),
      articleIds,
      representativeTitle: sortedByRecency[0].title,
      entities: [...entitySet],
      createdAt: sortedByRecency[0].fetchedAt,
    };
  });
}
