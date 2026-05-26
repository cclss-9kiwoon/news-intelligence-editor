import type {
  Article, Settings, ConvertedResult, AnalyzeAndTranslateOutput, ChannelOutput, Facts, FactReport,
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
    'You will receive multiple source articles covering the SAME event from different outlets.',
    'Your task: SYNTHESIZE them into ONE professional English draft. Do NOT translate each source separately.',
    'Cross-verify facts across sources. If sources conflict on a number/date/name, prefer the most consistent version and note disagreement at the end with "Sources disagree on: ...".',
    'If a fact appears in only one source, include it but you may flag it inline as "(per [source name])".',
    `Target style: "${styleLabel}". ${styleInstruction}`,
    `You MUST NEVER use these banned words/phrases: ${BANNED_LIST_FOR_PROMPT}`,
    'You MUST extract concrete facts (people, numbers, places, dates) as they appear across sources.',
    'Respond ONLY with valid JSON matching:',
    '{',
    '  "valueScore": number 1-10 (newsworthiness of the consolidated story),',
    '  "valueReason": string,',
    '  "facts": { "people": string[], "numbers": string[], "places": string[], "dates": string[] },',
    '  "englishDraft": string (400-600 words, professional, synthesized from all sources)',
    '}' + stricterNote,
  ].join('\n');
}

function buildCall1User(articles: Article[]): string {
  const parts: string[] = [`[${articles.length} source article(s) covering the same event]`, ''];
  articles.forEach((a, i) => {
    parts.push(`--- Source ${i + 1}: ${a.source} ---`);
    parts.push(`Title: ${a.title}`);
    parts.push(`Body: ${a.fullText || a.description}`);
    if (a.pubDate) parts.push(`Published: ${a.pubDate}`);
    parts.push('');
  });
  return parts.join('\n');
}

function buildCall2System(settings: Settings, facts: Facts): string {
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

export type FormatChannelsArgs = {
  editedDraft: string;
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
    system: buildCall2System(args.settings, args.facts),
    user: buildCall2User(args.editedDraft),
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

export async function runChain(articles: Article[], settings: Settings): Promise<ConvertedResult> {
  if (articles.length === 0) {
    throw new Error('runChain requires at least one article');
  }

  let call1 = await chatJson<AnalyzeAndTranslateOutput>({
    apiKey: settings.apiKey,
    model: settings.model,
    system: buildCall1System(settings, false),
    user: buildCall1User(articles),
    temperature: 0.5,
  });

  if (!scan(call1.englishDraft).ok) {
    call1 = await chatJson<AnalyzeAndTranslateOutput>({
      apiKey: settings.apiKey,
      model: settings.model,
      system: buildCall1System(settings, true),
      user: buildCall1User(articles),
      temperature: 0.3,
    });
  }

  const { channels, bannedHits, factReport } = await formatChannels({
    editedDraft: call1.englishDraft,
    facts: call1.facts,
    settings,
  });

  const newest = articles.reduce((p, c) => c.fetchedAt > p.fetchedAt ? c : p, articles[0]);

  return {
    id: `${newest.id}-${Date.now()}`,
    sourceArticleIds: articles.map(a => a.id),
    sourceTitle: newest.title,
    createdAt: Date.now(),
    valueScore: call1.valueScore,
    valueReason: call1.valueReason,
    facts: call1.facts,
    englishDraft: call1.englishDraft,
    channels,
    factReport,
    bannedHits,
    stylePreset: settings.stylePreset,
    model: settings.model,
  };
}
