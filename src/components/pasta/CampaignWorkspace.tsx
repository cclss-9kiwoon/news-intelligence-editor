import { useState } from 'react';
import { useTasks } from '../../state/TaskContext';
import { useArticles } from '../../state/ArticlesContext';
import { useSettings } from '../../state/SettingsContext';
import { generateStory } from '../../lib/promptChain';
import { TagInput } from './TagInput';
import { TaskSourcePanel } from './TaskSourcePanel';
import type { DiscardReason, Category, StoryOutput } from '../../types';

const DISCARD_REASONS: { value: DiscardReason; label: string }[] = [
  { value: 'low_quality', label: '품질 부족' },
  { value: 'off_topic', label: '주제 부적합' },
  { value: 'duplicate', label: '중복' },
  { value: 'other', label: '기타' },
];

export function CampaignWorkspace({ taskId, onBack }: { taskId: string; onBack: () => void }) {
  const { tasks, updateTask } = useTasks();
  const { articles } = useArticles();
  const { settings } = useSettings();

  const task = tasks.find(t => t.id === taskId);
  const [headline, setHeadline] = useState(task?.draft?.headline ?? '');
  const [body, setBody] = useState(task?.draft?.body ?? '');
  const [tags, setTags] = useState<string[]>(task?.draft?.tags ?? []);
  const [regenerating, setRegenerating] = useState(false);
  const [discarding, setDiscarding] = useState(false);

  if (!task) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400">
        기사 건을 찾을 수 없습니다. <button onClick={onBack} className="ml-2 underline">돌아가기</button>
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
      tags,
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
      setTags(fresh.tags);
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
    updateTask(task.id, { published: true, publishedAt: Date.now() });
    // Hydra 배포 훅 (stub)
    console.log('[pasta] publish → Hydra 배포 연결 지점', task.id);
    onBack();
  };

  const discard = (reason: DiscardReason) => {
    if (!confirm(`이 기사 건을 폐기하시겠습니까? (사유: ${DISCARD_REASONS.find(r => r.value === reason)?.label})`)) return;
    // 보존 폐기: 삭제 대신 discardReason 기록 → 폐기함에서 복원/영구삭제 가능
    updateTask(task.id, { discardReason: reason });
    onBack();
  };

  return (
    <div className="flex h-full flex-col" style={{ background: 'radial-gradient(ellipse 80% 80% at top left, #C5E3F6 0%, transparent 55%), radial-gradient(ellipse at bottom center, #FBE2BC 0%, transparent 55%), radial-gradient(ellipse at right, #F0D5F7 0%, transparent 55%), #FCF4E8' }}>
      {/* 헤더 */}
      <div className="flex items-center gap-2 border-b border-slate-200/60 bg-white/70 backdrop-blur-md px-5 py-2.5 text-sm">
        <button onClick={onBack} aria-label="칸반 보드로 돌아가기" className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors">← 칸반</button>
        <span className="font-bold text-slate-800 truncate">📰 {task.title}</span>
        {task.review && (
          <span className={`ml-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-mono font-semibold ${task.review.passed ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {task.review.passed ? '✓ 검수 통과' : `검수 ${task.review.findings.filter(f => f.severity === 'block').length}건 차단`}
          </span>
        )}
      </div>

      {/* 3분할 — 좁은 화면은 세로 스택, lg↑ 3분할 고정폭 */}
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[280px_1fr_320px] lg:overflow-hidden xl:grid-cols-[300px_1fr_340px]">
        {/* 좌: AI Assistant */}
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto border-r border-white/60 bg-white/45 backdrop-blur-md p-4">
          <div>
            <h3 className="mb-2 text-xs font-mono font-semibold uppercase tracking-wide text-slate-500">🤖 AI Assistant</h3>
            <button
              onClick={regenerate}
              disabled={regenerating}
              className="w-full rounded-full bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-700 disabled:opacity-40 transition-colors"
            >{regenerating ? '재생성 중...' : '✨ 초안 재생성'}</button>
          </div>

          <TaskSourcePanel task={task} />

          {/* #12 검수 결과 — 차단/경고 사유 */}
          {task.review && task.review.findings.length > 0 && (
            <div>
              <h4 className="mb-1.5 text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-400">
                검수 결과 ({task.review.passed ? '통과' : `${task.review.findings.filter(f => f.severity === 'block').length}건 차단`})
              </h4>
              <div className="space-y-1">
                {task.review.findings.map((f, i) => (
                  <div key={i} className={`rounded px-2 py-1 text-xs ${f.severity === 'block' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                    <span className="font-semibold">{f.severity === 'block' ? '🚫' : '⚠'} {f.label}</span>
                    <p className="text-[11px] opacity-80">{f.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h4 className="mb-1.5 text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-400">팩트 대조 ({sourceFacts.length})</h4>
            <div className="space-y-1.5">
              {sourceFacts.map((f, i) => (
                <label key={i} className="flex items-start gap-2 rounded-lg border border-slate-100 bg-white/70 px-2.5 py-1.5 text-xs text-slate-600 cursor-pointer hover:bg-white">
                  <input type="checkbox" className="mt-0.5 accent-indigo-500" />
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
            <label className="mb-1 block text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-400">헤드라인</label>
            <input
              className="w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-lg font-bold focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-colors"
              value={headline}
              onChange={e => setHeadline(e.target.value)}
            />
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            <label className="mb-1 block text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-400">본문 ({body.length}자)</label>
            <textarea
              className="min-h-0 flex-1 w-full resize-none rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm leading-relaxed focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-colors"
              value={body}
              onChange={e => setBody(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-400">태그</label>
            <TagInput values={tags} onChange={setTags} placeholder="태그 입력 후 Enter" />
          </div>
        </div>

        {/* 우: 채널 프리뷰 (X 트윗 스타일 글래스 카드) */}
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto border-l border-white/60 bg-white/45 backdrop-blur-md p-4">
          <h3 className="text-xs font-mono font-semibold uppercase tracking-wide text-slate-500">📱 채널 프리뷰</h3>
          <div className="rounded-2xl border border-white/70 bg-white/90 p-4 shadow-sm backdrop-blur-md">
            <div className="mb-2.5 flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs text-white">a</div>
              <div className="min-w-0">
                <p className="flex items-center gap-1 text-sm font-bold text-slate-900">
                  allkpop
                  <svg className="h-3.5 w-3.5 text-green-500" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zm3.54 6.54l-4 4a.75.75 0 0 1-1.06 0l-2-2a.75.75 0 1 1 1.06-1.06L7 8.94l3.47-3.47a.75.75 0 1 1 1.07 1.07z" />
                  </svg>
                </p>
                <p className="text-xs text-slate-400">@allkpop</p>
              </div>
              <span className="ml-auto rounded-full bg-black px-2 py-0.5 text-[10px] font-mono font-bold text-white">X</span>
            </div>
            <p className="text-sm font-semibold leading-snug text-slate-900">{stripHtml(headline) || '헤드라인'}</p>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600 line-clamp-6">{stripHtml(body).slice(0, 240) || '본문 미리보기'}</p>
            <p className="mt-2.5 text-xs text-indigo-500">{tags.map(t => `#${t}`).join(' ')}</p>
            <div className="mt-3 flex items-center gap-5 border-t border-slate-100 pt-2.5 text-[11px] font-mono text-slate-400">
              <span>💬 0</span><span>🔁 0</span><span>♥ 0</span><span>📊 0</span>
            </div>
          </div>
          <p className="text-xs text-slate-400">발행하면 연결된 배포 채널로 전송됩니다.</p>
        </div>
      </div>

      {/* 하단 액션 바 */}
      <div className="flex items-center gap-2 border-t border-slate-200/60 bg-white/70 backdrop-blur-md px-5 py-2.5">
        <button onClick={saveDraft} className="rounded-full border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">임시저장</button>
        <button onClick={publish} className="rounded-full bg-slate-900 px-5 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-700 transition-colors">발행</button>
        <button onClick={() => setDiscarding(v => !v)} className="rounded-full px-4 py-1.5 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors">폐기</button>
        {discarding && (
          <div className="flex items-center gap-1">
            {DISCARD_REASONS.map(r => (
              <button key={r.value} onClick={() => discard(r.value)} className="rounded-full border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 transition-colors">{r.label}</button>
            ))}
          </div>
        )}
        <span className="ml-auto text-xs font-mono text-slate-400">예약 발행 (캘린더 — Hydra)</span>
      </div>
    </div>
  );
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
}
