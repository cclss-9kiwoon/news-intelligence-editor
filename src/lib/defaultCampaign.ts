import type { Group, Campaign, CampaignSettings, SourceConfig } from '../types';
import {
  DEFAULT_RSS_SOURCES,
  DEFAULT_PROMPT_CONFIG,
  DEFAULT_PROJECT_PROFILE,
} from './defaultSettings';
import { DEFAULT_CATEGORIES } from './defaultCategories';

let idCounter = 0;
function newId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`;
}

export const DEFAULT_SOURCE_CONFIG: SourceConfig = {
  rssSources: DEFAULT_RSS_SOURCES,
  naverQueries: ['연예', 'K-pop 아이돌', '한국 드라마 영화'],
  articleWindow: '24h',
  clusterThreshold: 0.35,
  topicKeywords: [],
  excludeKeywords: [],
  minMediaCount: 2,
};

export function makeDefaultCampaignSettings(): CampaignSettings {
  return {
    source: { ...DEFAULT_SOURCE_CONFIG, rssSources: DEFAULT_RSS_SOURCES.map(s => ({ ...s })) },
    promptConfig: { ...DEFAULT_PROMPT_CONFIG },
    referenceArticles: [],
    projectProfile: JSON.parse(JSON.stringify(DEFAULT_PROJECT_PROFILE)),
    categories: DEFAULT_CATEGORIES.map(c => ({ ...c })),
    activeCategoryId: DEFAULT_CATEGORIES[0]?.id ?? 'music',
  };
}

export function makeGroup(name: string): Group {
  return {
    id: newId('grp'),
    name: name || '새 그룹',
    channels: [],
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
    createdAt: now,
    updatedAt: now,
  };
}

/** 최초 실행 시 기본 그룹 1개 + 캠페인 1개 시드 */
export function makeSeedData(): { groups: Group[]; campaigns: Campaign[] } {
  const group = makeGroup('allkpop');
  const campaign = makeCampaign(group.id, 'K-pop 컴백 속보');
  return { groups: [group], campaigns: [campaign] };
}
