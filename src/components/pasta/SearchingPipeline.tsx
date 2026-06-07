import { useEffect, useRef } from 'react';
import { useClusters } from '../../state/ClustersContext';
import { useArticles } from '../../state/ArticlesContext';
import { useSettings } from '../../state/SettingsContext';
import { useTasks } from '../../state/TaskContext';
import { generateStory, judgeExcludedTopic } from '../../lib/promptChain';
import { judgeTopicAdequacy } from '../../lib/topicJudge';
import { assessProducibility } from '../../lib/producibility';
import { reviewDraft } from '../../lib/review';
import { shouldClaimCluster } from '../../lib/searchFilter';
import { loadDiscarded, buildDiscardIndex } from '../../lib/discardLedger';
import { shouldDiscardAfterExtractFail } from '../../lib/extractRetry';
import { promotionBudget } from '../../lib/promotion';
import { judgeBreaking } from '../../lib/breakingDetector';
import { resolveStageLLM } from '../../lib/stageLLM';
import { useCampaigns } from '../../state/CampaignContext';
import type { Campaign, Category, Task, StageLLMConfig } from '../../types';

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
  const { tasks, addTasks, updateTask, discardTask } = useTasks();
  const { groups } = useCampaigns();
  const group = groups.find(g => g.id === campaign.groupId);
  // 단계 LLM 해석: 단계 오버라이드 → 그룹 → 전역. settings 클론으로 chatJson 호출부에 주입.
  const stageSettings = (cfg?: StageLLMConfig) => {
    const r = resolveStageLLM(settings, group?.profile, cfg);
    return { ...settings, provider: r.provider, apiKey: r.apiKey, model: r.model, apiBaseUrl: r.baseUrl };
  };
  const producingRef = useRef<Set<string>>(new Set());
  const topicJudgeRef = useRef<Set<string>>(new Set()); // 제외 주제 AI 판단 진행 중 가드
  const intentJudgeRef = useRef<Set<string>>(new Set()); // 주제 적합성 AI 판단 진행 중 가드
  const producibilityRef = useRef<Set<string>>(new Set()); // 제작 가능성 판정 진행 중 가드
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
  const taskSig = myTasks.map(t => `${t.id}:${t.status}:${t.draft ? 1 : 0}:${t.error ? 1 : 0}:${t.produceAttempts ?? 0}:${t.topicChecked ? 1 : 0}:${t.intentChecked ? 1 : 0}:${t.paused ? 1 : 0}:${t.priority ? 1 : 0}:${t.published ? 1 : 0}`).join(',');

  // 기준기사 시각 (만료·골든타임·승급정렬용) — 대표 기사 pubDate, 없으면 생성시각
  const refTime = (t: Task): number => {
    const a = articles.find(x => x.id === t.sources[0]?.articleId);
    const p = a?.pubDate ? Date.parse(a.pubDate) : NaN;
    return Number.isNaN(p) ? t.createdAt : p;
  };
  // goldenTime 입력값(저장)에서 만료/시작 시각 — 없으면 기준기사+window로 폴백(레거시)
  const expiresAtOf = (t: Task): number => t.goldenTime?.expiresAt ?? refTime(t) + windowMs;
  const startsAtOf = (t: Task): number => t.goldenTime?.startsAt ?? refTime(t);

  // ── 1. ① 대기큐 채우기: 자격 클러스터 전부 생성(LLM 비용 없음, 상한 없음).
  //   실패(error) 태스크도 클러스터 점유 유지 → 재생성 안 함(무한 재생성 루프 방지).
  //   실패 건은 사람이 카드에서 [다시 시도]로 복구. ──
  useEffect(() => {
    // ① 큐 채우기는 LLM 비용 0 → 자동수집 OFF여도 채움(수집된 기사로 후보 표시).
    // 자동수집(주기) OFF = ②승급(AI 작업) 정지. 지금수집은 ① 채워서 1회 결과 보임.
    const now = Date.now();
    const working: Task[] = tasks.filter(t => t.campaignId === campaign.id);

    // 폐기/거부 원장 인덱스 — 이미 폐기·거부된 사건(title/url/articleId) ① 재유입 차단
    const discardIdx = buildDiscardIndex(loadDiscarded(now));
    // 점진화: 한 사이클에 클러스터 전부 생성 금지(흰화면/프리즈 방지). 상한만큼 모아 1회 벌크 setState.
    const MAX_NEW_PER_CYCLE = 8;  // 점진적 — 사이클당 소량씩 자연스럽게 쌓이게(와르르 방지)
    const batch: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>[] = [];
    for (const cluster of clusters) {
      if (batch.length >= MAX_NEW_PER_CYCLE) break;
      const decision = shouldClaimCluster(cluster, articles, searchingCfg, working, now, discardIdx);
      if (!decision.ok) continue;
      // 골든타임: 대표 기사 pubDate 기준 유효창. 속보면 짧은 창(breakingGoldenMinutes).
      const repArt = articles.find(a => a.id === decision.sources[0]?.articleId);
      const startsAt = repArt?.pubDate && !Number.isNaN(Date.parse(repArt.pubDate)) ? Date.parse(repArt.pubDate) : now;
      const isBreaking = repArt ? judgeBreaking(repArt, searchingCfg.breakingKeywords ?? []) : false;
      const goldenSpan = isBreaking ? (searchingCfg.breakingGoldenMinutes ?? 60) * 60_000 : windowMs;
      const spec = {
        campaignId: campaign.id, status: 'searching' as const,
        title: cluster.representativeTitle, clusterId: cluster.id,
        sources: decision.sources, imageCount: decision.imageCount,
        isBreaking,
        goldenTime: { startsAt, expiresAt: startsAt + goldenSpan },
      };
      batch.push(spec);
      // 동일 사이클 중복 점유 방지용 합성 태스크
      working.push({ ...spec, id: `__pending_${cluster.id}`, createdAt: now, updatedAt: now });
    }
    if (batch.length > 0) addTasks(batch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clusters, articles, taskSig, campaign.id, campaign.autoCollect?.enabled]);

  // ── 1b. (제거됨) 골든타임 만료로 ① 삭제하던 로직 폐기 ──
  // 버그: 살짝 오래된/pubDate 빈 뉴스가 ① 진입 즉시 만료 삭제(77→59 증발),
  //       속보 30분은 pubDate+30분이라 생성 즉시 만료. 골든타임은 정렬/우선용일 뿐 삭제 사유 아님.
  // ① 삭제는 명시 경로만: 발행 / 폐기 / 사용자 "단계별 정리"(staleTaskIds, createdAt 기준).
  // 골든타임 임박은 아래 승급 effect의 priority 플래그 + 정렬로만 반영.

  // ── 2. ①→② 승급: maxPerHour 절대 초과 금지. 속보는 바이패스 아니라 '우선순위'로 처리. ──
  // (이전 버그: 속보 즉시승급이 maxPerHour 무시 → BREAKING_KEYWORDS가 컴백/결혼 등 광범위라
  //  대부분 태스크가 isBreaking으로 상한 우회 → 9>3 폭주. 이제 속보도 예산 내 우선 승급.)
  useEffect(() => {
    // 자동 진행 OFF = ①→② 승급·②③④ LLM 정지. ①엔 후보 쌓이되 자동 안 올라감(수집과 분리).
    if (campaign.autoProcess?.enabled === false) return;
    const now = Date.now();
    const queue = myTasks.filter(t => t.status === 'searching' && !t.error && !t.paused);
    if (queue.length === 0) return;

    // 예산 = maxPerHour − 최근1시간 승급수 (순수함수). 같은 사이클은 로컬 카운터로 추가 차감.
    let budget = promotionBudget(myTasks, campaign.id, maxPerHour, now);
    if (budget <= 0) return;

    // 골든타임 임박(잔여 < 20%) 자동 우선 플래그
    for (const t of queue) {
      if (!t.priority && windowMs > 0 && (expiresAtOf(t) - now) < windowMs * 0.2) {
        updateTask(t.id, { priority: true });
      }
    }
    // 정렬: 속보 → 우선 → 최신. (속보=먼저 승급, 단 예산은 공유 — 절대 초과 X)
    const sorted = [...queue].sort((a, b) =>
      (b.isBreaking ? 1 : 0) - (a.isBreaking ? 1 : 0) ||
      (b.priority ? 1 : 0) - (a.priority ? 1 : 0) ||
      startsAtOf(b) - startsAtOf(a));

    for (const t of sorted) {
      if (budget <= 0) break;
      updateTask(t.id, { status: 'topic_review', promotedAt: now });
      budget--; // 동일 사이클 즉시 차감 → 레이스 차단
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskSig, articles, maxPerHour, windowMs, campaign.autoProcess?.enabled]);

  // ── 3. ② 검수: 전문 수집 대기 + 제외 주제 AI 판단 → 제작 전환 / 탈락 ──
  useEffect(() => {
    if (campaign.autoProcess?.enabled === false) return;  // 자동 진행 OFF = ②③④ LLM 정지
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
          // 전 source 전문수집 실패 — N회 누적 시 자동 폐기(extract_failed), 아니면 재시도 대기.
          // error는 설정 안 함: ② 루프 가드(t.error continue)에 걸려 재진입 못 하면 attempts가
          // 1에서 정체해 자동폐기 안 됨. status=topic_review 유지로 다음 사이클 재평가→증가→임계 시 폐기.
          const attempts = (t.extractAttempts ?? 0) + 1;
          if (shouldDiscardAfterExtractFail(attempts)) {
            discardTask(t.id, 'extract_failed');  // 폐기함 + recordDiscard + 예산 회복(promotionBudget 제외)
          } else {
            updateTask(t.id, { sources: refreshed, extractAttempts: attempts });
          }
        } else if (changed) {
          updateTask(t.id, { sources: refreshed, imageCount });
        }
        continue;
      }

      // ②-B 제작 가능성 게이트 — intent/제외 LLM '앞'에 배치(fail-fast): 제작불가(이미지 없음) 건에
      // LLM 낭비 안 하도록 먼저 컷. 통과=producibleChecked 영속, 미통과=보류(자동삭제 없음, 수동 정리).
      if (!t.producibleChecked) {
        if (!producibilityRef.current.has(t.id)) {
          producibilityRef.current.add(t.id);
          const imgs = articles
            .filter(a => t.sources.some(s => s.articleId === a.id))
            .flatMap(a => (a.images ?? []).map(im => ({ url: im.url })));
          const cluster = clusters.find(c => c.id === t.clusterId);
          assessProducibility({ images: imgs, entities: cluster?.entities, groupId: campaign.groupId })
            .then(prod => {
              if (!mountedRef.current) return;
              if (prod.producible) updateTask(t.id, { producibleChecked: true });
              // 미통과: 보류 — producibleChecked 안 함 → 다음 사이클 재평가(이미지 생기면 통과).
            })
            .catch(() => { if (mountedRef.current) updateTask(t.id, { producibleChecked: true }); }) // 실패 시 통과(막힘 방지)
            .finally(() => { producibilityRef.current.delete(t.id); });
        }
        continue; // 제작 가능성 판정 대기 (LLM 전)
      }

      // 주제 정의(intent) 적합성 게이트 — 캠페인 주제정의에 맞는 기사만 통과.
      const intent = (campaign.settings.topicReview.intent ?? '').trim();
      if (intent && !t.intentChecked) {
        if (!intentJudgeRef.current.has(t.id)) {
          intentJudgeRef.current.add(t.id);
          const snippets = articles
            .filter(a => t.sources.some(s => s.articleId === a.id))
            .map(a => a.description || a.fullText?.slice(0, 300) || '');
          judgeTopicAdequacy({ title: t.title, snippets }, intent, stageSettings(campaign.settings.topicReview.llm))
            .then(r => {
              if (!mountedRef.current) return;
              // fail-CLOSED 3-state: 미결정(429/서킷/실패)→보류(재판단), 부적합→컷, 적합→통과
              if (!r.decided) return; // 보류 — intentChecked 안 함 → 다음 사이클 재판단(키/서킷 풀리면 결정)
              // decided-부적합 = 확정 거부 → 폐기함 이동(②서 제거). 원장 기록은 discardTask 내부 처리.
              // 미결정(!r.decided)은 위에서 return(보류) — 폐기 안 함(429/서킷 재시도 대상).
              if (!r.adequate) discardTask(t.id, 'off_topic');
              else updateTask(t.id, { intentChecked: true });
            })
            .catch(() => { /* 예외=미결정=보류. intentChecked 세팅 X → 재시도 */ })
            .finally(() => { intentJudgeRef.current.delete(t.id); });
        }
        continue; // 판단 결과 대기
      }

      // 제외 주제 AI 판단 게이트 — 통과(topicChecked) 전엔 제작으로 안 넘김.
      if (excludeTopics.length > 0 && !t.topicChecked) {
        if (!topicJudgeRef.current.has(t.id)) {
          topicJudgeRef.current.add(t.id);
          const snippets = articles
            .filter(a => t.sources.some(s => s.articleId === a.id))
            .map(a => a.description || a.fullText?.slice(0, 300) || '');
          judgeExcludedTopic({ title: t.title, snippets }, excludeTopics, stageSettings(campaign.settings.topicReview.llm))
            .then(r => {
              if (!mountedRef.current) return;
              // 제외주제 해당 = 확정 거부 → 폐기함 이동(원장 기록 내부 처리).
              if (r.excluded) discardTask(t.id, 'off_topic');
              else updateTask(t.id, { topicChecked: true });
            })
            .catch(() => { if (mountedRef.current) updateTask(t.id, { topicChecked: true }); }) // fail-open. PM ② 견고화에서 보류로 교체 예정
            .finally(() => { topicJudgeRef.current.delete(t.id); });
        }
        continue; // 판단 결과 대기
      }

      // 모든 게이트 통과(extract→producibility→intent→제외주제) → ③ 제작 승급
      updateTask(t.id, { sources: refreshed, imageCount, status: 'producing' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskSig, articles, settings, searchingCfg.excludeTopics, campaign.settings.topicReview.intent, campaign.autoProcess?.enabled]);

  // ── 4. ③ 제작: LLM 생성 → 결과물 검수 전환 ──
  useEffect(() => {
    if (campaign.autoProcess?.enabled === false) return;  // 자동 진행 OFF = ②③④ LLM 정지
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

      generateStory(srcArticles, stageSettings(campaign.settings.generation.llm), category)
        .then(async draft => {
          let review;
          // 검수 ctx: 소스 N≥2/금지매체/워터마크 게이트 활성화 (NIE 24f36a5)
          const reviewCtx = {
            sources: t.sources.map(s => ({ source: s.source })),
            images: srcArticles.flatMap(a => (a.images ?? []).map(im => ({ url: im.url }))),
          };
          try { review = await reviewDraft(draft, stageSettings(campaign.settings.finalReview.llm), reviewCtx); } catch { review = undefined; }
          if (mountedRef.current) updateTask(t.id, { draft, review, status: 'final_review', produceAttempts: attempt });
        })
        .catch((err: unknown) => {
          if (!mountedRef.current) return;
          // 429/quota 소진(서킷 throw)이면 재시도 카운트 올리지 말고 보류 — 무한 재시도/폭주 방지.
          // 서킷 cooldown 해제 후 자연 재개. (status 429 = OpenAIError 또는 서킷 차단)
          if ((err as { status?: number })?.status === 429) {
            producingRef.current.delete(t.id);
            return;
          }
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
  }, [taskSig, articles, settings, campaign.autoProcess?.enabled]);

  // ── 5. ④ 자동 발행: autoPublish on + 통과 + 안전(사람 불요·비속보)일 때만 자동.
  //        미통과·needsHuman(불확실/민감)·속보는 사람 큐(④ 잔류). ──
  useEffect(() => {
    if (!autoPublish) return;
    const now = Date.now();
    for (const t of myTasks) {
      if (t.status !== 'final_review' || t.published || t.error || t.paused) continue;
      const safe = t.review?.passed && !t.review.needsHuman && !t.isBreaking;
      if (safe) updateTask(t.id, { published: true, publishedAt: now });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskSig, autoPublish]);

  return null;
}
