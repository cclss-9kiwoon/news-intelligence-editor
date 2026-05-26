import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runChain, formatChannels } from './promptChain';
import * as openai from './openai';
import type { Settings, Article } from '../types';

const SETTINGS: Settings = {
  apiKey: 'sk-test',
  model: 'gpt-4o-mini',
  stylePreset: 'kpop',
  customStyleInstruction: '',
  rssSources: [],
  simulatorEnabled: false,
  simulatorIntervalSec: 30,
  alertSoundEnabled: true,
  browserNotificationsEnabled: false,
};

const ARTICLE_A: Article = {
  id: 'a1',
  title: 'BLACKPINK 컴백 발표',
  description: 'BLACKPINK이 2026년 5월 25일 서울에서 컴백 발표.',
  link: 'https://e.com/1',
  pubDate: '',
  source: '연합',
  inputType: 'rss',
  fetchedAt: 100,
};
const ARTICLE_B: Article = {
  id: 'a2',
  title: 'BLACKPINK Drops Comeback Teaser',
  description: 'The group confirmed a Seoul comeback for May 25, 2026.',
  link: 'https://e.com/2',
  pubDate: '',
  source: 'Soompi',
  inputType: 'rss',
  fetchedAt: 200,
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('promptChain.runChain (multi-source)', () => {
  it('makes exactly 2 OpenAI calls and aggregates 2+ sources', async () => {
    const spy = vi.spyOn(openai, 'chatJson')
      .mockResolvedValueOnce({
        valueScore: 8,
        valueReason: 'high interest',
        facts: { people: ['BLACKPINK'], numbers: ['2026'], places: ['Seoul'], dates: ['May 25, 2026'] },
        englishDraft: 'BLACKPINK announced their comeback in Seoul on May 25, 2026.',
      })
      .mockResolvedValueOnce({
        site: 'BLACKPINK comeback story in Seoul on May 25, 2026.',
        x: '1/ BLACKPINK is back 🔥\n2/ Comeback set for May 25, 2026 in Seoul.',
        medium: '# BLACKPINK Returns\n\n*A new chapter*\n\n## Intro\nBLACKPINK announced their comeback in Seoul on May 25, 2026.',
      });

    const result = await runChain([ARTICLE_A, ARTICLE_B], SETTINGS);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(result.channels.site).toContain('Seoul');
    expect(result.sourceArticleIds).toEqual(['a1', 'a2']);
    expect(result.factReport.ok).toBe(true);

    const call1Args = spy.mock.calls[0][0] as { user: string };
    expect(call1Args.user).toContain('연합');
    expect(call1Args.user).toContain('Soompi');
  });

  it('retries Call 1 once if banned word is in englishDraft', async () => {
    const spy = vi.spyOn(openai, 'chatJson')
      .mockResolvedValueOnce({
        valueScore: 7,
        valueReason: 'ok',
        facts: { people: [], numbers: [], places: [], dates: [] },
        englishDraft: 'In conclusion, fans rejoiced.',
      })
      .mockResolvedValueOnce({
        valueScore: 7,
        valueReason: 'ok',
        facts: { people: [], numbers: [], places: [], dates: [] },
        englishDraft: 'Fans rejoiced after the announcement.',
      })
      .mockResolvedValueOnce({
        site: 'Fans rejoiced after the announcement.',
        x: '1/ Fans rejoiced.',
        medium: '# Title\n## Intro\nFans rejoiced.',
      });

    const result = await runChain([ARTICLE_A], SETTINGS);
    expect(spy).toHaveBeenCalledTimes(3);
    expect(result.englishDraft.toLowerCase()).not.toContain('in conclusion');
  });

  it('flags banned hits in channel outputs when Call 2 produces them', async () => {
    vi.spyOn(openai, 'chatJson')
      .mockResolvedValueOnce({
        valueScore: 5,
        valueReason: 'meh',
        facts: { people: [], numbers: [], places: [], dates: [] },
        englishDraft: 'A clean draft about the comeback.',
      })
      .mockResolvedValueOnce({
        site: 'Furthermore, the band returns.',
        x: '1/ A clean tweet.',
        medium: '# Title\n## Intro\nA clean section.',
      });

    const result = await runChain([ARTICLE_A], SETTINGS);
    expect(result.bannedHits.site.length).toBeGreaterThan(0);
    expect(result.bannedHits.x).toEqual([]);
  });

  it('reports fact mismatch when output omits a required number', async () => {
    vi.spyOn(openai, 'chatJson')
      .mockResolvedValueOnce({
        valueScore: 9,
        valueReason: 'huge',
        facts: { people: [], numbers: ['10 million'], places: [], dates: [] },
        englishDraft: 'They sold 10 million copies.',
      })
      .mockResolvedValueOnce({
        site: 'They sold some copies.',
        x: '1/ A success.',
        medium: '# Title\n## Intro\nA success.',
      });

    const result = await runChain([ARTICLE_A], SETTINGS);
    expect(result.factReport.ok).toBe(false);
    expect(result.factReport.missing.some(m => m.value === '10 million')).toBe(true);
  });

  it('throws when articles array is empty', async () => {
    await expect(runChain([], SETTINGS)).rejects.toThrow(/at least one/i);
  });
});

describe('promptChain.formatChannels (edited draft re-run)', () => {
  it('makes a single Call 2 against an edited draft', async () => {
    const spy = vi.spyOn(openai, 'chatJson').mockResolvedValueOnce({
      site: 'Edited site copy.',
      x: '1/ edited tweet.',
      medium: '# Edited\n## Intro\nbody.',
    });

    const facts = { people: ['BLACKPINK'], numbers: [], places: [], dates: [] };
    const out = await formatChannels({
      editedDraft: 'Edited English body the user changed.',
      facts,
      settings: SETTINGS,
    });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(out.channels.site).toBe('Edited site copy.');
    expect(out.factReport).toBeDefined();
  });
});
