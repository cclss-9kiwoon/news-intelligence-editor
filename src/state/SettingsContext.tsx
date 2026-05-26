import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import type { Settings, StylePresetKey, ModelId, RssSource, ProviderId } from '../types';
import { PROVIDERS } from '../types';
import { DEFAULT_SETTINGS } from '../lib/defaultSettings';
import { loadJson, saveJson, STORAGE_KEYS } from '../lib/storage';

type Ctx = {
  settings: Settings;
  setApiKey: (k: string) => void;
  setRss2jsonApiKey: (k: string) => void;
  setProvider: (p: ProviderId) => void;
  setApiBaseUrl: (u: string) => void;
  setModel: (m: ModelId) => void;
  setStylePreset: (s: StylePresetKey) => void;
  setCustomStyleInstruction: (s: string) => void;
  setRssSources: (s: RssSource[]) => void;
  toggleRssSource: (id: string) => void;
  setRssPollMinutes: (n: number) => void;
  setClusterThreshold: (n: number) => void;
  setSimulatorEnabled: (b: boolean) => void;
  setSimulatorIntervalSec: (n: number) => void;
  setAlertSoundEnabled: (b: boolean) => void;
  setBrowserNotificationsEnabled: (b: boolean) => void;
  resetSettings: () => void;
};

const SettingsCtx = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => {
    const stored = loadJson<Partial<Settings>>(STORAGE_KEYS.settings, {});
    return { ...DEFAULT_SETTINGS, ...stored, rssSources: stored.rssSources || DEFAULT_SETTINGS.rssSources };
  });

  useEffect(() => {
    saveJson(STORAGE_KEYS.settings, settings);
  }, [settings]);

  const setApiKey = useCallback((k: string) => setSettings(s => ({ ...s, apiKey: k })), []);
  const setRss2jsonApiKey = useCallback((k: string) => setSettings(s => ({ ...s, rss2jsonApiKey: k })), []);
  const setProvider = useCallback((p: ProviderId) => setSettings(s => {
    const cfg = PROVIDERS[p];
    const firstModel = cfg.models[0]?.id ?? s.model;
    return { ...s, provider: p, apiBaseUrl: cfg.baseUrl, model: firstModel, apiKey: '' };
  }), []);
  const setApiBaseUrl = useCallback((u: string) => setSettings(s => ({ ...s, apiBaseUrl: u })), []);
  const setModel = useCallback((m: ModelId) => setSettings(s => ({ ...s, model: m })), []);
  const setStylePreset = useCallback((p: StylePresetKey) => setSettings(s => ({ ...s, stylePreset: p })), []);
  const setCustomStyleInstruction = useCallback((v: string) => setSettings(s => ({ ...s, customStyleInstruction: v })), []);
  const setRssSources = useCallback((rs: RssSource[]) => setSettings(s => ({ ...s, rssSources: rs })), []);
  const toggleRssSource = useCallback((id: string) =>
    setSettings(s => ({ ...s, rssSources: s.rssSources.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r) })), []);
  const setRssPollMinutes = useCallback((n: number) => setSettings(s => ({ ...s, rssPollMinutes: n })), []);
  const setClusterThreshold = useCallback((n: number) => setSettings(s => ({ ...s, clusterThreshold: n })), []);
  const setSimulatorEnabled = useCallback((b: boolean) => setSettings(s => ({ ...s, simulatorEnabled: b })), []);
  const setSimulatorIntervalSec = useCallback((n: number) => setSettings(s => ({ ...s, simulatorIntervalSec: n })), []);
  const setAlertSoundEnabled = useCallback((b: boolean) => setSettings(s => ({ ...s, alertSoundEnabled: b })), []);
  const setBrowserNotificationsEnabled = useCallback((b: boolean) => setSettings(s => ({ ...s, browserNotificationsEnabled: b })), []);
  const resetSettings = useCallback(() => setSettings(DEFAULT_SETTINGS), []);

  const value: Ctx = {
    settings, setApiKey, setRss2jsonApiKey, setProvider, setApiBaseUrl,
    setModel, setStylePreset, setCustomStyleInstruction,
    setRssSources, toggleRssSource, setRssPollMinutes, setClusterThreshold, setSimulatorEnabled, setSimulatorIntervalSec,
    setAlertSoundEnabled, setBrowserNotificationsEnabled, resetSettings,
  };
  return <SettingsCtx.Provider value={value}>{children}</SettingsCtx.Provider>;
}

export function useSettings(): Ctx {
  const ctx = useContext(SettingsCtx);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
