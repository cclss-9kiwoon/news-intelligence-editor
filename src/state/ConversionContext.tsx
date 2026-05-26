import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { Article, ConvertedResult } from '../types';
import { runChain } from '../lib/promptChain';
import { OpenAIError } from '../lib/openai';
import { useSettings } from './SettingsContext';
import { useHistory } from './HistoryContext';

type Status = 'idle' | 'converting' | 'error';

type Ctx = {
  status: Status;
  error: string | null;
  currentResult: ConvertedResult | null;
  convert: (article: Article) => Promise<void>;
  loadResult: (result: ConvertedResult) => void;
  clearError: () => void;
};

const ConversionCtx = createContext<Ctx | null>(null);

export function ConversionProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const { addEntry } = useHistory();
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [currentResult, setCurrentResult] = useState<ConvertedResult | null>(null);

  const convert = useCallback(async (article: Article) => {
    if (!settings.apiKey) {
      setError('NO_API_KEY');
      return;
    }
    setStatus('converting');
    setError(null);
    try {
      const result = await runChain(article, settings);
      setCurrentResult(result);
      addEntry(result);
      setStatus('idle');
    } catch (err) {
      const msg = err instanceof OpenAIError
        ? `OpenAI error (${err.status}): ${err.message}`
        : (err as Error).message;
      setError(msg);
      setStatus('error');
    }
  }, [settings, addEntry]);

  const loadResult = useCallback((r: ConvertedResult) => setCurrentResult(r), []);
  const clearError = useCallback(() => setError(null), []);

  return (
    <ConversionCtx.Provider value={{ status, error, currentResult, convert, loadResult, clearError }}>
      {children}
    </ConversionCtx.Provider>
  );
}

export function useConversion(): Ctx {
  const ctx = useContext(ConversionCtx);
  if (!ctx) throw new Error('useConversion must be used within ConversionProvider');
  return ctx;
}
