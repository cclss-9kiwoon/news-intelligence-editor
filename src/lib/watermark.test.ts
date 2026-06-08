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

  it('akp-RW 추가 블랙 도메인 차단(starnewskorea/mt.co.kr/allkpop)', () => {
    expect(isWatermarkedImage({ url: 'https://image.starnewskorea.com/2024/x.jpg' })).toBe(true);
    expect(isWatermarkedImage({ url: 'https://photo.mt.co.kr/y.jpg' })).toBe(true);
    expect(isWatermarkedImage({ url: 'https://cdn.allkpop.com/rehost.jpg' })).toBe(true);
  });

  it('화이트 도메인은 블랙 패턴 우연 일치해도 통과(공식 보도사진/소속사)', () => {
    expect(isWatermarkedImage({ url: 'https://images.khan.co.kr/official.jpg' })).toBe(false);
    expect(isWatermarkedImage({ url: 'https://weverse.io/poster.jpg' })).toBe(false);
    expect(isWatermarkedImage({ url: 'https://ygfamily.com/artist.jpg' })).toBe(false);
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
