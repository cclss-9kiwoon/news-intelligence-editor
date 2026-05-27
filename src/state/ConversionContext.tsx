import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { Article, ConvertedResult } from '../types';
import { generateStory, buildInitialResult, translateToEnglish } from '../lib/promptChain';
import { OpenAIError } from '../lib/openai';
import { useSettings } from './SettingsContext';
import { useHistory } from './HistoryContext';

type Status = 'idle' | 'analyzing' | 'translating' | 'error';
type TextField = 'summary' | 'headline' | 'body' | 'imagePrompt';
type ViewLang = 'ko' | 'en';

type Ctx = {
  status: Status;
  error: string | null;
  currentResult: ConvertedResult | null;
  viewLang: ViewLang;
  analyze: (articles: Article[]) => Promise<void>;
  switchLang: (target: ViewLang) => Promise<void>;
  setText: (field: TextField, value: string) => void;
  setTags: (tags: string[]) => void;
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
  const [viewLang, setViewLang] = useState<ViewLang>('ko');

  const analyze = useCallback(async (articles: Article[]) => {
    if (!settings.apiKey) { setError('NO_API_KEY'); return; }
    if (articles.length === 0) { setError('변환할 기사가 없습니다.'); return; }
    const category = settings.categories.find(c => c.id === settings.activeCategoryId)
      ?? settings.categories[0];
    if (!category) { setError('카테고리가 없습니다. ⚙ 설정에서 추가하세요.'); return; }
    setStatus('analyzing');
    setError(null);
    try {
      const story = await generateStory(articles, settings, category);
      const result = buildInitialResult(articles, story, settings, category);
      setCurrentResult(result);
      setViewLang('ko');
      addEntry(result);
      setStatus('idle');
    } catch (err) {
      setError(toErrorMessage(err));
      setStatus('error');
    }
  }, [settings, addEntry]);

  const switchLang = useCallback(async (target: ViewLang) => {
    if (!currentResult) return;
    if (target === 'ko') { setViewLang('ko'); return; }
    if (currentResult.en) { setViewLang('en'); return; }
    if (!settings.apiKey) { setError('NO_API_KEY'); return; }
    setStatus('translating');
    setError(null);
    try {
      const en = await translateToEnglish(
        { summary: currentResult.summary, headline: currentResult.headline, body: currentResult.body, tags: currentResult.tags },
        settings,
      );
      setCurrentResult(prev => (prev ? { ...prev, en } : prev));
      setViewLang('en');
      setStatus('idle');
    } catch (err) {
      setError(toErrorMessage(err));
      setStatus('error');
    }
  }, [currentResult, settings]);

  const setText = useCallback((field: TextField, value: string) => {
    setCurrentResult(prev => {
      if (!prev) return prev;
      if (viewLang === 'en' && prev.en && field !== 'imagePrompt') {
        return { ...prev, en: { ...prev.en, [field]: value } };
      }
      return { ...prev, [field]: value };
    });
  }, [viewLang]);

  const setTags = useCallback((tags: string[]) => {
    setCurrentResult(prev => {
      if (!prev) return prev;
      if (viewLang === 'en' && prev.en) return { ...prev, en: { ...prev.en, tags } };
      return { ...prev, tags };
    });
  }, [viewLang]);

  const loadResult = useCallback((r: ConvertedResult) => { setCurrentResult(r); setViewLang('ko'); }, []);
  const clearError = useCallback(() => setError(null), []);

  return (
    <ConversionCtx.Provider value={{
      status, error, currentResult, viewLang,
      analyze, switchLang, setText, setTags, loadResult, clearError,
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
