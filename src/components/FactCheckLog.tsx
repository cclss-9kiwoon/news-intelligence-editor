import { Info } from 'lucide-react';
import { useConversion } from '../state/ConversionContext';

const CATEGORY_LABELS: Record<string, string> = {
  people: '인물', numbers: '숫자', places: '장소', dates: '날짜',
};

const CATEGORY_COLOR: Record<string, string> = {
  people: 'bg-indigo-100 text-indigo-800',
  numbers: 'bg-emerald-100 text-emerald-800',
  places: 'bg-amber-100 text-amber-800',
  dates: 'bg-rose-100 text-rose-800',
};

export function FactCheckLog() {
  const { currentResult } = useConversion();
  if (!currentResult) return null;
  const { facts } = currentResult;
  const allEmpty = (['people', 'numbers', 'places', 'dates'] as const).every(k => facts[k].length === 0);
  if (allEmpty) return null;

  return (
    <div className="border-y border-slate-200 bg-slate-50 px-4 py-2 text-xs">
      <div className="mb-1 flex items-center gap-1.5 text-slate-600">
        <Info size={14} />
        <span className="font-semibold">원본에서 추출된 팩트 — 채널 출력에 포함되도록 LLM에 전달했습니다 (참고용)</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {(['people', 'numbers', 'places', 'dates'] as const).flatMap(cat =>
          facts[cat].map((v, i) => (
            <span key={`${cat}-${i}`} className={'rounded px-2 py-0.5 ' + CATEGORY_COLOR[cat]}>
              <span className="mr-1 text-[10px] uppercase opacity-70">{CATEGORY_LABELS[cat]}</span>
              {v}
            </span>
          ))
        )}
      </div>
    </div>
  );
}
