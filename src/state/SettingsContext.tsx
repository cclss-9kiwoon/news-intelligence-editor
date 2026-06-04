import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import type { Settings, ModelId, RssSource, ProviderId, Category, ArticleWindow, PromptConfig, ReferenceArticle, ProjectProfile, FormatRules, ReviewRule, CampaignSettings } from '../types';
import { PROVIDERS } from '../types';
import { DEFAULT_SETTINGS, DEFAULT_PROMPT_CONFIG, DEFAULT_PROJECT_PROFILE } from '../lib/defaultSettings';
import { loadJson, saveJson, STORAGE_KEYS, backupSettingsToFile, restoreSettingsFromFile } from '../lib/storage';

type Ctx = {
  settings: Settings;
  setApiKey: (k: string) => void;
  setRss2jsonApiKey: (k: string) => void;
  setProvider: (p: ProviderId) => void;
  setApiBaseUrl: (u: string) => void;
  setModel: (m: ModelId) => void;
  setActiveCategoryId: (id: string) => void;
  addCategory: () => void;
  updateCategory: (id: string, patch: Partial<Category>) => void;
  removeCategory: (id: string) => void;
  setArticleWindow: (w: ArticleWindow) => void;
  setRssSources: (s: RssSource[]) => void;
  toggleRssSource: (id: string) => void;
  setRssPollMinutes: (n: number) => void;
  setClusterThreshold: (n: number) => void;
  setSimulatorEnabled: (b: boolean) => void;
  setSimulatorIntervalSec: (n: number) => void;
  setAlertSoundEnabled: (b: boolean) => void;
  setBrowserNotificationsEnabled: (b: boolean) => void;
  setNaverClientId: (k: string) => void;
  setNaverClientSecret: (k: string) => void;
  setNaverQueries: (q: string[]) => void;
  updatePromptConfig: (field: keyof PromptConfig, value: string) => void;
  resetPromptConfigField: (field: keyof PromptConfig) => void;
  addReferenceArticle: (article: ReferenceArticle) => void;
  removeReferenceArticle: (id: string) => void;
  updateProjectProfile: (patch: Partial<ProjectProfile>) => void;
  updateFormatRules: (patch: Partial<FormatRules>) => void;
  addReviewRule: () => void;
  updateReviewRule: (id: string, patch: Partial<ReviewRule>) => void;
  removeReviewRule: (id: string) => void;
  resetSettings: () => void;
  applyCampaignSettings: (cs: CampaignSettings, groupProfile?: { identity: string; audience: string; toneBase: string }) => void;
};

const SettingsCtx = createContext<Ctx | null>(null);

function mergeWithDefaults(stored: Partial<Settings>): Settings {
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    rssSources: stored.rssSources || DEFAULT_SETTINGS.rssSources,
    categories: stored.categories && stored.categories.length > 0 ? stored.categories : DEFAULT_SETTINGS.categories,
    activeCategoryId: stored.activeCategoryId || DEFAULT_SETTINGS.activeCategoryId,
    promptConfig: { ...DEFAULT_PROMPT_CONFIG, ...(stored.promptConfig || {}) },
    referenceArticles: stored.referenceArticles || [],
    projectProfile: {
      ...DEFAULT_PROJECT_PROFILE,
      ...(stored.projectProfile || {}),
      formatRules: { ...DEFAULT_PROJECT_PROFILE.formatRules, ...(stored.projectProfile?.formatRules || {}) },
      reviewRules: stored.projectProfile?.reviewRules || DEFAULT_PROJECT_PROFILE.reviewRules,
    },
  };
}

