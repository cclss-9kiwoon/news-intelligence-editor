import { useState } from 'react';
import { RefreshCw, Plus } from 'lucide-react';
import { useArticles } from '../state/ArticlesContext';

export function ArticlePicker() {
  const { articles, selectedArticle, selectArticle, addManualArticle, refreshNow } = useArticles();
  const [showManual, setShowManual] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualText, setManualText] = useState('');
  const [manualUrl, setManualUrl] = useState('');

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
    <aside className="flex h-full min-h-0 flex-col overflow-hidden border-r border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
        <h2 className="text-sm font-semibold">📰 기사 ({articles.length})</h2>
        <div className="flex gap-1">
          <button
            onClick={refreshNow}
            className="rounded p-1 hover:bg-slate-100"
            aria-label="새로고침"
            title="새로고침"
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={() => setShowManual(v => !v)}
            className="rounded p-1 hover:bg-slate-100"
            aria-label="직접 입력"
            title="직접 입력"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

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
        {articles.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-slate-400">
            아직 수집된 기사가 없습니다. 30초 대기 또는 ＋ 버튼으로 직접 입력.
          </li>
        )}
        {articles.map(a => (
          <li
            key={a.id}
            onClick={() => selectArticle(a)}
            className={
              'cursor-pointer border-b border-slate-100 px-4 py-3 hover:bg-slate-50 ' +
              (selectedArticle?.id === a.id ? 'bg-slate-100' : '')
            }
          >
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>{a.source}</span>
              {a.isBreaking && <span className="rounded bg-red-100 px-1 text-red-700">🚨 속보</span>}
              {a.inputType === 'simulator' && <span>🧪</span>}
            </div>
            <div className="mt-0.5 text-sm font-medium text-slate-900 line-clamp-2">{a.title}</div>
            <div className="mt-0.5 text-xs text-slate-500 line-clamp-2">{a.description}</div>
          </li>
        ))}
      </ul>
    </aside>
  );
}
