import { useEffect, useRef } from 'react';
import { useClusters } from '../../state/ClustersContext';
import { useArticles } from '../../state/ArticlesContext';
import { useSettings } from '../../state/SettingsContext';
import { useTasks } from '../../state/TaskContext';
import { generateStory, judgeExcludedTopic } from '../../lib/promptChain';
import { reviewDraft } from '../../lib/review';
import { shouldClaimCluster } from '../../lib/searchFilter';
import type { Campaign, Category, Task } from '../../types';

const SOURCE_REVIEW_TIMEOUT_MS = 90_000; // 전문 수집 대기 상한

/**
 * Pasta 자동 파이프라인: 서칭 → 주제 검수 → 아티클 제작 자동 전환.
 * 렌더링 없는 로직 컴포넌트. 칸반 모드의 Provider 트리 안에 위치.
 * 결과물 검수(final_review)는 사람이 처리.
 */
export function SearchingPipeline({ campaign }: { campaign: Campaign }) {
  const { clusters } = useClusters();
  const { articles } = useArticles();
  const { settings } = useSettings();
  const { tasks, addTask, updateTask, moveTask } = useTasks();
  const producingRef = useRef<Set<string>>(new Set());
  const topicJudgeRef = useRef<Set<string>>(new Set()); // 제외 주제 AI 판단 진행 중 가드
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const myTasks = tasks.filter(t => t.campaignId === campaign.id);
  // deps용 시그니처 (태스크 추가/삭제/상태변경 모두 반영)
  const taskSig = myTasks.map(t => `${t.id}:${t.status}:${t.draft ? 1 : 0}:${t.error ? 1 : 0}:${t.produceAttempts ?? 0}:${t.topicChecked ? 1 : 0}`).join(',');

  // ── 1. 서칭: 클러스터 → 태스크 생성 ──
  useEffect(() => {
    const searching = campaign.settings.searching;
    const now = Date.now();

    // 점유 판정은 lib/searchFilter.shouldClaimCluster(순수함수)에 위임.
    // 같은 사이클 내 중복 점유 방지: claim 시 합성 태스크를 working에 push해
    // 다음 클러스터 판정에서 claimedArticleIds·entityCountToday에 반영되게 한다.
    const working: Task[] = tasks.filter(t => t.campaignId === campaign.id);

    for (const cluster of clusters) {
      const decision = shouldClaimCluster(cluster, articles, searching, working, now);
      if (!decision.ok) continue;

      addTask({
        campaignId: campaign.id, status: 'searching',
        title: cluster.representativeTitle, clusterId: cluster.id, sources: decision.sources,
        imageCount: decision.imageCount,
      });

      // 동일 사이클 누적용 합성 태스크 (다음 판정의 claimed/entity 카운트에 반영)
      working.push({
        id: `__pending_${cluster.id}`, campaignId: campaign.id, status: 'searching',
        title: cluster.representativeTitle, clusterId: cluster.id, sources: decision.sources,
        imageCount: decision.imageCount, createdAt: now, updatedAt: now,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clusters, articles, taskSig, campaign.id]);

  // ── 2. 서칭 → 주제 검수 (즉시 전환) ──
  useEffect(() => {
    for (const t of myTasks) {
      if (t.status === 'searching') moveTask(t.id, 'topic_review');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskSig]);

  // ── 3. 주제 검수: 주제 선정 판단(topicReview) + 전문 수집 확인 → 제작 전환 / 탈락 ──
  useEffect(() => {
    const excludeTopics = (campaign.settings.searching.excludeTopics ?? []).filter(x => x.trim());

    for (const t of myTasks) {
      if (t.status !== 'topic_review') continue;
      if (t.error) continue; // 이미 탈락 처리된 태스크는 skip (중복 에러 방지)

      // 제외 주제 AI 판단 게이트 — 통과(topicChecked) 전엔 다음 단계로 안 넘김.
      if (excludeTopics.length > 0 && !t.topicChecked) {
        if (!topicJudgeRef.current.has(t.id)) {
          topicJudgeRef.current.add(t.id);
          const snippets = articles
            .filter(a => t.sources.some(s => s.articleId === a.id))
            .map(a => a.description || a.fullText?.slice(0, 300) || '');
          judgeExcludedTopic({ title: t.title, snippets }, excludeTopics, settings)
            .then(r => {
              if (!mountedRef.current) return;
              if (r.excluded) updateTask(t.id, { error: `제외 주제 해당: ${r.matched || '동일 주제'}` });
              else updateTask(t.id, { topicChecked: true });
            })
            .catch(() => { if (mountedRef.current) updateTask(t.id, { topicChecked: true }); }) // 판단 실패 → 통과(fail-open)
            .finally(() => { topicJudgeRef.current.delete(t.id); });
        }
        continue; // 판단 결과 대기
      }

      const refreshed = t.sources.map(s => {
        const a = articles.find(x => x.id === s.articleId);
        return a ? { ...s, hasFullText: !!a.fullText } : s;
      });
      const fullTextCount = refreshed.filter(s => s.hasFullText).length;
      const changed = refreshed.some((s, i) => s.hasFullText !== t.sources[i].hasFullText);
      const imageCount = articles
        .filter(a => t.sources.some(s => s.articleId === a.id))
        .reduce((n, a) => n + (a.images?.length ?? 0), 0);

      if (fullTextCount > 0) {
        updateTask(t.id, { sources: refreshed, imageCount, status: 'producing' });
      } else if (Date.now() - t.createdAt > SOURCE_REVIEW_TIMEOUT_MS) {
        updateTask(t.id, { sources: refreshed, error: '전문 수집 실패 (출처 0건)' });
      } else if (changed) {
        updateTask(t.id, { sources: refreshed, imageCount });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskSig, articles, settings, campaign.settings.searching.excludeTopics]);

  // ── 4. 아티클 제작: LLM 생성 → 결과물 검수 전환 ──
  useEffect(() => {
    for (const t of myTasks) {
      if (t.status !== 'producing' || t.draft || t.error) continue;
      if (producingRef.current.has(t.id)) continue;
      producingRef.current.add(t.id);

      const srcArticles = articles.filter(a => t.sources.some(s => s.articleId === a.id));
      const category: Category =
        settings.categories.find(c => c.id === settings.activeCategoryId)
        ?? settings.categories[0]
        ?? { id: 'default', label: '기본', criteria: '', tone: '' };

      const attempt = (t.produceAttempts ?? 0) + 1;
      const MAX_ATTEMPTS = 3;

      generateStory(srcArticles, settings, category)
        .then(async draft => {
          let review;
          try { review = await reviewDraft(draft, settings); } catch { review = undefined; }
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

  return null;
}
