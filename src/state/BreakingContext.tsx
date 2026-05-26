import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import type { BreakingAlert } from '../types';
import { detect, generateMockBreaking } from '../lib/breakingDetector';
import { useSettings } from './SettingsContext';
import { useArticles } from './ArticlesContext';
import { useClusters } from './ClustersContext';

type Ctx = {
  alerts: BreakingAlert[];
  dismissAlert: (articleId: string) => void;
  jumpToAlert: (alert: BreakingAlert) => void;
};

const BreakingCtx = createContext<Ctx | null>(null);

export function BreakingProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const { articles } = useArticles();
  const { clusters, selectCluster } = useClusters();
  const [alerts, setAlerts] = useState<BreakingAlert[]>([]);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio(import.meta.env.BASE_URL + 'ping.mp3');
    audioRef.current.volume = 0.5;
  }, []);

  const dismissAlert = useCallback((articleId: string) => {
    setAlerts(prev => prev.filter(a => a.article.id !== articleId));
  }, []);

  const playSound = useCallback(() => {
    if (settings.alertSoundEnabled && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => { /* autoplay blocked */ });
    }
  }, [settings.alertSoundEnabled]);

  const pushAlert = useCallback((a: BreakingAlert) => {
    if (seenIdsRef.current.has(a.article.id)) return;
    seenIdsRef.current.add(a.article.id);
    setAlerts(prev => [a, ...prev].slice(0, 5));
    playSound();
    if (settings.browserNotificationsEnabled && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification('🚨 ' + a.article.title);
    }
    setTimeout(() => dismissAlert(a.article.id), 30_000);
  }, [playSound, settings.browserNotificationsEnabled, dismissAlert]);

  const jumpToAlert = useCallback((alert: BreakingAlert) => {
    const owning = clusters.find(c => c.articleIds.includes(alert.article.id));
    if (owning) selectCluster(owning.id);
    dismissAlert(alert.article.id);
  }, [dismissAlert, selectCluster, clusters]);

  useEffect(() => {
    for (const article of articles) {
      const a = detect(article);
      if (a) pushAlert(a);
    }
  }, [articles, pushAlert]);

  useEffect(() => {
    if (!settings.simulatorEnabled) return;
    const id = setInterval(() => {
      const mock = generateMockBreaking();
      const a = detect(mock);
      if (a) pushAlert(a);
    }, settings.simulatorIntervalSec * 1000);
    return () => clearInterval(id);
  }, [settings.simulatorEnabled, settings.simulatorIntervalSec, pushAlert]);

  return (
    <BreakingCtx.Provider value={{ alerts, dismissAlert, jumpToAlert }}>
      {children}
    </BreakingCtx.Provider>
  );
}

export function useBreaking(): Ctx {
  const ctx = useContext(BreakingCtx);
  if (!ctx) throw new Error('useBreaking must be used within BreakingProvider');
  return ctx;
}
