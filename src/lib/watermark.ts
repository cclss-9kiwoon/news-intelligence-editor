/**
 * 워터마크/로고 박힌 이미지 거름 — 발행 부적합(매체 로고 워터마크) 사진 차단.
 * allkpop 원칙: 공식 포스터·소속사 제공·무워터마크만 발행. 로고 매체 사진은 제외.
 *
 * 시드 블랙리스트(akp-RW 워터마크 기준 오면 정교화). 보수적 매칭 — 소스명/URL 도메인에
 * 명확한 로고 매체가 보이면 워터마크로 간주. 판정 못 하면 통과(과차단 방지).
 */

/** 로고 워터마크가 흔한 매체(소스명·URL 부분일치, 소문자). */
const WATERMARK_PATTERNS: string[] = [
  'starnews', '스타뉴스', 'dispatch', '디스패치',
  'newsen', '뉴센', 'osen', 'xportsnews', '엑스포츠', 'tvreport', '티브이리포트',
  'sportschosun', '스포츠조선', 'sportsseoul', '스포츠서울', 'isplus', '일간스포츠',
  'mydaily', '마이데일리', 'topstarnews', 'sportsq',
  // 방송사 캡처(로고 박힘)
  'mbc', 'imbc', 'sbs', 'kbs', 'jtbc', 'mnet', 'tvchosun', 'channela',
];

/** 이 이미지가 워터마크/로고 매체 출처인가 — true면 발행 부적합. */
export function isWatermarkedImage(img: { url?: string; source?: string }): boolean {
  const hay = `${img.source ?? ''} ${img.url ?? ''}`.toLowerCase();
  return WATERMARK_PATTERNS.some(p => hay.includes(p));
}

/** 워터마크 의심 이미지 제거(발행 가능 이미지만). */
export function filterPublishableImages<T extends { url?: string; source?: string }>(images: T[]): T[] {
  return images.filter(img => !isWatermarkedImage(img));
}
