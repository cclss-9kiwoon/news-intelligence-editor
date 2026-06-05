import { describe, it, expect } from 'vitest';
import { isUsableImage, countUsableImages, assessProducibility } from './producibility';

describe('isUsableImage', () => {
  it('일반 이미지 = 사용가능', () => {
    expect(isUsableImage({ url: 'https://img.yna.co.kr/photo/abc.jpg' })).toBe(true);
  });
  it('워터마크 의심 URL = 불가', () => {
    expect(isUsableImage({ url: 'https://x/dispatch_photo.jpg' })).toBe(false);
    expect(isUsableImage({ url: 'https://x/sample_wm.png' })).toBe(false);
  });
  it('규격 미달(w/h) = 불가', () => {
    expect(isUsableImage({ url: 'https://x/a.jpg', w: 100, h: 100 })).toBe(false);
    expect(isUsableImage({ url: 'https://x/a.jpg', w: 800, h: 600 })).toBe(true);
  });
  it('usable=false 캐시 = 불가', () => {
    expect(isUsableImage({ url: 'https://x/a.jpg', usable: false })).toBe(false);
  });
  it('치수 모르면 통과(수집 이미지)', () => {
    expect(isUsableImage({ url: 'https://x/a.jpg' })).toBe(true);
  });
});

describe('countUsableImages', () => {
  it('사용가능만 카운트', () => {
    const imgs = [
      { url: 'https://x/ok1.jpg' },
      { url: 'https://x/logo.png' },   // 불가
      { url: 'https://x/ok2.jpg' },
    ];
    expect(countUsableImages(imgs)).toBe(2);
  });
});

describe('assessProducibility', () => {
  it('수집 이미지 ≥1 사용가능 → producible(collected)', async () => {
    const r = await assessProducibility({ images: [{ url: 'https://x/ok.jpg' }] });
    expect(r).toMatchObject({ producible: true, source: 'collected' });
  });

  it('수집 0(전부 워터마크) + 라이브러리 단서 없음 → none(보류)', async () => {
    const r = await assessProducibility({ images: [{ url: 'https://x/logo.png' }] });
    expect(r.producible).toBe(false);
    expect(r.source).toBe('none');
  });

  it('수집 0 + entities/groupId 없으면 라이브러리 폴백 생략 → none', async () => {
    const r = await assessProducibility({ images: [] });
    expect(r).toMatchObject({ producible: false, source: 'none' });
  });
});
