import { AlertTriangle, X, ArrowRight } from 'lucide-react';
import { useBreaking } from '../state/BreakingContext';

export function AlertBanner() {
  const { alerts, dismissAlert, jumpToAlert } = useBreaking();
  if (alerts.length === 0) return null;
  const top = alerts[0];

  return (
    <div className="flex animate-pulse-fast items-center justify-between gap-4 bg-red-600 px-6 py-3 text-white">
      <div className="flex items-center gap-3 min-w-0">
        <AlertTriangle size={20} className="flex-none" />
        <div className="min-w-0">
          <span className="mr-2 rounded bg-red-800 px-2 py-0.5 text-xs uppercase tracking-wider">
            {top.severity}
          </span>
          <span className="truncate font-semibold">{top.article.title}</span>
          {top.article.inputType === 'simulator' && (
            <span className="ml-2 text-xs opacity-80">🧪 시뮬레이션</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-none">
        <button
          onClick={() => jumpToAlert(top)}
          className="flex items-center gap-1 rounded-md bg-white px-3 py-1 text-sm font-semibold text-red-700 hover:bg-red-50"
        >
          지금 변환 <ArrowRight size={14} />
        </button>
        <button
          onClick={() => dismissAlert(top.article.id)}
          className="rounded-md p-1 hover:bg-red-700"
          aria-label="닫기"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
