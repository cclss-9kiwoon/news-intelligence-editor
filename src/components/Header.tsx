import { Settings, History, Bell } from 'lucide-react';
import { useBreaking } from '../state/BreakingContext';

type Props = {
  onOpenSettings: () => void;
  onOpenHistory: () => void;
};

export function Header({ onOpenSettings, onOpenHistory }: Props) {
  const { alerts } = useBreaking();
  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
      <div className="flex items-center gap-2">
        <span className="text-xl font-bold">📰 News Intelligence Editor</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">MVP</span>
      </div>
      <div className="flex items-center gap-2">
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
