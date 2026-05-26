import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { Article, ConvertedResult, DraftLanguage } from '../types';
import { analyzeKorean, translateDraft, formatChannels, buildInitialResult } from '../lib/promptChain';
import { OpenAIError } from '../lib/openai';
import { useSettings } from './SettingsContext';
import { useHistory } from './HistoryContext';

type Status = 'idle' | 'analyzing' | 'translating' | 'generating' | 'error';

type Ctx = {
  status: Status;
  error: string | null;
  currentResult: ConvertedResult | null;
  analyze: (articles: Article[]) => Promise<void>;
  setDraftText: (text: string) => void;
  switchLanguage: (target: DraftLanguage) => Promise<void>;
  regenerateChannels: () => Promise<void>;
  loadResult: (result: ConvertedResult) => void;
  clearError: () => void;
};

const ConversionCtx = createContext<Ctx | null>(null);

function toErrorMessage(err: unknown): string {
  if (err instanceof OpenAIError) {
    if (err.status === 429) {
      return `API 한도/잔액 초과 (429): ${err.message}\n→ ⚙ 설정에서 Provider/모델 전환 또는 결제/한도 확인.`;
    }
    if (err.status === 401) {
      return `인증 실패 (401): API 키가 잘못되었거나 만료. ⚙ 설정에서 다시 입력하세요.`;
    }
    if (err.status === 404) {
      return `API 404: 모델 ID가 해당 provider에서 지원되지 않거나 base URL이 잘못됨. ⚙ 설정 확인.`;
    }
    return `API 오류 (${err.status}): ${err.message}`;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

export function ConversionProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const { addEntry } = useHistory();
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [currentResult, setCurrentResult] = useState<ConvertedResult | null>(null);

  const analyze = useCallback(async (articles: Article[]) => {
    if (!settings.apiKey) { setError('NO_API_KEY'); return; }
    if (articles.length === 0) { setError('변환할 기사가 없습니다.'); return; }
    setStatus('analyzing');
    setError(null);
    try {
      const analyzed = await analyzeKorean(articles, settings);
      const result = buildInitialResult(articles, analyzed, settings);
      setCurrentResult(result);
      addEntry(result);
      setStatus('idle');
    } catch (err) {
      setError(toErrorMessage(err));
      setStatus('error');
    }
  }, [settings, addEntry]);

  const setDraftText = useCallback((text: string) => {
    setCurrentResult(prev => {
      if (!prev) return prev;
      return { ...prev, drafts: { ...prev.drafts, [prev.activeLanguage]: text } };
    });
  }, []);

  const switchLanguage = useCallback(async (target: DraftLanguage) => {
    if (!currentResult) return;
    if (!settings.apiKey) { setError('NO_API_KEY'); return; }
    if (currentResult.activeLanguage === target) return;

    const existing = currentResult.drafts[target];
    if (existing && existing.trim().length > 0) {
      setCurrentResult({ ...currentResult, activeLanguage: target });
      return;
    }

    const source: DraftLanguage = target === 'ko' ? 'en' : 'ko';
    const sourceText = currentResult.drafts[source];
    if (!sourceText.trim()) { setError(`${source === 'ko' ? '한국어' : '영문'} 드래프트가 비어있어 번역할 수 없습니다.`); return; }

    setStatus('translating');
    setError(null);
    try {
      const translated = await translateDraft({ text: sourceText, from: source, to: target, settings });
      const updated: ConvertedResult = {
        ...currentResult,
        drafts: { ...currentResult.drafts, [target]: translated },
        activeLanguage: target,
      };
      setCurrentResult(updated);
      addEntry(updated);
      setStatus('idle');
    } catch (err) {
      setError(toErrorMessage(err));
      setStatus('error');
    }
  }, [currentResult, settings, addEntry]);

  const regenerateChannels = useCallback(async () => {
    if (!currentResult) return;
    if (!settings.apiKey) { setError('NO_API_KEY'); return; }

    let englishDraft = currentResult.drafts.en;
    let workingResult = currentResult;

    if (!englishDraft.trim()) {
      if (!currentResult.drafts.ko.trim()) { setError('드래프트가 비어있습니다.'); return; }
      setStatus('translating');
      setError(null);
      try {
        englishDraft = await translateDraft({
          text: currentResult.drafts.ko, from: 'ko', to: 'en', settings,
        });
        workingResult = {
          ...currentResult,
          drafts: { ...currentResult.drafts, en: englishDraft },
        };
        setCurrentResult(workingResult);
      } catch (err) {
        setError(toErrorMessage(err));
        setStatus('error');
        return;
      }
    }

    setStatus('generating');
    setError(null);
    try {
      const { channels, bannedHits, factReport } = await formatChannels({
        englishDraft,
        facts: workingResult.facts,
        settings,
      });
      const updated: ConvertedResult = {
        ...workingResult,
        channels,
        channelsGenerated: true,
        bannedHits,
        factReport,
      };
      setCurrentResult(updated);
      addEntry(updated);
      setStatus('idle');
    } catch (err) {
      setError(toErrorMessage(err));
      setStatus('error');
    }
  }, [currentResult, settings, addEntry]);

  const loadResult = useCallback((r: ConvertedResult) => setCurrentResult(r), []);
  const clearError = useCallback(() => setError(null), []);

  return (
    <ConversionCtx.Provider value={{
      status, error, currentResult,
      analyze, setDraftText, switchLanguage, regenerateChannels,
      loadResult, clearError,
    }}>
      {children}
    </ConversionCtx.Provider>
  );
}

export function useConversion(): Ctx {
  const ctx = useContext(ConversionCtx);
  if (!ctx) throw new Error('useConversion must be used within ConversionProvider');
  return ctx;
}
