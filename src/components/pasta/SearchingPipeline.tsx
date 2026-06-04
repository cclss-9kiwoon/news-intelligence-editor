import { useEffect } from 'react';
import { useClusters } from '../../state/ClustersContext';
import { useArticles } from '../../state/ArticlesContext';
import { useTasks } from '../../state/TaskContext';
import type { Campaign, TaskSource } from '../../types';

/**
 * 서칭 자동화: 클러스터를 감시하여 캠페인 조건을 충족하면 태스크 생성.
 * 렌더링 없는 로직 전용 컴포넌트. 칸반 모드의 Provider 트리 안에 위치.
 *
 * 태스크 dedup: clusterId는 기사 추가 시 변동하므로, 클러스터 기사 중
 * 하나라도 기존 태스크에 포함되면 skip (articleId 멤버십 기준).
 */
export function SearchingPipeline({ campaign }: { campaign: Campaign }) {
  const { clusters } = useClusters();
  const { articles } = useArticles();
  const { tasksForCampaign, addTask } = useTasks();

  useEffect(() => {
    const existing = tasksForCampaign(campaign.id);
    const claimedArticleIds = new Set<string>();
    existing.forEach(t => t.sources.forEach(s => claimedArticleIds.add(s.articleId)));

    const { minMediaCount, topicKeywords, excludeKeywords } = campaign.settings.source;

    for (const cluster of clusters) {
      // 이미 태스크가 점유한 기사가 포함된 클러스터면 skip
      if (cluster.articleIds.some(id => claimedArticleIds.has(id))) continue;

      const clusterArticles = articles.filter(a => cluster.articleIds.includes(a.id));
      if (clusterArticles.length === 0) continue;

      // 매체 수 필터
      const mediaCount = new Set(clusterArticles.map(a => a.source)).size;
      if (mediaCount < minMediaCount) continue;

      // 토픽 필터 (제목+설명 기준)
      const haystack = clusterArticles.map(a => `${a.title} ${a.description}`).join(' ').toLowerCase();
      if (topicKeywords.length > 0 && !topicKeywords.some(k => haystack.includes(k.toLowerCase()))) continue;
      if (excludeKeywords.length > 0 && excludeKeywords.some(k => haystack.includes(k.toLowerCase()))) continue;

      const sources: TaskSource[] = clusterArticles.map(a => ({
        articleId: a.id,
        title: a.title,
        source: a.source,
        hasFullText: !!a.fullText,
      }));

      addTask({
        campaignId: campaign.id,
        status: 'searching',
        title: cluster.representativeTitle,
        clusterId: cluster.id,
        sources,
        imageCount: clusterArticles.reduce((n, a) => n + (a.images?.length ?? 0), 0),
      });

      // 이번 사이클에 생성한 기사도 점유 처리 (중복 방지)
      cluster.articleIds.forEach(id => claimedArticleIds.add(id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clusters, articles, campaign.id]);

  return null;
}
