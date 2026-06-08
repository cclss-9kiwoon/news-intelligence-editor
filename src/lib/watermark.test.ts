import { describe, it, expect } from 'vitest';
import { isWatermarkedImage, filterPublishableImages } from './watermark';

describe('watermark — 로고 매체 이미지 거름', () => {
  it('로고 매체 source/URL은 워터마크로 판정', () => {
    expect(isWatermarkedImage({ source: '스타뉴스' })).toBe(true);
    expect(isWatermarkedImage({ source: 'OSEN' })).toBe(true);
    expect(isWatermarkedImage({ url: 'https://dispatch.co.kr/photo/1.jpg' })).toBe(true);
    expect(isWatermarkedImage({ url: 'https://img.imbc.com/x.jpg' })).toBe(true);
  });

  it('무워터마크/공식 출처는 통과', () => {
    expect(isWatermarkedImage({ source: 'SM엔터테인먼트', url: 'https://pstatic.net/a.jpg' })).toBe(false);
    expect(isWatermarkedImage({ url: 'https://example.com/poster.jpg' })).toBe(false);
    expect(isWatermarkedImage({})).toBe(false); // 판정 불가 → 통과(과차단 방지)
  });

  it('filterPublishableImages는 워터마크 의심만 제거', () => {
    const imgs = [
      { url: 'https://pstatic.net/ok.jpg', source: '연합뉴스' },
      { url: 'https://dispatch.co.kr/wm.jpg', source: '디스패치' },
      { url: 'https://example.com/poster.jpg' },
    ];
    const out = filterPublishableImages(imgs);
    expect(out).toHaveLength(2);
    expect(out.some(i => i.url.includes('dispatch'))).toBe(false);
  });
});
