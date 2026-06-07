import { useMemo } from 'react';
import { useTasks } from '../../../state/TaskContext';
import type { DiscardReason } from '../../../types';

const REASON_LABEL: Record<DiscardReason, string> = {
  low_quality: '품질 부족',
  off_topic: '주제 부적합',
  duplicate: '중복',
  extract_failed: '수집 실패',
  other: '기타',
};
const REASON_ORDER: DiscardReason[] = ['low_quality', 'off_topic', 'duplicate', 'extract_failed', 'other'];

/**
 * 폐기함 — discardReason 있는 태스크, 사유별 그룹.
 * 행마다 복원(discardReason 해제) / 영구삭제(confirm).
 */
export function DiscardedView({ campaignId }: { campaignId: string }) {
  const { tasks: allTasks, updateTask, deleteTask } = useTasks();

  const groups = useMemo(() => {
    const discarded = allTasks.filter(t => t.campaignId === campaignId && t.discardReason);
    const by: Record<string, typeof discarded> = {};
    for (const t of discarded) {
      const r = t.discardReason as DiscardReason;
      (by[r] ??= []).push(t);
    }
    return by;
  }, [allTasks, campaignId]);

  const total = Object.values(groups).reduce((n, g) => n + g.length, 0);

  if (total === 0) {
    return <div className="flex h-full items-center justify-center text-sm text-slate-400">폐기된 기사가 없습니다.</div>;
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-4xl space-y-5">
        <h3 className="text-xs font-mono font-semibold uppercase tracking-widest text-slate-400">폐기함 ({total})</h3>
        {REASON_ORDER.filter(r => groups[r]?.length).map(r => (
          <section key={r}>
            <h4 className="mb-1.5 text-xs font-semibold text-slate-500">{REASON_LABEL[r]} ({groups[r].length})</h4>
            <div className="space-y-1.5">
              {groups[r].map(t => (
                <div key={t.id} className="flex items-center gap-3 rounded-xl border border-white/70 bg-white/60 px-4 py-2.5 shadow-sm backdrop-blur-md">
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-600">{t.draft?.headline || t.title}</span>
                  <button
                    onClick={() => updateTask(t.id, { discardReason: undefined })}
                    className="flex-none rounded-full border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
                  >복원</button>
                  <button
                    onClick={() => { if (confirm('이 기사 건을 영구 삭제하시겠습니까? 되돌릴 수 없습니다.')) deleteTask(t.id); }}
                    className="flex-none rounded-full border border-red-200 px-2.5 py-1 text-xs text-red-500 hover:bg-red-50 transition-colors"
                  >영구삭제</button>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
