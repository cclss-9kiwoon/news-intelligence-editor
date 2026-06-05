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
  const promotedLastHour = tasks.filter(
    t => t.campaignId === campaignId && t.promotedAt != null && now - t.promotedAt <= HOUR_MS,
  ).length;
  return Math.max(0, maxPerHour - promotedLastHour);
}
