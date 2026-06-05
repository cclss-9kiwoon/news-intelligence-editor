import type { Article, BreakingAlert } from '../types';
import { makeArticleId } from './rss';

export const BREAKING_KEYWORDS = [
  '속보', '긴급', '단독', '사망', '사고', '폭발', '비상', '체포', '해킹', '습격',
  '결혼', '이혼', '열애', '컴백', '해체', '탈퇴', '입대', '폭로', '논란', '복귀',
];

const CRITICAL_PREFIX = /^\[(속보|단독|긴급)\]/;

export function detect(article: Article): BreakingAlert | null {
  const text = `${article.title} ${article.description}`;
  const matched = BREAKING_KEYWORDS.filter(kw => text.includes(kw));
  const titleCritical = CRITICAL_PREFIX.test(article.title);
  if (!titleCritical && matched.length === 0) return null;

  const severity: BreakingAlert['severity'] =
    titleCritical ? 'critical' : matched.length >= 2 ? 'high' : 'medium';

  return {
    article: { ...article, isBreaking: true },
    matchedKeywords: matched,
    severity,
    firedAt: Date.now(),
  };
}

/**
 * 속보 판정 — 파이프라인이 Task.isBreaking 전파에 사용.
 * 기본 BREAKING_KEYWORDS/제목 critical 매칭(detect) OR 캠페인 breakingKeywords 매칭.
 */
export function judgeBreaking(article: Article, breakingKeywords: string[] = []): boolean {
  if (detect(article)) return true;
  const text = `${article.title} ${article.description}`;
  return breakingKeywords.some(k => k.trim() && text.includes(k.trim()));
}

const MOCK_HEADLINES = [
  '[속보] 유명 K-pop 그룹 멤버 ○○ 군 입대 발표',
  '[단독] △△ 엔터테인먼트, 새 보이그룹 데뷔 일정 공개',
  '[속보] 톱스타 □□ 열애 인정',
  '[긴급] 인기 아이돌 그룹 일부 멤버 탈퇴 논란',
  '[속보] 베테랑 배우 ●● 별세, 향년 75세',
  '[단독] 글로벌 OTT, 한국 오리지널 신작 라인업 공개',
  '[속보] 인기 그룹 X 해체 공식 발표',
  '[긴급] 유명 작곡가 ★★ 표절 의혹 제기',
  '[단독] K-pop 톱그룹, 美 빌보드 1위 등극',
  '[속보] 인기 배우 △△ 결혼 발표',
];

const MOCK_DESCRIPTIONS = [
  '소속사가 공식 입장문을 통해 사실을 인정했다.',
  '관계자는 익명을 전제로 일정을 확인했다.',
  '팬들 사이에서는 이미 추측이 무성했다.',
  '연예가에 큰 파장이 예상된다.',
];

let mockIdx = 0;
export function generateMockBreaking(): Article {
  const title = MOCK_HEADLINES[mockIdx % MOCK_HEADLINES.length];
  const description = MOCK_DESCRIPTIONS[mockIdx % MOCK_DESCRIPTIONS.length];
  mockIdx++;
  const link = `simulator://mock/${Date.now()}/${mockIdx}`;
  return {
    id: makeArticleId(link),
    title,
    description,
    link,
    pubDate: new Date().toUTCString(),
    source: '🧪 시뮬레이터',
    inputType: 'simulator',
    isBreaking: true,
    fetchedAt: Date.now(),
  };
}
