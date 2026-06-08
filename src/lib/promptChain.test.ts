import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateStory, sanitizeBody, buildInitialResult } from './promptChain';
import * as openai from './openai';
import type { Settings, Article, Category, StoryOutput } from '../types';
import { DEFAULT_CATEGORIES } from './defaultCategories';
import { DEFAULT_PROMPT_CONFIG, DEFAULT_PROJECT_PROFILE } from './defaultSettings';

const CATEGORY: Category = DEFAULT_CATEGORIES.find(c => c.id === 'screen')!;

const SETTINGS: Settings = {
  provider: 'openai',
  apiKey: 'sk-test',
  apiBaseUrl: 'https://api.openai.com/v1',
  rss2jsonApiKey: '',
  model: 'gpt-4o-mini',
  categories: DEFAULT_CATEGORIES,
  activeCategoryId: 'screen',
  articleWindow: '24h',
  rssSources: [],
  rssPollMinutes: 5,
  clusterThreshold: 0.35,
  simulatorEnabled: false,
  simulatorIntervalSec: 30,
  alertSoundEnabled: true,
  browserNotificationsEnabled: false,
  naverClientId: '',
  naverClientSecret: '',
  naverQueries: ['연예'],
  daumRestApiKey: '',
  daumQueries: ['연예'],
  promptConfig: DEFAULT_PROMPT_CONFIG,
  referenceArticles: [],
  projectProfile: DEFAULT_PROJECT_PROFILE,
  queryPresets: [],
};

const ARTICLE_A: Article = {
  id: 'a1', title: "A방송 '예시작품' 출연진 공개",
  description: "A방송 새 드라마 '예시작품'가 출연진과 줄거리를 공개했다.",
  link: 'https://e.com/1', pubDate: '', source: '연합', inputType: 'rss', fetchedAt: 100,
};
const ARTICLE_B: Article = {
  id: 'a2', title: "'예시작품' 티저 공개",
  description: '영혼 교체 설정의 예고편이 공개됐다.',
  link: 'https://e.com/2', pubDate: '', source: 'Soompi', inputType: 'rss', fetchedAt: 200,
};

const STORY: StoryOutput = {
  summary: "A방송 새 드라마 '예시작품'가 줄거리와 출연진을 공개했습니다.",
  headline: "A방송 '예시작품', 영혼 교체 줄거리 공개",
  body: '드라마가 첫 방송을 앞두고 주요 줄거리를 공개했다. 출연진은 호흡을 자랑했다.',
  tags: ['예시작품', 'A방송'],
  imagePrompt: 'A dramatic K-drama scene, soul swap, cinematic lighting.',
};

beforeEach(() => vi.restoreAllMocks());

describe('sanitizeBody', () => {
  it('strips internal section-label lines but keeps prose', () => {
    const dirty = '# 1. 헤드라인\n## 2. 스토리텔링형 본문\n진짜 본문 한 줄.\n## 3. 태그\n#a #b';
    const clean = sanitizeBody(dirty);
    expect(clean).toBe('진짜 본문 한 줄.\n#a #b');
    expect(clean).not.toContain('## 2.');
    expect(clean).not.toContain('# 1.');
  });

  it('빈 <p> 단락 제거', () => {
    expect(sanitizeBody('<p>내용</p><p></p><p>  </p><p>&nbsp;</p>')).toBe('<p>내용</p>');
  });

  it('src 없는/빈 <img> 제거, 실제 src는 유지', () => {
    expect(sanitizeBody('<img alt="x"><img src=""><p>본문</p><img src="https://a/i.jpg" alt="t">'))
      .toBe('<p>본문</p><img src="https://a/i.jpg" alt="t">');
  });
});

describe('generateStory', () => {
  it('returns the 5-key story object and injects category criteria+tone', async () => {
    const spy = vi.spyOn(openai, 'chatJson').mockResolvedValueOnce(STORY);

    const out = await generateStory([ARTICLE_A, ARTICLE_B], SETTINGS, CATEGORY);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(out.headline).toContain('예시작품');
    expect(out.tags).toEqual(['예시작품', 'A방송']);

    const call = spy.mock.calls[0][0] as { user: string; system: string };
    expect(call.user).toContain('연합');
    expect(call.user).toContain('Soompi');
    expect(call.system).toContain(CATEGORY.criteria);
    expect(call.system).toContain(CATEGORY.tone);
    expect(call.system).toContain('발행 여부를 판단하지');
  });

  it('sanitizes leftover section labels in body and coerces tags to array', async () => {
    vi.spyOn(openai, 'chatJson').mockResolvedValueOnce({
      ...STORY,
      body: '## 2. 스토리텔링형 본문\n깨끗해야 하는 본문.',
      tags: undefined as unknown as string[],
    });
    const out = await generateStory([ARTICLE_A], SETTINGS, CATEGORY);
    expect(out.body).toBe('깨끗해야 하는 본문.');
    expect(out.tags).toEqual([]);
  });

  it('전 source 요약뿐이면 summaryBased=true + 보수적 지침 주입', async () => {
    const spy = vi.spyOn(openai, 'chatJson').mockResolvedValueOnce(STORY);
    const out = await generateStory([ARTICLE_A, ARTICLE_B], SETTINGS, CATEGORY); // fullText 없음
    expect(out.summaryBased).toBe(true);
    const call = spy.mock.calls[0][0] as { system: string };
    expect(call.system).toMatch(/요약\/발췌|부분 정보/);
  });

  it('풀텍스트 있으면 summaryBased=false + 보수적 지침 없음', async () => {
    const spy = vi.spyOn(openai, 'chatJson').mockResolvedValueOnce(STORY);
    const withFull: Article = { ...ARTICLE_A, fullText: 'A방송 드라마 전문 본문 내용 충분히 길다.'.repeat(5) };
    const out = await generateStory([withFull], SETTINGS, CATEGORY);
    expect(out.summaryBased).toBe(false);
    const call = spy.mock.calls[0][0] as { system: string };
    expect(call.system).not.toMatch(/요약\/발췌/);
  });

  it('throws on empty input', async () => {
    await expect(generateStory([], SETTINGS, CATEGORY)).rejects.toThrow(/at least one/i);
  });
});

describe('buildInitialResult', () => {
  it('wraps a StoryOutput into a versioned ConvertedResult with categoryId', () => {
    const r = buildInitialResult([ARTICLE_A, ARTICLE_B], STORY, SETTINGS, CATEGORY);
    expect(r.schemaVersion).toBe(3);
    expect(r.categoryId).toBe('screen');
    expect(r.summary).toBe(STORY.summary);
    expect(r.headline).toBe(STORY.headline);
    expect(r.body).toBe(STORY.body);
    expect(r.tags).toEqual(STORY.tags);
    expect(r.imagePrompt).toBe(STORY.imagePrompt);
    expect(r.sourceArticleIds).toEqual(['a1', 'a2']);
    expect(r.sourceTitle).toBe(ARTICLE_B.title);
    expect(r.model).toBe('gpt-4o-mini');
  });
});
