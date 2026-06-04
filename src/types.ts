export type RssSource = {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
};

export type ArticleImage = {
  url: string;
  alt?: string;
  caption?: string;
  source?: string;          // 출처 매체명
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
  images?: ArticleImage[];   // 본문 내 모든 이미지
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

export type PromptConfig = {
  editorRole: string;
  publishingGuide: string;
  taskInstructions: string;
  bannedExpressions: string;
};

// ─── Project Profile (포맷·검수 규칙 SSOT) ───────────────────────────
// 생성 프롬프트 + 검수 엔진이 동일하게 읽는 단일 진실 소스(SSOT).
// 구조화 규칙(formatRules)은 regex 자동검수 가능, styleGuide/reviewRules는 LLM 해석.

export type QuoteStyle = 'double' | 'single';
export type HeadlineCasing = 'lower-minor' | 'title' | 'sentence' | 'none';
export type ArtistMarkup = 'strong' | 'link' | 'plain';
export type ImageMarkup = 'img-direct' | 'figure';
export type OutputLanguage = 'ko' | 'en' | 'both';

/** 구조화 포맷 규칙 — 기계 검수(regex) 가능 */
export type FormatRules = {
  quoteSong: QuoteStyle;        // 곡명/트랙명
  quoteWork: QuoteStyle;        // 앨범/EP/쇼/드라마/투어명
  quoteQuotation: QuoteStyle;   // 인용구
  headlineCasing: HeadlineCasing;
  artistMarkup: ArtistMarkup;   // 본문 아티스트명 마크업
  imageMarkup: ImageMarkup;     // 이미지 배치 방식
  noEditorialClosing: boolean;  // 클로징 에디토리얼 첨언 금지
  bodyMinChars: number;         // 본문 최소 길이 (0=무제한)
  bodyMaxChars: number;         // 본문 최대 길이 (0=무제한)
};

/** 커스텀 검수 항목 — LLM이 해석해서 검사 */
export type ReviewRule = {
  id: string;
  label: string;
  instruction: string;          // LLM 검수 지시 내용
  severity: 'block' | 'warn';   // block=발행 차단, warn=경고만
  enabled: boolean;
};

export type ProjectProfile = {
  publicationName: string;      // 매체/프로젝트명
  outputLanguage: OutputLanguage;
  allowedMedia: string[];       // 허용 소스 매체 (비면 전체 허용)
  bannedMedia: string[];        // 금지 소스 매체
  formatRules: FormatRules;
  styleGuide: string;           // 자유 가이드라인 (위로 안 잡히는 규칙)
  reviewRules: ReviewRule[];    // 커스텀 LLM 검수 항목
};

// ─── Review 결과 ────────────────────────────────────────────────────

export type ReviewFinding = {
  ruleId: string;
  label: string;
  severity: 'block' | 'warn';
  message: string;              // 무엇이 어긋났는지
  field?: 'headline' | 'body' | 'tags' | 'imagePrompt';
  source: 'rule' | 'llm';       // 규칙기반 vs LLM 검수
};

export type ReviewResult = {
  passed: boolean;              // block 0건이면 true
  findings: ReviewFinding[];
  checkedAt: number;
};

export type ReferenceArticle = {
  id: string;
  url: string;
  title: string;
  body: string;
  fetchedAt: number;
};

export type Cluster = {
  id: string;
  articleIds: string[];
  representativeTitle: string;
  entities: string[];
  createdAt: number;
};

export type Category = {
  id: string;
  label: string;
  criteria: string;  // 선별/평가 기준 템플릿
  tone: string;      // 말투/문체 템플릿
};

// LLM이 반환하는 정확히 6개 키 (구조화 발행 드래프트)
export type StoryOutput = {
  summary: string;     // 중립 요약 1~2줄 (판단 X)
  headline: string;
  body: string;        // 발행용 깨끗한 본문 (섹션 라벨 없음)
  tags: string[];
  imagePrompt: string; // 순수 영문(Midjourney)
  sourceFacts?: string[];  // key facts extracted from sources
};

export const CONVERTED_RESULT_SCHEMA_VERSION = 3;

// 번역 가능한 필드 부분집합 (imagePrompt는 항상 영문이라 제외)
export type TranslatedFields = Pick<StoryOutput, 'summary' | 'headline' | 'body' | 'tags'>;

export type ConvertedResult = StoryOutput & {
  schemaVersion: typeof CONVERTED_RESULT_SCHEMA_VERSION;
  id: string;
  sourceArticleIds: string[];
  sourceTitle: string;
  createdAt: number;
  model: ModelId;
  categoryId: string;
  en?: TranslatedFields;  // 영어 번역본 (요청 시 생성·캐시)
};

export type ArticleWindow = '1h' | '24h' | '7d' | '30d' | 'breaking';

export type Settings = {
  provider: ProviderId;
  apiKey: string;
  apiBaseUrl: string;
  rss2jsonApiKey: string;
  model: ModelId;
  categories: Category[];
  activeCategoryId: string;
  articleWindow: ArticleWindow;
  rssSources: RssSource[];
  rssPollMinutes: number;
  clusterThreshold: number;
  simulatorEnabled: boolean;
  simulatorIntervalSec: number;
  alertSoundEnabled: boolean;
  browserNotificationsEnabled: boolean;
  naverClientId: string;
  naverClientSecret: string;
  naverQueries: string[];
  promptConfig: PromptConfig;
  referenceArticles: ReferenceArticle[];
  projectProfile: ProjectProfile;
};
