import { useEffect, useRef } from 'react';
import { useClusters } from '../../state/ClustersContext';
import { useArticles } from '../../state/ArticlesContext';
import { useSettings } from '../../state/SettingsContext';
import { useTasks } from '../../state/TaskContext';
import { generateStory } from '../../lib/promptChain';
import { reviewDraft } from '../../lib/review';
import type { Campaign, TaskSource, Category } from '../../types';

const SOURCE_REVIEW_TIMEOUT_MS = 90_000; // 전문 수집 대기 상한

/**
 * Pasta 자동 파이프라인: 서칭 → 소스 검수 → 아티클 제작 자동 전환.
 * 렌더링 없는 로직 컴포넌트. 칸반 모드의 Provider 트리 안에 위치.
 * 결과물 검수(final_review)는 사람이 처리.
 */
export function SearchingPipeline({ campaign }: { campaign: Campaign }) {
  const { clusters } = useClusters();
  const { articles } = useArticles();
  const { settings } = useSettings();
  const { tasks, addTask, updateTask, moveTask } = useTasks();
  const producingRef = useRef<Set<string>>(new Set());

  const myTasks = tasks.filter(t => t.campaignId === campaign.id);

  // ── 1. 서칭: 클러스터 → 태스크 생성 ──
  useEffect(() => {
    const claimedArticleIds = new Set<string>();
    myTasks.forEach(t => t.sources.forEach(s => claimedArticleIds.add(s.articleId)));

    const { minMediaCount, topicKeywords, excludeKeywords } = campaign.settings.source;

    for (const cluster of clusters) {
      if (cluster.articleIds.some(id => claimedArticleIds.has(id))) continue;
      const clusterArticles = articles.filter(a => cluster.articleIds.includes(a.id));
      if (clusterArticles.length === 0) continue;

      const mediaCount = new Set(clusterArticles.map(a => a.source)).size;
      if (mediaCount < minMediaCount) continue;

      const haystack = clusterArticles.map(a => `${a.title} ${a.description}`).join(' ').toLowerCase();
      if (topicKeywords.length > 0 && !topicKeywords.some(k => haystack.includes(k.toLowerCase()))) continue;
      if (excludeKeywords.length > 0 && excludeKeywords.some(k => haystack.includes(k.toLowerCase()))) continue;

      const sources: TaskSource[] = clusterArticles.map(a => ({
        articleId: a.id, title: a.title, source: a.source, hasFullText: !!a.fullText,
      }));

      addTask({
        campaignId: campaign.id, status: 'searching',
        title: cluster.representativeTitle, clusterId: cluster.id, sources,
        imageCount: clusterArticles.reduce((n, a) => n + (a.images?.length ?? 0), 0),
      });
      cluster.articleIds.forEach(id => claimedArticleIds.add(id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clusters, articles, campaign.id]);

  // ── 2. 서칭 → 소스 검수 (즉시 전환) ──
  useEffect(() => {
    for (const t of myTasks) {
      if (t.status !== 'searching') continue;
      moveTask(t.id, 'source_review');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myTasks.map(t => `${t.id}:${t.status}`).join(',')]);

  // ── 3. 소스 검수: 전문 확인 → 제작 전환 / 탈락 ──
  useEffect(() => {
    for (const t of myTasks) {
      if (t.status !== 'source_review') continue;
      // 현재 articles로 전문 수집 상태 갱신
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
        // 탈락: 전문 수집 0건 (검수 포인트 2)
        updateTask(t.id, { sources: refreshed, status: 'source_review', error: '전문 수집 실패 (소스 0건)' });
      } else if (changed) {
        updateTask(t.id, { sources: refreshed, imageCount });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myTasks.map(t => t.id + t.status).join(','), articles]);

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

      generateStory(srcArticles, settings, category)
        .then(async draft => {
          let review;
          try { review = await reviewDraft(draft, settings); } catch { review = undefined; }
          updateTask(t.id, { draft, review, status: 'final_review' });
        })
        .catch(err => {
          // 제작 실패: final_review로 안 넘김 (검수 포인트 3)
          updateTask(t.id, { error: `제작 실패: ${err instanceof Error ? err.message : String(err)}` });
        })
        .finally(() => { producingRef.current.delete(t.id); });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myTasks.map(t => t.id + t.status + (t.draft ? '1' : '0')).join(','), articles, settings]);

  return null;
}
