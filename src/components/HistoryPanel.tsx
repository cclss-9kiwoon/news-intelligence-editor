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
                  <div className="text-xs text-slate-500">
                    {new Date(h.createdAt).toLocaleString('ko-KR')} · {h.stylePreset} · 가치 {h.valueScore}/10
                  </div>
                  <div className="mt-0.5 text-sm font-medium truncate">{h.sourceTitle}</div>
                  <div className="mt-0.5 flex flex-wrap gap-1 text-xs">
                    {h.channelsGenerated.ko && <span className="rounded bg-slate-100 px-1.5 text-slate-700">KO 채널</span>}
                    {h.channelsGenerated.en && <span className="rounded bg-slate-100 px-1.5 text-slate-700">EN 채널</span>}
                    {(h.bannedHits.en.site.length + h.bannedHits.en.x.length + h.bannedHits.en.medium.length) > 0 && (
                      <span className="rounded bg-amber-100 px-1.5 text-amber-700">금지어</span>
                    )}
                  </div>
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
