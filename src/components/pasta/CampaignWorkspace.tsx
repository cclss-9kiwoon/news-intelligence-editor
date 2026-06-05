import { useState, useEffect } from 'react';
import { useTasks } from '../../state/TaskContext';
import { useArticles } from '../../state/ArticlesContext';
import { useSettings } from '../../state/SettingsContext';
import { useCampaigns } from '../../state/CampaignContext';
import { generateStory } from '../../lib/promptChain';
import { TagInput } from './TagInput';
import { TaskSourcePanel } from './TaskSourcePanel';
import type { DiscardReason, Category, StoryOutput, ChannelType } from '../../types';

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
  const { campaigns, groups } = useCampaigns();

  const task = tasks.find(t => t.id === taskId);
  const group = groups.find(g => g.id === campaigns.find(c => c.id === task?.campaignId)?.groupId);
  const profile = group?.profile;

  const [headline, setHeadline] = useState(task?.draft?.headline ?? '');
  const [body, setBody] = useState(task?.draft?.body ?? '');
  const [tags, setTags] = useState<string[]>(task?.draft?.tags ?? []);
  const [regenerating, setRegenerating] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [checkedFacts, setCheckedFacts] = useState<Set<number>>(new Set());

  // (1) draft state 누수 방지 — taskId 바뀌면 에디터 state를 새 태스크 draft로 동기화
  useEffect(() => {
    const t = tasks.find(x => x.id === taskId);
    setHeadline(t?.draft?.headline ?? '');
    setBody(t?.draft?.body ?? '');
    setTags(t?.draft?.tags ?? []);
    setCheckedFacts(new Set());
    setDiscarding(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

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

  // (2) 미저장 이탈 가드
  const dirty =
    headline !== (draft?.headline ?? '') ||
    body !== (draft?.body ?? '') ||
    JSON.stringify(tags) !== JSON.stringify(draft?.tags ?? []);
  const guardedBack = () => {
    if (dirty && !confirm('저장하지 않은 편집이 있습니다. 저장하지 않고 나가시겠습니까?')) return;
    onBack();
  };

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
        <button onClick={guardedBack} aria-label="칸반 보드로 돌아가기" className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors">← 칸반</button>
        {dirty && <span className="text-[10px] text-amber-600" title="저장하지 않은 변경 있음">● 미저장</span>}
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
            <h4 className="mb-1.5 text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-400">
              팩트 대조 ({checkedFacts.size}/{sourceFacts.length})
            </h4>
            <div className="space-y-1.5">
              {sourceFacts.map((f, i) => {
                const checked = checkedFacts.has(i);
                return (
                  <label key={i} className="flex items-start gap-2 rounded-lg border border-slate-100 bg-white/70 px-2.5 py-1.5 text-xs text-slate-600 cursor-pointer hover:bg-white">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => setCheckedFacts(prev => {
                        const next = new Set(prev);
                        if (next.has(i)) next.delete(i); else next.add(i);
                        return next;
                      })}
                      className="mt-0.5 accent-indigo-500"
                    />
                    <span className={checked ? 'text-slate-400 line-through' : ''}>{f}</span>
                  </label>
                );
              })}
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

        {/* 우: 채널 프리뷰 — 그룹 채널 유형별 분기 */}
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto border-l border-white/60 bg-white/45 backdrop-blur-md p-4">
          <h3 className="text-xs font-mono font-semibold uppercase tracking-wide text-slate-500">📱 채널 프리뷰</h3>
          {(() => {
            const channelName = group?.name?.trim() || '채널';
            const handle = '@' + channelName.toLowerCase().replace(/[^a-z0-9]+/g, '');
            const ct: ChannelType = profile?.channelType ?? 'vertical_curation';
            const UI: Record<ChannelType, { badge: string; badgeBg: string; isSocial: boolean }> = {
              news_media: { badge: '기사', badgeBg: 'bg-slate-700', isSocial: false },
              vertical_curation: { badge: 'X', badgeBg: 'bg-black', isSocial: true },
              brand_corporate: { badge: '공식', badgeBg: 'bg-indigo-600', isSocial: true },
              creator_newsletter: { badge: '뉴스레터', badgeBg: 'bg-amber-600', isSocial: false },
            };
            const u = UI[ct];
            const initial = channelName.charAt(0) || '·';
            return (
              <div className="rounded-2xl border border-white/70 bg-white/90 p-4 shadow-sm backdrop-blur-md">
                <div className="mb-2.5 flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs text-white">{initial}</div>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1 text-sm font-bold text-slate-900">
                      {channelName}
                      <svg className="h-3.5 w-3.5 text-green-500" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zm3.54 6.54l-4 4a.75.75 0 0 1-1.06 0l-2-2a.75.75 0 1 1 1.06-1.06L7 8.94l3.47-3.47a.75.75 0 1 1 1.07 1.07z" />
                      </svg>
                    </p>
                    <p className="truncate text-xs text-slate-400">{u.isSocial ? handle : (profile?.character || channelName)}</p>
                  </div>
                  <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-mono font-bold text-white ${u.badgeBg}`}>{u.badge}</span>
                </div>
                <p className="text-sm font-semibold leading-snug text-slate-900">{stripHtml(headline) || '헤드라인'}</p>
                <p className={`mt-1.5 text-xs leading-relaxed text-slate-600 ${u.isSocial ? 'line-clamp-6' : ''}`}>
                  {stripHtml(body).slice(0, u.isSocial ? 240 : 600) || '본문 미리보기'}
                </p>
                <p className="mt-2.5 text-xs text-indigo-500">{tags.map(t => `#${t}`).join(' ')}</p>
                {u.isSocial && (
                  <div className="mt-3 flex items-center gap-5 border-t border-slate-100 pt-2.5 text-[11px] font-mono text-slate-400">
                    <span>💬 0</span><span>🔁 0</span><span>♥ 0</span><span>📊 0</span>
                  </div>
                )}
              </div>
            );
          })()}
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
