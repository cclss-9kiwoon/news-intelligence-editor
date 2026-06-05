import { useEffect, useRef } from 'react';
import { useClusters } from '../../state/ClustersContext';
import { useArticles } from '../../state/ArticlesContext';
import { useSettings } from '../../state/SettingsContext';
import { useTasks } from '../../state/TaskContext';
import { generateStory, judgeExcludedTopic } from '../../lib/promptChain';
import { reviewDraft } from '../../lib/review';
import { shouldClaimCluster } from '../../lib/searchFilter';
import { cheapStageSettings, writingStageSettings } from '../../lib/stageModel';
import type { Campaign, Category, Task } from '../../types';

const SOURCE_REVIEW_TIMEOUT_MS = 90_000; // 전문 수집 대기 상한
const HOUR_MS = 3600_000;
const WINDOW_MS: Record<string, number> = {
  '1h': HOUR_MS, '24h': 24 * HOUR_MS, '7d': 7 * 24 * HOUR_MS, '30d': 30 * 24 * HOUR_MS, breaking: 30 * 24 * HOUR_MS,
};

/**
 * Pasta 자동 파이프라인: 서칭 → 주제 검수 → 아티클 제작 자동 전환.
 * 렌더링 없는 로직 컴포넌트. 칸반 모드의 Provider 트리 안에 위치.
 * 결과물 검수(final_review)는 사람이 처리.
 */
