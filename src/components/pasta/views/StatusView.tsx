import { useMemo } from 'react';
import { useTasks } from '../../../state/TaskContext';
import { useArticles } from '../../../state/ArticlesContext';
import type { TaskStatus } from '../../../types';

/**
 * 현황 대시보드 — 캠페인 파이프라인 한눈에.
 * 단계별 건수 / 오늘(자정 이후) 생성·발행·폐기 / 검수 통과율 / 마지막 수집.
 */
const STAGES: { status: TaskStatus; label: string; dot: string }[] = [
  { status: 'searching', label: '기사 찾기', dot: 'bg-blue-400' },
  { status: 'topic_review', label: '주제 검수', dot: 'bg-blue-400' },
  { status: 'producing', label: '기사 작성', dot: 'bg-blue-400' },
  { status: 'final_review', label: '최종 검수', dot: 'bg-amber-400' },
];

function startOfToday(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function StatusView({ campaignId, onOpenTask }: { campaignId: string; onOpenTask: (taskId: string) => void }) {
  const { tasks: allTasks } = useTasks();
  const { articles, lastRefreshedAt } = useArticles();

  const m = useMemo(() => {
    const now = Date.now();
    const midnight = startOfToday(now);
    const tasks = allTasks.filter(t => t.campaignId === campaignId);
    const active = tasks.filter(t => !t.discardReason);

    const stageCounts: Record<TaskStatus, number> = {
      searching: 0, topic_review: 0, producing: 0, final_review: 0,
    };
    active.forEach(t => { stageCounts[t.status] = (stageCounts[t.status] ?? 0) + 1; });

    const createdToday = tasks.filter(t => t.createdAt >= midnight).length;
    const publishedToday = tasks.filter(t => t.published && (t.publishedAt ?? 0) >= midnight).length;
    const discardedToday = tasks.filter(t => t.discardReason && t.updatedAt >= midnight).length;

    const reviewed = tasks.filter(t => t.review);
    const passed = reviewed.filter(t => t.review!.passed).length;
    const passRate = reviewed.length > 0 ? Math.round((passed / reviewed.length) * 100) : null;

    const latestFetch = articles.reduce((mx, a) => Math.max(mx, a.fetchedAt), 0) || lastRefreshedAt || 0;

    return { stageCounts, createdToday, publishedToday, discardedToday, passRate, reviewedCount: reviewed.length, passed, articleCount: articles.length, latestFetch };
  }, [allTasks, campaignId, articles, lastRefreshedAt]);

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* 단계별 건수 */}
        <section>
          <h3 className="mb-2 text-xs font-mono font-semibold uppercase tracking-widest text-slate-400">파이프라인 단계</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {STAGES.map(s => (
              <button
                key={s.status}
                onClick={() => {
                  const first = allTasks.find(t => t.campaignId === campaignId && t.status === s.status && !t.discardReason);
                  if (first) onOpenTask(first.id);
                }}
                className="rounded-2xl border border-white/70 bg-white/70 p-4 text-left shadow-sm backdrop-blur-md transition-colors hover:bg-white"
              >
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className={`h-2 w-2 rounded-full ${s.dot}`} />{s.label}
                </div>
                <div className="mt-1 text-3xl font-bold tabular-nums text-slate-900">{m.stageCounts[s.status]}</div>
              </button>
            ))}
          </div>
        </section>

        {/* 오늘 지표 */}
        <section>
          <h3 className="mb-2 text-xs font-mono font-semibold uppercase tracking-widest text-slate-400">오늘 (자정 이후)</h3>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="생성" value={m.createdToday} tone="text-blue-600" />
            <Stat label="발행" value={m.publishedToday} tone="text-green-600" />
            <Stat label="폐기" value={m.discardedToday} tone="text-red-500" />
          </div>
        </section>

        {/* 검수 통과율 + 수집 */}
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/70 bg-white/70 p-4 shadow-sm backdrop-blur-md">
            <div className="text-xs text-slate-500">검수 통과율</div>
            <div className="mt-1 text-3xl font-bold tabular-nums text-slate-900">
              {m.passRate === null ? '—' : `${m.passRate}%`}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-400">
              {m.reviewedCount > 0 ? `${m.passed}/${m.reviewedCount}건 통과` : '검수 이력 없음'}
            </div>
          </div>
          <div className="rounded-2xl border border-white/70 bg-white/70 p-4 shadow-sm backdrop-blur-md">
            <div className="text-xs text-slate-500">마지막 수집</div>
            <div className="mt-1 text-3xl font-bold tabular-nums text-slate-900">{m.articleCount}<span className="ml-1 text-sm font-normal text-slate-400">건</span></div>
            <div className="mt-0.5 text-[11px] text-slate-400">
              {m.latestFetch ? new Date(m.latestFetch).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '수집 이력 없음'}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/70 p-4 shadow-sm backdrop-blur-md">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 text-3xl font-bold tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}
