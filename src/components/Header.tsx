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
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
      <div className="flex items-center gap-2">
        <span className="text-xl font-bold">📰 News Intelligence Editor</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">MVP</span>
        <button
          onClick={onOpenTutorial}
          className="ml-1 rounded-full p-1 text-indigo-600 hover:bg-indigo-50"
          title="튜토리얼 — 단계별 안내"
          aria-label="튜토리얼"
        >
          <HelpCircle size={18} />
        </button>
      </div>
      <div className="flex items-center gap-2" data-tutorial="header-actions">
        <button
          onClick={onOpenGuide}
          className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm hover:bg-slate-100"
          title="상세 가이드"
        >
          <BookOpen size={16} />
          가이드
        </button>
        <button
          onClick={onOpenHistory}
          className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm hover:bg-slate-100"
        >
          <History size={16} />
          이력
        </button>
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm hover:bg-slate-100"
        >
          <Settings size={16} />
          설정
        </button>
        <div className="flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs">
          <Bell size={14} />
          {alerts.length}
        </div>
      </div>
    </header>
  );
}
