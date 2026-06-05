import { useEffect, useRef } from 'react';
import { useClusters } from '../../state/ClustersContext';
import { useArticles } from '../../state/ArticlesContext';
import { useSettings } from '../../state/SettingsContext';
import { useTasks } from '../../state/TaskContext';
import { generateStory } from '../../lib/promptChain';
import { reviewDraft } from '../../lib/review';
import { normalizeLink } from '../../lib/rss';
import type { Campaign, TaskSource, Category } from '../../types';

const SOURCE_REVIEW_TIMEOUT_MS = 90_000; // 전문 수집 대기 상한

function sourceMatches(source: string, rules: string[]): boolean {
  if (rules.length === 0) return false;
  const normalized = source.toLowerCase();
  return rules.some(rule => normalized.includes(rule.toLowerCase()));
}

function originalKey(link: string): string {
  return normalizeLink(link).replace(/^https?:\/\/m\./, 'https://www.');
}

function normalizeTitle(t: string): string {
  return t.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim();
}

/** entityAllowlist 중 haystack(소문자)에 등장하는 첫 엔티티. 없으면 null */
function matchEntity(haystack: string, allowlist: string[]): string | null {
  for (const e of allowlist) {
    if (e.trim() && haystack.includes(e.toLowerCase())) return e;
  }
  return null;
}

const DAY_MS = 86_400_000;

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
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const myTasks = tasks.filter(t => t.campaignId === campaign.id);
  // deps용 시그니처 (태스크 추가/삭제/상태변경 모두 반영)
  const taskSig = myTasks.map(t => `${t.id}:${t.status}:${t.draft ? 1 : 0}:${t.error ? 1 : 0}:${t.produceAttempts ?? 0}`).join(',');

  // ── 1. 서칭: 클러스터 → 태스크 생성 ──
  useEffect(() => {
    // 최신 tasks로 claimed 재계산 (삭제된 태스크는 즉시 미점유 → 정상 재생성 가능,
    // 단 같은 사이클 내 생성분은 로컬 set으로 중복 방지)
    const campaignTasks = tasks.filter(t => t.campaignId === campaign.id);
    const claimedArticleIds = new Set<string>();
    campaignTasks.forEach(t => t.sources.forEach(s => claimedArticleIds.add(s.articleId)));

    const {
      minMediaCount, topicKeywords, excludeKeywords, allowedSources = [], bannedSources = [],
      entityAllowlist = [], excludeTopics = [], maxPerEntityPerDay = 0, ownSiteDedupe = false,
    } = campaign.settings.searching;

    // ownSiteDedupe: 이미 발행/제작된 태스크 제목 (중복 회피용)
    const publishedTitles = new Set(
      campaignTasks.filter(t => t.published || t.status === 'final_review' || !!t.draft)
        .map(t => normalizeTitle(t.title)),
    );
    // maxPerEntityPerDay: 오늘 생성된 태스크의 엔티티별 카운트
    const now = Date.now();
    const entityCountToday = new Map<string, number>();
    if (maxPerEntityPerDay > 0 && entityAllowlist.length > 0) {
      for (const t of campaignTasks) {
        if (now - t.createdAt > DAY_MS) continue;
        const ent = matchEntity(t.title.toLowerCase(), entityAllowlist);
        if (ent) entityCountToday.set(ent, (entityCountToday.get(ent) ?? 0) + 1);
      }
    }

    for (const cluster of clusters) {
      if (cluster.articleIds.some(id => claimedArticleIds.has(id))) continue;
      const clusterArticles = articles
        .filter(a => cluster.articleIds.includes(a.id))
        .filter(a => allowedSources.length === 0 || sourceMatches(a.source, allowedSources))
        .filter(a => !sourceMatches(a.source, bannedSources));
      if (clusterArticles.length === 0) continue;

      const distinctOriginalCount = new Set(clusterArticles.map(a => originalKey(a.link))).size;
      const mediaCount = new Set(clusterArticles.map(a => a.source)).size;
      if (Math.min(mediaCount, distinctOriginalCount) < minMediaCount) continue;

      const haystack = clusterArticles.map(a => `${a.title} ${a.description}`).join(' ').toLowerCase();
      if (topicKeywords.length > 0 && !topicKeywords.some(k => haystack.includes(k.toLowerCase()))) continue;
      if (excludeKeywords.length > 0 && excludeKeywords.some(k => haystack.includes(k.toLowerCase()))) continue;
      if (excludeTopics.length > 0 && excludeTopics.some(k => k.trim() && haystack.includes(k.toLowerCase()))) continue;

      // entityAllowlist: 허용 엔티티 미등장 클러스터 제외
      const matchedEntity = entityAllowlist.length > 0 ? matchEntity(haystack, entityAllowlist) : null;
      if (entityAllowlist.length > 0 && !matchedEntity) continue;

      // maxPerEntityPerDay: 엔티티 일일 상한 초과 제외
      if (maxPerEntityPerDay > 0 && matchedEntity &&
          (entityCountToday.get(matchedEntity) ?? 0) >= maxPerEntityPerDay) continue;

      // ownSiteDedupe: 기보도/제작 제목과 중복 제외
      if (ownSiteDedupe && publishedTitles.has(normalizeTitle(cluster.representativeTitle))) continue;

      const sources: TaskSource[] = clusterArticles.map(a => ({
        articleId: a.id, title: a.title, source: a.source, hasFullText: !!a.fullText,
      }));

      addTask({
        campaignId: campaign.id, status: 'searching',
        title: cluster.representativeTitle, clusterId: cluster.id, sources,
        imageCount: clusterArticles.reduce((n, a) => n + (a.images?.length ?? 0), 0),
      });
      cluster.articleIds.forEach(id => claimedArticleIds.add(id));
      if (matchedEntity) entityCountToday.set(matchedEntity, (entityCountToday.get(matchedEntity) ?? 0) + 1);
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
    for (const t of myTasks) {
      if (t.status !== 'topic_review') continue;
      if (t.error) continue; // 이미 탈락 처리된 태스크는 skip (중복 에러 방지)

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
  }, [taskSig, articles]);

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
