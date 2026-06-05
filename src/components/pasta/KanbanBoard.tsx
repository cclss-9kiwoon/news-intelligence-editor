import { useMemo } from 'react';
import { useTasks } from '../../state/TaskContext';
import { useArticles } from '../../state/ArticlesContext';
import { useClusters } from '../../state/ClustersContext';
import { useCampaigns } from '../../state/CampaignContext';
import { shouldClaimCluster } from '../../lib/searchFilter';
import { IconTrash } from './icons';
import type { Task, TaskStatus } from '../../types';

const HOUR = 3600_000;

// 골든타임 파생값 (저장 안 함, 렌더 계산). gt 없으면 null.
export type GoldenView = { remainingMs: number; percent: number; state: 'ok' | 'warning' | 'expired' };
function computeGolden(gt: Task['goldenTime'], now: number): GoldenView | null {
  if (!gt) return null;
  const total = Math.max(1, gt.expiresAt - gt.startsAt);
  const remainingMs = gt.expiresAt - now;
  const percent = Math.max(0, Math.min(100, Math.round((remainingMs / total) * 100)));
  const state = remainingMs <= 0 ? 'expired' : percent < 20 ? 'warning' : 'ok';
  return { remainingMs, percent, state };
}
function fmtDur(ms: number): string {
  if (ms <= 0) return '만료';
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}분`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}시간` : `${Math.floor(h / 24)}일`;
}

type ColMeta = {
  status: TaskStatus; label: string; auto: boolean;
  bar: string;        // 상단 컬러 바
  badge: string;      // 자동/사람 배지
  dot: string;        // 카운트 도트
};

