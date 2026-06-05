import { useMemo } from 'react';
import { useTasks } from '../../../state/TaskContext';

/** 상대 시각 (방금/N분 전/N시간 전/N일 전) */
function relTime(ts: number, now: number): string {
  const diff = Math.max(0, now - ts);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  return `${Math.floor(hr / 24)}일 전`;
}

/**
 * 발행함 — published===true 태스크, publishedAt 내림차순.
 * 행: 제목 · 발행시각(상대) · 채널 placeholder.
 */
export function PublishedView({ campaignId, onOpenTask }: { campaignId: string; onOpenTask: (taskId: string) => void }) {
  const { tasks: allTasks } = useTasks();
  const now = Date.now();

  const published = useMemo(
    () => allTasks
      .filter(t => t.campaignId === campaignId && t.published)
      .sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0)),
    [allTasks, campaignId],
  );

  if (published.length === 0) {
    return <div className="flex h-full items-center justify-center text-sm text-slate-400">발행된 기사가 없습니다.</div>;
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-4xl space-y-2">
        <h3 className="mb-2 text-xs font-mono font-semibold uppercase tracking-widest text-slate-400">발행함 ({published.length})</h3>
        {published.map(t => (
          <button
            key={t.id}
            onClick={() => onOpenTask(t.id)}
            className="flex w-full items-center gap-3 rounded-xl border border-white/70 bg-white/70 px-4 py-3 text-left shadow-sm backdrop-blur-md transition-colors hover:bg-white"
          >
            <span className="text-green-500">✓</span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{t.draft?.headline || t.title}</span>
            <span className="flex-none rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-400" title="배포 채널 — Hydra 연동 예정">Hydra 미연결</span>
            <span className="flex-none text-xs text-slate-400">{t.publishedAt ? relTime(t.publishedAt, now) : '—'}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
