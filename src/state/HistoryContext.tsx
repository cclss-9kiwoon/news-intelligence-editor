import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import type { ConvertedResult } from '../types';
import { loadJson, saveJson, STORAGE_KEYS } from '../lib/storage';

const MAX_HISTORY = 20;

type Ctx = {
  history: ConvertedResult[];
  addEntry: (entry: ConvertedResult) => void;
  removeEntry: (id: string) => void;
  clear: () => void;
};

const HistoryCtx = createContext<Ctx | null>(null);

export function HistoryProvider({ children }: { children: ReactNode }) {
  const [history, setHistory] = useState<ConvertedResult[]>(() =>
    loadJson<ConvertedResult[]>(STORAGE_KEYS.history, [])
  );

  useEffect(() => { saveJson(STORAGE_KEYS.history, history); }, [history]);

  const addEntry = useCallback((entry: ConvertedResult) => {
    setHistory(prev => [entry, ...prev].slice(0, MAX_HISTORY));
  }, []);
  const removeEntry = useCallback((id: string) => {
    setHistory(prev => prev.filter(e => e.id !== id));
  }, []);
  const clear = useCallback(() => setHistory([]), []);

  return <HistoryCtx.Provider value={{ history, addEntry, removeEntry, clear }}>{children}</HistoryCtx.Provider>;
}

export function useHistory(): Ctx {
  const ctx = useContext(HistoryCtx);
  if (!ctx) throw new Error('useHistory must be used within HistoryProvider');
  return ctx;
}
