import type {
  Article, Settings, ConvertedResult, AnalyzeAndTranslateOutput, ChannelOutput,
} from '../types';
import { chatJson } from './openai';
import { scan } from './bannedWords';
import { verify } from './factCheck';
import { getStyleInstruction, STYLE_PRESETS } from './styles';

const BANNED_LIST_FOR_PROMPT =
  'delve, in conclusion, furthermore, testament, moreover, "it is important to note", ' +
  '"not only ... but also", "as an AI", "I think/believe/feel".';

function buildCall1System(settings: Settings, stricter: boolean): string {
  const styleInstruction = getStyleInstruction(settings.stylePreset, settings.customStyleInstruction);
  const styleLabel = STYLE_PRESETS[settings.stylePreset].label;
  const stricterNote = stricter
    ? '\n\nIMPORTANT: The previous attempt contained banned phrases. You MUST rewrite without ANY of the banned words. Use only plain, professional vocabulary.'
    : '';
  return [
    'You are a senior English news editor specializing in Korean entertainment and K-pop journalism.',
    `You MUST translate the Korean source article into professional English in the "${styleLabel}" style.`,
    `Style guidance: ${styleInstruction}`,
    `You MUST NEVER use these banned words/phrases: ${BANNED_LIST_FOR_PROMPT}`,
    'You MUST extract concrete facts (people, numbers, places, dates) exactly as they appear in the source.',
    'Respond ONLY with valid JSON matching this schema:',
    '{',
    '  "valueScore": number 1-10,',
    '  "valueReason": string (short reason),',
    '  "facts": { "people": string[], "numbers": string[], "places": string[], "dates": string[] },',
    '  "englishDraft": string (300-500 words, professional tone)',
    '}' + stricterNote,
  ].join('\n');
}

function buildCall1User(article: Article): string {
  return [
    `[Korean source article]`,
    `Title: ${article.title}`,
    `Body: ${article.fullText || article.description}`,
    `[Source]: ${article.source}`,
    `[Published]: ${article.pubDate}`,
  ].join('\n');
}

function buildCall2System(settings: Settings, facts: AnalyzeAndTranslateOutput['facts']): string {
  const styleInstruction = getStyleInstruction(settings.stylePreset, settings.customStyleInstruction);
  const factSummary = JSON.stringify(facts);
  return [
    'You are a multi-channel news formatter. Convert the given English draft into three channel-ready outputs.',
    `You MUST preserve ALL of these extracted facts (people/numbers/places/dates): ${factSummary}`,
    `You MUST NEVER use banned words: ${BANNED_LIST_FOR_PROMPT}`,
    `Style: ${styleInstruction}`,
    '',
    'Channel rules:',
    '1. site: Standalone English article. 400-600 words. Headline + lead + body + closing. NO markdown.',
    '2. x: Twitter thread, 5-8 tweets, each <= 280 chars. First tweet = hook. Number tweets "1/", "2/", etc. 1-2 emojis per tweet max.',
    '3. medium: Long-form blog. Markdown. H1 title, italic subtitle, H2 section headers (Intro / Body / Conclusion sections). 800-1200 words.',
    '',
    'Respond ONLY with valid JSON: { "site": string, "x": string, "medium": string }',
  ].join('\n');
}

function buildCall2User(draft: string): string {
  return `[English draft]\n${draft}`;
}

export async function runChain(article: Article, settings: Settings): Promise<ConvertedResult> {
  let call1 = await chatJson<AnalyzeAndTranslateOutput>({
    apiKey: settings.apiKey,
    model: settings.model,
    system: buildCall1System(settings, false),
    user: buildCall1User(article),
    temperature: 0.5,
  });

  if (!scan(call1.englishDraft).ok) {
    call1 = await chatJson<AnalyzeAndTranslateOutput>({
      apiKey: settings.apiKey,
      model: settings.model,
      system: buildCall1System(settings, true),
      user: buildCall1User(article),
      temperature: 0.3,
    });
  }

  const call2 = await chatJson<ChannelOutput>({
    apiKey: settings.apiKey,
    model: settings.model,
    system: buildCall2System(settings, call1.facts),
    user: buildCall2User(call1.englishDraft),
    temperature: 0.6,
  });

  const bannedHits = {
    site: scan(call2.site).hits,
    x: scan(call2.x).hits,
    medium: scan(call2.medium).hits,
  };
  const factReport = verify(call1.facts, call2);

  return {
    id: `${article.id}-${Date.now()}`,
    sourceArticleId: article.id,
    sourceTitle: article.title,
    createdAt: Date.now(),
    valueScore: call1.valueScore,
    valueReason: call1.valueReason,
    facts: call1.facts,
    englishDraft: call1.englishDraft,
    channels: call2,
    factReport,
    bannedHits,
    stylePreset: settings.stylePreset,
    model: settings.model,
  };
}
