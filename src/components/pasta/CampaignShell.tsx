import { useState } from 'react';
import type { Campaign } from '../../types';
import { useCampaigns } from '../../state/CampaignContext';
import { useArticles } from '../../state/ArticlesContext';
import { KanbanBoard } from './KanbanBoard';
import { StatusView } from './views/StatusView';
import { PublishedView } from './views/PublishedView';
import { DiscardedView } from './views/DiscardedView';
import { IconBoard, IconChart, IconSend, IconTrash, IconRefresh, IconBolt, IconSettings, IconWrench, IconArrowLeft } from './icons';
import type { ReactElement } from 'react';

type ShellView = 'board' | 'status' | 'published' | 'discarded';

const INTERVALS: (15 | 30 | 60)[] = [15, 30, 60];

const NAV: { id: ShellView; Icon: (p: { className?: string }) => ReactElement; label: string }[] = [
  { id: 'board', Icon: IconBoard, label: '보드' },
  { id: 'status', Icon: IconChart, label: '현황' },
  { id: 'published', Icon: IconSend, label: '발행함' },
  { id: 'discarded', Icon: IconTrash, label: '폐기함' },
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
  const { isRefreshing, refreshNow } = useArticles();
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
          <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium">
            <span className={`h-1.5 w-1.5 rounded-full ${auto.enabled ? 'animate-pulse bg-green-500' : 'bg-slate-300'}`} />
            <span className={auto.enabled ? 'text-green-600' : 'text-slate-400'}>{auto.enabled ? '활성' : '일시정지'}</span>
          </p>
        </div>

        {/* 운영 */}
        <div className="border-b border-slate-100 px-3 py-3">
          <p className="mb-2 px-1 text-[10px] font-mono uppercase tracking-wide text-slate-400">운영</p>
          <button
            onClick={refreshNow}
            disabled={isRefreshing}
            className="mb-2 flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-700 disabled:opacity-40 transition-colors"
          >
            <IconRefresh className={`h-4 w-4 ${isRefreshing ? 'animate-spin motion-reduce:animate-none' : ''}`} />
            {isRefreshing ? '수집 중…' : '지금 수집'}
          </button>
          <label className="flex items-center justify-between rounded-lg px-1 py-1 text-sm text-slate-600">
            <span className="flex items-center gap-1.5"><IconBolt className="h-3.5 w-3.5 text-slate-400" /> 자동 수집(주기)</span>
            <input type="checkbox" className="accent-slate-900" checked={auto.enabled}
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
              className={`mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition-colors ${
                view === n.id ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
            ><n.Icon className="h-4 w-4 shrink-0" />{n.label}</button>
          ))}
        </nav>

        {/* 하단 */}
        <div className="border-t border-slate-100 px-3 py-3">
          <button onClick={onOpenSettings} className="mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-slate-600 hover:bg-slate-100 transition-colors"><IconSettings className="h-4 w-4 shrink-0 text-slate-400" /> 캠페인 설정</button>
          <button onClick={onOpenWorkbench} className="mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-slate-600 hover:bg-slate-100 transition-colors"><IconWrench className="h-4 w-4 shrink-0 text-slate-400" /> 수동 워크벤치</button>
          <button onClick={onBackToList} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-slate-500 hover:bg-slate-100 transition-colors"><IconArrowLeft className="h-4 w-4 shrink-0" /> 캠페인 목록</button>
        </div>
      </aside>

      {/* 본문 */}
      <main className="min-w-0 flex-1">
        {view === 'board' && <KanbanBoard campaignId={campaign.id} onOpenTask={onOpenTask} />}
        {view === 'status' && <StatusView campaignId={campaign.id} onOpenTask={onOpenTask} />}
        {view === 'published' && <PublishedView campaignId={campaign.id} onOpenTask={onOpenTask} />}
        {view === 'discarded' && <DiscardedView campaignId={campaign.id} />}
      </main>
    </div>
  );
}
