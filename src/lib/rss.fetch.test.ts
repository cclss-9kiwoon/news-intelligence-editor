import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchRss } from './rss';
import type { RssSource } from '../types';

const fakeResponse = {
  status: 'ok',
  feed: { title: 'Test Feed' },
  items: [
    {
      title: '[속보] 테스트 기사',
      link: 'https://example.com/article/1?utm_source=rss',
      description: '<p>요약 본문</p>',
      pubDate: 'Sun, 24 May 2026 12:00:00 GMT',
      thumbnail: 'https://example.com/thumb.jpg',
      categories: ['연예'],
    },
  ],
};

describe('rss.fetchRss', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls rss2json with the encoded RSS URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => fakeResponse,
    });
    vi.stubGlobal('fetch', fetchMock);

    const source: RssSource = { id: 's1', name: '연합', url: 'https://www.yna.co.kr/rss/news.xml', enabled: true };
    await fetchRss(source);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain('api.rss2json.com');
    expect(calledUrl).toContain(encodeURIComponent(source.url));
  });

  it('returns mapped Article objects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => fakeResponse,
    }));
    const source: RssSource = { id: 's1', name: '연합', url: 'https://x', enabled: true };
    const arts = await fetchRss(source);
    expect(arts).toHaveLength(1);
    expect(arts[0].title).toBe('[속보] 테스트 기사');
    expect(arts[0].source).toBe('연합');
    expect(arts[0].description).toBe('요약 본문');
    expect(arts[0].thumbnail).toBe('https://example.com/thumb.jpg');
    expect(arts[0].inputType).toBe('rss');
  });

  it('returns empty array on HTTP failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429 }));
    const source: RssSource = { id: 's1', name: 'x', url: 'https://x', enabled: true };
    const arts = await fetchRss(source);
    expect(arts).toEqual([]);
  });

  it('returns empty array on rss2json status != ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'error', message: 'bad feed' }),
    }));
    const source: RssSource = { id: 's1', name: 'x', url: 'https://x', enabled: true };
    expect(await fetchRss(source)).toEqual([]);
  });
});
