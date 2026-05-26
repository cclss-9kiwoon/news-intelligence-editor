import { createContext, useContext, useMemo, useState, useCallback, useEffect, ReactNode } from 'react';
import type { Article, Cluster } from '../types';
import { groupIntoClusters } from '../lib/clustering';
import { useArticles } from './ArticlesContext';

type Override = {
  splitOut: Set<string>;
};

type Ctx = {
  clusters: Cluster[];
  selectedClusterId: string | null;
  selectCluster: (id: string | null) => void;
  selectedCluster: Cluster | null;
  selectedArticles: Article[];
  splitArticleOut: (articleId: string) => void;
  resetSplits: () => void;
};

const ClustersCtx = createContext<Ctx | null>(null);

export function ClustersProvider({ children }: { children: ReactNode }) {
  const { articles } = useArticles();
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [override, setOverride] = useState<Override>({ splitOut: new Set() });

  const clusters = useMemo(() => {
    const auto = groupIntoClusters(articles);
    if (override.splitOut.size === 0) return auto;

    const out: Cluster[] = [];
    for (const c of auto) {
      const stayed = c.articleIds.filter(id => !override.splitOut.has(id));
      const removed = c.articleIds.filter(id => override.splitOut.has(id));
      if (stayed.length > 0) {
        out.push({ ...c, articleIds: stayed });
      }
      for (const id of removed) {
        const art = articles.find(a => a.id === id);
        if (!art) continue;
        out.push({
          id: `solo-${id}`,
          articleIds: [id],
          representativeTitle: art.title,
          entities: [],
          createdAt: art.fetchedAt,
        });
      }
    }
    return out;
  }, [articles, override.splitOut]);

  useEffect(() => {
    if (selectedClusterId && !clusters.some(c => c.id === selectedClusterId)) {
      setSelectedClusterId(clusters[0]?.id ?? null);
    }
  }, [clusters, selectedClusterId]);

  const selectCluster = useCallback((id: string | null) => setSelectedClusterId(id), []);

  const splitArticleOut = useCallback((articleId: string) => {
    setOverride(prev => {
      const next = new Set(prev.splitOut);
      next.add(articleId);
      return { splitOut: next };
    });
  }, []);

  const resetSplits = useCallback(() => setOverride({ splitOut: new Set() }), []);

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
      clusters,
      selectedClusterId,
      selectCluster,
      selectedCluster,
      selectedArticles,
      splitArticleOut,
      resetSplits,
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
