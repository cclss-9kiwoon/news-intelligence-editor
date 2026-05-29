import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import type { Article } from '../types';
import { fetchRss, dedupeAndMerge, makeArticleId, clearAllRssCache } from '../lib/rss';
import { useSettings } from './SettingsContext';
import { classifyArticleCategory } from '../lib/clustering';
import { enrichArticlesWithFullText, getLastEnrichMethod } from '../lib/scraper';
import { fetchNaverArticles } from '../lib/naver';

const HIDDEN_MULTIPLIER = 3;
const MIN_POLL_MS = 60_000;
const MAX_ARTICLES = 200;

type Ctx = {
  articles: Article[];
  selectedArticle: Article | null;
  selectArticle: (a: Article | null) => void;
  addManualArticle: (input: { title: string; text: string; sourceUrl?: string }) => Article;
  refreshNow: () => Promise<void>;
  isRefreshing: boolean;
  isInitialLoading: boolean;
  lastRefreshedAt: number | null;
  enrichStats: { enriched: number; failed: number } | null;
  enrichMethod: 'naver' | 'jina' | 'none';
};

const ArticlesCtx = createContext<Ctx | null>(null);

export function ArticlesProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedArticle, setSelected] = useState<Article | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null);
  const [enrichStats, setEnrichStats] = useState<{ enriched: number; failed: number } | null>(null);
  const [enrichMethod, setEnrichMethod] = useState<'naver' | 'jina' | 'none'>('none');
  const inFlightRef = useRef(false);

  const sourcesRef = useRef(settings.rssSources);
  useEffect(() => { sourcesRef.current = settings.rssSources; }, [settings.rssSources]);

  const rss2jsonKeyRef = useRef(settings.rss2jsonApiKey);
  useEffect(() => { rss2jsonKeyRef.current = settings.rss2jsonApiKey; }, [settings.rss2jsonApiKey]);

  const naverIdRef = useRef(settings.naverClientId);
  useEffect(() => { naverIdRef.current = settings.naverClientId; }, [settings.naverClientId]);
  const naverSecretRef = useRef(settings.naverClientSecret);
  useEffect(() => { naverSecretRef.current = settings.naverClientSecret; }, [settings.naverClientSecret]);
  const naverQueriesRef = useRef(settings.naverQueries);
  useEffect(() => { naverQueriesRef.current = settings.naverQueries; }, [settings.naverQueries]);

  useEffect(() => {
    if (settings.naverClientId && settings.naverClientSecret) {
      setEnrichMethod('naver');
    }
  }, [settings.naverClientId, settings.naverClientSecret]);

  const pollMsRef = useRef(Math.max(MIN_POLL_MS, settings.rssPollMinutes * 60_000));
  useEffect(() => {
    pollMsRef.current = Math.max(MIN_POLL_MS, settings.rssPollMinutes * 60_000);
  }, [settings.rssPollMinutes]);

  /**
   * Shared fetch+classify+render+enrich helper.
   *
   * Primary (Naver keys present):
   *   Naver search → #dic_area full text extraction → articles arrive with fullText
   *   + RSS as supplement (for non-Korean or niche sources)
   *
   * Fallback (no Naver keys):
   *   RSS only → Jina enrichment in background
   */
  const fetchClassifyAndEnrich = useCallback(async () => {
    const hasNaver = !!(naverIdRef.current && naverSecretRef.current);

    let incoming: Article[] = [];
    let initialEnriched = 0;

    if (hasNaver) {
      // ── Naver as primary source (articles arrive with fullText) ──
      const naverArticles = await fetchNaverArticles(
        naverQueriesRef.current,
        naverIdRef.current,
        naverSecretRef.current,
      );
      incoming.push(...naverArticles);

      // Also fetch RSS for supplementary sources (non-Korean, niche feeds)
      const enabled = sourcesRef.current.filter(s => s.enabled);
      const rssResults = await Promise.all(enabled.map(s => fetchRss(s, rss2jsonKeyRef.current)));
      incoming.push(...rssResults.flat());

      initialEnriched = naverArticles.filter(a => a.fullText).length;
      if (initialEnriched > 0) {
        setEnrichStats({ enriched: initialEnriched, failed: naverArticles.length - initialEnriched });
        setEnrichMethod('naver');
      }
    } else {
      // ── RSS only ──
      const enabled = sourcesRef.current.filter(s => s.enabled);
      const results = await Promise.all(enabled.map(s => fetchRss(s, rss2jsonKeyRef.current)));
      incoming = results.flat();
    }

    // Classify categories
    for (const a of incoming) {
      if (!a.category) {
        a.category = classifyArticleCategory(a);
      }
    }

    // Show articles immediately
    setArticles(prev => dedupeAndMerge(prev, incoming, MAX_ARTICLES));

    // Background enrichment: extract full text for articles still missing it
    // Uses Jina Reader (universal, no API key) → HTML proxy fallback
    const needsEnrichment = incoming.filter(
      a => !a.fullText && a.link?.startsWith('http') &&
           !a.link.startsWith('manual://') && !a.link.startsWith('simulator://'),
    );
    if (needsEnrichment.length > 0) {
      enrichArticlesWithFullText(incoming, naverIdRef.current, naverSecretRef.current).then(stats => {
        setEnrichStats({
          enriched: initialEnriched + stats.enriched,
          failed: stats.failed,
        });
        if (stats.enriched > 0) {
          setEnrichMethod(getLastEnrichMethod());
          setArticles(prev => dedupeAndMerge(prev, incoming, MAX_ARTICLES));
        }
      });
    }
  }, []);

  const pollOnce = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      await fetchClassifyAndEnrich();
      setIsInitialLoading(false);
    } finally {
      inFlightRef.current = false;
    }
  }, [fetchClassifyAndEnrich]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    const start = () => {
      pollOnce();
      const ms = document.hidden ? pollMsRef.current * HIDDEN_MULTIPLIER : pollMsRef.current;
      timer = setInterval(pollOnce, ms);
    };
    const stop = () => clearInterval(timer);
    const onVisibility = () => { stop(); start(); };

    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility); };
  }, [pollOnce]);

  const selectArticle = useCallback((a: Article | null) => setSelected(a), []);

  const addManualArticle = useCallback((input: { title: string; text: string; sourceUrl?: string }) => {
    const link = input.sourceUrl || `manual://${Date.now()}`;
    const art: Article = {
      id: makeArticleId(link),
      title: input.title || '(직접 입력)',
      description: input.text.slice(0, 500),
      fullText: input.text,
      link,
      pubDate: new Date().toUTCString(),
      source: input.sourceUrl ? 'URL 입력' : '직접 입력',
      inputType: input.sourceUrl ? 'url' : 'paste',
      fetchedAt: Date.now(),
    };
    if (!art.category) {
      art.category = classifyArticleCategory(art);
    }
    setArticles(prev => dedupeAndMerge(prev, [art], MAX_ARTICLES));
    setSelected(art);
    return art;
  }, []);

  const forceRefresh = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsRefreshing(true);
    try {
      clearAllRssCache();
      await fetchClassifyAndEnrich();
      setLastRefreshedAt(Date.now());
    } finally {
      inFlightRef.current = false;
      setIsRefreshing(false);
    }
  }, [fetchClassifyAndEnrich]);

  return (
    <ArticlesCtx.Provider value={{ articles, selectedArticle, selectArticle, addManualArticle, refreshNow: forceRefresh, isRefreshing, isInitialLoading, lastRefreshedAt, enrichStats, enrichMethod }}>
      {children}
    </ArticlesCtx.Provider>
  );
}

export function useArticles(): Ctx {
  const ctx = useContext(ArticlesCtx);
  if (!ctx) throw new Error('useArticles must be used within ArticlesProvider');
  return ctx;
}
