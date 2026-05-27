import { useEffect, useState } from 'react';
import { Loader2, Sparkles, AlertOctagon, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Copy, Check } from 'lucide-react';
import { useClusters } from '../state/ClustersContext';
import { useConversion } from '../state/ConversionContext';
import { useSettings } from '../state/SettingsContext';
import { copyToClipboard } from '../lib/clipboard';
import { PROVIDERS } from '../types';

type Props = {
  onMissingKey: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
};

type FieldKey = 'summary' | 'headline' | 'body' | 'tags' | 'imagePrompt';

const FIELD_META: Array<{ key: FieldKey; label: string; placeholder: string; rows: number }> = [
  { key: 'summary', label: '요약', placeholder: '생성 후 무엇에 관한 기사인지 중립 요약이 표시됩니다.', rows: 2 },
  { key: 'headline', label: '헤드라인', placeholder: '제목', rows: 1 },
  { key: 'body', label: '본문 (발행용)', placeholder: '라벨 없는 깨끗한 발행 본문', rows: 8 },
  { key: 'tags', label: '태그', placeholder: '공백/쉼표로 구분 (예: 리본루키 JTBC)', rows: 1 },
  { key: 'imagePrompt', label: 'AI 이미지 프롬프트 (영문)', placeholder: 'English Midjourney prompt', rows: 3 },
];

export function Workbench({ onMissingKey, collapsed = false, onToggleCollapsed }: Props) {
  const { selectedCluster, selectedArticles } = useClusters();
  const { settings, setModel, setActiveCategoryId } = useSettings();
  const { status, error, currentResult, analyze, setText, setTags, clearError } = useConversion();

  const [sourceIdx, setSourceIdx] = useState(0);
  const [copiedField, setCopiedField] = useState<FieldKey | null>(null);

  useEffect(() => { setSourceIdx(0); }, [selectedCluster?.id]);

  const triggerAnalyze = () => {
    if (selectedArticles.length === 0) return;
    if (!settings.apiKey) { onMissingKey(); return; }
    analyze(selectedArticles);
  };

  const totalSources = selectedArticles.length;
  const currentSource = selectedArticles[sourceIdx];
  const isBusy = status === 'analyzing';

  const fieldText = (key: FieldKey): string => {
    if (!currentResult) return '';
    if (key === 'tags') return currentResult.tags.join(' ');
    return currentResult[key];
  };

  const onFieldChange = (key: FieldKey, value: string) => {
    if (key === 'tags') {
      setTags(value.split(/[\s,]+/).map(t => t.replace(/^#/, '').trim()).filter(Boolean));
    } else {
      setText(key, value);
    }
  };

  const doCopy = async (key: FieldKey) => {
    const value = key === 'tags' && currentResult
      ? currentResult.tags.map(t => `#${t}`).join(' ')
      : fieldText(key);
    if (await copyToClipboard(value)) {
      setCopiedField(key);
      setTimeout(() => setCopiedField(null), 1500);
    }
  };

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div data-tutorial="workbench-header" className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-2">
        <div className="flex min-w-0 items-center gap-1">
          {onToggleCollapsed && (
            <button
              onClick={onToggleCollapsed}
              className="rounded p-1 text-slate-500 hover:bg-slate-100"
              title={collapsed ? '원문/드래프트 펼치기' : '원문/드래프트 접기'}
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
          <select
            value={settings.activeCategoryId}
            onChange={e => setActiveCategoryId(e.target.value)}
            className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs"
            title="카테고리(렌즈) 선택"
          >
            {settings.categories.map(c => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
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
            {isBusy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {isBusy ? '평가 & 종합 중…' : '✨ 가치 평가 & 종합'}
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
                <button onClick={() => setSourceIdx(i => (i - 1 + totalSources) % totalSources)} className="rounded p-1 hover:bg-slate-100" aria-label="이전 소스"><ChevronLeft size={14} /></button>
                <button onClick={() => setSourceIdx(i => (i + 1) % totalSources)} className="rounded p-1 hover:bg-slate-100" aria-label="다음 소스"><ChevronRight size={14} /></button>
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
                  <a href={currentSource.link} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-indigo-600 hover:underline">원문 보기 ↗</a>
                )}
              </>
            ) : <span className="text-sm text-slate-400">—</span>}
          </div>
        </div>

        <div data-tutorial="draft-panel" className="flex min-h-0 flex-col gap-2 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3">
          {!currentResult && !isBusy && (
            <p className="text-sm text-slate-400">
              사건을 선택하고 카테고리를 고른 뒤 [✨ 가치 평가 & 종합]을 누르면 아래 필드가 채워집니다.
            </p>
          )}
          {FIELD_META.map(({ key, label, placeholder, rows }) => (
            <div key={key} className="flex flex-col">
              <div className="mb-0.5 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
                <button
                  onClick={() => doCopy(key)}
                  disabled={!currentResult}
                  className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-40"
                  title={`${label} 복사`}
                >
                  {copiedField === key ? <Check size={12} /> : <Copy size={12} />}
                  {copiedField === key ? '복사됨' : '복사'}
                </button>
              </div>
              <textarea
                value={fieldText(key)}
                onChange={e => onFieldChange(key, e.target.value)}
                rows={rows}
                placeholder={placeholder}
                className="resize-y rounded border border-slate-200 p-2 text-sm text-slate-800 outline-none focus:border-indigo-400"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
