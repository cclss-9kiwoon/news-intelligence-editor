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
  needsHuman?: boolean;         // 자율발행 차단 — 사람 확인 필요(불확실/민감). 값은 검수 로직(NIE)이 채움
  needsHumanReasons?: string[]; // 사람 필요 사유 (표시용)
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
  summaryBased?: boolean;  // 전 source 전문추출 실패 → RSS 요약 기반 생성(품질 플래그). 풀텍스트 있으면 false
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
export type SearchProviderId = 'naver' | 'daum';

export type SearchProviderConfig = {
  provider: SearchProviderId;
  enabled: boolean;
  query: string;
};

/** 검색어 프리셋 — naver/daum 검색어 묶음을 이름 붙여 전역 저장/재사용 (캠페인 간 공유) */
export type QueryPreset = {
  id: string;
  name: string;
  providers: SearchProviderConfig[];
  createdAt: number;
};

// ─── Pasta: Group / Campaign 계층 ───────────────────────────────────
// Hydra 모듈화. 그룹(회사) → 캠페인(아티클 종류) → [태스크는 Phase 2 칸반].
// 계정 전역 설정(provider/apiKey/model 등)은 Settings에 유지.
// 캠페인 스코프 설정(소스/포맷/프롬프트)은 CampaignSettings에 분리.

// 채널(배포 대상)은 Hydra 소관. 그룹은 "배포 맥락"(어떤 매체/플랫폼 성격인가)을
// 정의하고 하위 캠페인에 상속. 채널(어느 SNS 계정인가)은 제외.
// 배포 채널 유형 (범용 분류). 도메인 특정값(K-pop 등)은 프리셋으로 분리.
export type ChannelType = 'news_media' | 'vertical_curation' | 'brand_corporate' | 'creator_newsletter';
// 전문성·격식 수준 → ④결과물검수 엄격도에 직접 연동.
export type FormalityLevel = 'strict' | 'standard' | 'casual';
// 소스 검증 강도 → ①서칭 소스정책에 상속.
export type SourceStrictness = 'cross_verified' | 'standard' | 'loose';

/** 단계/그룹 LLM 오버라이드 — 비운 필드는 상위(그룹→글로벌 settings) 상속.
 * 우선순위: 단계 llm → 그룹 llm → 글로벌 settings. apiKey도 단계/그룹별 가능(quota 분산). */
export type StageLLMConfig = {
  provider?: ProviderId;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  enabled?: boolean;   // false면 이 단계 오버라이드 무시(상위 상속)
};

export type GroupProfile = {
  channelType: ChannelType;     // 배포 채널 유형
  formalityLevel: FormalityLevel; // 격식 수준 (검수 엄격도 연동)
  sourceStrictness: SourceStrictness; // 소스 검증 강도 (서칭 상속)
  language: string;             // 채널 언어 'ko'|'en'|... (주제선정 + 출력)
  character: string;            // 채널 성격 "이 채널이 어떤 곳인가"
  audience: string;             // 타겟 독자
  toneBase: string;             // 전반 톤·스타일 베이스
  llm?: StageLLMConfig;         // 그룹 기본 LLM(provider/키/모델). 캠페인 단계가 오버라이드
};

export type Group = {
  id: string;
  name: string;              // 회사/매체명 (allkpop, 스포츠조선 등)
  profile: GroupProfile;     // 배포 맥락 (캠페인 상속)
  createdAt: number;
};

