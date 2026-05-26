import { useState } from 'react';
import { RefreshCw, Plus, ChevronDown, ChevronRight, Split, Move, X, ArrowDownToLine } from 'lucide-react';
import { useArticles } from '../state/ArticlesContext';
import { useClusters } from '../state/ClustersContext';

export function ClusterPicker() {
  const { articles, addManualArticle, refreshNow } = useArticles();
  const {
    clusters, selectedClusterId, selectCluster,
    splitArticleOut, resetSplits, resetMerges,
    mergeModeSourceId, startMergeMode, cancelMergeMode, mergeIntoCluster,
  } = useClusters();

  const [showManual, setShowManual] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualText, setManualText] = useState('');
  const [manualUrl, setManualUrl] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const totalArticles = articles.length;
  const movingArticle = mergeModeSourceId ? articles.find(a => a.id === mergeModeSourceId) : null;

  const toggleExpanded = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submitManual = () => {
    if (!manualText.trim()) return;
    addManualArticle({
      title: manualTitle.trim() || '(직접 입력)',
      text: manualText.trim(),
      sourceUrl: manualUrl.trim() || undefined,
    });
    setManualText(''); setManualTitle(''); setManualUrl('');
    setShowManual(false);
  };

  return (
    <aside data-tutorial="cluster-list" className="flex h-full min-h-0 flex-col overflow-hidden border-r border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
        <h2 className="text-sm font-semibold">
          🗂 사건 ({clusters.length}) · 기사 {totalArticles}
        </h2>
        <div className="flex gap-1">
          <button
            onClick={() => { resetSplits(); resetMerges(); }}
            className="rounded p-1 hover:bg-slate-100 text-slate-500"
            title="수동 분리·합치기 모두 되돌리기"
          >
            <Split size={14} />
          </button>
          <button
            onClick={refreshNow}
            className="rounded p-1 hover:bg-slate-100"
            title="새로고침"
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={() => setShowManual(v => !v)}
            className="rounded p-1 hover:bg-slate-100"
            title="직접 입력"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {movingArticle && (
        <div className="flex items-start gap-2 border-b border-indigo-200 bg-indigo-50 px-4 py-2 text-xs text-indigo-900">
          <Move size={14} className="mt-0.5 flex-none" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold">이동 중</div>
            <div className="truncate">"{movingArticle.title}"</div>
            <div className="mt-0.5 text-indigo-700">옮길 클러스터의 <ArrowDownToLine size={12} className="inline" /> 버튼을 누르세요.</div>
          </div>
          <button
            onClick={cancelMergeMode}
            className="rounded p-0.5 hover:bg-indigo-100"
            aria-label="취소"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {showManual && (
        <div className="border-b border-slate-100 bg-slate-50 p-3 space-y-2">
          <input
            value={manualTitle}
            onChange={e => setManualTitle(e.target.value)}
            placeholder="제목 (선택)"
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
          <input
            value={manualUrl}
            onChange={e => setManualUrl(e.target.value)}
            placeholder="원본 URL (선택)"
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
          <textarea
            value={manualText}
            onChange={e => setManualText(e.target.value)}
            placeholder="본문 텍스트를 붙여넣으세요"
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm h-24"
          />
          <button
            onClick={submitManual}
            disabled={!manualText.trim()}
            className="w-full rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            추가
          </button>
        </div>
      )}

      <ul className="flex-1 min-h-0 overflow-y-auto">
        {clusters.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-slate-400">
            아직 수집된 기사가 없습니다. 30초 대기 또는 ＋ 버튼으로 직접 입력.
          </li>
        )}
        {clusters.map(cluster => {
          const isOpen = expanded.has(cluster.id);
          const isSelected = selectedClusterId === cluster.id;
          const memberArticles = cluster.articleIds
            .map(id => articles.find(a => a.id === id))
            .filter((a): a is NonNullable<typeof a> => !!a);
          const sources = [...new Set(memberArticles.map(a => a.source))];
          const hasBreaking = memberArticles.some(a => a.isBreaking);
          const isMergeTarget = !!movingArticle && !cluster.articleIds.includes(movingArticle.id);

          return (
            <li
              key={cluster.id}
              className={
                'border-b border-slate-100 ' +
                (isSelected ? 'bg-indigo-50' : '') +
                (isMergeTarget ? ' ring-1 ring-indigo-300' : '')
              }
            >
              <div
                className="flex cursor-pointer items-start gap-2 px-3 py-2 hover:bg-slate-50"
                onClick={() => selectCluster(cluster.id)}
              >
                <button
                  onClick={e => { e.stopPropagation(); toggleExpanded(cluster.id); }}
                  className="mt-0.5 rounded p-0.5 hover:bg-slate-200 text-slate-400"
                  aria-label={isOpen ? '접기' : '펼치기'}
                >
                  {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <span className="rounded bg-slate-100 px-1.5 font-semibold">{cluster.articleIds.length}건</span>
                    {hasBreaking && <span className="rounded bg-red-100 px-1.5 text-red-700">🚨 속보</span>}
                    <span className="truncate">{sources.join(' · ')}</span>
                  </div>
                  <div className="mt-0.5 text-sm font-medium text-slate-900 line-clamp-2">
                    {cluster.representativeTitle}
                  </div>
                  {cluster.entities.length > 0 && (
                    <div className="mt-0.5 text-xs text-slate-400 truncate">
                      🔖 {cluster.entities.slice(0, 5).join(', ')}
                    </div>
                  )}
                </div>
                {isMergeTarget && (
                  <button
                    onClick={e => { e.stopPropagation(); mergeIntoCluster(cluster.id); }}
                    className="mt-0.5 flex items-center gap-1 rounded-md bg-indigo-600 px-2 py-1 text-xs font-semibold text-white hover:bg-indigo-700"
                    title="이 클러스터로 이동"
                  >
                    <ArrowDownToLine size={12} />
                    여기로
                  </button>
                )}
              </div>

              {isOpen && (
                <ul className="border-t border-slate-100 bg-slate-50">
                  {memberArticles.map(a => (
                    <li
                      key={a.id}
                      className="border-b border-slate-100 px-4 py-2 last:border-b-0"
                    >
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-xs text-slate-500">
                            {a.source}
                            {a.inputType === 'simulator' && <span className="ml-1">🧪</span>}
                          </div>
                          <div className="text-xs text-slate-800 line-clamp-2">{a.title}</div>
                          {a.link && !a.link.startsWith('manual://') && !a.link.startsWith('simulator://') && (
                            <a
                              href={a.link}
                              target="_blank"
                              rel="noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="mt-0.5 inline-block text-xs text-indigo-600 hover:underline"
                            >
                              원문 ↗
                            </a>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={e => { e.stopPropagation(); startMergeMode(a.id); }}
                            className={
                              'rounded p-1 ' +
                              (mergeModeSourceId === a.id
                                ? 'bg-indigo-600 text-white'
                                : 'text-slate-400 hover:bg-indigo-100 hover:text-indigo-700')
                            }
                            title="다른 사건으로 이동"
                          >
                            <Move size={12} />
                          </button>
                          {cluster.articleIds.length > 1 && (
                            <button
                              onClick={e => { e.stopPropagation(); splitArticleOut(a.id); }}
                              className="rounded p-1 text-slate-400 hover:bg-amber-100 hover:text-amber-700"
                              title="단독 사건으로 분리"
                            >
                              <Split size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
