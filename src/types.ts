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
export type ModelId = string;

export type ModelOption = {
  id: string;
  label: string;
  note?: string;
};

export const MODEL_OPTIONS: ModelOption[] = [
  { id: 'gpt-3.5-turbo', label: 'gpt-3.5-turbo', note: '최저가 · 무료 한도/저예산용' },
  { id: 'gpt-4o-mini', label: 'gpt-4o-mini', note: '기본 · 권장' },
  { id: 'gpt-4o', label: 'gpt-4o', note: '고품질 · 비용 약 10배' },
];

export type DraftLanguage = 'ko' | 'en';

export type Cluster = {
  id: string;
  articleIds: string[];
  representativeTitle: string;
  entities: string[];
  createdAt: number;
};

export type ConvertedResult = {
  id: string;
  sourceArticleIds: string[];
  sourceTitle: string;
  createdAt: number;
  valueScore: number;
  valueReason: string;
  facts: Facts;
  drafts: {
    ko: string;
    en: string;
  };
  activeLanguage: DraftLanguage;
  channels: {
    site: string;
    x: string;
    medium: string;
  };
  channelsGenerated: boolean;
  factReport: FactReport;
  bannedHits: Record<'site' | 'x' | 'medium', string[]>;
  stylePreset: StylePresetKey;
  model: ModelId;
};

export type Settings = {
  apiKey: string;
  rss2jsonApiKey: string;
  model: ModelId;
  stylePreset: StylePresetKey;
  customStyleInstruction: string;
  rssSources: RssSource[];
  rssPollMinutes: number;
  simulatorEnabled: boolean;
  simulatorIntervalSec: number;
  alertSoundEnabled: boolean;
  browserNotificationsEnabled: boolean;
};

export type AnalyzeKoreanOutput = {
  valueScore: number;
  valueReason: string;
  facts: Facts;
  koreanDraft: string;
};

export type ChannelOutput = {
  site: string;
  x: string;
  medium: string;
};
