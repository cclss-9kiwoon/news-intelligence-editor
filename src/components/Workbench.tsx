import { useEffect, useState } from 'react';
import { Loader2, Sparkles, AlertOctagon, ChevronLeft, ChevronRight, RotateCw } from 'lucide-react';
import { useClusters } from '../state/ClustersContext';
import { useConversion } from '../state/ConversionContext';
import { useSettings } from '../state/SettingsContext';

type Props = {
  onMissingKey: () => void;
};

export function Workbench({ onMissingKey }: Props) {
  const { selectedCluster, selectedArticles } = useClusters();
  const { settings } = useSettings();
  const { status, error, currentResult, convert, regenerateChannels, clearError } = useConversion();

  const [sourceIdx, setSourceIdx] = useState(0);
  const [draftEdit, setDraftEdit] = useState('');
  const [draftDirty, setDraftDirty] = useState(false);

  useEffect(() => {
    setSourceIdx(0);
  }, [selectedCluster?.id]);

  useEffect(() => {
    if (currentResult) {
      setDraftEdit(currentResult.editedDraft ?? currentResult.englishDraft);
      setDraftDirty(false);
    } else {
      setDraftEdit('');
      setDraftDirty(false);
    }
  }, [currentResult?.id, currentResult?.englishDraft, currentResult?.editedDraft]);

  const triggerConvert = () => {
    if (selectedArticles.length === 0) return;
    if (!settings.apiKey) { onMissingKey(); return; }
    convert(selectedArticles);
  };

  const triggerRegenerate = () => {
    if (!currentResult) return;
    if (!settings.apiKey) { onMissingKey(); return; }
    regenerateChannels(draftEdit);
    setDraftDirty(false);
  };

  const onDraftChange = (v: string) => {
    setDraftEdit(v);
    setDraftDirty(currentResult ? v !== (currentResult.editedDraft ?? currentResult.englishDraft) : false);
  };

  const totalSources = selectedArticles.length;
  const currentSource = selectedArticles[sourceIdx];

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2">
        <h2 className="min-w-0 truncate text-sm font-semibold">
          {selectedCluster
            ? `📝 ${selectedCluster.representativeTitle} · ${totalSources}개 소스`
            : '👈 왼쪽에서 사건을 선택하세요'}
        </h2>
        <button
          disabled={!selectedCluster || status === 'converting' || status === 'regenerating'}
          onClick={triggerConvert}
          className="flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {status === 'converting' ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {status === 'converting' ? '종합 변환 중…' : '가치 평가 & 종합 변환'}
        </button>
      </div>

      {error && error !== 'NO_API_KEY' && (
        <div className="flex items-start gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          <AlertOctagon size={16} className="mt-0.5 flex-none" />
          <span className="flex-1">{error}</span>
          <button onClick={clearError} className="text-xs underline">닫기</button>
        </div>
      )}

      <div className="grid flex-1 min-h-0 grid-cols-2 gap-2 overflow-hidden p-3">
        <div className="flex min-h-0 flex-col rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-1.5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              원문 (한국어) {totalSources > 0 && `${sourceIdx + 1}/${totalSources}`}
            </h3>
            {totalSources > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setSourceIdx(i => (i - 1 + totalSources) % totalSources)}
                  className="rounded p-1 hover:bg-slate-100"
                  aria-label="이전 소스"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  onClick={() => setSourceIdx(i => (i + 1) % totalSources)}
                  className="rounded p-1 hover:bg-slate-100"
                  aria-label="다음 소스"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-3">
            {currentSource ? (
              <>
                <div className="mb-2 text-xs text-slate-500">
                  <span className="rounded bg-slate-100 px-1.5">{currentSource.source}</span>
                  {currentSource.pubDate && <span className="ml-2">{currentSource.pubDate}</span>}
                </div>
                <div className="mb-2 text-sm font-medium text-slate-900">{currentSource.title}</div>
                <div className="whitespace-pre-wrap text-sm text-slate-800">
                  {currentSource.fullText || currentSource.description || '—'}
                </div>
                {currentSource.link && !currentSource.link.startsWith('manual://') && !currentSource.link.startsWith('simulator://') && (
                  <a href={currentSource.link} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-indigo-600 hover:underline">
                    원문 보기 ↗
                  </a>
                )}
              </>
            ) : <span className="text-sm text-slate-400">—</span>}
          </div>
        </div>

        <div className="flex min-h-0 flex-col rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-1.5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              영문 종합 드래프트 · 가치 {currentResult?.valueScore ?? '—'}/10
              {draftDirty && <span className="ml-2 rounded bg-amber-100 px-1.5 text-amber-700 normal-case">수정됨</span>}
            </h3>
            <button
              onClick={triggerRegenerate}
              disabled={!currentResult || !draftDirty || status === 'converting' || status === 'regenerating'}
              className="flex items-center gap-1 rounded-md bg-amber-600 px-2 py-1 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
              title="편집한 드래프트로 3채널 출력 다시 생성"
            >
              {status === 'regenerating' ? <Loader2 size={12} className="animate-spin" /> : <RotateCw size={12} />}
              채널 재생성
            </button>
          </div>
          {currentResult ? (
            <>
              <p className="border-b border-slate-100 px-3 py-1.5 text-xs italic text-slate-500">
                {currentResult.valueReason}
              </p>
              <textarea
                value={draftEdit}
                onChange={e => onDraftChange(e.target.value)}
                className="flex-1 min-h-0 resize-none p-3 text-sm text-slate-800 outline-none"
                placeholder="여기에 영문 드래프트가 생성되면 직접 편집할 수 있습니다."
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
              사건을 선택하고 위의 버튼을 눌러 종합 변환을 시작하세요.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
