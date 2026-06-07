/**
 * 전문 수집(본문 추출) 실패 시 재시도 vs 자동 폐기 판정.
 *
 * 전 source 추출 실패(fullTextCount===0)가 N회 누적되면 폐기(extract_failed) — ②에 영영
 * 머무는 추출불가 매체(Jina 451 hard-block + proxy 실패 등)가 슬롯·시야를 막는 것 방지.
 * 부분 성공(1건이라도 fullText)은 호출부에서 이 판정 전에 통과시킨다.
 *
 * (TaskSource에 link가 없어 451 hard-block 도메인 구분은 파이프라인서 불가 → 카운터 단순화.)
 */
export const MAX_EXTRACT_ATTEMPTS = 3;

/**
 * 이번 실패까지 포함한 누적 시도(attempts)가 임계 이상이면 폐기.
 * @param attempts 이번 실패를 반영해 증가시킨 후의 extractAttempts (1-based)
 */
export function shouldDiscardAfterExtractFail(attempts: number, max: number = MAX_EXTRACT_ATTEMPTS): boolean {
  return attempts >= max;
}
