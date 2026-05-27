import { createContext, useContext, useMemo, useState, useCallback, useEffect, ReactNode } from 'react';
import type { Article, Cluster, ArticleWindow } from '../types';
import { groupIntoClusters } from '../lib/clustering';
import { useArticles } from './ArticlesContext';
import { useSettings } from './SettingsContext';

const WINDOW_MS: Record<ArticleWindow, number> = {
  '1h': 3600_000,
  '24h': 24 * 3600_000,
  '7d': 7 * 24 * 3600_000,
  '30d': 30 * 24 * 3600_000,
  'breaking': 30 * 24 * 3600_000,
};

type Ctx = {
  clusters: Cluster[];
  selectedClusterId: string | null;
  selectCluster: (id: string | null) => void;
  selectedCluster: Cluster | null;
  selectedArticles: Article[];

  splitArticleOut: (articleId: string) => void;
  resetSplits: () => void;

  mergeModeSourceId: string | null;
  startMergeMode: (articleId: string) => void;
  cancelMergeMode: () => void;
  mergeIntoCluster: (targetClusterId: string) => void;
  resetMerges: () => void;
};

const ClustersCtx = createContext<Ctx | null>(null);

function clusterAnchorOf(clusterId: string, clusters: Cluster[]): string | undefined {
  const c = clusters.find(x => x.id === clusterId);
  if (!c) return undefined;
  return c.articleIds[0];
}

export function ClustersProvider({ children }: { children: ReactNode }) {
  const { articles } = useArticles();
  const { settings } = useSettings();
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [splitOut, setSplitOut] = useState<Set<string>>(new Set());
  const [manualMerges, setManualMerges] = useState<Record<string, string>>({});
  const [mergeModeSourceId, setMergeModeSourceId] = useState<string | null>(null);

  const clusters = useMemo(() => {
    const win = settings.articleWindow;
    const pool = win === 'breaking' ? articles.filter(a => a.isBreaking) : articles;
    const auto = groupIntoClusters(pool, { threshold: settings.clusterThreshold, windowMs: WINDOW_MS[win] });

    let withSplits: Cluster[] = [];
    for (const c of auto) {
      const stayed = c.articleIds.filter(id => !splitOut.has(id));
      const removed = c.articleIds.filter(id => splitOut.has(id));
      if (stayed.length > 0) withSplits.push({ ...c, articleIds: stayed });
      for (const id of removed) {
        const art = articles.find(a => a.id === id);
        if (!art) continue;
        withSplits.push({
          id: `solo-${id}`,
          articleIds: [id],
          representativeTitle: art.title,
          entities: [],
          createdAt: art.fetchedAt,
        });
      }
    }

    if (Object.keys(manualMerges).length > 0) {
      for (const [moverId, anchorId] of Object.entries(manualMerges)) {
        const moverArticle = articles.find(a => a.id === moverId);
        if (!moverArticle) continue;

        withSplits = withSplits
          .map(c => ({ ...c, articleIds: c.articleIds.filter(id => id !== moverId) }))
          .filter(c => c.articleIds.length > 0);

        const targetCluster = withSplits.find(c => c.articleIds.includes(anchorId));
        if (targetCluster) {
          targetCluster.articleIds.push(moverId);
          targetCluster.representativeTitle =
            articles.find(a => a.id === targetCluster.articleIds[0])?.title ?? targetCluster.representativeTitle;
        } else {
          withSplits.push({
            id: `manual-${anchorId}`,
            articleIds: [anchorId, moverId],
            representativeTitle: moverArticle.title,
            entities: [],
            createdAt: moverArticle.fetchedAt,
          });
        }
      }
    }

    withSplits.sort((a, b) => b.createdAt - a.createdAt);
    return withSplits;
  }, [articles, settings.clusterThreshold, settings.articleWindow, splitOut, manualMerges]);

  useEffect(() => {
    if (selectedClusterId && !clusters.some(c => c.id === selectedClusterId)) {
      setSelectedClusterId(clusters[0]?.id ?? null);
    }
  }, [clusters, selectedClusterId]);

  const selectCluster = useCallback((id: string | null) => setSelectedClusterId(id), []);

  const splitArticleOut = useCallback((articleId: string) => {
    setSplitOut(prev => {
      const next = new Set(prev);
      next.add(articleId);
      return next;
    });
    setManualMerges(prev => {
      if (!(articleId in prev)) return prev;
      const { [articleId]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const resetSplits = useCallback(() => setSplitOut(new Set()), []);

  const startMergeMode = useCallback((articleId: string) => {
    setMergeModeSourceId(articleId);
  }, []);

  const cancelMergeMode = useCallback(() => setMergeModeSourceId(null), []);

  const mergeIntoCluster = useCallback((targetClusterId: string) => {
    setMergeModeSourceId(current => {
      if (!current) return null;
      const anchor = clusterAnchorOf(targetClusterId, clusters);
      if (!anchor || anchor === current) return null;
      setManualMerges(prev => ({ ...prev, [current]: anchor }));
      setSplitOut(prev => {
        if (!prev.has(current)) return prev;
        const next = new Set(prev);
        next.delete(current);
        return next;
      });
      return null;
    });
  }, [articles, clusters]);

  const resetMerges = useCallback(() => setManualMerges({}), []);

  const selectedCluster = useMemo(
    () => clusters.find(c => c.id === selectedClusterId) || null,
    [clusters, selectedClusterId]
  );

  const selectedArticles = useMemo(() => {
    if (!selectedCluster) return [];
    return selectedCluster.articleIds
      .map(id => articles.find(a => a.id === id))
      .filter((a): a is Article => !!a);
  }, [selectedCluster, articles]);

  return (
    <ClustersCtx.Provider value={{
      clusters, selectedClusterId, selectCluster, selectedCluster, selectedArticles,
      splitArticleOut, resetSplits,
      mergeModeSourceId, startMergeMode, cancelMergeMode, mergeIntoCluster, resetMerges,
    }}>
      {children}
    </ClustersCtx.Provider>
  );
}

export function useClusters(): Ctx {
  const ctx = useContext(ClustersCtx);
  if (!ctx) throw new Error('useClusters must be used within ClustersProvider');
  return ctx;
}
