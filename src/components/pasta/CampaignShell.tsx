import { useState } from 'react';
import type { Campaign } from '../../types';
import { useCampaigns } from '../../state/CampaignContext';
import { useArticles } from '../../state/ArticlesContext';
import { useTasks } from '../../state/TaskContext';
import { KanbanBoard } from './KanbanBoard';

type ShellView = 'board' | 'status' | 'published' | 'discarded';

const INTERVALS: (15 | 30 | 60)[] = [15, 30, 60];

const NAV: { id: ShellView; icon: string; label: string }[] = [
  { id: 'board', icon: '▦', label: '보드' },
  { id: 'status', icon: '📊', label: '현황' },
  { id: 'published', icon: '📤', label: '발행함' },
  { id: 'discarded', icon: '🗑', label: '폐기함' },
];

/**
 * 캠페인 메인 셸 — 좌측 운영 레일 + 우측 뷰(보드/현황/발행함/폐기함).
 * 설정 끝난 캠페인 진입 시 메인 화면. 보드가 기본.
 */
export function CampaignShell({ campaign, onBackToList, onOpenSettings, onOpenTask, onOpenWorkbench }: {
  campaign: Campaign;
  onBackToList: () => void;
  onOpenSettings: () => void;
  onOpenTask: (taskId: string) => void;
  onOpenWorkbench: () => void;
}) {
  const [view, setView] = useState<ShellView>('board');
  const { setCampaignAutoCollect } = useCampaigns();
  const { isRefreshing, refreshNow, lastRefreshedAt, articles } = useArticles();
  const auto = campaign.autoCollect ?? { enabled: true, intervalMin: 30 as const };

  return (
    <div className="flex h-screen bg-white">
      {/* 좌측 레일 */}
      <aside className="flex w-[220px] shrink-0 flex-col border-r border-slate-200 bg-white/80 backdrop-blur-md">
        {/* 헤더 */}
        <div className="border-b border-slate-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-900 text-xs">🍝</span>
            <span className="truncate font-bold text-slate-900">{campaign.name}</span>
          </div>
          <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
            <span className={auto.enabled ? 'text-green-500' : 'text-slate-400'}>{auto.enabled ? '● 활성' : '⏸ 일시정지'}</span>
          </p>
        </div>

        {/* 운영 */}
        <div className="border-b border-slate-100 px-3 py-3">
          <p className="mb-2 px-1 text-[10px] font-mono uppercase tracking-wide text-slate-400">운영</p>
          <button
            onClick={refreshNow}
            disabled={isRefreshing}
            className="mb-2 flex w-full items-center gap-2 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-40 transition-colors"
          >{isRefreshing ? '수집 중…' : '▶ 지금 수집'}</button>
          <label className="flex items-center justify-between rounded-lg px-1 py-1 text-sm text-slate-600">
            <span>⏯ 자동 수집</span>
            <input type="checkbox" checked={auto.enabled}
              onChange={e => setCampaignAutoCollect(campaign.id, { enabled: e.target.checked })} />
          </label>
          <div className={`mt-1 flex gap-1 transition-opacity ${auto.enabled ? '' : 'pointer-events-none opacity-40'}`}>
            {INTERVALS.map(m => (
              <button key={m}
                onClick={() => setCampaignAutoCollect(campaign.id, { intervalMin: m })}
                className={`flex-1 rounded-md border px-1 py-1 text-xs font-semibold transition-colors ${
                  auto.intervalMin === m ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >{m}분</button>
            ))}
          </div>
        </div>

        {/* 보기 */}
        <nav className="flex-1 px-3 py-3">
          <p className="mb-2 px-1 text-[10px] font-mono uppercase tracking-wide text-slate-400">보기</p>
          {NAV.map(n => (
            <button key={n.id}
              onClick={() => setView(n.id)}
              className={`mb-0.5 flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors ${
                view === n.id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            ><span>{n.icon}</span>{n.label}</button>
          ))}
        </nav>

        {/* 하단 */}
        <div className="border-t border-slate-100 px-3 py-3">
          <button onClick={onOpenSettings} className="mb-0.5 flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm text-slate-600 hover:bg-slate-100 transition-colors">⚙ 캠페인 설정</button>
          <button onClick={onOpenWorkbench} className="mb-0.5 flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm text-slate-600 hover:bg-slate-100 transition-colors">🛠 수동 워크벤치</button>
          <button onClick={onBackToList} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm text-slate-500 hover:bg-slate-100 transition-colors">← 캠페인 목록</button>
        </div>
      </aside>

      {/* 본문 */}
      <main className="min-w-0 flex-1">
        {view === 'board' && <KanbanBoard campaignId={campaign.id} onOpenTask={onOpenTask} />}
        {view === 'status' && <StatusPlaceholder campaignId={campaign.id} lastRefreshedAt={lastRefreshedAt} articleCount={articles.length} />}
        {view === 'published' && <PublishedPlaceholder campaignId={campaign.id} onOpenTask={onOpenTask} />}
        {view === 'discarded' && <DiscardedPlaceholder campaignId={campaign.id} />}
      </main>
    </div>
  );
}

// ── 임시 인라인 뷰 (NIE_개발 views/ 컴포넌트 랜딩 시 교체) ──

function ViewFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="h-full overflow-y-auto p-6">
      <h2 className="mb-4 text-lg font-bold text-slate-800">{title}</h2>
      {children}
    </div>
  );
}

