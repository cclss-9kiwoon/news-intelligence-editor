import type { Article, Settings, Category, ConvertedResult, StoryOutput } from '../types';
import { CONVERTED_RESULT_SCHEMA_VERSION } from '../types';
import { chatJson } from './openai';

const BANNED_LIST_FOR_PROMPT =
  'delve, in conclusion, furthermore, testament, moreover, "it is important to note", ' +
  '"not only ... but also", "as an AI", "I think/believe/feel".';

// body에 남은 내부 섹션 라벨 줄("# 1. ...", "## 2. ...")을 제거하는 안전망
export function sanitizeBody(body: string): string {
  return body
    .split('\n')
    .filter(line => !/^\s*#{1,6}\s*\d+\.\s/.test(line))
    .join('\n')
    .trim();
}

function buildStorySystem(category: Category): string {
  return [
    '당신은 한국 연예 매체의 시니어 에디터입니다.',
    '여러 매체가 동일 사건을 다룬 한국어 기사 N건을 입력으로 받습니다.',
    '',
    `[카테고리: ${category.label}]`,
    '[선별·정리 기준]',
    category.criteria,
    '[말투]',
    category.tone,
    '',
    '[작업] 발행 여부를 판단하지 마라. 위 기준과 말투로 기사들을 교차검증해 정리·종합만 한다.',
    '',
    '[MUST]',
    '- summary: 무엇에 관한 기사인지 중립적으로 1~2줄(누가/무엇/핵심). 가치 평가나 발행 권고 금지.',
    '- headline: 기사 제목.',
    '- body: 머리표·섹션 라벨(#, "## 2." 등) 없이 깨끗한 발행용 본문. 매체 간 충돌 시 가장 일관된 값 채택, 충돌 사실은 summary에 명시.',
    '- 원문에 없는 사실 추측·창작 금지. 핵심 엔티티(인물/장소/소속사) 누락 금지.',
    '- tags: 해시태그 문자열 배열(# 없이 키워드만). imagePrompt: 순수 영문(Midjourney 호환, 한국어 금지).',
    `- 영어 LLM 상투구 회피: ${BANNED_LIST_FOR_PROMPT}`,
    '',
    '오직 valid JSON, 정확히 5개 키:',
    '{ "summary": string, "headline": string, "body": string, "tags": string[], "imagePrompt": string }',
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

export async function generateStory(
  articles: Article[],
  settings: Settings,
  category: Category,
): Promise<StoryOutput> {
  if (articles.length === 0) throw new Error('generateStory requires at least one article');

  const out = await chatJson<StoryOutput>({
    apiKey: settings.apiKey,
    baseUrl: settings.apiBaseUrl,
    model: settings.model,
    system: buildStorySystem(category),
    user: buildStoryUser(articles),
    temperature: 0.5,
  });

  return {
    summary: out.summary ?? '',
    headline: out.headline ?? '',
    body: sanitizeBody(out.body ?? ''),
    tags: Array.isArray(out.tags) ? out.tags : [],
    imagePrompt: out.imagePrompt ?? '',
  };
}

export function buildInitialResult(
  articles: Article[],
  story: StoryOutput,
  settings: Settings,
  category: Category,
): ConvertedResult {
  const newest = articles.reduce((p, c) => (c.fetchedAt > p.fetchedAt ? c : p), articles[0]);
  return {
    schemaVersion: CONVERTED_RESULT_SCHEMA_VERSION,
    id: `${newest.id}-${Date.now()}`,
    sourceArticleIds: articles.map(a => a.id),
    sourceTitle: newest.title,
    createdAt: Date.now(),
    model: settings.model,
    categoryId: category.id,
    summary: story.summary,
    headline: story.headline,
    body: story.body,
    tags: story.tags,
    imagePrompt: story.imagePrompt,
  };
}
