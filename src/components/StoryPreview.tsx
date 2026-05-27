import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Copy, Check } from 'lucide-react';
import { useConversion } from '../state/ConversionContext';
import { copyToClipboard } from '../lib/clipboard';
import { scan } from '../lib/bannedWords';

export function StoryPreview() {
  const { currentResult } = useConversion();
  const [copied, setCopied] = useState(false);

  if (!currentResult) {
    return (
      <div data-tutorial="output-tabs" className="flex h-40 items-center justify-center text-sm text-slate-400">
        가치 평가 & 종합 결과(헤드라인 + 본문)가 여기에 표시됩니다.
      </div>
    );
  }

  const { headline, body, tags } = currentResult;
  const tagLine = tags.map(t => `#${t}`).join(' ');
  const markdown = `# ${headline}\n\n${body}${tagLine ? `\n\n${tagLine}` : ''}`;
  const bannedHits = scan(body).hits;

  const doCopy = async () => {
    if (await copyToClipboard(markdown)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div data-tutorial="output-tabs" className="flex h-full min-h-0 flex-col border-t border-slate-200 bg-white">
      <div className="flex flex-wrap items-center border-b border-slate-200 px-4 py-1">
        <span className="text-sm font-medium text-slate-700">📄 발행용 미리보기 (헤드라인 + 본문)</span>
        <div className="ml-auto flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span>글자 {body.length}</span>
          {bannedHits.length > 0 && (
            <span className="font-semibold text-red-600">금지어 {bannedHits.length}건</span>
          )}
          <button
            onClick={doCopy}
            className="flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? '복사됨' : '복사'}
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-2">
        <div className="prose prose-sm max-w-none flex-1 overflow-y-auto rounded border border-slate-200 bg-slate-50 p-3">
          <ReactMarkdown>{markdown}</ReactMarkdown>
        </div>
        {bannedHits.length > 0 && (
          <p className="mt-1 px-1 text-xs text-red-600">
            ⚠ 금지어 발견: {bannedHits.join(', ')} — 본문에서 수정 후 복사 권장
          </p>
        )}
      </div>
    </div>
  );
}
