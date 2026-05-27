import type { Article, Settings, ConvertedResult, StoryOutput } from '../types';
import { CONVERTED_RESULT_SCHEMA_VERSION } from '../types';
import { chatJson } from './openai';
import { getStyleInstruction } from './styles';

const BANNED_LIST_FOR_PROMPT =
  'delve, in conclusion, furthermore, testament, moreover, "it is important to note", ' +
  '"not only ... but also", "as an AI", "I think/believe/feel".';

function buildStorySystem(settings: Settings): string {
  const instruction = getStyleInstruction(settings.customStyleInstruction);
  return [
    '당신은 한국 디지털 매체의 시니어 에디터이자 가치 평가관입니다.',
    '여러 매체가 동일 사건을 다룬 한국어 기사 N건을 입력으로 받습니다.',
    '',
    '[에디터 통합 지침 — 가치 기준 + 말투]',
    instruction,
    '',
    '[작업]',
    '1) 가치 평가: 위 지침의 가치 기준에 비추어 발행 가치가 있는지 Pass/Fail 판정. holdReason에 한국어로 구체 사유.',
    '2) 종합 드래프트: 기사들을 교차검증해 단일 완결형 내러티브 작성. 매체별 개별 번역/요약 금지, 한 편의 글로 합칠 것.',
    '',
    '[MUST]',
    '- 원문에 없는 인물관계/날짜/수치 추측·창작 금지(Hallucination). 근거 없는 정보 작성 금지.',
    '- 숫자/날짜/이름이 매체 간 충돌 시 가장 일관된 값 채택 + §4에 "Sources disagree on: ..." 명시.',
    '- 핵심 엔티티(인물/장소/소속사)를 본문에 누락 없이 자연스럽게 융합.',
    '- §1~§4는 통합 지침의 말투로 한국어 작성.',
    '- §5(이미지 프롬프트)는 반드시 순수 영문(Midjourney 호환). 한국어 한 단어도 금지.',
    '',
    `[NEVER — 영어 LLM 상투구] ${BANNED_LIST_FOR_PROMPT}`,
    '사고 단계에서 회피하고 자연스러운 저널리즘 문체로 우회.',
    '',
    '[조언일 뿐] valueDecision이 Fail이어도 storyDraft는 끝까지 정상 작성(차단 금지).',
    '',
    '오직 valid JSON, 정확히 3개 키:',
    '{',
    '  "valueDecision": "Pass" | "Fail",',
    '  "holdReason": "...(한국어)",',
    '  "storyDraft": "# 1. [헤드라인]\\n\\n## 2. 스토리텔링형 본문\\n...\\n\\n## 3. 연관 키워드 및 태그\\n#키워드\\n\\n## 4. 에디터 코멘트 패널\\n...\\n\\n## 5. AI 이미지 생성용 영문 프롬프트\\n[pure English]"',
    '}',
  ].join('\n');
}

function buildStoryUser(articles: Article[]): string {
  const parts: string[] = [`[같은 사건을 다룬 ${articles.length}개 소스 기사]`, ''];
  articles.forEach((a, i) => {
    parts.push(`--- 소스 ${i + 1}: ${a.source} ---`);
    parts.push(`제목: ${a.title}`);
    parts.push(`본문: ${a.fullText || a.description}`);
    if (a.pubDate) parts.push(`발행: ${a.pubDate}`);
    parts.push('');
  });
  return parts.join('\n');
}

export async function generateStory(articles: Article[], settings: Settings): Promise<StoryOutput> {
  if (articles.length === 0) throw new Error('generateStory requires at least one article');

  return chatJson<StoryOutput>({
    apiKey: settings.apiKey,
    baseUrl: settings.apiBaseUrl,
    model: settings.model,
    system: buildStorySystem(settings),
    user: buildStoryUser(articles),
    temperature: 0.5,
  });
}

export function buildInitialResult(
  articles: Article[],
  story: StoryOutput,
  settings: Settings,
): ConvertedResult {
  const newest = articles.reduce((p, c) => c.fetchedAt > p.fetchedAt ? c : p, articles[0]);
  return {
    schemaVersion: CONVERTED_RESULT_SCHEMA_VERSION,
    id: `${newest.id}-${Date.now()}`,
    sourceArticleIds: articles.map(a => a.id),
    sourceTitle: newest.title,
    createdAt: Date.now(),
    valueDecision: story.valueDecision,
    holdReason: story.holdReason,
    storyDraft: story.storyDraft,
    model: settings.model,
  };
}
