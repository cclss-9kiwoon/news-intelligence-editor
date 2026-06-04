import { useMemo } from 'react';
import { useTasks } from '../../state/TaskContext';
import type { Task, TaskStatus } from '../../types';

const COLUMNS: { status: TaskStatus; label: string; auto: boolean }[] = [
  { status: 'searching', label: '서칭', auto: true },
  { status: 'source_review', label: '소스 검수', auto: true },
  { status: 'producing', label: '아티클 제작', auto: true },
  { status: 'final_review', label: '결과물 검수', auto: false },
];

export function KanbanBoard({ campaignId, onOpenTask }: { campaignId: string; onOpenTask: (taskId: string) => void }) {
  const { tasks: allTasks, deleteTask } = useTasks();
  const tasks = useMemo(() => allTasks.filter(t => t.campaignId === campaignId), [allTasks, campaignId]);

  return (
    <div className="grid h-full grid-cols-4 gap-3 overflow-hidden p-4">
      {COLUMNS.map(col => {
        const colTasks = tasks.filter(t => t.status === col.status);
        return (
          <div key={col.status} className="flex min-h-0 flex-col rounded-xl bg-gray-100 p-2">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-sm font-semibold text-gray-700">{col.label}</span>
              <div className="flex items-center gap-1.5">
                <span className={`rounded-full px-1.5 text-xs ${col.auto ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-700'}`}>
                  {col.auto ? '자동' : '사람'}
                </span>
                <span className="text-xs text-gray-400">{colTasks.length}</span>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
              {colTasks.map(t => (
                <TaskCard key={t.id} task={t} onOpen={() => onOpenTask(t.id)} onDelete={() => deleteTask(t.id)} />
              ))}
              {colTasks.length === 0 && (
                <div className="rounded-lg border-2 border-dashed border-gray-200 py-6 text-center text-xs text-gray-300">
                  비어 있음
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TaskCard({ task, onOpen, onDelete }: { task: Task; onOpen: () => void; onDelete: () => void }) {
  const fullTextCount = task.sources.filter(s => s.hasFullText).length;

  return (
    <div
      onClick={onOpen}
      className="cursor-pointer rounded-lg border border-gray-200 bg-white p-3 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-gray-800 line-clamp-2">📰 {task.title}</p>
        <button
          onClick={e => { e.stopPropagation(); if (confirm('태스크 삭제?')) onDelete(); }}
          className="shrink-0 text-gray-300 hover:text-red-500"
        >🗑</button>
      </div>

      <div className="mt-2 space-y-0.5 text-xs text-gray-500">
        {task.status === 'searching' && (
          <p>원문 {task.sources.length}건 · {new Date(task.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</p>
        )}
        {task.status === 'source_review' && (
          <p>전문 수집: {fullTextCount}/{task.sources.length}건 · 이미지 {task.imageCount}장</p>
        )}
        {task.status === 'producing' && (
          <p>{task.draft ? `초안 ${task.draft.body.length}자` : '제작 중...'}</p>
        )}
        {task.status === 'final_review' && task.draft && (
          <>
            <p className="truncate text-gray-700">{task.draft.headline}</p>
            <p>본문 {task.draft.body.length}자 · 태그 {task.draft.tags.length} · 이미지 {task.imageCount}</p>
            {task.review && (
              <p className={task.review.passed ? 'text-green-600' : 'text-red-600'}>
                검수 {task.review.passed ? '통과' : `${task.review.findings.filter(f => f.severity === 'block').length}건 차단`}
              </p>
            )}
          </>
        )}
        {task.error && <p className="text-red-500">⚠ {task.error}</p>}
      </div>
    </div>
  );
}