function StatusPlaceholder({ campaignId, lastRefreshedAt, articleCount }: { campaignId: string; lastRefreshedAt: number | null; articleCount: number }) {
  const { tasks } = useTasks();
  const mine = tasks.filter(t => t.campaignId === campaignId);
  const active = mine.filter(t => !t.published && !t.discardReason);
  const count = (s: string) => active.filter(t => t.status === s).length;
  const since = (() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime();
  })();
  const todayMade = mine.filter(t => t.createdAt >= since).length;
  const todayPub = mine.filter(t => t.publishedAt && t.publishedAt >= since).length;
  const todayDisc = mine.filter(t => t.discardReason && t.updatedAt >= since).length;
  const reached = mine.filter(t => t.status === 'final_review' || t.published).length;
  const passed = mine.filter(t => t.review?.passed).length;
  const rate = reached > 0 ? Math.round((passed / reached) * 100) : 0;
  const cell = 'rounded-xl border border-slate-200 bg-white/70 p-4';
  return (
    <ViewFrame title="📊 현황">
      <div className="grid grid-cols-4 gap-3">
        {(['searching', 'topic_review', 'producing', 'final_review'] as const).map(s => (
          <div key={s} className={cell}><p className="text-xs text-slate-400">{({ searching: '기사 찾기', topic_review: '주제 검수', producing: '기사 작성', final_review: '최종 검수' } as Record<string, string>)[s]}</p><p className="mt-1 text-2xl font-bold text-slate-800">{count(s)}</p></div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <div className={cell}><p className="text-xs text-slate-400">오늘 생성</p><p className="mt-1 text-2xl font-bold text-slate-800">{todayMade}</p></div>
        <div className={cell}><p className="text-xs text-slate-400">오늘 발행</p><p className="mt-1 text-2xl font-bold text-green-600">{todayPub}</p></div>
        <div className={cell}><p className="text-xs text-slate-400">오늘 폐기</p><p className="mt-1 text-2xl font-bold text-slate-500">{todayDisc}</p></div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className={cell}><p className="text-xs text-slate-400">검수 통과율</p><p className="mt-1 text-2xl font-bold text-slate-800">{rate}%</p><p className="text-[11px] text-slate-400">{passed}/{reached} 통과</p></div>
        <div className={cell}><p className="text-xs text-slate-400">마지막 수집</p><p className="mt-1 text-sm font-semibold text-slate-700">{lastRefreshedAt ? new Date(lastRefreshedAt).toLocaleTimeString('ko-KR') : '—'}</p><p className="text-[11px] text-slate-400">수집 기사 {articleCount}건</p></div>
      </div>
    </ViewFrame>
  );
}

function PublishedPlaceholder({ campaignId, onOpenTask }: { campaignId: string; onOpenTask: (taskId: string) => void }) {
  const { tasks } = useTasks();
  const pub = tasks.filter(t => t.campaignId === campaignId && t.published)
    .sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0));
  return (
    <ViewFrame title={`📤 발행함 (${pub.length})`}>
      {pub.length === 0 ? <p className="text-sm text-slate-400">🍃 발행된 기사가 없습니다.</p> : (
        <div className="space-y-1">
          {pub.map(t => (
            <button key={t.id} onClick={() => onOpenTask(t.id)} className="flex w-full items-center justify-between rounded-lg border border-slate-100 bg-white/60 px-3 py-2 text-left text-sm hover:bg-white">
              <span className="truncate text-slate-700">📄 {t.title}</span>
              <span className="ml-2 shrink-0 text-xs text-slate-400">{t.publishedAt ? new Date(t.publishedAt).toLocaleString('ko-KR') : ''} · <span className="text-slate-300">Hydra 미연결</span></span>
            </button>
          ))}
        </div>
      )}
    </ViewFrame>
  );
}

function DiscardedPlaceholder({ campaignId }: { campaignId: string }) {
  const { tasks, updateTask, deleteTask } = useTasks();
  const disc = tasks.filter(t => t.campaignId === campaignId && t.discardReason);
  const LABEL: Record<string, string> = { low_quality: '품질 부족', off_topic: '주제 부적합', duplicate: '중복', other: '기타' };
  return (
    <ViewFrame title={`🗑 폐기함 (${disc.length})`}>
      {disc.length === 0 ? <p className="text-sm text-slate-400">🍃 폐기된 기사가 없습니다.</p> : (
        <div className="space-y-1">
          {disc.map(t => (
            <div key={t.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-white/60 px-3 py-2 text-sm">
              <span className="min-w-0 truncate text-slate-600">📄 {t.title} <span className="ml-1 rounded-full bg-slate-100 px-1.5 text-[11px] text-slate-500">{LABEL[t.discardReason!] ?? t.discardReason}</span></span>
              <span className="ml-2 flex shrink-0 items-center gap-2">
                <button onClick={() => updateTask(t.id, { discardReason: undefined })} className="text-xs text-indigo-500 hover:underline">복원</button>
                <button onClick={() => { if (confirm('영구 삭제하시겠습니까? 되돌릴 수 없습니다.')) deleteTask(t.id); }} className="text-xs text-red-400 hover:text-red-600">영구삭제</button>
              </span>
            </div>
          ))}
        </div>
      )}
    </ViewFrame>
  );
}
