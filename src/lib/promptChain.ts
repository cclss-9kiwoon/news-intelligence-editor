import type {
  Article, Settings, ConvertedResult, AnalyzeKoreanOutput, ChannelOutput, Facts, FactReport, DraftLanguage,
} from '../types';
import { chatJson } from './openai';
import { scan } from './bannedWords';
import { verify } from './factCheck';
import { getStyleInstruction, STYLE_PRESETS } from './styles';

const BANNED_LIST_FOR_PROMPT =
  'delve, in conclusion, furthermore, testament, moreover, "it is important to note", ' +
  '"not only ... but also", "as an AI", "I think/believe/feel".';

function buildAnalyzeSystem(settings: Settings, stricter: boolean): string {
  const styleInstruction = getStyleInstruction(settings.stylePreset, settings.customStyleInstruction);
  const styleLabel = STYLE_PRESETS[settings.stylePreset].label;
  const stricterNote = stricter
    ? '\n\nIMPORTANT: 이전 시도에 LLM 상투구/금지어가 들어갔습니다. 평이하고 전문적인 한국어로 다시 작성하세요.'
    : '';
  return [
    '당신은 한국 연예/K-pop 분야의 시니어 에디터입니다.',
    '여러 매체가 동일한 사건을 다룬 한국어 기사 N건을 입력으로 받습니다.',
    '당신의 임무: 이 기사들을 교차검증하여 **단일 한국어 종합 드래프트**를 작성합니다.',
    '각 매체를 따로 번역/요약하지 말고 한 편의 글로 합치세요.',
    '숫자/날짜/이름이 매체 간 충돌하면 가장 일관된 값을 채택하고 마지막에 "Sources disagree on: ..."로 표기.',
    '한 매체만 언급한 사실은 본문에 포함하되 인라인으로 "(◯◯ 보도)"로 출처 표시 가능.',
    `톤/스타일: "${styleLabel}" (한국어로). 가이드: ${styleInstruction}`,
    `다음 영어 LLM 상투구는 본 글이 영어로 번역될 때도 등장해선 안 되니 사고 단계에서 회피: ${BANNED_LIST_FOR_PROMPT}`,
    'people/numbers/places/dates 팩트를 원문 그대로 추출 (이름은 한국어 그대로 또는 통상 영문 표기 모두 가능).',
    '**오직 valid JSON만 출력**:',
    '{',
    '  "valueScore": number 1-10 (이 사건의 뉴스 가치),',
    '  "valueReason": string (간단한 이유, 한국어),',
    '  "facts": { "people": string[], "numbers": string[], "places": string[], "dates": string[] },',
    '  "koreanDraft": string (400-600자 한국어 종합 드래프트, 전문적인 톤)',
    '}' + stricterNote,
  ].join('\n');
}

function buildAnalyzeUser(articles: Article[]): string {
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

export async function analyzeKorean(articles: Article[], settings: Settings): Promise<AnalyzeKoreanOutput> {
  if (articles.length === 0) throw new Error('analyzeKorean requires at least one article');

  const first = await chatJson<AnalyzeKoreanOutput>({
    apiKey: settings.apiKey,
    model: settings.model,
    system: buildAnalyzeSystem(settings, false),
    user: buildAnalyzeUser(articles),
    temperature: 0.5,
  });
  return first;
}

export type TranslateArgs = {
  text: string;
  from: DraftLanguage;
  to: DraftLanguage;
  settings: Settings;
};

export async function translateDraft(args: TranslateArgs): Promise<string> {
  if (args.from === args.to) return args.text;

  const fromLabel = args.from === 'ko' ? '한국어' : '영어';
  const toLabel = args.to === 'ko' ? '한국어' : '영어';
  const styleInstruction = getStyleInstruction(args.settings.stylePreset, args.settings.customStyleInstruction);

  const system = [
    `You are a professional translator. Translate the given ${fromLabel} draft into ${toLabel}.`,
    `Preserve facts exactly (people/numbers/places/dates). Keep paragraph structure. Adopt the editorial style: ${styleInstruction}`,
    args.to === 'en'
      ? `NEVER use these banned English phrases: ${BANNED_LIST_FOR_PROMPT}`
      : '평범하고 자연스러운 한국어로.',
    'Respond ONLY with valid JSON: { "translated": string }',
  ].join('\n');

  const result = await chatJson<{ translated: string }>({
    apiKey: args.settings.apiKey,
    model: args.settings.model,
    system,
    user: args.text,
    temperature: 0.3,
  });
  return result.translated;
}

function buildChannelsSystem(settings: Settings, facts: Facts): string {
  const styleInstruction = getStyleInstruction(settings.stylePreset, settings.customStyleInstruction);
  const factSummary = JSON.stringify(facts);
  return [
    'You are a multi-channel news formatter. Convert the given English draft into three channel-ready outputs.',
    `You MUST preserve ALL of these extracted facts: ${factSummary}`,
    `You MUST NEVER use banned words: ${BANNED_LIST_FOR_PROMPT}`,
    `Style: ${styleInstruction}`,
    '',
    'Channel rules:',
    '1. site: Standalone English article. 400-600 words. Headline + lead + body + closing. NO markdown.',
    '2. x: Twitter thread, 5-8 tweets, each <= 280 chars. First tweet = hook. Number tweets "1/", "2/", etc. 1-2 emojis per tweet max.',
    '3. medium: Long-form blog. Markdown. H1 title, italic subtitle, H2 section headers (Intro / Body / Conclusion). 800-1200 words.',
    '',
    'Respond ONLY with valid JSON: { "site": string, "x": string, "medium": string }',
  ].join('\n');
}

export type FormatChannelsArgs = {
  englishDraft: string;
  facts: Facts;
  settings: Settings;
};

export type FormatChannelsResult = {
  channels: ChannelOutput;
  factReport: FactReport;
  bannedHits: Record<'site' | 'x' | 'medium', string[]>;
};

export async function formatChannels(args: FormatChannelsArgs): Promise<FormatChannelsResult> {
  const channels = await chatJson<ChannelOutput>({
    apiKey: args.settings.apiKey,
    model: args.settings.model,
    system: buildChannelsSystem(args.settings, args.facts),
    user: `[English draft]\n${args.englishDraft}`,
    temperature: 0.6,
  });
  const bannedHits = {
    site: scan(channels.site).hits,
    x: scan(channels.x).hits,
    medium: scan(channels.medium).hits,
  };
  const factReport = verify(args.facts, channels);
  return { channels, bannedHits, factReport };
}

export function buildInitialResult(
  articles: Article[],
  analyzed: AnalyzeKoreanOutput,
  settings: Settings,
): ConvertedResult {
  const newest = articles.reduce((p, c) => c.fetchedAt > p.fetchedAt ? c : p, articles[0]);
  return {
    id: `${newest.id}-${Date.now()}`,
    sourceArticleIds: articles.map(a => a.id),
    sourceTitle: newest.title,
    createdAt: Date.now(),
    valueScore: analyzed.valueScore,
    valueReason: analyzed.valueReason,
    facts: analyzed.facts,
    drafts: { ko: analyzed.koreanDraft, en: '' },
    activeLanguage: 'ko',
    channels: { site: '', x: '', medium: '' },
    channelsGenerated: false,
    factReport: { ok: true, missing: [] },
    bannedHits: { site: [], x: [], medium: [] },
    stylePreset: settings.stylePreset,
    model: settings.model,
  };
}
