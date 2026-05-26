export type RssSource = {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
};

export type Article = {
  id: string;
  title: string;
  description: string;
  fullText?: string;
  link: string;
  pubDate: string;
  source: string;
  inputType: 'rss' | 'url' | 'paste' | 'simulator';
  category?: string;
  thumbnail?: string;
  isBreaking?: boolean;
  fetchedAt: number;
};

export type BreakingAlert = {
  article: Article;
  matchedKeywords: string[];
  severity: 'medium' | 'high' | 'critical';
  firedAt: number;
  dismissedAt?: number;
};

export type Facts = {
  people: string[];
  numbers: string[];
  places: string[];
  dates: string[];
};

export type FactReport = {
  ok: boolean;
  missing: Array<{ category: keyof Facts; value: string }>;
};

export type StylePresetKey = 'kpop' | 'ap' | 'bloomberg' | 'techcrunch' | 'custom';
export type ModelId = 'gpt-4o-mini' | 'gpt-4o';

export type ConvertedResult = {
  id: string;
  sourceArticleId: string;
  sourceTitle: string;
  createdAt: number;
  valueScore: number;
  valueReason: string;
  facts: Facts;
  englishDraft: string;
  channels: {
    site: string;
    x: string;
    medium: string;
  };
  factReport: FactReport;
  bannedHits: Record<'site' | 'x' | 'medium', string[]>;
  stylePreset: StylePresetKey;
  model: ModelId;
};

export type Settings = {
  apiKey: string;
  model: ModelId;
  stylePreset: StylePresetKey;
  customStyleInstruction: string;
  rssSources: RssSource[];
  simulatorEnabled: boolean;
  simulatorIntervalSec: number;
  alertSoundEnabled: boolean;
  browserNotificationsEnabled: boolean;
};

export type AnalyzeAndTranslateOutput = {
  valueScore: number;
  valueReason: string;
  facts: Facts;
  englishDraft: string;
};

export type ChannelOutput = {
  site: string;
  x: string;
  medium: string;
};
