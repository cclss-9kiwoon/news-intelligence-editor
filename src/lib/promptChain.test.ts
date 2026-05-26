import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeKorean, translateDraft, formatChannels, buildInitialResult } from './promptChain';
import * as openai from './openai';
import type { Settings, Article } from '../types';

const SETTINGS: Settings = {
  apiKey: 'sk-test',
  rss2jsonApiKey: '',
  model: 'gpt-4o-mini',
  stylePreset: 'kpop',
  customStyleInstruction: '',
  rssSources: [],
  rssPollMinutes: 5,
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

beforeEach(() => vi.restoreAllMocks());

describe('analyzeKorean', () => {
  it('produces a Korean draft + facts + valueScore from N sources', async () => {
    const spy = vi.spyOn(openai, 'chatJson').mockResolvedValueOnce({
      valueScore: 8, valueReason: '글로벌 팬덤 관심',
      facts: { people: ['BLACKPINK'], numbers: [], places: ['서울'], dates: ['2026년 5월 25일'] },
      koreanDraft: 'BLACKPINK이 2026년 5월 25일 서울에서 컴백을 발표했다. ...',
    });

    const out = await analyzeKorean([ARTICLE_A, ARTICLE_B], SETTINGS);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(out.koreanDraft).toContain('BLACKPINK');
    expect(out.facts.places).toContain('서울');

    const call = spy.mock.calls[0][0] as { user: string; system: string };
    expect(call.user).toContain('연합');
    expect(call.user).toContain('Soompi');
    expect(call.system).toMatch(/한국어/);
  });

  it('throws on empty input', async () => {
    await expect(analyzeKorean([], SETTINGS)).rejects.toThrow(/at least one/i);
  });
});

describe('translateDraft', () => {
  it('translates ko→en via single LLM call', async () => {
    const spy = vi.spyOn(openai, 'chatJson').mockResolvedValueOnce({
      translated: 'BLACKPINK announced their comeback in Seoul on May 25, 2026.',
    });
    const out = await translateDraft({
      text: 'BLACKPINK이 서울에서 컴백을 발표했다.',
      from: 'ko', to: 'en', settings: SETTINGS,
    });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(out).toContain('Seoul');
  });

  it('returns text unchanged when from === to', async () => {
    const spy = vi.spyOn(openai, 'chatJson');
    const out = await translateDraft({ text: 'hi', from: 'en', to: 'en', settings: SETTINGS });
    expect(out).toBe('hi');
    expect(spy).not.toHaveBeenCalled();
  });

  it('translates en→ko', async () => {
    vi.spyOn(openai, 'chatJson').mockResolvedValueOnce({ translated: '안녕' });
    const out = await translateDraft({ text: 'hello', from: 'en', to: 'ko', settings: SETTINGS });
    expect(out).toBe('안녕');
  });
});

describe('formatChannels', () => {
  it('generates 3 channels from an English draft and flags banned words', async () => {
    vi.spyOn(openai, 'chatJson').mockResolvedValueOnce({
      site: 'Furthermore, the band returns.',
      x: '1/ A clean tweet.',
      medium: '# Title\n## Intro\nA clean section.',
    });
    const out = await formatChannels({
      englishDraft: 'A clean draft about the comeback.',
      facts: { people: [], numbers: [], places: [], dates: [] },
      settings: SETTINGS,
    });
    expect(out.channels.site).toContain('Furthermore');
    expect(out.bannedHits.site.length).toBeGreaterThan(0);
    expect(out.bannedHits.x).toEqual([]);
  });

  it('reports fact mismatch when output omits a required number', async () => {
    vi.spyOn(openai, 'chatJson').mockResolvedValueOnce({
      site: 'They sold some copies.',
      x: '1/ A success.',
      medium: '# Title\n## Intro\nA success.',
    });
    const out = await formatChannels({
      englishDraft: 'They sold 10 million copies.',
      facts: { people: [], numbers: ['10 million'], places: [], dates: [] },
      settings: SETTINGS,
    });
    expect(out.factReport.ok).toBe(false);
  });
});

describe('buildInitialResult', () => {
  it('initializes ko draft, empty en, empty channels', () => {
    const r = buildInitialResult([ARTICLE_A, ARTICLE_B], {
      valueScore: 7, valueReason: 'ok',
      facts: { people: [], numbers: [], places: [], dates: [] },
      koreanDraft: '본문',
    }, SETTINGS);
    expect(r.drafts.ko).toBe('본문');
    expect(r.drafts.en).toBe('');
    expect(r.activeLanguage).toBe('ko');
    expect(r.channelsGenerated).toBe(false);
    expect(r.sourceArticleIds).toEqual(['a1', 'a2']);
  });
});