/** 캠페인 소스 설정 — 어디서 어떤 기사를 가져올지 */
export type SourceConfig = {
  apiEnabled: boolean;
  rssEnabled: boolean;
  rssSources: RssSource[];
  searchProviders: SearchProviderConfig[];
  naverQueries: string[];
  daumQueries: string[];
  allowedSources: string[];
  bannedSources: string[];
  articleWindow: ArticleWindow;
  clusterThreshold: number;
  topicKeywords: string[];   // 포함 키워드 (비면 전체)
  excludeKeywords: string[]; // 제외 키워드
  minMediaCount: number;     // 태스크 생성 최소 매체 수
  minMediaForWrite?: number; // ③ 작성 전 교차검증 최소 distinct 매체 수(단일소스 차단). 기본 2. 임시 1로 흐름 확인 가능
  // ── 중복·범위 보강 (범용 스키마) ──
  entityAllowlist: string[];   // 허용 엔티티(인물/브랜드). 비면 전체 허용
  excludeTopics: string[];     // 제외 주제(구문 단위, 대소문자 무시)
  maxPerEntityPerDay: number;  // 엔티티당 하루 최대 기사 건수 (0=무제한)
  maxPerHour?: number;         // 시간당 신규 태스크 생성 상한 (기본 3, 0=무제한). 초과분은 버림
  breakingKeywords?: string[]; // 속보 판정 키워드 (제목/본문 포함 시 isBreaking). 판정은 NIE 로직
  breakingGoldenMinutes?: number; // 속보 골든타임(분) — 일반보다 짧은 유효창
  ownSiteDedupe: boolean;      // 자체 기보도 제목과 중복되면 스킵
  imageSourcePolicy: string;   // 이미지 출처 정책 (검수 프롬프트에 주입)
};

/** ② 주제 검수 설정 — 어떤 주제를 고르나 */
export type TopicReviewConfig = {
  intent?: string;            // 캠페인 주제 정의(자연어) — ② AI 적합성 선별 기준. 주력(키워드는 보조)
  selectionCriteria: string;  // 주제 선정 기준 (최신성/인지도/다양성)
  dedupeRules: string;        // 중복·앵글 회피 규칙
  priority: string;           // 우선순위
  llm?: StageLLMConfig;       // ② 단계 LLM 오버라이드(주제판단). 비면 그룹/글로벌 상속
};

/** ③ 생성 설정 — 어떻게 쓰나 */
export type GenerationConfig = {
  promptConfig: PromptConfig;       // 에디터 역할/발행 가이드/작업 지침/금지 표현
  formatRules: FormatRules;         // 표기 규칙 (인용부호/마크업)
  referenceArticles: ReferenceArticle[];
  styleGuide: string;               // 자유 가이드라인
  outputLanguage: OutputLanguage;
  writingModel?: string;            // ③ 작성 전용 모델(비면 글로벌). 높을수록 품질↑ (레거시, llm.model로 흡수 예정)
  llm?: StageLLMConfig;             // ③ 단계 LLM 오버라이드(작성). 비면 그룹/글로벌 상속
};

/** ④ 결과물 검수 설정 — 무엇을 검수하나 */
export type FinalReviewConfig = {
  reviewRules: ReviewRule[];        // 커스텀 LLM 검수 항목 (block=자동차단, warn=사람판단)
  allowedMedia: string[];
  bannedMedia: string[];
  autoPublish?: boolean;            // on=③→④ 진입 후 Verified(passed)면 자동 발행. 미통과는 사람 대기
  llm?: StageLLMConfig;             // ④ 단계 LLM 오버라이드(검수). 비면 그룹/글로벌 상속
};

/** 캠페인 단위 설정 — 칸반 4단계 구조 */
export type CampaignSettings = {
  searching: SourceConfig;          // ① 서칭
  topicReview: TopicReviewConfig;   // ② 주제 검수
  generation: GenerationConfig;     // ③ 생성
  finalReview: FinalReviewConfig;   // ④ 결과물 검수
  categories: Category[];
  activeCategoryId: string;
};

export type Campaign = {
  id: string;
  groupId: string;
  name: string;              // 아티클 종류 ("tier 3 아티클", "K-pop 컴백 속보")
  settings: CampaignSettings;
  configured?: boolean;      // 설정 1회 완료 여부 — true면 진입 시 칸반 직행
  autoCollect?: AutoCollectConfig;  // 자동 수집(주기 fetch→① 큐) on/off + 주기
  autoProcess?: AutoProcessConfig;  // 자동 진행(①→④ LLM 승급/판단/작성/검수) on/off
  createdAt: number;
  updatedAt: number;
};

