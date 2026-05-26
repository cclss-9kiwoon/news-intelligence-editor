import { useEffect, useState } from 'react';
import { Loader2, Sparkles, AlertOctagon, ChevronLeft, ChevronRight, RotateCw, Languages, ChevronUp, ChevronDown } from 'lucide-react';
import { useClusters } from '../state/ClustersContext';
import { useConversion } from '../state/ConversionContext';
import { useSettings } from '../state/SettingsContext';
import { PROVIDERS, type DraftLanguage } from '../types';

type Props = {
  onMissingKey: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
};

export function Workbench({ onMissingKey, collapsed = false, onToggleCollapsed }: Props) {
  const { selectedCluster, selectedArticles } = useClusters();
  const { settings, setModel } = useSettings();
  const {
    status, error, currentResult,
    analyze, setDraftText, switchLanguage, regenerateChannels, clearError,
  } = useConversion();

  const [sourceIdx, setSourceIdx] = useState(0);

  useEffect(() => { setSourceIdx(0); }, [selectedCluster?.id]);

  const triggerAnalyze = () => {
    if (selectedArticles.length === 0) return;
    if (!settings.apiKey) { onMissingKey(); return; }
    analyze(selectedArticles);
  };

  const triggerSwitchLang = (target: DraftLanguage) => {
    if (!currentResult) return;
    if (!settings.apiKey) { onMissingKey(); return; }
    switchLanguage(target);
  };

  const triggerRegenerate = () => {
    if (!currentResult) return;
    if (!settings.apiKey) { onMissingKey(); return; }
    regenerateChannels();
  };

  const totalSources = selectedArticles.length;
  const currentSource = selectedArticles[sourceIdx];

  const activeLang = currentResult?.activeLanguage ?? 'ko';
  const currentText = currentResult ? currentResult.drafts[activeLang] : '';
  const isBusy = status === 'analyzing' || status === 'translating' || status === 'generating';

  const statusLabel: Record<typeof status, string> = {
    idle: '',
    analyzing: '종합 분석 중…',
    translating: '번역 중…',
    generating: '채널 생성 중…',
    error: '',
  };

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div data-tutorial="workbench-header" className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-2">
        <div className="flex min-w-0 items-center gap-1">
          {onToggleCollapsed && (
            <button
              onClick={onToggleCollapsed}
              className="rounded p-1 text-slate-500 hover:bg-slate-100"
              title={collapsed ? '원문/드래프트 펼치기' : '원문/드래프트 접고 채널 출력 크게 보기'}
              aria-label={collapsed ? '펼치기' : '접기'}
            >
              {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </button>
          )}
          <h2 className="min-w-0 truncate text-sm font-semibold">
            {selectedCluster
              ? `📝 ${selectedCluster.representativeTitle} · ${totalSources}개 소스`
              : '👈 왼쪽에서 사건을 선택하세요'}
          </h2>
        </div>
        <div className="flex items-center gap-2 flex-none">
          <label className="flex items-center gap-1 text-xs text-slate-500">
            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold">{PROVIDERS[settings.provider].name}</span>
            <select
              value={settings.model}
              onChange={e => setModel(e.target.value)}
              className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs"
              title="모델 선택"
            >
              {PROVIDERS[settings.provider].models.map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
              {!PROVIDERS[settings.provider].models.some(m => m.id === settings.model) && (
                <option value={settings.model}>{settings.model} (custom)</option>
              )}
            </select>
          </label>
          <button
            disabled={!selectedCluster || isBusy}
            onClick={triggerAnalyze}
            className="flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {status === 'analyzing' ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {status === 'analyzing' ? '분석 중…' : '가치 평가 & 종합 (한국어)'}
          </button>
        </div>
      </div>

      {error && error !== 'NO_API_KEY' && (
        <div className="flex items-start gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 whitespace-pre-wrap">
          <AlertOctagon size={16} className="mt-0.5 flex-none" />
          <span className="flex-1">{error}</span>
          <button onClick={clearError} className="text-xs underline">닫기</button>
        </div>
      )}

      {collapsed && (
        <div className="bg-slate-50 px-4 py-2 text-xs text-slate-500">
          원문/드래프트 영역이 접혀있습니다. 위 ⌄ 버튼을 눌러 펼치세요.
        </div>
      )}

      <div className={(collapsed ? 'hidden ' : '') + 'grid flex-1 min-h-0 grid-cols-2 gap-2 overflow-hidden p-3'}>
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

        <div data-tutorial="draft-panel" className="flex min-h-0 flex-col rounded-lg border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-1.5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              종합 드래프트 · 가치 {currentResult?.valueScore ?? '—'}/10
              {isBusy && <span className="ml-2 text-indigo-600 normal-case">{statusLabel[status]}</span>}
            </h3>
            <div className="flex items-center gap-1">
              <div className="flex overflow-hidden rounded-md border border-slate-300 text-xs">
                {(['ko', 'en'] as DraftLanguage[]).map(lang => (
                  <button
                    key={lang}
                    onClick={() => triggerSwitchLang(lang)}
                    disabled={!currentResult || isBusy}
                    className={
                      'px-2 py-1 ' +
                      (activeLang === lang
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-100') +
                      (!currentResult || isBusy ? ' opacity-50 cursor-not-allowed' : '')
                    }
                    title={lang === 'ko' ? '한국어 보기' : '영문 보기 (없으면 자동 번역)'}
                  >
                    {lang === 'ko' ? 'KO' : 'EN'}
                    {currentResult && !currentResult.drafts[lang].trim() && activeLang !== lang && (
                      <Languages size={10} className="ml-1 inline" />
                    )}
                  </button>
                ))}
              </div>
              <button
                onClick={triggerRegenerate}
                disabled={!currentResult || isBusy}
                className="flex items-center gap-1 rounded-md bg-amber-600 px-2 py-1 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                title="현재 언어 드래프트로 3채널 출력 (재)생성"
              >
                {status === 'generating' ? <Loader2 size={12} className="animate-spin" /> : <RotateCw size={12} />}
                {currentResult?.channelsGenerated[activeLang] ? `${activeLang.toUpperCase()} 채널 재생성` : `${activeLang.toUpperCase()} 채널 생성`}
              </button>
            </div>
          </div>
          {currentResult ? (
            <>
              <p className="border-b border-slate-100 px-3 py-1.5 text-xs italic text-slate-500">
                {currentResult.valueReason}
              </p>
              <textarea
                value={currentText}
                onChange={e => setDraftText(e.target.value)}
                className="flex-1 min-h-0 resize-none p-3 text-sm text-slate-800 outline-none"
                placeholder={
                  activeLang === 'ko'
                    ? '여기에 한국어 종합 드래프트가 생성되면 직접 편집하세요.'
                    : '영문이 비어있습니다. EN 버튼을 누르면 한국어 드래프트를 자동 번역합니다.'
                }
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
              사건을 선택하고 위의 버튼을 눌러 한국어 종합 드래프트를 생성하세요.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
