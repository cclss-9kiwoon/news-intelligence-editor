import type { Group, GroupProfile, Campaign, CampaignSettings, SourceConfig } from '../types';
import {
  DEFAULT_RSS_SOURCES,
  DEFAULT_PROMPT_CONFIG,
  DEFAULT_PROJECT_PROFILE,
} from './defaultSettings';
import { DEFAULT_CATEGORIES } from './defaultCategories';

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export const DEFAULT_SOURCE_CONFIG: SourceConfig = {
  apiEnabled: true,
  rssEnabled: true,
  rssSources: DEFAULT_RSS_SOURCES,
  searchProviders: [
    { provider: 'naver', enabled: true, query: '연예' },
    { provider: 'naver', enabled: true, query: 'K-pop 아이돌' },
    { provider: 'naver', enabled: true, query: '한국 드라마 영화' },
    { provider: 'daum', enabled: false, query: '연예' },
    { provider: 'daum', enabled: false, query: 'K-pop 아이돌' },
  ],
  naverQueries: ['연예', 'K-pop 아이돌', '한국 드라마 영화'],
  daumQueries: ['연예', 'K-pop 아이돌', '한국 드라마 영화'],
  allowedSources: [],
  bannedSources: [],
  articleWindow: '24h',
  clusterThreshold: 0.35,
  topicKeywords: [],
  excludeKeywords: [],
  minMediaCount: 1,   // 1=기사 1건이면 후보 생성(수집 잘 됨). 2+=교차검증(같은 사건 다매체 묶일 때만)
  entityAllowlist: [],
  excludeTopics: [],
  maxPerEntityPerDay: 0,
  maxPerHour: 3,
  ownSiteDedupe: false,
  imageSourcePolicy: '',
};

export const DEFAULT_GROUP_PROFILE: GroupProfile = {
  channelType: 'news_media',
  formalityLevel: 'standard',
  sourceStrictness: 'standard',
  language: 'ko',
  character: '',
  audience: '',
  toneBase: '',
};

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export function makeDefaultCampaignSettings(): CampaignSettings {
  return {
    searching: {
      ...DEFAULT_SOURCE_CONFIG,
      rssSources: DEFAULT_RSS_SOURCES.map(s => ({ ...s })),
      searchProviders: DEFAULT_SOURCE_CONFIG.searchProviders.map(p => ({ ...p })),
    },
    topicReview: {
      selectionCriteria: '최신성 우선, 인지도 높은 주제, 다양성 확보.',
      dedupeRules: '같은 내용 중복 금지. 이미 다룬 주제는 다른 관점일 때만 허용.',
      priority: '속보 > 발표 > 차트/마일스톤 > 일반.',
    },
    generation: {
      promptConfig: { ...DEFAULT_PROMPT_CONFIG },
      formatRules: clone(DEFAULT_PROJECT_PROFILE.formatRules),
      referenceArticles: [],
      styleGuide: DEFAULT_PROJECT_PROFILE.styleGuide,
      outputLanguage: DEFAULT_PROJECT_PROFILE.outputLanguage,
    },
    finalReview: {
      reviewRules: clone(DEFAULT_PROJECT_PROFILE.reviewRules),
      allowedMedia: [],
      bannedMedia: [],
    },
    categories: DEFAULT_CATEGORIES.map(c => ({ ...c })),
    activeCategoryId: DEFAULT_CATEGORIES[0]?.id ?? 'music',
  };
}

export function makeGroup(name: string, profile?: Partial<GroupProfile>): Group {
  return {
    id: newId('grp'),
    name: name || '새 그룹',
    profile: { ...DEFAULT_GROUP_PROFILE, ...(profile ?? {}) },
    createdAt: Date.now(),
  };
}

export function makeCampaign(groupId: string, name: string): Campaign {
  const now = Date.now();
  return {
    id: newId('cmp'),
    groupId,
    name: name || '새 캠페인',
    settings: makeDefaultCampaignSettings(),
    autoCollect: { enabled: true, intervalMin: 30 },
    createdAt: now,
    updatedAt: now,
  };
}

// ── 마이그레이션: 구버전 평면 CampaignSettings → 4단계 ──
// 구버전: { source, promptConfig, referenceArticles, projectProfile, categories, activeCategoryId }
export function migrateCampaignSettings(raw: any): CampaignSettings {
  if (!raw) return makeDefaultCampaignSettings();
  const def = makeDefaultCampaignSettings();
  // 이미 4단계 구조면 searching 신규 필드(searchProviders 등)만 기본값 보강
  if (raw.searching && raw.generation && raw.finalReview && raw.topicReview) {
    return {
      ...raw,
      searching: { ...def.searching, ...raw.searching },
    } as CampaignSettings;
  }
  const pp = raw.projectProfile ?? {};
  return {
    searching: { ...def.searching, ...(raw.source ?? {}) },
    topicReview: def.topicReview,
    generation: {
      promptConfig: raw.promptConfig ?? def.generation.promptConfig,
      formatRules: pp.formatRules ?? def.generation.formatRules,
      referenceArticles: raw.referenceArticles ?? [],
      styleGuide: pp.styleGuide ?? '',
      outputLanguage: pp.outputLanguage ?? 'ko',
    },
    finalReview: {
      reviewRules: pp.reviewRules ?? def.finalReview.reviewRules,
      allowedMedia: pp.allowedMedia ?? [],
      bannedMedia: pp.bannedMedia ?? [],
    },
    categories: raw.categories ?? def.categories,
    activeCategoryId: raw.activeCategoryId ?? def.activeCategoryId,
  };
}

// 구버전 group → profile 보강/마이그레이션
// 구 profile: {targetType, identity, audience, toneBase} → 신: {channelType, formalityLevel, character, ...}
export function migrateGroup(raw: any): Group {
  const p = raw.profile ?? {};
  const TARGET_MAP: Record<string, GroupProfile['channelType']> = {
    media: 'news_media', blog: 'creator_newsletter', medium: 'creator_newsletter', other: 'news_media',
  };
  const profile: GroupProfile = {
    channelType: p.channelType ?? TARGET_MAP[p.targetType] ?? 'news_media',
    formalityLevel: p.formalityLevel ?? 'standard',
    sourceStrictness: p.sourceStrictness ?? 'standard',
    language: p.language ?? 'ko',
    character: p.character ?? p.identity ?? '',
    audience: p.audience ?? '',
    toneBase: p.toneBase ?? '',
  };
  return {
    id: raw.id,
    name: raw.name ?? '새 그룹',
    profile,
    createdAt: raw.createdAt ?? Date.now(),
  };
}
