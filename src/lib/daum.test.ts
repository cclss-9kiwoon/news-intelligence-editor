import { describe, it, expect } from 'vitest';
import { isNewsUrl, NEWS_DOMAINS } from './daum';

describe('isNewsUrl — 다음 뉴스 도메인 화이트리스트', () => {
  it('주요 뉴스 매체 도메인은 통과', () => {
    expect(isNewsUrl('https://www.yna.co.kr/view/AKR123')).toBe(true);
    expect(isNewsUrl('https://entertain.daum.net/v/2026')).toBe(true);
    expect(isNewsUrl('https://n.news.naver.com/article/001')).toBe(true);
    expect(isNewsUrl('https://www.osen.mt.co.kr/article/G1')).toBe(true);
    expect(isNewsUrl('https://sports.chosun.com/news')).toBe(true);
    expect(isNewsUrl('https://mydaily.co.kr/page/view/x')).toBe(true);
  });

  it('서브도메인도 endsWith로 통과', () => {
    expect(isNewsUrl('https://news.daum.net/foo')).toBe(true);
    expect(isNewsUrl('https://sports.donga.com/article')).toBe(true);
  });

  it('커뮤니티/블로그/티스토리는 제외 (키워드 매칭과 무관)', () => {
    expect(isNewsUrl('https://www.instiz.net/pt/1234')).toBe(false);
    expect(isNewsUrl('https://theqoo.net/square/9999')).toBe(false);
    expect(isNewsUrl('https://gall.dcinside.com/board/lists')).toBe(false);
    expect(isNewsUrl('https://pann.nate.com/talk/1')).toBe(false);
    expect(isNewsUrl('https://www.fmkorea.com/best/2')).toBe(false);
    expect(isNewsUrl('https://someblog.tistory.com/3')).toBe(false);
    expect(isNewsUrl('https://blog.naver.com/abc/1')).toBe(false);
  });

  it('allowlist 미포함 임의 도메인은 제외', () => {
    expect(isNewsUrl('https://example.com/news')).toBe(false);
    expect(isNewsUrl('https://random-site.xyz/article')).toBe(false);
  });

  it('잘못된 URL은 안전하게 false', () => {
    expect(isNewsUrl('not-a-url')).toBe(false);
    expect(isNewsUrl('')).toBe(false);
  });

  it('NEWS_DOMAINS 상수는 비어있지 않음(가드 무력화 방지)', () => {
    expect(NEWS_DOMAINS.length).toBeGreaterThan(10);
  });
});
