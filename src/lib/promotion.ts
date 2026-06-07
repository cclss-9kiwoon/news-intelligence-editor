import type { Task } from '../types';

const HOUR_MS = 3_600_000;

/**
 * ①→② 승급 예산 — 최근 1시간 승급수 기준 남은 슬롯.
 * 속보 포함 모든 승급이 promotedAt를 찍으므로 전부 카운트(maxPerHour 절대 초과 방지).
 * maxPerHour<=0 = 무제한(Infinity).
 *
 * 순수함수 — 호출부(SearchingPipeline)는 이 예산 내에서, 같은 사이클 다중 승급도
 * 로컬 카운터로 차감해 레이스(9>3) 차단.
 */
export function promotionBudget(
  tasks: Task[],
  campaignId: string,
  maxPerHour: number,
  now: number,
): number {
  if (maxPerHour <= 0) return Infinity;
  // 승급 '행위'가 시간당 슬롯을 소비 — 결과(성공/실패/보류) 무관 promotedAt 기준 카운트.
  // error/보류(discardReason 없음)는 카운트 유지: 제외하면 fail-closed 보류·실패분이
  // 예산을 안 깎아 무한 재승급(38/2 폭주) 발생.
  // 단 사용자/자동 '폐기'(discardReason 있음)는 제외: 최종 거부 + discardLedger(discarded_dup)가
  // 재유입까지 차단하므로 슬롯 점유 이유 없음. 안 빼면 큐레이션이 승급 예산을 잠식(0/5 굶음).
  // 1시간 롤링 윈도라 어차피 영구 잠식 아님 — promotedAt가 1h 지나면 자연 회복.
  const promotedLastHour = tasks.filter(
    t => t.campaignId === campaignId
      && t.promotedAt != null
      && now - t.promotedAt <= HOUR_MS
      && !t.discardReason,   // 폐기건은 예산 회복 (재유입은 원장이 막음)
  ).length;
  return Math.max(0, maxPerHour - promotedLastHour);
}
