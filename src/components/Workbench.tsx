import { Loader2, Sparkles, AlertOctagon } from 'lucide-react';
import { useArticles } from '../state/ArticlesContext';
import { useConversion } from '../state/ConversionContext';
import { useSettings } from '../state/SettingsContext';

type Props = {
  onMissingKey: () => void;
};

export function Workbench({ onMissingKey }: Props) {
  const { selectedArticle } = useArticles();
  const { settings } = useSettings();
  const { status, error, currentResult, convert, clearError } = useConversion();

  const trigger = () => {
    if (!selectedArticle) return;
    if (!settings.apiKey) { onMissingKey(); return; }
    convert(selectedArticle);
  };

  return (
    <section className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2">
        <h2 className="text-sm font-semibold">
          {selectedArticle ? `📝 ${selectedArticle.title}` : '👈 기사를 선택하세요'}
        </h2>
        <button
          disabled={!selectedArticle || status === 'converting'}
          onClick={trigger}
          className="flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {status === 'converting' ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {status === 'converting' ? '변환 중…' : '가치 평가 & 생성'}
        </button>
      </div>

      {error && error !== 'NO_API_KEY' && (
        <div className="flex items-start gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          <AlertOctagon size={16} className="mt-0.5 flex-none" />
          <span className="flex-1">{error}</span>
          <button onClick={clearError} className="text-xs underline">닫기</button>
        </div>
      )}

      <div className="grid flex-1 grid-cols-2 gap-2 overflow-y-auto p-3">
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">원문 (한국어)</h3>
          <div className="whitespace-pre-wrap text-sm text-slate-800">
            {selectedArticle?.fullText || selectedArticle?.description || '—'}
          </div>
          {selectedArticle?.link && !selectedArticle.link.startsWith('manual://') && !selectedArticle.link.startsWith('simulator://') && (
            <a href={selectedArticle.link} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-indigo-600 hover:underline">
              원문 보기 ↗
            </a>
          )}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            영문 변환 (가치 점수: {currentResult?.valueScore ?? '—'}/10)
          </h3>
          {currentResult && (
            <p className="mb-2 text-xs italic text-slate-500">{currentResult.valueReason}</p>
          )}
          <div className="whitespace-pre-wrap text-sm text-slate-800">
            {currentResult?.englishDraft || '—'}
          </div>
        </div>
      </div>
    </section>
  );
}
