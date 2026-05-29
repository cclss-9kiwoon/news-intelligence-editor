import type { Settings, RssSource, PromptConfig } from '../types';
import { DEFAULT_PROVIDER, PROVIDERS } from '../types';
import { DEFAULT_CATEGORIES } from './defaultCategories';

export const DEFAULT_RSS_SOURCES: RssSource[] = [
  { id: 'yna-news', name: '연합뉴스 속보', url: 'https://www.yna.co.kr/rss/news.xml', enabled: true },
  { id: 'yna-ent', name: '연합뉴스 연예', url: 'https://www.yna.co.kr/rss/entertainment.xml', enabled: true },
  { id: 'soompi', name: 'Soompi', url: 'https://www.soompi.com/feed', enabled: true },
  { id: 'allkpop', name: 'Allkpop', url: 'https://www.allkpop.com/feed', enabled: false },
  { id: 'chosun-ent', name: '조선일보 연예', url: 'https://www.chosun.com/arc/outboundfeeds/rss/category/entertainments/?outputType=xml', enabled: false },
  { id: 'hani-culture', name: '한겨레 문화', url: 'https://www.hani.co.kr/rss/culture/', enabled: false },
  { id: 'sportsseoul', name: '스포츠서울', url: 'https://www.sportsseoul.com/rss/news.xml', enabled: false },
];

export const DEFAULT_PROMPT_CONFIG: PromptConfig = {
  editorRole: '한국 연예 매체의 시니어 에디터',

  publishingGuide: `- 경어체(~했다, ~밝혔다) 사용
- 리드문(2문장 이내) → 핵심 내용 → 부가 정보 → 마무리 구조
- 800~1200자 내외
- 미확인 정보는 "~로 알려졌다", "~는 확인되지 않았다"로 표기
- 소속사 공식 입장은 "소속사는 ~라고 밝혔다" 형식
- 자극적 수식어 지양, 팩트 중심 서술`,

  taskInstructions: `1. 모든 매체가 공통으로 다루는 핵심 팩트를 본문의 중심으로 삼는다.
2. 특정 매체만 다룬 추가 정보(배경, 수치, 후속 전망 등)가 있으면:
   - 다른 매체의 내용과 모순되지 않는지 교차검증한다.
   - 모순 없으면 본문에 자연스럽게 병합한다.
   - 모순 있거나 단독 보도라 검증 불가하면 summary에 "[매체명] 단독: ..."으로 명시한다.
3. 카테고리 기준(criteria)에 따라 중요도를 판단하되, 톤은 발행 가이드를 따른다.
4. 발행 가이드가 있으면 그 문체·구조·분량을 우선 적용한다.`,

  bannedExpressions: 'delve, in conclusion, furthermore, testament, moreover, "it is important to note", "not only ... but also", "as an AI", "I think/believe/feel"',
};

export const DEFAULT_SETTINGS: Settings = {
  provider: DEFAULT_PROVIDER,
  apiKey: '',
  apiBaseUrl: PROVIDERS[DEFAULT_PROVIDER].baseUrl,
  rss2jsonApiKey: '',
  model: 'gpt-4o-mini',
  categories: DEFAULT_CATEGORIES,
  activeCategoryId: 'music',
  articleWindow: '24h',
  rssSources: DEFAULT_RSS_SOURCES,
  rssPollMinutes: 5,
  clusterThreshold: 0.35,
  simulatorEnabled: true,
  simulatorIntervalSec: 30,
  alertSoundEnabled: true,
  browserNotificationsEnabled: false,
  naverClientId: '',
  naverClientSecret: '',
  naverQueries: ['연예', 'K-pop 아이돌', '한국 드라마 영화'],
  promptConfig: DEFAULT_PROMPT_CONFIG,
  referenceArticles: [],
};