// 단계별 컬러코딩: 자동 단계=블루, 검수=앰버, 결과=그린
const COLUMNS: ColMeta[] = [
  { status: 'searching',    label: '기사 찾기',    auto: true,  bar: 'bg-blue-400',  badge: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-500' },
  { status: 'topic_review', label: '주제 검수',    auto: true,  bar: 'bg-blue-400',  badge: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-500' },
  { status: 'producing',    label: '기사 작성',    auto: true,  bar: 'bg-blue-400',  badge: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-500' },
  { status: 'final_review', label: '최종 검수',    auto: false, bar: 'bg-amber-400', badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
];

export function KanbanBoard({ campaignId, onOpenTask }: { campaignId: string; onOpenTask: (taskId: string) => void }) {
  const { tasks: allTasks, deleteTask, updateTask, togglePriority, pauseTask, resumeTask, discardTask } = useTasks();
  const { isRefreshing, loadingStatus, lastRefreshedAt, articles, refreshNow } = useArticles();
  const { clusters } = useClusters();
  const { campaigns } = useCampaigns();
  // 보드는 진행중 태스크만 — 발행됨(→발행함)·폐기됨(→폐기함)은 제외
  const tasks = useMemo(
    () => allTasks.filter(t => t.campaignId === campaignId && !t.published && !t.discardReason),
    [allTasks, campaignId],
  );
  const retryTask = (id: string) => updateTask(id, { error: undefined, produceAttempts: 0, status: 'producing' });
  const publishTask = (id: string) => updateTask(id, { published: true, publishedAt: Date.now() });

  // 리듬바 수치 (피카소 GaugeChip/InfoChip용)
  const maxPerHour = campaigns.find(c => c.id === campaignId)?.settings.searching.maxPerHour ?? 3;
  const rhythm = useMemo(() => {
    const now = Date.now();
    const promotedLastHour = tasks.filter(t => t.promotedAt && now - t.promotedAt <= HOUR).length;
    const queueCount = tasks.filter(t => t.status === 'searching' && !t.error && !t.paused).length;
    return { promotedLastHour, maxPerHour, queueCount, collected: articles.length, atCap: maxPerHour > 0 && promotedLastHour >= maxPerHour };
  }, [tasks, maxPerHour, articles.length]);

  // 0건 진단: 수집은 됐는데 태스크가 안 생기는 이유를 클러스터 거부 사유로 집계
  const searching = campaigns.find(c => c.id === campaignId)?.settings.searching;
  const noTaskHint = useMemo(() => {
    if (isRefreshing || tasks.length > 0 || articles.length === 0 || !searching) return null;
    const now = Date.now();
    const reasons: Record<string, number> = {};
    let claimable = 0;
    for (const c of clusters) {
      const d = shouldClaimCluster(c, articles, searching, tasks, now);
      if (d.ok) claimable++;
      else reasons[d.reason] = (reasons[d.reason] ?? 0) + 1;
    }
    if (claimable > 0) return null; // 곧 생성됨 — 힌트 불필요
    const top = Object.entries(reasons).sort((a, b) => b[1] - a[1])[0]?.[0];
    return { clusterCount: clusters.length, text: reasonHint(top, searching) };
  }, [isRefreshing, tasks, articles, clusters, searching]);

  return (
    <div className="flex h-full flex-col overflow-hidden" style={{ background: 'radial-gradient(ellipse 80% 80% at top left, #C5E3F6 0%, transparent 55%), radial-gradient(ellipse at bottom center, #FBE2BC 0%, transparent 55%), radial-gradient(ellipse at right, #F0D5F7 0%, transparent 55%), #FCF4E8' }}>
      {/* #3 단계 가시성: 수집 상태 바 + 수동 트리거 + 0건 진단 */}
      <div className="flex flex-wrap items-center gap-2 px-8 pt-4">
        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs backdrop-blur-md transition-colors ${
          isRefreshing
            ? 'border-blue-200/70 bg-blue-50/70 text-blue-700'
            : 'border-white/60 bg-white/55 text-slate-500'
        }`}>
          <span className={`inline-flex h-2 w-2 rounded-full ${isRefreshing ? 'animate-pulse bg-blue-500' : 'bg-slate-300'}`} />
          {isRefreshing
            ? <span className="font-semibold">{loadingStatus || '수집 중...'}</span>
            : <span>자동 진행 대기 · 수집 {articles.length}건{lastRefreshedAt ? ` · 마지막 ${relTime(lastRefreshedAt)}` : ''}</span>}
        </span>

        <button
          onClick={() => { if (!isRefreshing) refreshNow(); }}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-500 px-3 py-1 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isRefreshing ? <Spinner className="h-3 w-3 text-white" /> : '▶'} 지금 수집
        </button>

        {noTaskHint && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/80 bg-amber-50/80 px-3 py-1 text-xs text-amber-700 backdrop-blur-md">
            ⚠ 묶음 {noTaskHint.clusterCount}개 · 생성 0 — {noTaskHint.text}
          </span>
        )}

        {/* 리듬바: 승급 처리량 / 대기 / 수집 (피카소 GaugeChip 자리) */}
        <span data-rhythm className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs backdrop-blur-md ${rhythm.atCap ? 'border-amber-200/70 bg-amber-50/70 text-amber-700' : 'border-white/60 bg-white/55 text-slate-500'}`}>
          승급 {rhythm.promotedLastHour}/{rhythm.maxPerHour === 0 ? '∞' : rhythm.maxPerHour}·시간
          <span className="text-slate-300">|</span> ①대기 {rhythm.queueCount}
          <span className="text-slate-300">|</span> 수집 {rhythm.collected}
        </span>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 px-4 pb-6 pt-3 sm:grid-cols-2 sm:px-8 xl:grid-cols-4">
        {COLUMNS.map(col => {
          const colTasks = tasks.filter(t => t.status === col.status);
          const activeCount = colTasks.filter(taskActive).length;
          return (
            <div key={col.status} className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/60 bg-white/55 backdrop-blur-md shadow-sm">
              <div className={`h-1.5 w-full ${col.bar}`} />
              <div className="flex items-center justify-between px-4 py-3.5">
                <span className="text-[15px] font-bold text-slate-800">{col.label}</span>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide ${col.badge}`}>
                    {col.auto ? '자동' : '사람'}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs font-mono font-semibold text-slate-500">
                    {activeCount > 0
                      ? <Spinner className={`h-3.5 w-3.5 ${col.auto ? 'text-blue-500' : 'text-amber-500'}`} />
                      : <span className={`h-2 w-2 rounded-full ${col.dot}`} />}
                    {colTasks.length}
                  </span>
                </div>
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pb-4">
                {colTasks.map(t => (
                  <TaskCard key={t.id} task={t}
                    onOpen={() => onOpenTask(t.id)}
                    onDelete={() => deleteTask(t.id)}
                    onRetry={() => retryTask(t.id)}
                    onTogglePriority={() => togglePriority(t.id)}
                    onPause={() => pauseTask(t.id)}
                    onResume={() => resumeTask(t.id)}
                    onDiscard={() => discardTask(t.id, 'other')}
                    onPublish={() => publishTask(t.id)}
                  />
                ))}
                {colTasks.length === 0 && (
                  <div className="mt-1 flex flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed border-slate-200/70 py-10 text-center">
                    <span className="pasta-float text-lg opacity-50">🍃</span>
                    <span className="text-xs text-slate-300">비어 있음</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TaskCard({ task, onOpen, onDelete, onRetry, onTogglePriority, onPause, onResume, onDiscard, onPublish }: {
  task: Task; onOpen: () => void; onDelete: () => void; onRetry: () => void;
  onTogglePriority: () => void; onPause: () => void; onResume: () => void; onDiscard: () => void; onPublish: () => void;
}) {
  const fullTextCount = task.sources.filter(s => s.hasFullText).length;
  const mediaCount = new Set(task.sources.map(s => s.source)).size;
  const verified = task.status === 'final_review' && task.review?.passed;
  const golden = task.status === 'searching' && !task.error ? computeGolden(task.goldenTime, Date.now()) : null;
  const stop = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn(); };
  const attempts = task.produceAttempts ?? 0;
  const retrying = task.status === 'producing' && !task.draft && !task.error && attempts >= 1;
  const inProgress = taskActive(task);
  const progressLabel =
    task.status === 'searching' ? '수집 중'
    : task.status === 'topic_review' ? '주제 검수 중'
    : retrying ? `재시도 ${attempts + 1}/3`
    : '작성 중';

  return (
    <div
      onClick={onOpen}
      className="pasta-springy cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-snug text-slate-800 line-clamp-2">
          {task.priority && <span title="우선" className="text-amber-500">★ </span>}📰 {task.title}
        </p>
        <span className="flex shrink-0 items-center gap-1.5">
          <button onClick={stop(onTogglePriority)} aria-label="우선 처리 토글"
            className={`transition-colors ${task.priority ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'}`}>★</button>
          <button onClick={e => { e.stopPropagation(); if (confirm('이 기사 건을 삭제할까요?')) onDelete(); }}
            aria-label="기사 건 삭제" className="text-slate-300 hover:text-red-500 transition-colors"><IconTrash className="h-4 w-4" /></button>
        </span>
      </div>

      {/* 골든타임 바 (① 대기) — 피카소 GoldenTimeBar 자리. data-* 로 값 노출 */}
      {golden && (
        <div data-golden-state={golden.state} data-golden-percent={golden.percent} className="mt-2">
          <div className="h-1 w-full overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${golden.state === 'expired' ? 'bg-red-400' : golden.state === 'warning' ? 'bg-amber-400' : 'bg-blue-400'}`} style={{ width: `${golden.percent}%` }} />
          </div>
          <p className={`mt-0.5 text-[10px] font-mono ${golden.state === 'warning' ? 'text-amber-600' : 'text-slate-400'}`}>골든타임 {fmtDur(golden.remainingMs)} 남음</p>
        </div>
      )}

      {/* 보류 상태 — [재개]/[폐기] */}
      {task.paused && (
        <div className="mt-2 flex items-center justify-between rounded-lg bg-slate-100 px-2 py-1 text-[11px]">
          <span className="font-semibold text-slate-500">⏸ 보류 중</span>
          <span className="flex gap-2">
            <button onClick={stop(onResume)} className="text-indigo-500 hover:underline">재개</button>
            <button onClick={stop(onDiscard)} className="text-red-400 hover:text-red-600">폐기</button>
          </span>
        </div>
      )}

      {/* 진행 중 표시 — 자동 단계에서 작업이 돌아가는 중 (스피너 + 라벨) */}
      {inProgress && (
        <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-mono font-semibold text-blue-700">
          <Spinner className="h-3 w-3 text-blue-500" />
          {progressLabel}
        </span>
      )}

      {/* 발행됨 뱃지 — Hydra 배포 완료 */}
      {task.published && (
        <span className="mt-2 mr-1 inline-flex items-center gap-1 rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-mono font-semibold text-white">
          📤 발행됨
        </span>
      )}

      {/* Verified 뱃지 — 검수 통과 결과물 */}
      {!task.published && verified && (
        <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-mono font-semibold text-green-700">
          <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zm3.54 6.54l-4 4a.75.75 0 0 1-1.06 0l-2-2a.75.75 0 1 1 1.06-1.06L7 8.94l3.47-3.47a.75.75 0 1 1 1.07 1.07z" />
          </svg>
          Verified
        </span>
      )}

      <div className="mt-2 space-y-0.5 text-xs font-mono text-slate-500">
        {/* #2 카드 메타: 원문 매체 · 서브 건수 · 경과 시간 */}
        {(task.status === 'searching' || task.status === 'topic_review') && (
          <p>
            원문: {task.sources[0]?.source ?? '—'}
            {mediaCount > 1 && <span className="text-slate-700 font-semibold"> · 서브 {mediaCount - 1}곳</span>}
            {' · '}{relTime(task.createdAt)}
          </p>
        )}
        {task.status === 'topic_review' && !task.error && (
          <p>전문 수집: {fullTextCount}/{task.sources.length}건 · 이미지 {task.imageCount}장</p>
        )}
        {task.status === 'producing' && !task.error && (
          <p>{task.draft ? `초안 ${task.draft.body.length}자` : retrying ? `초안 생성 재시도 중 (${attempts + 1}/3)` : '초안 생성 중...'}</p>
        )}
        {task.status === 'final_review' && task.draft && (
          <>
            {/* #11 헤드라인 HTML 태그 strip */}
            <p className="truncate font-sans font-medium text-slate-700">{stripHtml(task.draft.headline)}</p>
            <p>원문: {task.sources[0]?.source ?? '—'}{mediaCount > 1 && <span className="font-semibold text-slate-700"> · 서브 {mediaCount - 1}곳</span>} · 본문 {task.draft.body.length}자</p>
            {/* #12 차단 사유 노출 */}
            {task.review && !task.review.passed && (
              <div className="mt-0.5">
                <p className="text-red-600">검수 {task.review.findings.filter(f => f.severity === 'block').length}건 차단</p>
                <ul className="mt-0.5 space-y-0.5">
                  {task.review.findings.filter(f => f.severity === 'block').slice(0, 3).map((f, i) => (
                    <li key={i} className="truncate text-[11px] text-red-400">· {f.label}: {f.message}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
        {/* #1 실패 UX: 사람 읽을 메시지 + 다시 시도 버튼 */}
        {task.error && (
          <div className="mt-1 rounded-lg bg-red-50 px-2 py-1.5">
            <p className="text-red-600">{task.error}</p>
            <button
              onClick={e => { e.stopPropagation(); onRetry(); }}
              className="mt-1 rounded-md bg-red-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-red-700"
            >↻ 다시 시도</button>
          </div>
        )}
      </div>

      {/* 액션 푸터 — 자동 단계: 보류 / ④ Verified: 빠른발행 */}
      {!task.paused && !task.error && (
        <div className="mt-2 flex items-center gap-2 border-t border-slate-100 pt-2 text-[11px]">
          {task.status === 'final_review' && verified && !task.published && (
            <button onClick={stop(onPublish)} className="rounded-md bg-green-600 px-2 py-0.5 font-semibold text-white hover:bg-green-700">⚡ 빠른 발행</button>
          )}
          {task.status === 'final_review' && task.review && !task.review.passed && (
            <button onClick={stop(onOpen)} className="rounded-md border border-amber-300 px-2 py-0.5 font-semibold text-amber-700 hover:bg-amber-50">검토</button>
          )}
          {task.status !== 'final_review' && (
            <button onClick={stop(onPause)} className="text-slate-400 hover:text-slate-600">⏸ 보류</button>
          )}
        </div>
      )}
    </div>
  );
}

// 클러스터 거부 사유 → 사람이 읽을 원인 + 해결 힌트
function reasonHint(reason: string | undefined, searching: { minMediaCount: number }): string {
  switch (reason) {
    case 'below_min_media':
      return `최소 매체 수(${searching.minMediaCount}) 미달. 같은 이슈를 여러 매체가 다뤄야 생성됩니다 — 설정에서 낮춰보세요.`;
    case 'no_topic_keyword':
      return '포함 키워드와 일치하는 기사가 없습니다 — 키워드를 넓혀보세요.';
    case 'excluded_keyword':
      return '대부분 제외 키워드에 걸렸습니다.';
    case 'no_allowed_entity':
      return '허용 인물·브랜드가 없는 기사뿐입니다 — 목록을 비우거나 넓혀보세요.';
    case 'no_articles':
      return '허용/차단 매체 필터로 전부 제외됐습니다 — 소스 필터를 확인하세요.';
    case 'already_claimed':
      return '이미 모두 기사 건으로 생성됐습니다.';
    default:
      return '조건에 맞는 묶음이 없습니다 — 서칭 설정을 조정하세요.';
  }
}

// 자동 단계에서 실제로 작업이 돌아가는 중인지 (에러·완료 제외)
function taskActive(t: Task): boolean {
  if (t.error) return false;
  if (t.status === 'searching' || t.status === 'topic_review') return true;
  if (t.status === 'producing' && !t.draft) return true;
  return false;
}

// 돌아가는 스피너 — 진행 중 가시화. prefers-reduced-motion 시 정지(라벨로 상태 전달).
function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg className={`animate-spin motion-reduce:animate-none ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.4 0 0 5.4 0 12h4z" />
    </svg>
  );
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
}

function relTime(ts: number): string {
  const min = Math.floor((Date.now() - ts) / 60000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}
