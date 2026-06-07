import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import type { Article } from '../types';
import { fetchRss, dedupeAndMerge, makeArticleId, clearAllRssCache } from '../lib/rss';
import { useSettings } from './SettingsContext';
import { classifyArticleCategory } from '../lib/clustering';
import { enrichArticlesWithFullText, getLastEnrichMethod } from '../lib/scraper';
import { fetchNaverArticles } from '../lib/naver';
import { fetchDaumArticles } from '../lib/daum';
import { searchFailureMessage, type SearchFetchStats } from '../lib/searchStats';

const HIDDEN_MULTIPLIER = 3;
const MIN_POLL_MS = 60_000;
const MAX_ARTICLES = 200;
const MIN_SPINNER_MS = 600;   // #2: 스피너 최소 노출(깜빡임 방지)

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
  // 진행 중인 수집 promise — 폴러/수동이 서로 합류(join)할 수 있게 공유.
  const inFlightPromiseRef = useRef<Promise<void> | null>(null);

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

    // search 잡은 stats(httpStatus/rawCount/droppedNonNews/finalCount) 동반 →
    // 인증실패 / 빈응답 / allowlist 전량 drop을 구분해 정직한 메시지(거짓 키에러 방지).
    type JobResult = { articles: Article[]; stats?: SearchFetchStats };
    type Job = { label: string; kind: 'search' | 'rss'; run: () => Promise<JobResult> };
    const jobs: Job[] = [];
    if (hasNaver) jobs.push({ label: '네이버 검색', kind: 'search', run: () => fetchNaverArticles(naverQueriesRef.current, naverIdRef.current, naverSecretRef.current) });
    if (hasDaum) jobs.push({ label: '다음 검색', kind: 'search', run: () => fetchDaumArticles(daumQueriesRef.current, daumKeyRef.current) });
    for (const s of enabled) jobs.push({ label: s.name, kind: 'rss', run: async () => ({ articles: await fetchRss(s, rss2jsonKeyRef.current) }) });

    const settled = await Promise.allSettled(jobs.map(j => j.run()));
    const failures: string[] = [];
    let searchArticleCount = 0;
    let searchEnrichedCount = 0;
    settled.forEach((res, i) => {
      const job = jobs[i];
      if (res.status === 'fulfilled') {
        const arts = res.value.articles;
        incoming.push(...arts);
        if (job.kind === 'search') {
          searchArticleCount += arts.length;
          searchEnrichedCount += arts.filter(a => a.fullText).length;
          // stats 기반 정직한 분기 (401→키확인 / allowlist전량drop→정상 / 빈응답)
          if (res.value.stats) {
            const msg = searchFailureMessage(job.label, res.value.stats);
            if (msg) failures.push(msg);
          } else if (arts.length === 0) {
            failures.push(`${job.label}: 결과 없음`);
          }
        }
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
      // #3: enrichment를 await — isRefreshing/inFlight를 전문추출 완료까지 유지(스피너 조기 종료 방지).
      // 과거 fire-and-forget(.then)이라 fetch+분류만 로딩 표시 → 소스 적으면 깜빡임.
      setLoadingStatus(`전문 추출 중 (0/${needsEnrichment.length})...`);
      const stats = await enrichArticlesWithFullText(incoming, naverIdRef.current, naverSecretRef.current, (done, total) => {
        setLoadingStatus(`전문 추출 중 (${done}/${total})...`);
      });
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
    } else {
      setLoadingStatus('');
    }
  }, []);

  const pollOnce = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    const p = (async () => {
      try {
        await fetchClassifyAndEnrich();
      } catch (err) {
        console.warn('[articles] poll failed', err);
        setCollectError('수집 중 오류 발생');
      }
    })();
    inFlightPromiseRef.current = p;
    try {
      await p;
    } finally {
      setIsInitialLoading(false);
      setLoadingStatus('');
      inFlightRef.current = false;
      if (inFlightPromiseRef.current === p) inFlightPromiseRef.current = null;
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
    // (c) inFlight 체크 *전에* 즉시 스피너 — 클릭이 조용히 무시되는 먹통 체감 제거.
    setIsRefreshing(true);
    const startedAt = Date.now();
    // #2: 스피너 최소 노출 보장 후 해제 (깜빡임 방지).
    const releaseSpinner = async () => {
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_SPINNER_MS) {
        await new Promise(r => setTimeout(r, MIN_SPINNER_MS - elapsed));
      }
      setIsRefreshing(false);
      setLoadingStatus('');
    };

    // (a) 이미 수집 중(백그라운드 폴러 등) — bare return 금지. 진행 중 작업에 합류해
    //     완료까지 스피너 유지하고, 사용자에 "이미 수집 중" 표시.
    if (inFlightRef.current && inFlightPromiseRef.current) {
      setLoadingStatus('이미 수집 중…');
      try { await inFlightPromiseRef.current; } catch { /* 오류는 해당 실행에서 collectError로 노출됨 */ }
      await releaseSpinner();
      return;
    }

    inFlightRef.current = true;
    const p = (async () => {
      clearAllRssCache();
      await fetchClassifyAndEnrich();
      setLastRefreshedAt(Date.now());
    })();
    inFlightPromiseRef.current = p;
    try {
      await p;
    } catch (err) {
      console.warn('[articles] refresh failed', err);
      setCollectError('수집 중 오류 발생');
    } finally {
      inFlightRef.current = false;
      if (inFlightPromiseRef.current === p) inFlightPromiseRef.current = null;
      await releaseSpinner();   // 어떤 실패든 스피너 해제 (영구 로딩 금지)
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
