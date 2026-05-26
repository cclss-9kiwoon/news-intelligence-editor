import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { X } from 'lucide-react';
import { GUIDE_SECTIONS } from '../data/guideContent';

type Props = {
  open: boolean;
  onClose: () => void;
};

export function GuideModal({ open, onClose }: Props) {
  const [activeId, setActiveId] = useState(GUIDE_SECTIONS[0].id);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const active = GUIDE_SECTIONS.find(s => s.id === activeId) || GUIDE_SECTIONS[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex h-[90vh] w-full max-w-5xl overflow-hidden rounded-lg bg-white shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <nav className="flex w-56 min-w-56 flex-col border-r border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 className="text-base font-semibold">📖 가이드</h2>
          </div>
          <ul className="flex-1 overflow-y-auto py-2">
            {GUIDE_SECTIONS.map(s => (
              <li key={s.id}>
                <button
                  onClick={() => setActiveId(s.id)}
                  className={
                    'block w-full px-4 py-1.5 text-left text-sm ' +
                    (activeId === s.id
                      ? 'bg-indigo-100 font-semibold text-indigo-800'
                      : 'text-slate-700 hover:bg-slate-100')
                  }
                >
                  {s.title}
                </button>
              </li>
            ))}
          </ul>
          <p className="border-t border-slate-200 px-4 py-2 text-xs text-slate-400">
            ESC 또는 ✕ 로 닫기
          </p>
        </nav>

        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
            <h3 className="text-lg font-semibold">{active.title}</h3>
            <button onClick={onClose} className="rounded p-1 hover:bg-slate-100" aria-label="닫기">
              <X size={18} />
            </button>
          </div>
          <div className="prose prose-sm max-w-none flex-1 overflow-y-auto p-6
            prose-headings:font-semibold prose-h2:text-xl prose-h2:mt-0 prose-h2:mb-4
            prose-h3:text-base prose-h3:mt-5 prose-h3:mb-2
            prose-p:my-2 prose-li:my-0.5
            prose-table:text-sm prose-th:bg-slate-100 prose-th:font-semibold prose-th:px-3 prose-th:py-1.5
            prose-td:px-3 prose-td:py-1.5
            prose-code:rounded prose-code:bg-slate-100 prose-code:px-1 prose-code:py-0.5 prose-code:text-xs prose-code:font-mono prose-code:before:content-none prose-code:after:content-none
            prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-pre:rounded prose-pre:p-3 prose-pre:text-xs
          ">
            <ReactMarkdown>{active.body}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}
