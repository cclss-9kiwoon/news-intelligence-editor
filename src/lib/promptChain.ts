import type { Article, Settings, Category, ConvertedResult, StoryOutput, TranslatedFields, ReferenceArticle } from '../types';
import { CONVERTED_RESULT_SCHEMA_VERSION } from '../types';
import { chatJson } from './openai';
import { extractArticleText } from './scraper';
import { buildProjectRulesText } from './projectRules';

// body에 남은 내부 섹션 라벨 줄("# 1. ...", "## 2. ...")을 제거하는 안전망
export function sanitizeBody(body: string): string {
  return body
    .split('\n')
    .filter(line => !/^\s*#{1,6}\s*\d+\.\s/.test(line))
    .join('\n')
    .trim();
}

function buildStorySystem(category: Category, settings: Settings): string {
  const { promptConfig, referenceArticles } = settings;

  const sections: string[] = [];

  // 1. 에디터 역할
  sections.push(`당신은 ${promptConfig.editorRole}입니다.`);
  sections.push('여러 매체가 동일 이슈를 다룬 한국어 기사 N건을 입력으로 받습니다.');
  sections.push('');

  // 2. 발행 가이드
  if (promptConfig.publishingGuide.trim()) {
    sections.push('[발행 가이드]');
    sections.push(promptConfig.publishingGuide);
    sections.push('');
  }

  // 3. 작업 지침
  if (promptConfig.taskInstructions.trim()) {
    sections.push('[작업 지침]');
    sections.push(promptConfig.taskInstructions);
    sections.push('');
  }

  // 3.5 프로젝트 포맷·정책 규칙 (SSOT — 검수 엔진과 공유)
  const projectRules = buildProjectRulesText(settings.projectProfile);
  if (projectRules.trim()) {
    sections.push('[포맷·정책 규칙 — 반드시 준수]');
    sections.push(projectRules);
    sections.push('');
  }

  // 4. 카테고리 (기존)
  sections.push(`[카테고리: ${category.label}]`);
  sections.push('[선별·정리 기준]');
  sections.push(category.criteria);
  sections.push('[말투]');
  sections.push(category.tone);
  sections.push('');

  // 5. 레퍼런스 기사 (있을 때만)
  if (referenceArticles.length > 0) {
    sections.push('[우리 매체 기사 예시]');
    referenceArticles.forEach((ref: ReferenceArticle, i: number) => {
      sections.push(`--- 예시 ${i + 1} ---`);
      sections.push(`제목: ${ref.title}`);
      sections.push(`본문: ${ref.body.slice(0, 2000)}`);
    });
    sections.push('위 예시의 문체·구조·톤을 참고하라.');
    sections.push('');
  }

  // 6. 고정 지침
  sections.push('[작업] 발행 여부를 판단하지 마라. 위 기준과 말투로 기사들을 교차검증해 정리·종합만 한다.');
  sections.push('');
  sections.push('[MUST]');
  sections.push('- summary: 무엇에 관한 기사인지 중립적으로 1~2줄(누가/무엇/핵심). 가치 평가나 발행 권고 금지.');
  sections.push('- headline: 기사 제목.');
  sections.push('- body: 머리표·섹션 라벨(#, "## 2." 등) 없이 깨끗한 발행용 본문. 매체 간 충돌 시 가장 일관된 값 채택, 충돌 사실은 summary에 명시.');
  sections.push('- 원문에 없는 사실 추측·창작 금지. 핵심 이름(인물/장소/소속사) 누락 금지.');
  sections.push('- tags: 해시태그 문자열 배열(# 없이 키워드만). imagePrompt: 순수 영문(Midjourney 호환, 한국어 금지).');
  sections.push('- sourceFacts: 원문에서 추출한 핵심 사실 5~10개를 불릿 리스트 배열로. 각 항목은 한 줄 이내, "누가 무엇을 했다" 형식. 드래프트에 반영했는지 에디터가 대조할 용도.');

  // 출력 언어 (프로젝트 프로필)
  if (settings.projectProfile.outputLanguage === 'en') {
    sections.push('- 출력 언어: summary·headline·body·tags를 자연스러운 영문으로 작성한다. 한국어 인명/작품명은 표준 로마자로 표기한다. sourceFacts는 한국어 유지(에디터 대조용).');
  }

  // 7. 금지 표현
  if (promptConfig.bannedExpressions.trim()) {
    sections.push(`- 영어 LLM 상투구 회피: ${promptConfig.bannedExpressions}`);
  }

  sections.push('');
  sections.push('오직 valid JSON, 정확히 6개 키:');
  sections.push('{ "summary": string, "headline": string, "body": string, "tags": string[], "imagePrompt": string, "sourceFacts": string[] }');

  return sections.join('\n');
}

// 매체당 본문 길이 상한 — 다수 매체 입력 시 컨텍스트 토큰 오버플로 방지
const MAX_ARTICLE_CHARS = 6000;

function buildStoryUser(articles: Article[]): string {
  const parts: string[] = [`[같은 이슈를 다룬 ${articles.length}개 매체 기사]`, ''];
  articles.forEach((a, i) => {
    const raw = a.fullText || a.description || '';
    const body = raw.length > MAX_ARTICLE_CHARS
      ? `${raw.slice(0, MAX_ARTICLE_CHARS)}… (이하 생략)`
      : raw;
    parts.push(`--- 매체 ${i + 1}: ${a.source} ---`);
    parts.push(`제목: ${a.title}`);
    parts.push(`본문: ${body}`);
    if (a.pubDate) parts.push(`발행: ${a.pubDate}`);
    parts.push('');
  });
  return parts.join('\n');
}

/**
 * On-demand full text extraction for articles missing fullText.
 * Retries extraction right before story generation so the AI gets maximum context.
 */
async function enrichMissingFullText(articles: Article[]): Promise<Article[]> {
  const missing = articles.filter(a => !a.fullText && a.link && a.link.startsWith('http'));
  if (missing.length === 0) return articles;

  console.log(`[promptChain] on-demand extraction for ${missing.length} articles missing fullText`);
  const patches = new Map<string, { fullText: string; images?: typeof missing[0]['images']; thumbnail?: string }>();
  await Promise.allSettled(
    missing.map(async (article) => {
      const result = await extractArticleText(article.link);
      if (result.ok && result.text) {
        patches.set(article.link, {
          fullText: result.text,
          ...(result.images ? { images: result.images.map(img => ({ ...img, source: article.source })) } : {}),
          ...(result.thumbnail ? { thumbnail: result.thumbnail } : {}),
        });
        console.log(`[promptChain] ✓ extracted ${result.text.length} chars from ${article.source} (${result.method})`);
      }
    }),
  );
  // Return new array with patches applied immutably
  return articles.map(article => {
    const p = patches.get(article.link);
    if (!p) return article;
    return {
      ...article,
      fullText: p.fullText,
      ...(!article.images && p.images ? { images: p.images } : {}),
      ...(!article.thumbnail && p.thumbnail ? { thumbnail: p.thumbnail } : {}),
    };
  });
}

export async function generateStory(
  articles: Article[],
  settings: Settings,
  category: Category,
): Promise<StoryOutput> {
  if (articles.length === 0) throw new Error('generateStory requires at least one article');

  // On-demand: retry extraction for articles still missing fullText (immutable)
  const enrichedArticles = await enrichMissingFullText(articles);

  const out = await chatJson<StoryOutput>({
    apiKey: settings.apiKey,
    baseUrl: settings.apiBaseUrl,
    model: settings.model,
    system: buildStorySystem(category, settings),
    user: buildStoryUser(enrichedArticles),
    temperature: 0.5,
  });

  return {
    summary: out.summary ?? '',
    headline: out.headline ?? '',
    body: sanitizeBody(out.body ?? ''),
    tags: Array.isArray(out.tags) ? out.tags : [],
    imagePrompt: out.imagePrompt ?? '',
    sourceFacts: Array.isArray(out.sourceFacts) ? out.sourceFacts : [],
  };
}

export async function translateToEnglish(
  fields: TranslatedFields,
  settings: Settings,
): Promise<TranslatedFields> {
  const bannedList = settings.promptConfig?.bannedExpressions || '';
  const system = [
    'You are a professional Korean→English news translator and copy editor.',
    'Translate the given Korean draft fields into natural, publication-ready English.',
    'Preserve every fact exactly (people, numbers, dates, organizations). Romanize Korean names in standard form (e.g., 양정아 → Yang Jung-ah).',
    ...(bannedList.trim() ? [`NEVER use these AI clichés: ${bannedList}`] : []),
    'tags: translate each keyword to a concise English keyword (no # prefix).',
    'Respond ONLY with valid JSON, exactly 4 keys: { "summary": string, "headline": string, "body": string, "tags": string[] }',
  ].join('\n');
  const user = [
    `[summary]\n${fields.summary}`,
    `[headline]\n${fields.headline}`,
    `[body]\n${fields.body}`,
    `[tags]\n${fields.tags.join(', ')}`,
  ].join('\n\n');

  const out = await chatJson<TranslatedFields>({
    apiKey: settings.apiKey,
    baseUrl: settings.apiBaseUrl,
    model: settings.model,
    system,
    user,
    temperature: 0.3,
  });

  return {
    summary: out.summary ?? '',
    headline: out.headline ?? '',
    body: sanitizeBody(out.body ?? ''),
    tags: Array.isArray(out.tags) ? out.tags : [],
  };
}

/**
 * 제외 주제(excludeTopics) 의미 판단 — AI가 기사가 제외 주제 중 하나에 해당하는지 본다.
 * 단순 키워드 포함이 아니라 "같은 주제인가"를 판단. excludeTopics 비면 호출 금지(상위에서 가드).
 */
export async function judgeExcludedTopic(
  context: { title: string; snippets: string[] },
  excludeTopics: string[],
  settings: Settings,
): Promise<{ excluded: boolean; matched: string }> {
  const topics = excludeTopics.filter(t => t.trim());
  if (topics.length === 0) return { excluded: false, matched: '' };

  const system = [
    '너는 기사 주제 분류기다. 주어진 기사가 "제외 주제" 목록 중 하나와 본질적으로 같은 주제인지 판단한다.',
    '단순 단어 일치가 아니라 의미·주제 단위로 본다. 예: 제외 주제 "열애설"이면 "두 사람 사귄다 보도", "연인 인정" 같은 기사도 같은 주제로 본다.',
    '확실히 해당 주제일 때만 excluded=true. 애매하면 false.',
    '오직 valid JSON: { "excluded": boolean, "matched": string }  // matched=해당된 제외 주제(없으면 "")',
  ].join('\n');
  const user = [
    `[제외 주제 목록]\n${topics.map((t, i) => `${i + 1}. ${t}`).join('\n')}`,
    '',
    `[기사 제목]\n${context.title}`,
    `[기사 내용 일부]\n${context.snippets.filter(Boolean).join('\n').slice(0, 1500)}`,
  ].join('\n');

  const out = await chatJson<{ excluded?: boolean; matched?: string }>({
    apiKey: settings.apiKey,
    baseUrl: settings.apiBaseUrl,
    model: settings.model,
    system,
    user,
    temperature: 0,
  });
  return { excluded: out.excluded === true, matched: out.matched ?? '' };
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
    sourceFacts: story.sourceFacts || [],
  };
}
