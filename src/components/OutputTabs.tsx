import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Copy, Check } from 'lucide-react';
import { useConversion } from '../state/ConversionContext';
import { copyToClipboard } from '../lib/clipboard';

type Tab = 'site' | 'x' | 'medium';

const TAB_LABELS: Record<Tab, string> = {
  site: '본 사이트',
  x: 'X 스레드',
  medium: 'Medium',
};

export function OutputTabs() {
  const { currentResult } = useConversion();
  const [active, setActive] = useState<Tab>('site');
  const [copied, setCopied] = useState<Tab | null>(null);

  if (!currentResult) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-slate-400">
        변환 결과가 여기에 표시됩니다.
      </div>
    );
  }

  if (!currentResult.channelsGenerated) {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-slate-500">
        <span>한국어 드래프트를 검토한 뒤 워크벤치의</span>
        <span><span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800 font-semibold">채널 생성</span> 버튼을 눌러주세요.</span>
        <span className="text-xs text-slate-400">(영문이 비어있으면 자동 번역 후 생성됩니다.)</span>
      </div>
    );
  }

  const text = currentResult.channels[active];
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const bannedCount = currentResult.bannedHits[active].length;

  const doCopy = async () => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(active);
      setTimeout(() => setCopied(null), 1500);
    }
  };

  return (
    <div className="border-t border-slate-200 bg-white">
      <div className="flex items-center border-b border-slate-200">
        {(Object.keys(TAB_LABELS) as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setActive(t)}
            className={
              'px-4 py-2 text-sm font-medium border-b-2 ' +
              (active === t ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700')
            }
          >
            {TAB_LABELS[t]}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-3 px-4 text-xs text-slate-500">
          <span>단어 {wordCount}</span>
          <span>글자 {text.length}</span>
          <span className={bannedCount > 0 ? 'text-red-600 font-semibold' : ''}>
            금지어 {bannedCount}건
          </span>
          <span className={currentResult.factReport.ok ? 'text-green-600' : 'text-red-600 font-semibold'}>
            팩트 {currentResult.factReport.ok ? '✓' : '✗'}
          </span>
          <button
            onClick={doCopy}
            className="flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            {copied === active ? <Check size={14} /> : <Copy size={14} />}
            {copied === active ? '복사됨' : '복사'}
          </button>
        </div>
      </div>

      <div className="max-h-72 overflow-y-auto p-4">
        {active === 'medium' ? (
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown>{text}</ReactMarkdown>
          </div>
        ) : active === 'x' ? (
          <div className="space-y-3">
            {text.split(/\n(?=\d+\/)/).map((tweet, i) => (
              <div key={i} className="rounded border border-slate-200 bg-slate-50 p-3 text-sm whitespace-pre-wrap">
                {tweet.trim()}
              </div>
            ))}
          </div>
        ) : (
          <pre className="whitespace-pre-wrap text-sm text-slate-800">{text}</pre>
        )}
        {bannedCount > 0 && (
          <p className="mt-3 text-xs text-red-600">
            ⚠ 금지어 발견: {currentResult.bannedHits[active].join(', ')}
          </p>
        )}
      </div>
    </div>
  );
}