export function SearchingPipeline({ campaign }: { campaign: Campaign }) {
  const { clusters } = useClusters();
  const { articles } = useArticles();
  const { settings } = useSettings();
  const { tasks, addTask, updateTask, deleteTask } = useTasks();
  const producingRef = useRef<Set<string>>(new Set());
  const topicJudgeRef = useRef<Set<string>>(new Set()); // 제외 주제 AI 판단 진행 중 가드
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const searchingCfg = campaign.settings.searching;
  const windowMs = WINDOW_MS[searchingCfg.articleWindow] ?? 24 * HOUR_MS;
  const maxPerHour = searchingCfg.maxPerHour ?? 3;
  const autoPublish = !!campaign.settings.finalReview.autoPublish;

  const myTasks = tasks.filter(t => t.campaignId === campaign.id);
  // deps용 시그니처 (상태/플래그 변화 반영 — paused/priority 포함해 보드 조작 즉시 반영)
  const taskSig = myTasks.map(t => `${t.id}:${t.status}:${t.draft ? 1 : 0}:${t.error ? 1 : 0}:${t.produceAttempts ?? 0}:${t.topicChecked ? 1 : 0}:${t.paused ? 1 : 0}:${t.priority ? 1 : 0}:${t.published ? 1 : 0}`).join(',');

  // 기준기사 시각 (만료·골든타임·승급정렬용) — 대표 기사 pubDate, 없으면 생성시각
  const refTime = (t: Task): number => {
    const a = articles.find(x => x.id === t.sources[0]?.articleId);
    const p = a?.pubDate ? Date.parse(a.pubDate) : NaN;
    return Number.isNaN(p) ? t.createdAt : p;
  };

  // ── 1. ① 대기큐 채우기: 자격 클러스터 전부 생성(LLM 비용 없음, 상한 없음). 실패 클러스터 자가치유 ──
  useEffect(() => {
    if (campaign.autoCollect && campaign.autoCollect.enabled === false) return;
    const now = Date.now();
    const campaignTasks = tasks.filter(t => t.campaignId === campaign.id);
    const working: Task[] = campaignTasks.filter(t => !t.error);
    const erroredByCluster = new Map<string, string>();
    campaignTasks.filter(t => t.error).forEach(t => erroredByCluster.set(t.clusterId, t.id));

    for (const cluster of clusters) {
      const decision = shouldClaimCluster(cluster, articles, searchingCfg, working, now);
      if (!decision.ok) continue;
      const stale = erroredByCluster.get(cluster.id);
      if (stale) deleteTask(stale);
      const created = addTask({
        campaignId: campaign.id, status: 'searching',
        title: cluster.representativeTitle, clusterId: cluster.id,
        sources: decision.sources, imageCount: decision.imageCount,
      });
      working.push(created);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clusters, articles, taskSig, campaign.id, campaign.autoCollect?.enabled]);

  // ── 1b. ① 만료: 기준기사가 articleWindow 벗어난 대기 후보 자동 폐기(완전 삭제). 보류는 면제 ──
  useEffect(() => {
    const now = Date.now();
    for (const t of myTasks) {
      if (t.status !== 'searching' || t.error || t.paused) continue;
      if (now - refTime(t) > windowMs) deleteTask(t.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskSig, articles, windowMs]);

  // ── 2. ①→② 승급: 시간당 상한 내에서 우선·최신 순. 골든타임 임박 시 자동 우선 ──
  useEffect(() => {
    const now = Date.now();
    const promotedLastHour = myTasks.filter(t => t.promotedAt && now - t.promotedAt <= HOUR_MS).length;
    let slots = maxPerHour > 0 ? maxPerHour - promotedLastHour : Infinity;
    if (slots <= 0) return;

    const queue = myTasks.filter(t => t.status === 'searching' && !t.error && !t.paused);
    // 골든타임 임박(잔여 < 20%) 자동 우선 플래그
    for (const t of queue) {
      if (!t.priority && windowMs > 0 && (windowMs - (now - refTime(t))) < windowMs * 0.2) {
        updateTask(t.id, { priority: true });
      }
    }
    queue.sort((a, b) => (b.priority ? 1 : 0) - (a.priority ? 1 : 0) || refTime(b) - refTime(a));

    for (const t of queue) {
      if (slots <= 0) break;
      updateTask(t.id, { status: 'topic_review', promotedAt: now });
      slots--;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskSig, articles, maxPerHour, windowMs]);

  // ── 3. ② 검수: 전문 수집 대기 + 제외 주제 AI 판단 → 제작 전환 / 탈락 ──
  useEffect(() => {
    const excludeTopics = (searchingCfg.excludeTopics ?? []).filter(x => x.trim());

    for (const t of myTasks) {
      if (t.status !== 'topic_review' || t.error || t.paused) continue;

      // 전문 수집 대기 (승급 시각 기준 타임아웃)
      const refreshed = t.sources.map(s => {
        const a = articles.find(x => x.id === s.articleId);
        return a ? { ...s, hasFullText: !!a.fullText } : s;
      });
      const fullTextCount = refreshed.filter(s => s.hasFullText).length;
      const changed = refreshed.some((s, i) => s.hasFullText !== t.sources[i].hasFullText);
      const imageCount = articles
        .filter(a => t.sources.some(s => s.articleId === a.id))
        .reduce((n, a) => n + (a.images?.length ?? 0), 0);

      if (fullTextCount === 0) {
        if (Date.now() - (t.promotedAt ?? t.createdAt) > SOURCE_REVIEW_TIMEOUT_MS) {
          updateTask(t.id, { sources: refreshed, error: '전문 수집 실패 (출처 0건)' });
        } else if (changed) {
          updateTask(t.id, { sources: refreshed, imageCount });
        }
        continue;
      }

      // 제외 주제 AI 판단 게이트 — 통과(topicChecked) 전엔 제작으로 안 넘김.
      if (excludeTopics.length > 0 && !t.topicChecked) {
        if (!topicJudgeRef.current.has(t.id)) {
          topicJudgeRef.current.add(t.id);
          const snippets = articles
            .filter(a => t.sources.some(s => s.articleId === a.id))
            .map(a => a.description || a.fullText?.slice(0, 300) || '');
          judgeExcludedTopic({ title: t.title, snippets }, excludeTopics, cheapStageSettings(settings))
            .then(r => {
              if (!mountedRef.current) return;
              if (r.excluded) updateTask(t.id, { error: `제외 주제 해당: ${r.matched || '동일 주제'}` });
              else updateTask(t.id, { topicChecked: true });
            })
            .catch(() => { if (mountedRef.current) updateTask(t.id, { topicChecked: true }); }) // fail-open. PM ② 견고화에서 보류로 교체 예정
            .finally(() => { topicJudgeRef.current.delete(t.id); });
        }
        continue; // 판단 결과 대기
      }

      updateTask(t.id, { sources: refreshed, imageCount, status: 'producing' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskSig, articles, settings, searchingCfg.excludeTopics]);

  // ── 4. ③ 제작: LLM 생성 → 결과물 검수 전환 ──
  useEffect(() => {
    for (const t of myTasks) {
      if (t.status !== 'producing' || t.draft || t.error || t.paused) continue;
      if (producingRef.current.has(t.id)) continue;
      producingRef.current.add(t.id);

      const srcArticles = articles.filter(a => t.sources.some(s => s.articleId === a.id));
      const category: Category =
        settings.categories.find(c => c.id === settings.activeCategoryId)
        ?? settings.categories[0]
        ?? { id: 'default', label: '기본', criteria: '', tone: '' };

      const attempt = (t.produceAttempts ?? 0) + 1;
      const MAX_ATTEMPTS = 3;

      generateStory(srcArticles, writingStageSettings(settings, campaign.settings.generation.writingModel), category)
        .then(async draft => {
          let review;
          try { review = await reviewDraft(draft, cheapStageSettings(settings)); } catch { review = undefined; }
          if (mountedRef.current) updateTask(t.id, { draft, review, status: 'final_review', produceAttempts: attempt });
        })
        .catch(() => {
          if (!mountedRef.current) return;
          if (attempt < MAX_ATTEMPTS) {
            // 자동 재시도: producing 유지, attempts만 증가 (다음 사이클에 재실행)
            updateTask(t.id, { produceAttempts: attempt });
          } else {
            // 최종 실패: 사람 읽을 메시지 + raw 에러 별도 보관
            updateTask(t.id, {
              error: '초안 생성 실패 — AI 응답을 처리하지 못했습니다. 다시 시도하거나 수동 워크벤치를 이용하세요.',
              produceAttempts: attempt,
            });
          }
        })
        .finally(() => { producingRef.current.delete(t.id); });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskSig, articles, settings]);

  // ── 5. ④ 자동 발행: autoPublish on + Verified(검수 통과)면 자동 발행. 미통과는 사람 대기 ──
  useEffect(() => {
    if (!autoPublish) return;
    const now = Date.now();
    for (const t of myTasks) {
      if (t.status !== 'final_review' || t.published || t.error || t.paused) continue;
      if (t.review?.passed) updateTask(t.id, { published: true, publishedAt: now });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskSig, autoPublish]);

  return null;
}
