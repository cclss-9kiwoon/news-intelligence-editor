import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Copy, Check, Eye, Pencil } from 'lucide-react';
import { useConversion } from '../state/ConversionContext';
import { copyToClipboard } from '../lib/clipboard';
import type { ChannelKey } from '../types';

const TAB_LABELS: Record<ChannelKey, string> = {
  site: '본 사이트',
  x: 'X 스레드',
  medium: 'Medium',
};

export function OutputTabs() {
  const { currentResult, setChannelText } = useConversion();
  const [active, setActive] = useState<ChannelKey>('site');
  const [copied, setCopied] = useState<ChannelKey | null>(null);
  const [previewMedium, setPreviewMedium] = useState(false);

  if (!currentResult) {
    return (
      <div data-tutorial="output-tabs" className="flex h-40 items-center justify-center text-sm text-slate-400">
        변환 결과가 여기에 표시됩니다.
      </div>
    );
  }

  const lang = currentResult.activeLanguage;
  const langLabel = lang === 'ko' ? '한국어' : '영문';
  const generated = currentResult.channelsGenerated[lang];

  if (!generated) {
    return (
      <div data-tutorial="output-tabs" className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-slate-500">
        <span>
          현재 <span className="rounded bg-slate-100 px-1.5 font-semibold">{langLabel}</span> 채널 출력이 아직 생성되지 않았습니다.
        </span>
        <span>워크벤치의 <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800 font-semibold">채널 생성</span> 버튼을 눌러주세요.</span>
        <span className="text-xs text-slate-400">언어를 바꾸려면 KO/EN 토글 후 다시 [채널 생성].</span>
      </div>
    );
  }

  const channels = currentResult.channels[lang];
  const bannedHits = currentResult.bannedHits[lang];
  const text = channels[active];
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const bannedCount = bannedHits[active].length;

  const doCopy = async () => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(active);
      setTimeout(() => setCopied(null), 1500);
    }
  };

  return (
    <div data-tutorial="output-tabs" className="flex max-h-[40vh] flex-col border-t border-slate-200 bg-white">
      <div className="flex flex-wrap items-center border-b border-slate-200">
        {(Object.keys(TAB_LABELS) as ChannelKey[]).map(t => (
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
        <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{langLabel}</span>
        <div className="ml-auto flex flex-wrap items-center gap-3 px-4 py-1 text-xs text-slate-500">
          <span>단어 {wordCount}</span>
          <span>글자 {text.length}</span>
          {bannedCount > 0 && (
            <span className="text-red-600 font-semibold">금지어 {bannedCount}건</span>
          )}
          {active === 'medium' && (
            <button
              onClick={() => setPreviewMedium(v => !v)}
              className="flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
              title="마크다운 미리보기 ↔ 편집 전환"
            >
              {previewMedium ? <Pencil size={12} /> : <Eye size={12} />}
              {previewMedium ? '편집' : '미리보기'}
            </button>
          )}
          <button
            onClick={doCopy}
            className="flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            {copied === active ? <Check size={14} /> : <Copy size={14} />}
            {copied === active ? '복사됨' : '복사'}
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-2">
        {active === 'medium' && previewMedium ? (
          <div className="prose prose-sm max-w-none flex-1 overflow-y-auto rounded border border-slate-200 bg-slate-50 p-3">
            <ReactMarkdown>{text}</ReactMarkdown>
          </div>
        ) : (
          <textarea
            value={text}
            onChange={e => setChannelText(active, e.target.value)}
            className="flex-1 min-h-[180px] resize-none rounded border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-800 outline-none focus:border-indigo-400"
            placeholder={`이 채널 출력을 직접 편집할 수 있습니다 (${langLabel}).`}
          />
        )}
        {bannedCount > 0 && (
          <p className="mt-1 px-1 text-xs text-red-600">
            ⚠ 금지어 발견: {bannedHits[active].join(', ')} — 복사 전 본문에서 수정 권장
          </p>
        )}
      </div>
    </div>
  );
}
