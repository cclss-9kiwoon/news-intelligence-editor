import type { Article, Settings, Category, ConvertedResult, StoryOutput, TranslatedFields, ReferenceArticle } from '../types';
import { CONVERTED_RESULT_SCHEMA_VERSION } from '../types';
import { chatJson } from './openai';
import { extractArticleText } from './scraper';
import { buildProjectRulesText } from './projectRules';

// body에 남은 내부 섹션 라벨 줄("# 1. ...", "## 2. ...") 제거 + 빈 HTML 노드 정리.
// 빈 <p></p>(렌더 시 빈 단락) / src 없는 <img>(깨진 이미지)가 생성물에 들어오므로 후처리.
export function sanitizeBody(body: string): string {
  return body
    .split('\n')
    .filter(line => !/^\s*#{1,6}\s*\d+\.\s/.test(line))
    .join('\n')
    // src가 없거나 빈 <img> 제거 (인라인 이미지는 실제 src 있을 때만 유지)
    .replace(/<img\b[^>]*>/gi, (tag) => {
      const m = tag.match(/\bsrc\s*=\s*["']?([^"'\s>]*)/i);
      return m && m[1].trim() ? tag : '';
    })
    // 빈 단락 <p></p>, <p> </p>, <p>&nbsp;</p> 제거
    .replace(/<p>\s*(?:&nbsp;|&#160;|\s)*<\/p>/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// 영문 헤드라인 케이싱 후처리 — 전치사/접속사/관사는 소문자(lowercaseMinor), 나머지 주요 단어는 첫 글자 대문자.
// 첫·끝 단어는 항상 대문자. 약어(BTS, NCT)는 원형 보존(첫 글자만 손대고 나머지 유지).
const MINOR_WORDS = new Set([
  'a', 'an', 'the', 'and', 'but', 'or', 'nor', 'for', 'to', 'of', 'in', 'on', 'at',
  'by', 'from', 'with', 'as', 'vs', 'via', 'per', 'up', 'off', 'into', 'over',
]);
export function titleCaseHeadline(headline: string, lowercaseMinor: boolean): string {
  const tokens = headline.split(/(\s+)/); // 공백 보존
  const wordIdx = tokens.map((t, i) => (/\S/.test(t) ? i : -1)).filter(i => i >= 0);
  const first = wordIdx[0];
  const last = wordIdx[wordIdx.length - 1];
  const cap = (w: string) => w.replace(/^([^A-Za-z]*)([a-z])/, (_, p, c) => p + c.toUpperCase());
  return tokens
    .map((tok, i) => {
      if (!/\S/.test(tok)) return tok;
      const bare = tok.replace(/[^A-Za-z]/g, '').toLowerCase();
      if (lowercaseMinor && i !== first && i !== last && MINOR_WORDS.has(bare)) {
        return tok.toLowerCase();
      }
      return cap(tok);
    })
    .join('');
}

// 본문에 블록 태그(<p> 등)가 없으면 빈 줄 단위로 단락을 <p>로 감싼다(HTML <p> 필수 보장).
// 이미 <p>가 있으면 그대로 둔다. <blockquote>/<img>/<h*>로 시작하는 블록은 감싸지 않는다.
export function ensureParagraphs(html: string): string {
  if (/<p[\s>]/i.test(html)) return html;
  const blocks = html.split(/\n{2,}/).map(b => b.trim()).filter(Boolean);
  if (blocks.length === 0) return html;
  return blocks
    .map(b => (/^<(?:blockquote|img|figure|h[1-6]|ul|ol|table|div)\b/i.test(b) ? b : `<p>${b.replace(/\n/g, ' ')}</p>`))
    .join('\n');
}

function buildStorySystem(category: Category, settings: Settings, summaryBased = false): string {
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
  sections.push('- body 포맷(HTML): 각 문단을 별도 <p>…</p>로 분리(여러 문단을 한 <p>에 몰지 말 것). 가사·직접 인용은 <blockquote>…</blockquote>. 강조는 <strong>. 빈 <p></p>나 src 없는 <img> 금지. 한 문단은 2~4문장 권장.');
  // ── 안티-환각 하드룰 (모델 무관 핵심 — 발행 신뢰도 1순위) ──
  sections.push('[안티-환각 — 절대 규칙]');
  sections.push('- 제공된 매체 기사 본문에 *명시된 내용만* 작성한다. 직접 인용문·날짜·멤버명·곡명/앨범명·수치·소속사·기간 등 원문에 없는 것은 절대 창작·추측하지 마라.');
  sections.push('- 직접 인용("...")은 원문에 그대로 있는 문장만 쓴다. 원문에 없는 발언을 지어내 인용하지 마라.');
  sections.push('- "N년 만"·"N주년"·"데뷔 N년차" 같은 기간/횟수 계산은 원문에 그 수치가 명시돼 있을 때만 쓴다. 직접 연도를 빼서 계산하지 마라(예: 7년을 "10년 만"으로 틀리는 오류 방지). 명시 없으면 생략한다.');
  sections.push('- 핵심 이름(인물/그룹/멤버/장소/소속사)은 원문에 있으면 누락하지 말고, 없으면 지어내지 마라.');
  sections.push('- 불확실하면 단정하지 말고 생략한다. 정보가 빈약하면 차라리 짧게 써라(길이 채우려 창작 금지).');
  sections.push('- 사실 신뢰도(원문 충실)가 분량·표현보다 우선이다.');
  // 톤 블랙리스트 (에디토리얼/과장 표현 금지)
  sections.push('- 에디토리얼·과장 표현 금지: "legendary, highly anticipated, overwhelming, immense love, iconic, sensation" 류의 단정적 찬사/과장은 쓰지 말고 중립적 사실 서술로 대체하거나 삭제한다.');
  if (summaryBased) {
    sections.push('- ⚠️ 입력이 전문(full text) 없이 *요약/발췌(부분 정보)*뿐이다. 위 안티-환각 규칙을 *더 엄격히* 적용한다: 요약에 직접 드러난 사실만 쓰고, 요약 범위를 넘는 세부·정황·인용·수치·기간은 일절 지어내지 마라. 인용문은 사실상 금지(요약에 따옴표째 들어있지 않으면 쓰지 말 것). 빈약하면 짧게.');
  }
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

  // 품질 플래그: 풀텍스트가 1건도 없으면 RSS 요약(description) 기반 생성 → 보수적 작성 + draft 배지.
  const summaryBased = enrichedArticles.every(a => !a.fullText?.trim());

  const out = await chatJson<StoryOutput>({
    apiKey: settings.apiKey,
    baseUrl: settings.apiBaseUrl,
    model: settings.model,
    system: buildStorySystem(category, settings, summaryBased),
    user: buildStoryUser(enrichedArticles),
    temperature: 0.5,
  });

  // ③ 포맷 후처리: 헤드라인 케이싱(영문) + 본문 <p> 보장
  let headline = out.headline ?? '';
  const casing = settings.projectProfile.formatRules.headlineCasing;
  if (settings.projectProfile.outputLanguage === 'en' && (casing === 'title' || casing === 'lower-minor')) {
    headline = titleCaseHeadline(headline, casing === 'lower-minor');
  }

  return {
    summary: out.summary ?? '',
    headline,
    body: ensureParagraphs(sanitizeBody(out.body ?? '')),
    tags: Array.isArray(out.tags) ? out.tags : [],
    imagePrompt: out.imagePrompt ?? '',
    sourceFacts: Array.isArray(out.sourceFacts) ? out.sourceFacts : [],
    summaryBased,
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
