import { useMemo } from 'react';
import { useTasks } from '../../state/TaskContext';
import type { Task, TaskStatus } from '../../types';

type ColMeta = {
  status: TaskStatus; label: string; auto: boolean;
  bar: string;        // 상단 컬러 바
  badge: string;      // 자동/사람 배지
  dot: string;        // 카운트 도트
};

// 단계별 컬러코딩: 자동 단계=블루, 검수=앰버, 결과=그린
const COLUMNS: ColMeta[] = [
  { status: 'searching',    label: '서칭',        auto: true,  bar: 'bg-blue-400',  badge: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-500' },
  { status: 'topic_review', label: '주제 검수',    auto: true,  bar: 'bg-blue-400',  badge: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-500' },
  { status: 'producing',    label: '아티클 제작',  auto: true,  bar: 'bg-blue-400',  badge: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-500' },
  { status: 'final_review', label: '결과물 검수',  auto: false, bar: 'bg-amber-400', badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
];

export function KanbanBoard({ campaignId, onOpenTask }: { campaignId: string; onOpenTask: (taskId: string) => void }) {
  const { tasks: allTasks, deleteTask, updateTask } = useTasks();
  const tasks = useMemo(() => allTasks.filter(t => t.campaignId === campaignId), [allTasks, campaignId]);
  const retryTask = (id: string) => updateTask(id, { error: undefined, produceAttempts: 0, status: 'producing' });

  return (
    <div className="h-full overflow-hidden" style={{ background: 'radial-gradient(ellipse 80% 80% at top left, #C5E3F6 0%, transparent 55%), radial-gradient(ellipse at bottom center, #FBE2BC 0%, transparent 55%), radial-gradient(ellipse at right, #F0D5F7 0%, transparent 55%), #FCF4E8' }}>
      <div className="grid h-full grid-cols-4 gap-5 px-8 py-6">
        {COLUMNS.map(col => {
          const colTasks = tasks.filter(t => t.status === col.status);
          return (
            <div key={col.status} className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/60 bg-white/55 backdrop-blur-md shadow-sm">
              <div className={`h-1.5 w-full ${col.bar}`} />
              <div className="flex items-center justify-between px-4 py-3.5">
                <span className="text-[15px] font-bold text-slate-800">{col.label}</span>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide ${col.badge}`}>
                    {col.auto ? '자동' : '사람'}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs font-mono font-semibold text-slate-500">
                    <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                    {colTasks.length}
                  </span>
                </div>
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pb-4">
                {colTasks.map(t => (
                  <TaskCard key={t.id} task={t} onOpen={() => onOpenTask(t.id)} onDelete={() => deleteTask(t.id)} onRetry={() => retryTask(t.id)} />
                ))}
                {colTasks.length === 0 && (
                  <div className="mt-1 rounded-xl border-2 border-dashed border-slate-200/80 py-10 text-center text-xs text-slate-300">
                    비어 있음
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TaskCard({ task, onOpen, onDelete, onRetry }: { task: Task; onOpen: () => void; onDelete: () => void; onRetry: () => void }) {
  const fullTextCount = task.sources.filter(s => s.hasFullText).length;
  const mediaCount = new Set(task.sources.map(s => s.source)).size;
  const verified = task.status === 'final_review' && task.review?.passed;
  const attempts = task.produceAttempts ?? 0;
  const retrying = task.status === 'producing' && !task.draft && !task.error && attempts >= 1;

  return (
    <div
      onClick={onOpen}
      className="cursor-pointer rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md hover:border-slate-300 hover:-translate-y-0.5 transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-snug text-slate-800 line-clamp-2">📰 {task.title}</p>
        <button
          onClick={e => { e.stopPropagation(); if (confirm('태스크 삭제?')) onDelete(); }}
          className="shrink-0 text-slate-300 hover:text-red-500 transition-colors"
        >🗑</button>
      </div>

      {/* 발행됨 뱃지 — Hydra 배포 완료 */}
      {task.published && (
        <span className="mt-2 mr-1 inline-flex items-center gap-1 rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-mono font-semibold text-white">
          📤 발행됨
        </span>
      )}

      {/* Verified 뱃지 — 검수 통과 결과물 */}
      {!task.published && verified && (
        <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-mono font-semibold text-green-700">
          <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zm3.54 6.54l-4 4a.75.75 0 0 1-1.06 0l-2-2a.75.75 0 1 1 1.06-1.06L7 8.94l3.47-3.47a.75.75 0 1 1 1.07 1.07z" />
          </svg>
          Verified
        </span>
      )}

      <div className="mt-2 space-y-0.5 text-xs font-mono text-slate-500">
        {/* #2 카드 메타: 원문 매체 · 서브 건수 · 경과 시간 */}
        {(task.status === 'searching' || task.status === 'topic_review') && (
          <p>
            원문: {task.sources[0]?.source ?? '—'}
            {mediaCount > 1 && <span className="text-slate-700 font-semibold"> · 서브 {mediaCount - 1}곳</span>}
            {' · '}{relTime(task.createdAt)}
          </p>
        )}
        {task.status === 'topic_review' && !task.error && (
          <p>전문 수집: {fullTextCount}/{task.sources.length}건 · 이미지 {task.imageCount}장</p>
        )}
        {task.status === 'producing' && !task.error && (
          <p>{task.draft ? `초안 ${task.draft.body.length}자` : retrying ? `초안 생성 재시도 중 (${attempts + 1}/3)` : '초안 생성 중...'}</p>
        )}
        {task.status === 'final_review' && task.draft && (
          <>
            <p className="truncate font-sans font-medium text-slate-700">{task.draft.headline}</p>
            <p>본문 {task.draft.body.length}자 · 태그 {task.draft.tags.length} · 이미지 {task.imageCount}</p>
            {task.review && !task.review.passed && (
              <p className="text-red-600">검수 {task.review.findings.filter(f => f.severity === 'block').length}건 차단</p>
            )}
          </>
        )}
        {/* #1 실패 UX: 사람 읽을 메시지 + 다시 시도 버튼 */}
        {task.error && (
          <div className="mt-1 rounded-lg bg-red-50 px-2 py-1.5">
            <p className="text-red-600">{task.error}</p>
            <button
              onClick={e => { e.stopPropagation(); onRetry(); }}
              className="mt-1 rounded-md bg-red-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-red-700"
            >↻ 다시 시도</button>
          </div>
        )}
      </div>
    </div>
  );
}

function relTime(ts: number): string {
  const min = Math.floor((Date.now() - ts) / 60000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}
