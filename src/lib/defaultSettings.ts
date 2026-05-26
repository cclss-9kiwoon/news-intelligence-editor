import type { Settings, RssSource } from '../types';
import { DEFAULT_PROVIDER, PROVIDERS } from '../types';

export const DEFAULT_RSS_SOURCES: RssSource[] = [
  { id: 'yna-news', name: '연합뉴스 속보', url: 'https://www.yna.co.kr/rss/news.xml', enabled: true },
  { id: 'yna-ent', name: '연합뉴스 연예', url: 'https://www.yna.co.kr/rss/entertainment.xml', enabled: true },
  { id: 'soompi', name: 'Soompi', url: 'https://www.soompi.com/feed', enabled: true },
  { id: 'allkpop', name: 'Allkpop', url: 'https://www.allkpop.com/feed', enabled: false },
  { id: 'chosun-ent', name: '조선일보 연예', url: 'https://www.chosun.com/arc/outboundfeeds/rss/category/entertainments/?outputType=xml', enabled: false },
  { id: 'hani-culture', name: '한겨레 문화', url: 'https://www.hani.co.kr/rss/culture/', enabled: false },
  { id: 'sportsseoul', name: '스포츠서울', url: 'https://www.sportsseoul.com/rss/news.xml', enabled: false },
];

export const DEFAULT_SETTINGS: Settings = {
  provider: DEFAULT_PROVIDER,
  apiKey: '',
  apiBaseUrl: PROVIDERS[DEFAULT_PROVIDER].baseUrl,
  rss2jsonApiKey: '',
  model: 'gpt-4o-mini',
  stylePreset: 'kpop',
  customStyleInstruction: '',
  rssSources: DEFAULT_RSS_SOURCES,
  rssPollMinutes: 5,
  clusterThreshold: 0.35,
  simulatorEnabled: true,
  simulatorIntervalSec: 30,
  alertSoundEnabled: true,
  browserNotificationsEnabled: false,
};
