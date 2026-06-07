import { matchByEntity, type ImageAsset } from './imageStore';

/**
 * ②-B 제작 가능성 판정 — 발행에 쓸 "사용가능 이미지"가 있는가.
 *   1) 수집 기사 이미지 중 사용가능(워터마크 의심 X + 규격 충족) 카운트 ≥1 → OK(썸네일 겸용).
 *   2) 0장이면 로컬 이미지 라이브러리(imageStore)에서 cluster.entities 매칭으로 보완.
 *   3) 그래도 0 → 보류(골든타임 만료 시 컷).
 *
 * usable 판정은 휴리스틱(URL 워터마크 + 규격). 비전 판별 한계 — 확정 아님.
 */

// 워터마크/로고/샘플 의심 URL 힌트 (review.ts와 동일 취지, 발행 적합성 기준)
const WATERMARK_HINTS = ['watermark', 'dispatch', 'starnews', 'mnet', 'logo', 'preview', 'sample', '_wm', 'thumb'];
const MIN_DIM = 400; // 규격 최소 변(px). w/h 모를 땐 통과(수집이미지엔 치수 없음).

export function isUsableImage(img: { url: string; w?: number; h?: number; usable?: boolean }): boolean {
  if (img.usable === false) return false;           // 명시적 사용불가(라이브러리 판정 캐시)
  const u = img.url.toLowerCase();
  if (WATERMARK_HINTS.some(h => u.includes(h))) return false;
  if (img.w != null && img.h != null && (img.w < MIN_DIM || img.h < MIN_DIM)) return false;
  return true;
}

export function countUsableImages(images: { url: string; w?: number; h?: number }[]): number {
  return images.filter(isUsableImage).length;
}

export type Producibility = {
  producible: boolean;
  usableCount: number;
  source: 'collected' | 'library' | 'none';
  libraryMatches?: ImageAsset[];
  reason?: string;
};

/**
 * 제작 가능성 종합 판정. 수집 이미지 우선, 0장이면 라이브러리 엔티티 매칭 폴백.
 * groupId/entities 없으면 라이브러리 폴백 생략.
 */
export async function assessProducibility(opts: {
  images: { url: string; w?: number; h?: number }[];
  entities?: string[];
  groupId?: string;
}): Promise<Producibility> {
  const usableCount = countUsableImages(opts.images);
  if (usableCount >= 1) {
    return { producible: true, usableCount, source: 'collected' };
  }

  // 수집 0장 → 라이브러리 엔티티 매칭
  const entities = opts.entities ?? [];
  if (opts.groupId && entities.length > 0) {
    let matches: ImageAsset[] = [];
    try { matches = await matchByEntity(opts.groupId, entities); } catch { matches = []; }
    const usable = matches.filter(a => isUsableImage({ url: a.id, w: a.w, h: a.h, usable: a.usable }));
    if (usable.length > 0) {
      return { producible: true, usableCount: 0, source: 'library', libraryMatches: usable };
    }
  }

  return { producible: false, usableCount: 0, source: 'none', reason: '사용가능 이미지 없음 (수집 0 + 라이브러리 매칭 0) — 보류' };
}
