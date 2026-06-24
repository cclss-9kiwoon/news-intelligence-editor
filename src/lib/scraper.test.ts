import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  extractArticleText, getJinaBlockedDomainCount, _resetJinaBlocked,
  mediaPriorityRank, orderByMediaPriority, setMediaPriorityLists, _resetMediaPriorityLists,
} from './scraper';

// 비한국 도메인(.net)으로 Jina-first 경로 강제. Jina=/api/extract, proxy=/api/naver-article.
const URL_A = 'https://topstarnews.net/news/123';
const URL_B = 'https://topstarnews.net/news/456';

function mockFetch(handler: (url: string) => Response) {
  vi.stubGlobal('fetch', vi.fn(async (input: string) => handler(String(input))));
}

const okJina = () => ({
  ok: true,
  json: async () => ({ code: 200, data: { title: 't', content: 'x'.repeat(300) } }),
}) as unknown as Response;

const status = (s: number) => ({ ok: false, status: s, text: async () => '', json: async () => ({}) }) as unknown as Response;

beforeEach(() => {
  vi.restoreAllMocks();
  _resetJinaBlocked();
  _resetMediaPriorityLists();
});

describe('scraper 매체 추출 우선순위', () => {
  it('화이트=0, 후순위=2, 일반=1', () => {
    expect(mediaPriorityRank('https://www.yna.co.kr/view/1')).toBe(0);
    expect(mediaPriorityRank('https://imgnews.pstatic.net/x.jpg')).toBe(0);
    expect(mediaPriorityRank('https://topstarnews.net/news/1')).toBe(2);
    expect(mediaPriorityRank('https://gukjenews.com/news/2')).toBe(2);
    expect(mediaPriorityRank('https://some-random-media.co.kr/a')).toBe(1);
  });

  it('orderByMediaPriority: 화이트 먼저, 후순위 나중, 동순위는 원순서 보존', () => {
    const items = [
      { link: 'https://topstarnews.net/1' }, // 2
      { link: 'https://mid-a.com/2' },        // 1
      { link: 'https://yna.co.kr/3' },        // 0
      { link: 'https://mid-b.com/4' },        // 1
    ];
    expect(orderByMediaPriority(items).map(x => x.link)).toEqual([
      'https://yna.co.kr/3',
      'https://mid-a.com/2',
      'https://mid-b.com/4',
      'https://topstarnews.net/1',
    ]);
  });

  it('setMediaPriorityLists로 akp-RW 리스트 주입 가능', () => {
    setMediaPriorityLists({ whitelist: ['example.com'], deprioritize: ['spam.net'] });
    expect(mediaPriorityRank('https://example.com/a')).toBe(0);
    expect(mediaPriorityRank('https://spam.net/b')).toBe(2);
    expect(mediaPriorityRank('https://yna.co.kr/c')).toBe(1); // 기존 시드 교체됨
  });
});

describe('scraper Jina 451 hard-block', () => {
  it('Jina 451 → 도메인 기록, 이후 호출은 Jina 건너뛰고 프록시 우선', async () => {
    let jinaCalls = 0;
    let proxyCalls = 0;
    mockFetch((url) => {
      if (url.includes('/api/extract')) { jinaCalls++; return status(451); }
      // proxy
      proxyCalls++;
      return { ok: true, text: async () => '<html><body><article>' + 'y'.repeat(300) + '</article></body></html>' } as unknown as Response;
    });

    // 1차: Jina 451 → 프록시 폴백 성공
    const r1 = await extractArticleText(URL_A);
    expect(r1.ok).toBe(true);
    expect(jinaCalls).toBe(1);
    expect(getJinaBlockedDomainCount()).toBe(1);

    // 2차(동일 도메인): Jina 건너뜀 → jinaCalls 안 늘고 프록시만
    const r2 = await extractArticleText(URL_B);
    expect(r2.ok).toBe(true);
    expect(jinaCalls).toBe(1);   // 늘지 않음 (Jina skip)
    expect(proxyCalls).toBe(2);
  });

  it('Jina 200(정상)이면 도메인 차단 안 함', async () => {
    mockFetch((url) => (url.includes('/api/extract') ? okJina() : status(500)));
    const r = await extractArticleText(URL_A);
    expect(r.ok).toBe(true);
    expect(getJinaBlockedDomainCount()).toBe(0);
  });
});
