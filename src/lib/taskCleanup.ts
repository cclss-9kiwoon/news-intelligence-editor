import type { Task, TaskStatus } from '../types';

/**
 * 오래된(stuck) 태스크 정리 — 경과 시간 기준 삭제 대상 id 목록.
 * createdAt 기준 olderThanMs 초과한 캠페인 태스크.
 * ① searching은 골든타임 만료로 자동 삭제되므로, 주로 ②③④에 머무는 건 수동 정리용.
 *
 * 순수함수 — 호출부(KanbanBoard)는 반환 id를 deleteTask로 일괄 삭제.
 */
export type StaleOpts = {
  status?: TaskStatus;        // 특정 단계만 (없으면 전 단계)
  includePublished?: boolean; // 발행분 포함 여부 (기본 false — 발행분은 보존)
};

export function staleTaskIds(
  tasks: Task[],
  campaignId: string,
  olderThanMs: number,
  now: number,
  opts: StaleOpts = {},
): string[] {
  return tasks
    .filter(t => t.campaignId === campaignId)
    .filter(t => !opts.status || t.status === opts.status)
    .filter(t => opts.includePublished ? true : !t.published)
    .filter(t => now - t.createdAt > olderThanMs)
    .map(t => t.id);
}

/**
 * 단계별 정리 대상 건수 — UI 컬럼 뱃지용.
 * statuses 각각에 staleTaskIds 적용한 count map. status 미지정 단계는 0.
 */
export function staleCountByStatus(
  tasks: Task[],
  campaignId: string,
  olderThanMs: number,
  now: number,
  statuses: TaskStatus[],
  opts: Omit<StaleOpts, 'status'> = {},
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of statuses) {
    out[s] = staleTaskIds(tasks, campaignId, olderThanMs, now, { ...opts, status: s }).length;
  }
  return out;
}

/** 시간(시) → ms 헬퍼 (UI 선택값 변환용) */
export function hoursToMs(hours: number): number {
  return hours * 3_600_000;
}
