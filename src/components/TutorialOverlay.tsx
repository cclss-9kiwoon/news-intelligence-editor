import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X, BookOpen } from 'lucide-react';
import { TUTORIAL_STEPS } from '../data/guideContent';

const HIGHLIGHT_CLASS = 'nie-tutorial-highlight';

function applyHighlight(selector: string | undefined) {
  document.querySelectorAll('.' + HIGHLIGHT_CLASS).forEach(el => el.classList.remove(HIGHLIGHT_CLASS));
  if (!selector) return;
  const el = document.querySelector(selector);
  if (el) {
    el.classList.add(HIGHLIGHT_CLASS);
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }
}

function clearHighlight() {
  document.querySelectorAll('.' + HIGHLIGHT_CLASS).forEach(el => el.classList.remove(HIGHLIGHT_CLASS));
}

type Props = {
  open: boolean;
  onClose: () => void;
  onOpenGuide: () => void;
};

export function TutorialOverlay({ open, onClose, onOpenGuide }: Props) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!open) { clearHighlight(); return; }
    setIdx(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    applyHighlight(TUTORIAL_STEPS[idx]?.targetSelector);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { clearHighlight(); onClose(); }
      else if (e.key === 'ArrowRight') setIdx(i => Math.min(i + 1, TUTORIAL_STEPS.length - 1));
      else if (e.key === 'ArrowLeft') setIdx(i => Math.max(i - 1, 0));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, idx, onClose]);

  useEffect(() => () => clearHighlight(), []);

  if (!open) return null;

  const step = TUTORIAL_STEPS[idx];
  const total = TUTORIAL_STEPS.length;
  const isLast = idx === total - 1;

  return (
    <div className="pointer-events-none fixed inset-0 z-[60]">
      <div
        className="pointer-events-auto absolute bottom-6 left-1/2 w-[480px] max-w-[92vw] -translate-x-1/2 rounded-xl border border-indigo-200 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
            튜토리얼 · {idx + 1} / {total}
          </span>
          <button
            onClick={() => { clearHighlight(); onClose(); }}
            className="rounded p-1 text-slate-400 hover:bg-slate-100"
            aria-label="닫기"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4">
          <h3 className="mb-2 text-base font-bold text-slate-900">{step.title}</h3>
          <p className="whitespace-pre-line text-sm leading-6 text-slate-700">{step.body}</p>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2">
          <div className="flex items-center gap-1">
            {TUTORIAL_STEPS.map((_, i) => (
              <span
                key={i}
                className={
                  'h-1.5 w-1.5 rounded-full ' +
                  (i === idx ? 'bg-indigo-600' : i < idx ? 'bg-indigo-300' : 'bg-slate-200')
                }
              />
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIdx(i => Math.max(i - 1, 0))}
              disabled={idx === 0}
              className="flex items-center gap-0.5 rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-30"
            >
              <ChevronLeft size={14} /> 이전
            </button>
            {!isLast ? (
              <button
                onClick={() => setIdx(i => Math.min(i + 1, total - 1))}
                className="flex items-center gap-0.5 rounded bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                다음 <ChevronRight size={14} />
              </button>
            ) : (
              <button
                onClick={() => { clearHighlight(); onClose(); onOpenGuide(); }}
                className="flex items-center gap-1 rounded bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                <BookOpen size={12} />
                상세 가이드 보기
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
