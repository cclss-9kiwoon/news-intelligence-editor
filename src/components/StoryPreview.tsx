import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Copy, Check } from 'lucide-react';
import { useConversion } from '../state/ConversionContext';
import { copyToClipboard } from '../lib/clipboard';
import { scan } from '../lib/bannedWords';

export function StoryPreview() {
  const { currentResult, viewLang, switchLang, status } = useConversion();
  const [copied, setCopied] = useState(false);
  const [showSource, setShowSource] = useState(true);
  const [showAiLabel, setShowAiLabel] = useState(false);

  if (!currentResult) {
    return (
      <div data-tutorial="output-tabs" className="flex h-40 items-center justify-center text-sm text-slate-400">
        가치 평가 & 종합 결과(헤드라인 + 본문)가 여기에 표시됩니다.
      </div>
    );
  }

  const view = viewLang === 'en' && currentResult.en ? currentResult.en : currentResult;
  const { headline, body, tags } = view;
  const tagLine = tags.map(t => `#${t}`).join(' ');
  let markdown = `# ${headline}\n\n*${view.summary || ''}*\n\n${body}${tagLine ? `\n\n---\n\n${tagLine}` : ''}`;
  if (showSource && currentResult.sourceTitle) {
    markdown += `\n\n---\n\n*출처: ${currentResult.sourceTitle}*`;
  }
  if (showAiLabel) {
    markdown += `\n\n*이 기사는 AI의 도움을 받아 작성되었습니다.*`;
  }
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
          <div className="flex overflow-hidden rounded-md border border-slate-300">
            {(['ko', 'en'] as const).map(lang => (
              <button
                key={lang}
                onClick={() => switchLang(lang)}
                disabled={status === 'translating'}
                className={
                  'px-2 py-0.5 ' +
                  (viewLang === lang ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100') +
                  (status === 'translating' ? ' cursor-not-allowed opacity-50' : '')
                }
                title={lang === 'ko' ? '한국어 보기' : '영어로 번역해서 보기'}
              >
                {lang === 'ko' ? '한국어' : 'English'}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={showSource}
              onChange={e => setShowSource(e.target.checked)}
              className="rounded border-slate-300"
            />
            출처 표기
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={showAiLabel}
              onChange={e => setShowAiLabel(e.target.checked)}
              className="rounded border-slate-300"
            />
            AI 도움 표기
          </label>
          {status === 'translating' && <span className="text-indigo-600">번역 중…</span>}
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
          {currentResult.imagePrompt && (
            <div className="mt-3 rounded border border-dashed border-slate-300 bg-slate-100 p-3 text-center">
              <span className="text-xs text-slate-500">🖼 AI 이미지 프롬프트:</span>
              <p className="mt-1 text-xs italic text-slate-600">{currentResult.imagePrompt}</p>
            </div>
          )}
          {currentResult.sourceArticleIds.length > 0 && (
            <div className="mt-3 border-t border-slate-200 pt-2 text-xs text-slate-500">
              출처: {currentResult.sourceTitle} 외 {currentResult.sourceArticleIds.length - 1}개 매체
            </div>
          )}
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
