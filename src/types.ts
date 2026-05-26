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
export type ProviderId = 'openai' | 'gemini' | 'custom';

export type ModelOption = {
  id: string;
  label: string;
  note?: string;
};

export type ProviderConfig = {
  id: ProviderId;
  name: string;
  baseUrl: string;
  models: ModelOption[];
  keyLabel: string;
  keyHelp: string;
};

export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    keyLabel: 'OpenAI API 키',
    keyHelp: 'platform.openai.com에서 발급. 결제 충전(prepaid) 필요.',
    models: [
      { id: 'gpt-3.5-turbo', label: 'gpt-3.5-turbo', note: '최저가' },
      { id: 'gpt-4o-mini', label: 'gpt-4o-mini', note: '권장' },
      { id: 'gpt-4o', label: 'gpt-4o', note: '고품질 · 비용 ~10배' },
    ],
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    keyLabel: 'Gemini API 키',
    keyHelp: 'aistudio.google.com에서 무료 발급. 분당 15건 / 일 1,500건 무료 한도.',
    models: [
      { id: 'gemini-2.5-flash', label: 'gemini-2.5-flash', note: '권장 · 무료' },
      { id: 'gemini-2.0-flash', label: 'gemini-2.0-flash', note: '안정 · 무료' },
      { id: 'gemini-1.5-flash', label: 'gemini-1.5-flash', note: '레거시' },
      { id: 'gemini-2.5-pro', label: 'gemini-2.5-pro', note: '고품질 · 한도 더 좁음' },
    ],
  },
  custom: {
    id: 'custom',
    name: '커스텀 (OpenAI 호환)',
    baseUrl: '',
    keyLabel: 'API 키',
    keyHelp: 'Groq / OpenRouter / 자체 호스팅 등 OpenAI 호환 endpoint',
    models: [],
  },
};

export const DEFAULT_PROVIDER: ProviderId = 'openai';

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
  provider: ProviderId;
  apiKey: string;
  apiBaseUrl: string;
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
