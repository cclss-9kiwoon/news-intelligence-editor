import { X, Trash2 } from 'lucide-react';
import { useHistory } from '../state/HistoryContext';
import { useConversion } from '../state/ConversionContext';

type Props = { open: boolean; onClose: () => void };

export function HistoryPanel({ open, onClose }: Props) {
  const { history, removeEntry } = useHistory();
  const { loadResult } = useConversion();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex" onClick={onClose}>
      <div className="flex-1 bg-black/30" />
      <aside
        className="w-96 bg-white shadow-2xl overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sticky top-0 bg-white">
          <h2 className="font-semibold">📜 변환 이력 ({history.length}/20)</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        {history.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-slate-400">아직 이력이 없습니다.</p>
        )}

        <ul>
          {history.map(h => (
            <li
              key={h.id}
              className="border-b border-slate-100 px-4 py-3 hover:bg-slate-50 cursor-pointer"
              onClick={() => { loadResult(h); onClose(); }}
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span>{new Date(h.createdAt).toLocaleString('ko-KR')}</span>
                    <span
                      className={
                        'rounded px-1.5 font-semibold ' +
                        (h.valueDecision === 'Pass'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700')
                      }
                    >
                      {h.valueDecision === 'Pass' ? '✅ Pass' : '⚠️ Fail'}
                    </span>
                  </div>
                  <div className="mt-0.5 text-sm font-medium truncate">{h.sourceTitle}</div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); removeEntry(h.id); }}
                  className="rounded p-1 text-red-600 hover:bg-red-50"
                  aria-label="삭제"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
