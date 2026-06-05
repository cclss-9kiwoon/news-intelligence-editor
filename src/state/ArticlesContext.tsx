import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import type { Article } from '../types';
import { fetchRss, dedupeAndMerge, makeArticleId, clearAllRssCache } from '../lib/rss';
import { useSettings } from './SettingsContext';
import { classifyArticleCategory } from '../lib/clustering';
import { enrichArticlesWithFullText, getLastEnrichMethod } from '../lib/scraper';
import { fetchNaverArticles } from '../lib/naver';
import { fetchDaumArticles } from '../lib/daum';

const HIDDEN_MULTIPLIER = 3;
const MIN_POLL_MS = 60_000;
const MAX_ARTICLES = 200;

type EnrichStats = {
  enriched: number;
  failed: number;
  skipped: number;
  total: number;
};

type Ctx = {
  articles: Article[];
  selectedArticle: Article | null;
  selectArticle: (a: Article | null) => void;
  addManualArticle: (input: { title: string; text: string; sourceUrl?: string }) => Article;
  refreshNow: () => Promise<void>;
  isRefreshing: boolean;
  isInitialLoading: boolean;
  loadingStatus: string;
  lastRefreshedAt: number | null;
  enrichStats: EnrichStats | null;
  enrichMethod: 'naver' | 'jina' | 'none';
  collectError: string | null;   // 소스별 수집 실패 안내 (네이버 401 등)
};

const ArticlesCtx = createContext<Ctx | null>(null);

export function ArticlesProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedArticle, setSelected] = useState<Article | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState('초기화 중...');
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null);
  const [enrichStats, setEnrichStats] = useState<EnrichStats | null>(null);
  const [enrichMethod, setEnrichMethod] = useState<'naver' | 'jina' | 'none'>('none');
  const [collectError, setCollectError] = useState<string | null>(null);
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
  const daumKeyRef = useRef(settings.daumRestApiKey);
  useEffect(() => { daumKeyRef.current = settings.daumRestApiKey; }, [settings.daumRestApiKey]);
  const daumQueriesRef = useRef(settings.daumQueries);
  useEffect(() => { daumQueriesRef.current = settings.daumQueries; }, [settings.daumQueries]);

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
    const hasDaum = !!daumKeyRef.current;

    let incoming: Article[] = [];
    let initialEnriched = 0;

    // 견고성: 모든 소스를 Promise.allSettled로 — 한 소스 실패(naver 401 등)가
    // 전체 수집을 멈추지 않게. 소스별 실패는 수집해서 사용자에 노출.
    setLoadingStatus(hasNaver || hasDaum ? '검색 API + RSS 수집 중...' : 'RSS 수집 중...');
    const enabled = sourcesRef.current.filter(s => s.enabled);

    type Job = { label: string; kind: 'search' | 'rss'; run: () => Promise<Article[]> };
    const jobs: Job[] = [];
    if (hasNaver) jobs.push({ label: '네이버 검색', kind: 'search', run: () => fetchNaverArticles(naverQueriesRef.current, naverIdRef.current, naverSecretRef.current) });
    if (hasDaum) jobs.push({ label: '다음 검색', kind: 'search', run: () => fetchDaumArticles(daumQueriesRef.current, daumKeyRef.current) });
    for (const s of enabled) jobs.push({ label: s.name, kind: 'rss', run: () => fetchRss(s, rss2jsonKeyRef.current) });

    const settled = await Promise.allSettled(jobs.map(j => j.run()));
    const failures: string[] = [];
    let searchArticleCount = 0;
    let searchEnrichedCount = 0;
    settled.forEach((res, i) => {
      const job = jobs[i];
      if (res.status === 'fulfilled') {
        incoming.push(...res.value);
        if (job.kind === 'search') {
          searchArticleCount += res.value.length;
          searchEnrichedCount += res.value.filter(a => a.fullText).length;
        }
        // 키 있는 검색 소스가 0건이면 인증/응답 실패 가능성 — 알림
        if (job.kind === 'search' && res.value.length === 0) failures.push(`${job.label}: 결과 0 (키·인증 확인)`);
      } else {
        failures.push(`${job.label}: 실패`);
        console.warn(`[articles] source failed: ${job.label}`, res.reason);
      }
    });

    initialEnriched = searchEnrichedCount;
    if (searchEnrichedCount > 0) {
      setEnrichStats({ enriched: searchEnrichedCount, failed: searchArticleCount - searchEnrichedCount, skipped: 0, total: searchArticleCount });
      setEnrichMethod(hasNaver ? 'naver' : 'jina');
    }
    // 소스 실패 노출 (전체 침묵 금지)
    setCollectError(failures.length > 0 ? failures.join(' · ') : null);

    setLoadingStatus('카테고리 분류 중...');
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
      setLoadingStatus(`전문 추출 중 (0/${needsEnrichment.length})...`);
      enrichArticlesWithFullText(incoming, naverIdRef.current, naverSecretRef.current, (done, total) => {
        setLoadingStatus(`전문 추출 중 (${done}/${total})...`);
      }).then(stats => {
        setLoadingStatus('');
        const total = initialEnriched + stats.total;
        setEnrichStats({
          enriched: initialEnriched + stats.enriched,
          failed: stats.failed + stats.blocked,
          skipped: stats.skipped,
          total,
        });
        if (stats.enriched > 0 && stats.updates.size > 0) {
          setEnrichMethod(getLastEnrichMethod());
          // Immutable merge: create new article objects with enriched data
          setArticles(prev => prev.map(a => {
            const patch = stats.updates.get(a.link);
            if (!patch) return a;
            return {
              ...a,
              fullText: patch.fullText,
              ...(patch.images ? { images: patch.images } : {}),
            };
          }));
        }
      });
    } else {
      setLoadingStatus('');
    }
  }, []);

  const pollOnce = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      await fetchClassifyAndEnrich();
    } catch (err) {
      console.warn('[articles] poll failed', err);
      setCollectError('수집 중 오류 발생');
    } finally {
      setIsInitialLoading(false);
      setLoadingStatus('');
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
    } catch (err) {
      console.warn('[articles] refresh failed', err);
      setCollectError('수집 중 오류 발생');
    } finally {
      inFlightRef.current = false;
      setIsRefreshing(false);   // 어떤 실패든 스피너 해제 (영구 로딩 금지)
      setLoadingStatus('');
    }
  }, [fetchClassifyAndEnrich]);

  return (
    <ArticlesCtx.Provider value={{ articles, selectedArticle, selectArticle, addManualArticle, refreshNow: forceRefresh, isRefreshing, isInitialLoading, loadingStatus, lastRefreshedAt, enrichStats, enrichMethod, collectError }}>
      {children}
    </ArticlesCtx.Provider>
  );
}

export function useArticles(): Ctx {
  const ctx = useContext(ArticlesCtx);
  if (!ctx) throw new Error('useArticles must be used within ArticlesProvider');
  return ctx;
}
