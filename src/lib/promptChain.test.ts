import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateStory, buildInitialResult } from './promptChain';
import * as openai from './openai';
import type { Settings, Article, StoryOutput } from '../types';

const SETTINGS: Settings = {
  provider: 'openai',
  apiKey: 'sk-test',
  apiBaseUrl: 'https://api.openai.com/v1',
  rss2jsonApiKey: '',
  model: 'gpt-4o-mini',
  customStyleInstruction: '',
  rssSources: [],
  rssPollMinutes: 5,
  clusterThreshold: 0.35,
  simulatorEnabled: false,
  simulatorIntervalSec: 30,
  alertSoundEnabled: true,
  browserNotificationsEnabled: false,
};

const ARTICLE_A: Article = {
  id: 'a1', title: 'BLACKPINK 컴백 발표',
  description: 'BLACKPINK이 2026년 5월 25일 서울에서 컴백 발표.',
  link: 'https://e.com/1', pubDate: '', source: '연합', inputType: 'rss', fetchedAt: 100,
};
const ARTICLE_B: Article = {
  id: 'a2', title: 'BLACKPINK Drops Comeback Teaser',
  description: 'The group confirmed a Seoul comeback for May 25, 2026.',
  link: 'https://e.com/2', pubDate: '', source: 'Soompi', inputType: 'rss', fetchedAt: 200,
};

const PASS_OUTPUT: StoryOutput = {
  valueDecision: 'Pass',
  holdReason: '글로벌 팬덤 관심도가 높고 사실관계가 분명함.',
  storyDraft: [
    '# 1. BLACKPINK, 서울 컴백 공식화',
    '## 2. 스토리텔링형 본문\nBLACKPINK이 2026년 5월 25일 서울에서 컴백한다.',
    '## 3. 연관 키워드 및 태그\n#BLACKPINK #컴백',
    '## 4. 에디터 코멘트 패널\n매체 간 충돌 없음.',
    '## 5. AI 이미지 생성용 영문 프롬프트\nFour K-pop idols on a neon Seoul stage, cinematic lighting.',
  ].join('\n\n'),
};

beforeEach(() => vi.restoreAllMocks());

describe('generateStory', () => {
  it('returns the single 3-key story object from N sources', async () => {
    const spy = vi.spyOn(openai, 'chatJson').mockResolvedValueOnce(PASS_OUTPUT);

    const out = await generateStory([ARTICLE_A, ARTICLE_B], SETTINGS);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(out.valueDecision).toBe('Pass');
    expect(out.holdReason).toMatch(/팬덤/);
    expect(out.storyDraft).toContain('## 5. AI 이미지 생성용 영문 프롬프트');

    const call = spy.mock.calls[0][0] as { user: string; system: string };
    expect(call.user).toContain('연합');
    expect(call.user).toContain('Soompi');
    expect(call.system).toMatch(/Pass\/Fail/);
    expect(call.system).toMatch(/Midjourney/);
  });

  it('still returns a non-empty storyDraft even when value decision is Fail (advisor only)', async () => {
    vi.spyOn(openai, 'chatJson').mockResolvedValueOnce({
      valueDecision: 'Fail',
      holdReason: '단순 가십성 기사로 발행 기준 미달.',
      storyDraft: '# 1. 헤드라인\n\n## 2. 스토리텔링형 본문\n본문.',
    } satisfies StoryOutput);

    const out = await generateStory([ARTICLE_A], SETTINGS);
    expect(out.valueDecision).toBe('Fail');
    expect(out.storyDraft.trim().length).toBeGreaterThan(0);
  });

  it('throws on empty input', async () => {
    await expect(generateStory([], SETTINGS)).rejects.toThrow(/at least one/i);
  });
});

describe('buildInitialResult', () => {
  it('wraps a StoryOutput into a versioned ConvertedResult', () => {
    const r = buildInitialResult([ARTICLE_A, ARTICLE_B], PASS_OUTPUT, SETTINGS);
    expect(r.schemaVersion).toBe(2);
    expect(r.valueDecision).toBe('Pass');
    expect(r.holdReason).toBe(PASS_OUTPUT.holdReason);
    expect(r.storyDraft).toBe(PASS_OUTPUT.storyDraft);
    expect(r.sourceArticleIds).toEqual(['a1', 'a2']);
    expect(r.sourceTitle).toBe(ARTICLE_B.title); // newest by fetchedAt
    expect(r.model).toBe('gpt-4o-mini');
  });
});
