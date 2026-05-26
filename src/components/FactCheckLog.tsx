import { ShieldAlert } from 'lucide-react';
import { useConversion } from '../state/ConversionContext';

const CATEGORY_LABELS: Record<string, string> = {
  people: '인물', numbers: '숫자', places: '장소', dates: '날짜',
};

export function FactCheckLog() {
  const { currentResult } = useConversion();
  if (!currentResult || currentResult.factReport.ok) return null;

  return (
    <div className="border-y border-red-300 bg-red-50 px-4 py-3">
      <div className="mb-2 flex items-center gap-2 font-semibold text-red-800">
        <ShieldAlert size={18} />
        🚨 Warning: Fact Mismatch Detected — 출력에 누락된 핵심 팩트가 있습니다.
      </div>
      <ul className="space-y-1 text-sm text-red-700">
        {currentResult.factReport.missing.map((m, i) => (
          <li key={i}>
            <span className="mr-2 rounded bg-red-200 px-1.5 py-0.5 text-xs font-semibold uppercase">
              {CATEGORY_LABELS[m.category] || m.category}
            </span>
            "{m.value}"
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-red-600">수동으로 누락된 정보를 확인하고 보정해주세요.</p>
    </div>
  );
}