/** Check if stored settings have any real user config (API keys, etc.) */
function hasUserConfig(s: Partial<Settings>): boolean {
  return !!(s.apiKey || s.naverClientId || s.naverClientSecret || s.rss2jsonApiKey);
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => {
    const stored = loadJson<Partial<Settings>>(STORAGE_KEYS.settings, {});
    return mergeWithDefaults(stored);
  });

  // On mount: if localStorage has no user config, try restoring from file backup
  // On mount: if localStorage has no user config, try restoring from file backup
  useEffect(() => {
    const stored = loadJson<Partial<Settings>>(STORAGE_KEYS.settings, {});
    if (!hasUserConfig(stored)) {
      restoreSettingsFromFile<Partial<Settings>>().then(backup => {
        if (backup && hasUserConfig(backup)) {
          const merged = mergeWithDefaults(backup);
          setSettings(merged);
          saveJson(STORAGE_KEYS.settings, merged);
          console.log('[settings] ✓ restored from file backup (API keys recovered)');
        }
      });
    }
  }, []);

  // Persist to localStorage + file backup on every change
  useEffect(() => {
    saveJson(STORAGE_KEYS.settings, settings);
    if (hasUserConfig(settings)) {
      backupSettingsToFile(settings);
    }
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
  const setActiveCategoryId = useCallback((id: string) => setSettings(s => ({ ...s, activeCategoryId: id })), []);
  const addCategory = useCallback(() => setSettings(s => {
    const id = `cat-${Date.now()}`;
    const next: Category = { id, label: '새 카테고리', criteria: '', tone: '' };
    return { ...s, categories: [...s.categories, next], activeCategoryId: id };
  }), []);
  const updateCategory = useCallback((id: string, patch: Partial<Category>) => setSettings(s => ({
    ...s,
    categories: s.categories.map(c => (c.id === id ? { ...c, ...patch } : c)),
  })), []);
  const removeCategory = useCallback((id: string) => setSettings(s => {
    const categories = s.categories.filter(c => c.id !== id);
    const activeCategoryId = s.activeCategoryId === id ? (categories[0]?.id ?? '') : s.activeCategoryId;
    return { ...s, categories, activeCategoryId };
  }), []);
  const setArticleWindow = useCallback((w: ArticleWindow) => setSettings(s => ({ ...s, articleWindow: w })), []);
  const setRssSources = useCallback((rs: RssSource[]) => setSettings(s => ({ ...s, rssSources: rs })), []);
  const toggleRssSource = useCallback((id: string) =>
    setSettings(s => ({ ...s, rssSources: s.rssSources.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r) })), []);
  const setRssPollMinutes = useCallback((n: number) => setSettings(s => ({ ...s, rssPollMinutes: n })), []);
  const setClusterThreshold = useCallback((n: number) => setSettings(s => ({ ...s, clusterThreshold: n })), []);
  const setSimulatorEnabled = useCallback((b: boolean) => setSettings(s => ({ ...s, simulatorEnabled: b })), []);
  const setSimulatorIntervalSec = useCallback((n: number) => setSettings(s => ({ ...s, simulatorIntervalSec: n })), []);
  const setAlertSoundEnabled = useCallback((b: boolean) => setSettings(s => ({ ...s, alertSoundEnabled: b })), []);
  const setBrowserNotificationsEnabled = useCallback((b: boolean) => setSettings(s => ({ ...s, browserNotificationsEnabled: b })), []);
  const setNaverClientId = useCallback((k: string) => setSettings(s => ({ ...s, naverClientId: k })), []);
  const setNaverClientSecret = useCallback((k: string) => setSettings(s => ({ ...s, naverClientSecret: k })), []);
  const setNaverQueries = useCallback((q: string[]) => setSettings(s => ({ ...s, naverQueries: q })), []);
  const updatePromptConfig = useCallback((field: keyof PromptConfig, value: string) =>
    setSettings(s => ({ ...s, promptConfig: { ...s.promptConfig, [field]: value } })), []);
  const resetPromptConfigField = useCallback((field: keyof PromptConfig) =>
    setSettings(s => ({ ...s, promptConfig: { ...s.promptConfig, [field]: DEFAULT_PROMPT_CONFIG[field] } })), []);
  const addReferenceArticle = useCallback((article: ReferenceArticle) =>
    setSettings(s => {
      if (s.referenceArticles.length >= 5) return s;
      if (s.referenceArticles.some(r => r.url === article.url)) return s;
      return { ...s, referenceArticles: [...s.referenceArticles, article] };
    }), []);
  const removeReferenceArticle = useCallback((id: string) =>
    setSettings(s => ({ ...s, referenceArticles: s.referenceArticles.filter(r => r.id !== id) })), []);
  const updateProjectProfile = useCallback((patch: Partial<ProjectProfile>) =>
    setSettings(s => ({ ...s, projectProfile: { ...s.projectProfile, ...patch } })), []);
  const updateFormatRules = useCallback((patch: Partial<FormatRules>) =>
    setSettings(s => ({ ...s, projectProfile: { ...s.projectProfile, formatRules: { ...s.projectProfile.formatRules, ...patch } } })), []);
  const addReviewRule = useCallback(() =>
    setSettings(s => {
      const rule: ReviewRule = { id: `rule-${Date.now()}`, label: '새 검수 항목', instruction: '', severity: 'warn', enabled: true };
      return { ...s, projectProfile: { ...s.projectProfile, reviewRules: [...s.projectProfile.reviewRules, rule] } };
    }), []);
  const updateReviewRule = useCallback((id: string, patch: Partial<ReviewRule>) =>
    setSettings(s => ({ ...s, projectProfile: { ...s.projectProfile, reviewRules: s.projectProfile.reviewRules.map(r => r.id === id ? { ...r, ...patch } : r) } })), []);
  const removeReviewRule = useCallback((id: string) =>
    setSettings(s => ({ ...s, projectProfile: { ...s.projectProfile, reviewRules: s.projectProfile.reviewRules.filter(r => r.id !== id) } })), []);
  const resetSettings = useCallback(() => setSettings(DEFAULT_SETTINGS), []);
  // Pasta: 캠페인 스코프 설정을 현재 Settings에 주입 (계정 전역 필드는 유지)
  // 4단계 CampaignSettings → 평면 Settings 브리지. 그룹 배포맥락(profile)도 주입.
  const applyCampaignSettings = useCallback((cs: CampaignSettings, groupProfile?: { identity: string; audience: string; toneBase: string }) => setSettings(s => {
    const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
    return {
      ...s,
      // ① 서칭
      rssSources: clone(cs.searching.rssSources),
      naverQueries: [...cs.searching.naverQueries],
      articleWindow: cs.searching.articleWindow,
      clusterThreshold: cs.searching.clusterThreshold,
      // ③ 생성
      promptConfig: clone(cs.generation.promptConfig),
      referenceArticles: clone(cs.generation.referenceArticles),
      categories: clone(cs.categories),
      activeCategoryId: cs.activeCategoryId,
      // projectProfile = ③생성 표기 + ④검수 규칙 + 그룹 배포맥락 합성
      projectProfile: {
        publicationName: groupProfile?.identity || s.projectProfile.publicationName,
        outputLanguage: cs.generation.outputLanguage,
        allowedMedia: clone(cs.finalReview.allowedMedia),
        bannedMedia: clone(cs.finalReview.bannedMedia),
        formatRules: clone(cs.generation.formatRules),
        styleGuide: [
          groupProfile ? `[배포 맥락] ${groupProfile.identity} · 타겟: ${groupProfile.audience} · 톤: ${groupProfile.toneBase}` : '',
          cs.generation.styleGuide,
        ].filter(Boolean).join('\n'),
        reviewRules: clone(cs.finalReview.reviewRules),
      },
    };
  }), []);

  const value: Ctx = {
    settings, setApiKey, setRss2jsonApiKey, setProvider, setApiBaseUrl,
    setModel, setActiveCategoryId, addCategory, updateCategory, removeCategory, setArticleWindow,
    setRssSources, toggleRssSource, setRssPollMinutes, setClusterThreshold, setSimulatorEnabled, setSimulatorIntervalSec,
    setAlertSoundEnabled, setBrowserNotificationsEnabled,
    setNaverClientId, setNaverClientSecret, setNaverQueries,
    updatePromptConfig, resetPromptConfigField, addReferenceArticle, removeReferenceArticle,
    updateProjectProfile, updateFormatRules, addReviewRule, updateReviewRule, removeReviewRule,
    resetSettings, applyCampaignSettings,
  };
  return <SettingsCtx.Provider value={value}>{children}</SettingsCtx.Provider>;
}

export function useSettings(): Ctx {
  const ctx = useContext(SettingsCtx);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