/** 자동 수집 설정 — off면 주기 fetch 멈춤(① 큐 채우기). RSS 폴링과 분리 */
export type AutoCollectConfig = {
  enabled: boolean;
  intervalMin: 15 | 30 | 60;
};

/**
 * 자동 진행 설정 — off면 ①→② 승급 및 ②③④ LLM 처리 멈춤(① 큐엔 후보 계속 쌓임).
 * autoCollect와 독립. ① 큐 채우기(shouldClaimCluster)는 두 토글 무관 항상 동작(LLM 비용 0).
 */
export type AutoProcessConfig = {
  enabled: boolean;
};

// ─── Pasta Phase 2: 칸반 태스크 ─────────────────────────────────────
// 태스크 = 개별 기사 건. 캠페인 안에서 4단계 칸반으로 흐름.
//   searching → topic_review → producing → final_review
// 서칭~제작은 자동, 결과물 검수는 사람.

export type TaskStatus = 'searching' | 'topic_review' | 'producing' | 'final_review';

export type TaskSource = {
  articleId: string;
  title: string;
  source: string;            // 매체명
  hasFullText: boolean;
};

export type DiscardReason = 'low_quality' | 'off_topic' | 'duplicate' | 'extract_failed' | 'other';

export type Task = {
  id: string;
  campaignId: string;
  status: TaskStatus;
  title: string;             // 대표 제목
  clusterId: string;         // 원본 클러스터
  sources: TaskSource[];     // 원문 + 서브 소스
  imageCount: number;        // 수집된 이미지 수
  draft?: StoryOutput;       // 아티클 제작 결과
  review?: ReviewResult;     // 검수 결과
  error?: string;
  produceAttempts?: number;  // 제작 시도 횟수 (자동 재시도용)
  extractAttempts?: number;  // 전문 수집(추출) 실패 누적 — N회 0건이면 자동 폐기(extract_failed)
  topicChecked?: boolean;    // 제외 주제 AI 판단 통과 (주제 검수 단계)
  intentChecked?: boolean;   // 주제 정의(intent) 적합성 AI 판단 통과
  producibleChecked?: boolean; // ②-B 제작가능성(이미지) gate 통과 — LLM 판단 전 컷용 영속 플래그
  published?: boolean;       // 발행 완료 (Hydra 배포 훅)
  publishedAt?: number;      // 발행 시각 (발행함 뷰 정렬/표시)
  discardReason?: DiscardReason;  // 폐기 사유
  priority?: boolean;        // 우선 처리 (①→②승급·③제작 순서 우선). 골든타임 임박 시 자동 set
  paused?: boolean;          // 보류 — 파이프라인이 스킵. [재개]로 해제
  pausedAt?: number;         // 보류 시각
  pauseReason?: string;      // 보류 사유 (표시용)
  promotedAt?: number;       // ①→② 승급 시각 (시간당 승급 상한 카운트용)
  goldenTime?: { startsAt: number; expiresAt: number };  // 후보 유효창(입력값만 저장, 잔여/비율은 렌더 시 계산)
  isBreaking?: boolean;      // 속보 — 최상단 정렬·자동발행 차단·알림. 판정은 검수 로직(NIE)이 채움
  createdAt: number;
  updatedAt: number;
};

export type Settings = {
  provider: ProviderId;
  apiKey: string;
  apiBaseUrl: string;
  rss2jsonApiKey: string;
  model: ModelId;
  fastModel?: string;          // ②판단·④검수용 경량 모델(throughput·비용). 비면 model로 폴백

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
  daumRestApiKey: string;
  daumQueries: string[];
  promptConfig: PromptConfig;
  referenceArticles: ReferenceArticle[];
  projectProfile: ProjectProfile;
  queryPresets: QueryPreset[];   // 검색어 프리셋 (전역 공유)
};
