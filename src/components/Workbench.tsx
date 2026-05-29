import { useEffect, useState } from 'react';
import { Loader2, Sparkles, AlertOctagon, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Copy, Check, Languages } from 'lucide-react';
import { useClusters } from '../state/ClustersContext';
import { useConversion } from '../state/ConversionContext';
import { useSettings } from '../state/SettingsContext';
import { copyToClipboard } from '../lib/clipboard';
import { PROVIDERS } from '../types';
import type { ArticleImage } from '../types';

type Props = {
  onMissingKey: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
};

type FieldKey = 'headline' | 'body' | 'tags' | 'imagePrompt';

const FIELD_META: Array<{ key: FieldKey; label: string; placeholder: string; rows: number }> = [
  { key: 'headline', label: '헤드라인', placeholder: '제목', rows: 1 },
  { key: 'body', label: '본문 (발행용)', placeholder: '라벨 없는 깨끗한 발행 본문', rows: 8 },
  { key: 'tags', label: '태그', placeholder: '공백/쉼표로 구분 (예: #태그 #예시)', rows: 1 },
  { key: 'imagePrompt', label: 'AI 이미지 프롬프트 (영문)', placeholder: 'English Midjourney prompt', rows: 3 },
];

export function Workbench({ onMissingKey, collapsed = false, onToggleCollapsed }: Props) {
  const { selectedCluster, selectedArticles } = useClusters();
  const { settings, setModel, setActiveCategoryId } = useSettings();
  const { status, error, currentResult, viewLang, analyze, switchLang, setText, setTags, clearError } = useConversion();

  const [sourceIdx, setSourceIdx] = useState(0);
  const [copiedField, setCopiedField] = useState<FieldKey | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(true);

  useEffect(() => { setSourceIdx(0); }, [selectedCluster?.id]);

  const triggerAnalyze = () => {
    if (selectedArticles.length === 0) return;
    if (!settings.apiKey) { onMissingKey(); return; }
    analyze(selectedArticles);
  };

  const totalSources = selectedArticles.length;
  const currentSource = selectedArticles[sourceIdx];
  const isBusy = status === 'analyzing' || status === 'translating';

  const view = currentResult
    ? (viewLang === 'en' && currentResult.en
        ? currentResult.en
        : { summary: currentResult.summary, headline: currentResult.headline, body: currentResult.body, tags: currentResult.tags })
    : null;

  const triggerSwitchLang = (lang: 'ko' | 'en') => {
    if (lang === 'en' && !currentResult?.en && !settings.apiKey) { onMissingKey(); return; }
    switchLang(lang);
  };

  const fieldText = (key: FieldKey): string => {
    if (!currentResult || !view) return '';
    if (key === 'imagePrompt') return currentResult.imagePrompt;
    if (key === 'tags') return view.tags.map(t => `#${t}`).join(' ');
    if (key === 'headline') return view.headline;
    return view.body;
  };

  const onFieldChange = (key: FieldKey, value: string) => {
    if (key === 'tags') {
      setTags(value.split(/[\s,]+/).map(t => t.replace(/^#/, '').trim()).filter(Boolean));
    } else {
      setText(key, value);
    }
  };

  const doCopy = async (key: FieldKey) => {
    if (await copyToClipboard(fieldText(key))) {
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
              ? `📝 ${selectedCluster.representativeTitle} · ${totalSources}개 매체`
              : '👈 왼쪽에서 이슈를 선택하세요'}
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
                <button onClick={() => setSourceIdx(i => (i - 1 + totalSources) % totalSources)} className="rounded p-1 hover:bg-slate-100" aria-label="이전 매체"><ChevronLeft size={14} /></button>
                <button onClick={() => setSourceIdx(i => (i + 1) % totalSources)} className="rounded p-1 hover:bg-slate-100" aria-label="다음 매체"><ChevronRight size={14} /></button>
              </div>
            )}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-3">
            {currentSource ? (
              <>
                <div className="mb-2 text-xs text-slate-500">
                  <span className="rounded bg-slate-100 px-1.5">{currentSource.source}</span>
                  {currentSource.pubDate && (
                    <span className="ml-2">
                      {(() => {
                        try {
                          const raw = currentSource.pubDate.trim();
                          // rss2json returns "2026-05-28 07:13:32" (UTC, no tz indicator)
                          // JS Date needs ISO format: "2026-05-28T07:13:32Z"
                          // Check for timezone at end: Z, +09:00, -05:00 etc
                          let isoStr = raw;
                          if (!/[Z]$/i.test(raw) && !/[+-]\d{2}:?\d{2}$/.test(raw)) {
                            isoStr = raw.replace(' ', 'T') + 'Z';
                          }
                          const d = new Date(isoStr);
                          if (isNaN(d.getTime())) return raw;
                          return d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
                        } catch { return currentSource.pubDate; }
                      })()}
                    </span>
                  )}
                </div>
                <div className="mb-2 text-sm font-medium text-slate-900">{currentSource.title}</div>
                <div className="whitespace-pre-wrap text-sm text-slate-800">
                  {currentSource.fullText || currentSource.description || '—'}
                </div>
                {currentSource.link && !currentSource.link.startsWith('manual://') && !currentSource.link.startsWith('simulator://') && (
                  <a href={currentSource.link} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-indigo-600 hover:underline">원문 보기 ↗</a>
                )}
                {currentResult?.sourceFacts && currentResult.sourceFacts.length > 0 && (
                  <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 p-2">
                    <h4 className="mb-1 text-xs font-semibold text-blue-700">📋 원문 핵심 사실</h4>
                    <ul className="space-y-0.5">
                      {currentResult.sourceFacts.map((fact, i) => (
                        <li key={i} className="text-xs text-blue-900">• {fact}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : <span className="text-sm text-slate-400">—</span>}
          </div>
        </div>

        <div data-tutorial="draft-panel" className="flex min-h-0 flex-col gap-2 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3">
          {!currentResult && !isBusy && (
            <p className="text-sm text-slate-400">
              이슈를 선택하고 카테고리를 고른 뒤 [✨ 가치 평가 & 종합]을 누르면 아래 필드가 채워집니다.
            </p>
          )}
          {currentResult && (
            <div className="flex items-center justify-between">
              <div className="flex overflow-hidden rounded-md border border-slate-300 text-xs">
                {(['ko', 'en'] as const).map(lang => (
                  <button
                    key={lang}
                    onClick={() => triggerSwitchLang(lang)}
                    disabled={isBusy}
                    className={
                      'flex items-center px-2 py-0.5 ' +
                      (viewLang === lang ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100') +
                      (isBusy ? ' cursor-not-allowed opacity-50' : '')
                    }
                    title={lang === 'ko' ? '한국어 보기' : '영어로 번역해서 보기'}
                  >
                    {lang === 'ko' ? '한국어' : 'English'}
                    {lang === 'en' && !currentResult.en && <Languages size={10} className="ml-1" />}
                  </button>
                ))}
              </div>
              {status === 'translating' && <span className="text-xs text-indigo-600">번역 중…</span>}
            </div>
          )}
          {view?.summary && (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
              <button
                onClick={() => setSummaryOpen(v => !v)}
                className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-700"
                title="요약 접기/펼치기"
              >
                {summaryOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                요약
              </button>
              {summaryOpen && (
                <p className="mt-1 whitespace-pre-wrap text-xs italic text-slate-600">
                  {view.summary}
                </p>
              )}
            </div>
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
          {(() => {
            // Collect all images from all articles in the cluster
            const allImages: (ArticleImage & { articleSource: string })[] = [];
            const seenUrls = new Set<string>();
            for (const a of selectedArticles) {
              // From images array (full extraction)
              if (a.images) {
                for (const img of a.images) {
                  if (!seenUrls.has(img.url)) {
                    seenUrls.add(img.url);
                    allImages.push({ ...img, articleSource: img.source || a.source });
                  }
                }
              }
              // Fallback: thumbnail only (RSS without full extraction)
              if (a.thumbnail && !seenUrls.has(a.thumbnail)) {
                seenUrls.add(a.thumbnail);
                allImages.push({ url: a.thumbnail, articleSource: a.source });
              }
            }
            if (allImages.length === 0) return null;
            return (
              <div className="flex flex-col">
                <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  원문 이미지 후보 ({allImages.length})
                </span>
                <p className="mb-1.5 text-xs text-slate-400">원문 이미지를 그대로 사용합니다. 클릭하면 URL이 복사됩니다.</p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {allImages.map((img) => (
                    <button
                      key={img.url}
                      onClick={async () => {
                        if (await copyToClipboard(img.url)) {
                          setCopiedField('imagePrompt');
                          setTimeout(() => setCopiedField(null), 1500);
                        }
                      }}
                      className="group relative shrink-0 overflow-hidden rounded border border-slate-200 hover:border-indigo-400"
                      title={`${img.articleSource}${img.caption ? ` — ${img.caption}` : ''}\n클릭하여 URL 복사`}
                    >
                      <img
                        src={img.url}
                        alt={img.alt || img.caption || ''}
                        className="h-24 w-32 object-cover"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      <span className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5 text-[10px] text-white truncate">
                        {img.articleSource}
                      </span>
                      {img.caption && (
                        <span className="absolute top-0 left-0 right-0 bg-black/40 px-1 py-0.5 text-[9px] text-white/80 truncate">
                          {img.caption}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </section>
  );
}
