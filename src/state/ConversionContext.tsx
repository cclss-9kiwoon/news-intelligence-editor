import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { Article, ConvertedResult } from '../types';
import { runChain, formatChannels } from '../lib/promptChain';
import { OpenAIError } from '../lib/openai';
import { useSettings } from './SettingsContext';
import { useHistory } from './HistoryContext';

type Status = 'idle' | 'converting' | 'regenerating' | 'error';

type Ctx = {
  status: Status;
  error: string | null;
  currentResult: ConvertedResult | null;
  convert: (articles: Article[]) => Promise<void>;
  regenerateChannels: (editedDraft: string) => Promise<void>;
  loadResult: (result: ConvertedResult) => void;
  clearError: () => void;
};

const ConversionCtx = createContext<Ctx | null>(null);

function toErrorMessage(err: unknown): string {
  if (err instanceof OpenAIError) return `OpenAI error (${err.status}): ${err.message}`;
  if (err instanceof Error) return err.message;
  return String(err);
}

export function ConversionProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const { addEntry } = useHistory();
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [currentResult, setCurrentResult] = useState<ConvertedResult | null>(null);

  const convert = useCallback(async (articles: Article[]) => {
    if (!settings.apiKey) { setError('NO_API_KEY'); return; }
    if (articles.length === 0) { setError('변환할 기사가 없습니다.'); return; }
    setStatus('converting');
    setError(null);
    try {
      const result = await runChain(articles, settings);
      setCurrentResult(result);
      addEntry(result);
      setStatus('idle');
    } catch (err) {
      setError(toErrorMessage(err));
      setStatus('error');
    }
  }, [settings, addEntry]);

  const regenerateChannels = useCallback(async (editedDraft: string) => {
    if (!currentResult) { setError('재생성할 변환 결과가 없습니다.'); return; }
    if (!settings.apiKey) { setError('NO_API_KEY'); return; }
    setStatus('regenerating');
    setError(null);
    try {
      const { channels, bannedHits, factReport } = await formatChannels({
        editedDraft,
        facts: currentResult.facts,
        settings,
      });
      const updated: ConvertedResult = {
        ...currentResult,
        editedDraft,
        channels,
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
    <ConversionCtx.Provider value={{ status, error, currentResult, convert, regenerateChannels, loadResult, clearError }}>
      {children}
    </ConversionCtx.Provider>
  );
}

export function useConversion(): Ctx {
  const ctx = useContext(ConversionCtx);
  if (!ctx) throw new Error('useConversion must be used within ConversionProvider');
  return ctx;
}
