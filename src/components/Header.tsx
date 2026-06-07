import { Settings, History, Bell, BookOpen, HelpCircle } from 'lucide-react';
import { useBreaking } from '../state/BreakingContext';

type Props = {
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  onOpenGuide: () => void;
  onOpenTutorial: () => void;
};

export function Header({ onOpenSettings, onOpenHistory, onOpenGuide, onOpenTutorial }: Props) {
  const { alerts } = useBreaking();
  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-2.5 shadow-sm">
      <div className="flex items-center gap-3">
        {/* Logo mark */}
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 4h12M2 8h8M2 12h10" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold tracking-tight text-slate-900">News Intelligence Editor</span>
          <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-600">MVP</span>
        </div>
        <button
          onClick={onOpenTutorial}
          className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 transition-colors"
          title="튜토리얼 — 단계별 안내"
          aria-label="튜토리얼"
        >
          <HelpCircle size={15} />
        </button>
      </div>

      <div className="flex items-center gap-1" data-tutorial="header-actions">
        <button
          onClick={onOpenGuide}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          title="상세 가이드"
        >
          <BookOpen size={14} />
          가이드
        </button>
        <button
          onClick={onOpenHistory}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
        >
          <History size={14} />
          이력
        </button>
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
        >
          <Settings size={14} />
          설정
        </button>
        <div className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${alerts.length > 0 ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
          <Bell size={12} />
          {alerts.length}
        </div>
      </div>
    </header>
  );
}
