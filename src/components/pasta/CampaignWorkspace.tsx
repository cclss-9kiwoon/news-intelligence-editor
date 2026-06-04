import { useState } from 'react';
import { useTasks } from '../../state/TaskContext';
import { useArticles } from '../../state/ArticlesContext';
import { useSettings } from '../../state/SettingsContext';
import { generateStory } from '../../lib/promptChain';
import type { DiscardReason, Category, StoryOutput } from '../../types';

const DISCARD_REASONS: { value: DiscardReason; label: string }[] = [
  { value: 'low_quality', label: '품질 부족' },
  { value: 'off_topic', label: '주제 부적합' },
  { value: 'duplicate', label: '중복' },
  { value: 'other', label: '기타' },
];

export function CampaignWorkspace({ taskId, onBack }: { taskId: string; onBack: () => void }) {
  const { tasks, updateTask, deleteTask } = useTasks();
  const { articles } = useArticles();
  const { settings } = useSettings();

  const task = tasks.find(t => t.id === taskId);
  const [headline, setHeadline] = useState(task?.draft?.headline ?? '');
  const [body, setBody] = useState(task?.draft?.body ?? '');
  const [tags, setTags] = useState((task?.draft?.tags ?? []).join(', '));
  const [regenerating, setRegenerating] = useState(false);
  const [discarding, setDiscarding] = useState(false);

  if (!task) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400">
        태스크를 찾을 수 없습니다. <button onClick={onBack} className="ml-2 underline">돌아가기</button>
      </div>
    );
  }

  const draft = task.draft;
  const sourceFacts = draft?.sourceFacts ?? [];
  const srcArticles = articles.filter(a => task.sources.some(s => s.articleId === a.id));

  const saveDraft = () => {
    const updated: StoryOutput = {
      ...(draft ?? { summary: '', headline: '', body: '', tags: [], imagePrompt: '' }),
      headline,
      body,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
    };
    updateTask(task.id, { draft: updated });
  };

  const regenerate = async () => {
    setRegenerating(true);
    try {
      const category: Category =
        settings.categories.find(c => c.id === settings.activeCategoryId)
        ?? settings.categories[0]
        ?? { id: 'default', label: '기본', criteria: '', tone: '' };
      const fresh = await generateStory(srcArticles, settings, category);
      setHeadline(fresh.headline);
      setBody(fresh.body);
      setTags(fresh.tags.join(', '));
      updateTask(task.id, { draft: fresh });
    } catch (err) {
      alert(`재생성 실패: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRegenerating(false);
    }
  };

  const publish = () => {
    if (!confirm('이 아티클을 발행하시겠습니까? (Hydra 배포)')) return;
    saveDraft();
    updateTask(task.id, { published: true });
    // Hydra 배포 훅 (stub)
    console.log('[pasta] publish → Hydra 배포 연결 지점', task.id);
    onBack();
  };

  const discard = (reason: DiscardReason) => {
    if (!confirm(`이 태스크를 폐기하시겠습니까? (사유: ${DISCARD_REASONS.find(r => r.value === reason)?.label})`)) return;
    deleteTask(task.id);
    onBack();
  };

  return (
    <div className="flex h-full flex-col bg-white">
      {/* 헤더 */}
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-2 text-sm">
        <button onClick={onBack} className="rounded px-2 py-0.5 text-slate-500 hover:bg-slate-100">← 칸반</button>
        <span className="font-semibold text-slate-800 truncate">📰 {task.title}</span>
        {task.review && (
          <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${task.review.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            검수 {task.review.passed ? '통과' : `${task.review.findings.filter(f => f.severity === 'block').length}건 차단`}
          </span>
        )}
      </div>

      {/* 3분할 */}
      <div className="grid min-h-0 flex-1 grid-cols-[300px_1fr_340px] overflow-hidden">
        {/* 좌: AI Assistant */}
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto border-r border-slate-200 bg-slate-50 p-4">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">🤖 AI Assistant</h3>
            <button
              onClick={regenerate}
              disabled={regenerating}
              className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
            >{regenerating ? '재생성 중...' : '✨ 초안 재생성'}</button>
          </div>

          <div>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">원문 소스 ({srcArticles.length})</h4>
            <div className="space-y-1">
              {task.sources.map(s => (
                <div key={s.articleId} className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600">
                  <span className={s.hasFullText ? 'text-green-600' : 'text-slate-300'}>●</span> {s.source} · {s.title.slice(0, 30)}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">팩트 대조 ({sourceFacts.length})</h4>
            <div className="space-y-1">
              {sourceFacts.map((f, i) => (
                <label key={i} className="flex items-start gap-1.5 rounded bg-white px-2 py-1 text-xs text-slate-600">
                  <input type="checkbox" className="mt-0.5" />
                  <span>{f}</span>
                </label>
              ))}
              {sourceFacts.length === 0 && <p className="text-xs text-slate-300">팩트 없음</p>}
            </div>
          </div>
        </div>

        {/* 중: 에디터 */}
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto p-5">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">헤드라인</label>
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-lg font-bold focus:border-indigo-400 focus:outline-none"
              value={headline}
              onChange={e => setHeadline(e.target.value)}
            />
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">본문 ({body.length}자)</label>
            <textarea
              className="min-h-0 flex-1 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm leading-relaxed focus:border-indigo-400 focus:outline-none"
              value={body}
              onChange={e => setBody(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">태그 (쉼표)</label>
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
              value={tags}
              onChange={e => setTags(e.target.value)}
            />
          </div>
        </div>

        {/* 우: 채널 프리뷰 */}
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto border-l border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-semibold text-slate-700">📱 채널 프리뷰</h3>
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-slate-900" />
              <div>
                <p className="text-sm font-bold text-slate-800">allkpop</p>
                <p className="text-xs text-slate-400">@allkpop</p>
              </div>
            </div>
            <p className="text-sm font-semibold text-slate-800">{headline || '헤드라인'}</p>
            <p className="mt-1 text-xs text-slate-600 line-clamp-6">{body.slice(0, 240) || '본문 미리보기'}</p>
            <p className="mt-2 text-xs text-indigo-500">{tags.split(',').map(t => t.trim()).filter(Boolean).map(t => `#${t}`).join(' ')}</p>
          </div>
          <p className="text-xs text-slate-400">발행 시 Hydra 배포 파이프라인으로 연결됩니다.</p>
        </div>
      </div>

      {/* 하단 액션 바 */}
      <div className="flex items-center gap-2 border-t border-slate-200 px-4 py-2.5">
        <button onClick={saveDraft} className="rounded-lg border border-slate-300 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-50">임시저장</button>
        <button onClick={publish} className="rounded-lg bg-slate-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-slate-700">발행</button>
        <button onClick={() => setDiscarding(v => !v)} className="rounded-lg px-4 py-1.5 text-sm text-red-500 hover:bg-red-50">폐기</button>
        {discarding && (
          <div className="flex items-center gap-1">
            {DISCARD_REASONS.map(r => (
              <button key={r.value} onClick={() => discard(r.value)} className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50">{r.label}</button>
            ))}
          </div>
        )}
        <span className="ml-auto text-xs text-slate-400">예약 발행 (캘린더 — Hydra)</span>
      </div>
    </div>
  );
}
