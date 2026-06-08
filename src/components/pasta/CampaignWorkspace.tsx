import { useState, useEffect } from 'react';
import { useTasks } from '../../state/TaskContext';
import { useArticles } from '../../state/ArticlesContext';
import { useSettings } from '../../state/SettingsContext';
import { useCampaigns } from '../../state/CampaignContext';
import { generateStory } from '../../lib/promptChain';
import { sanitizeHtml } from '../../lib/sanitizeHtml';
import { TagInput } from './TagInput';
import { TaskSourcePanel } from './TaskSourcePanel';
import type { DiscardReason, Category, StoryOutput, ChannelType } from '../../types';

const DISCARD_REASONS: { value: DiscardReason; label: string }[] = [
  { value: 'low_quality', label: '품질 부족' },
  { value: 'off_topic', label: '주제 부적합' },
  { value: 'duplicate', label: '중복' },
  { value: 'other', label: '기타' },
];

export function CampaignWorkspace({ taskId, onBack }: { taskId: string; onBack: () => void }) {
  const { tasks, updateTask } = useTasks();
  const { articles } = useArticles();
  const { settings } = useSettings();
  const { campaigns, groups } = useCampaigns();

  const task = tasks.find(t => t.id === taskId);
  const group = groups.find(g => g.id === campaigns.find(c => c.id === task?.campaignId)?.groupId);
  const profile = group?.profile;

  const [headline, setHeadline] = useState(task?.draft?.headline ?? '');
  const [body, setBody] = useState(task?.draft?.body ?? '');
  const [tags, setTags] = useState<string[]>(task?.draft?.tags ?? []);
  const [regenerating, setRegenerating] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [checkedFacts, setCheckedFacts] = useState<Set<number>>(new Set());
  // 본문 패널: 미리보기(렌더) / 소스(HTML 편집). 기본 미리보기. localStorage 기억.
  const [bodyView, setBodyView] = useState<'preview' | 'source'>(
    () => (localStorage.getItem('pasta:bodyView') === 'source' ? 'source' : 'preview'),
  );
  const switchBodyView = (v: 'preview' | 'source') => {
    setBodyView(v);
    try { localStorage.setItem('pasta:bodyView', v); } catch { /* ignore */ }
  };

  // (1) draft state 누수 방지 — taskId 바뀌면 에디터 state를 새 태스크 draft로 동기화
  useEffect(() => {
    const t = tasks.find(x => x.id === taskId);
    setHeadline(t?.draft?.headline ?? '');
    setBody(t?.draft?.body ?? '');
    setTags(t?.draft?.tags ?? []);
    setCheckedFacts(new Set());
    setDiscarding(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  if (!task) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400">
        기사 건을 찾을 수 없습니다. <button onClick={onBack} className="ml-2 underline">돌아가기</button>
      </div>
    );
  }

  const draft = task.draft;
  const sourceFacts = draft?.sourceFacts ?? [];
  const srcArticles = articles.filter(a => task.sources.some(s => s.articleId === a.id));

  // 히어로 이미지 + 본문 — 인라인 첫 유효 <img> 우선, 없으면 srcArticles 전체 순회(유효 url).
  // 히어로로 끌어올린 인라인 이미지는 본문서 제거 + 빈 src img도 제거(깨진 이미지 방지). 미리보기 2곳 공통.
  const inlineHero = firstImgSrc(body);
  const heroSrc = pickHero(body, srcArticles);
  const bodyRender = stripEmptyImg(inlineHero ? stripFirstImg(body) : body);

  // (2) 미저장 이탈 가드
  const dirty =
    headline !== (draft?.headline ?? '') ||
    body !== (draft?.body ?? '') ||
    JSON.stringify(tags) !== JSON.stringify(draft?.tags ?? []);
  const guardedBack = () => {
    if (dirty && !confirm('저장하지 않은 편집이 있습니다. 저장하지 않고 나가시겠습니까?')) return;
    onBack();
  };

  const saveDraft = () => {
    const updated: StoryOutput = {
      ...(draft ?? { summary: '', headline: '', body: '', tags: [], imagePrompt: '' }),
      headline,
      body,
      tags,
    };
    updateTask(task.id, { draft: updated });
  };

  const regenerate = async () => {
    setRegenerating(true);
    try {
      const category: Category =
        settings.categories.find(c => c.id === settings.activeCategoryId)
        ?? settings.categories[0]
        ?? { id: 'default', label: '기본', criteria: '', tone: '' };
      const fresh = await generateStory(srcArticles, settings, category);
      setHeadline(fresh.headline);
      setBody(fresh.body);
      setTags(fresh.tags);
      updateTask(task.id, { draft: fresh });
    } catch (err) {
      alert(`재생성 실패: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRegenerating(false);
    }
  };

  const publish = () => {
    if (!confirm('이 아티클을 발행하시겠습니까? (Hydra 배포)')) return;
    saveDraft();
    updateTask(task.id, { published: true, publishedAt: Date.now() });
    // Hydra 배포 훅 (stub)
    console.log('[pasta] publish → Hydra 배포 연결 지점', task.id);
    onBack();
  };

  const discard = (reason: DiscardReason) => {
    if (!confirm(`이 기사 건을 폐기하시겠습니까? (사유: ${DISCARD_REASONS.find(r => r.value === reason)?.label})`)) return;
    // 보존 폐기: 삭제 대신 discardReason 기록 → 폐기함에서 복원/영구삭제 가능
    updateTask(task.id, { discardReason: reason });
    onBack();
  };

  return (
    <div className="flex h-full flex-col" style={{ background: 'radial-gradient(ellipse 80% 80% at top left, #C5E3F6 0%, transparent 55%), radial-gradient(ellipse at bottom center, #FBE2BC 0%, transparent 55%), radial-gradient(ellipse at right, #F0D5F7 0%, transparent 55%), #FCF4E8' }}>
      {/* 헤더 */}
      <div className="flex items-center gap-2 border-b border-slate-200/60 bg-white/70 backdrop-blur-md px-5 py-2.5 text-sm">
        <button onClick={guardedBack} aria-label="칸반 보드로 돌아가기" className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors">← 칸반</button>
        {dirty && <span className="text-[10px] text-amber-600" title="저장하지 않은 변경 있음">● 미저장</span>}
        <span className="font-bold text-slate-800 truncate">📰 {task.title}</span>
        {task.review && (
          <span className={`ml-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-mono font-semibold ${task.review.passed ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {task.review.passed ? '✓ 검수 통과' : `검수 ${task.review.findings.filter(f => f.severity === 'block').length}건 차단`}
          </span>
        )}
        {task.draft?.summaryBased && (
          <span title="전문 추출 실패로 RSS 요약 기반 작성 — 사실 보수적" className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-mono font-semibold text-amber-700">
            ⚠ 요약 기반
          </span>
        )}
      </div>

      {/* 3분할 — 좁은 화면은 세로 스택, lg↑ 3분할 고정폭 */}
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[280px_1fr_320px] lg:overflow-hidden xl:grid-cols-[300px_1fr_340px]">
        {/* 좌: AI Assistant */}
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto border-r border-white/60 bg-white/45 backdrop-blur-md p-4">
          <div>
            <h3 className="mb-2 text-xs font-mono font-semibold uppercase tracking-wide text-slate-500">🤖 AI Assistant</h3>
            <button
              onClick={regenerate}
              disabled={regenerating}
              className="w-full rounded-full bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-700 disabled:opacity-40 transition-colors"
            >{regenerating ? '재생성 중...' : '✨ 초안 재생성'}</button>
          </div>

          <TaskSourcePanel task={task} />

          {/* #12 검수 결과 — 차단/경고 사유 */}
          {task.review && task.review.findings.length > 0 && (
            <div>
              <h4 className="mb-1.5 text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-400">
                검수 결과 ({task.review.passed ? '통과' : `${task.review.findings.filter(f => f.severity === 'block').length}건 차단`})
              </h4>
              <div className="space-y-1">
                {task.review.findings.map((f, i) => (
                  <div key={i} className={`rounded px-2 py-1 text-xs ${f.severity === 'block' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                    <span className="font-semibold">{f.severity === 'block' ? '🚫' : '⚠'} {f.label}</span>
                    <p className="text-[11px] opacity-80">{f.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h4 className="mb-1.5 text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-400">
              팩트 대조 ({checkedFacts.size}/{sourceFacts.length})
            </h4>
            <div className="space-y-1.5">
              {sourceFacts.map((f, i) => {
                const checked = checkedFacts.has(i);
                return (
                  <label key={i} className="flex items-start gap-2 rounded-lg border border-slate-100 bg-white/70 px-2.5 py-1.5 text-xs text-slate-600 cursor-pointer hover:bg-white">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => setCheckedFacts(prev => {
                        const next = new Set(prev);
                        if (next.has(i)) next.delete(i); else next.add(i);
                        return next;
                      })}
                      className="mt-0.5 accent-indigo-500"
                    />
                    <span className={checked ? 'text-slate-400 line-through' : ''}>{f}</span>
                  </label>
                );
              })}
              {sourceFacts.length === 0 && <p className="text-xs text-slate-300">팩트 없음</p>}
            </div>
          </div>
        </div>

        {/* 중: 에디터 */}
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto p-5">
          <div>
            <label className="mb-1 block text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-400">헤드라인</label>
            <input
              className="w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-lg font-bold focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-colors"
              value={headline}
              onChange={e => setHeadline(e.target.value)}
            />
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-400">본문 ({body.length}자)</label>
              <div className="flex gap-0.5 rounded-lg border border-slate-200 bg-white/60 p-0.5 text-[11px] font-semibold">
                {(['preview', 'source'] as const).map(v => (
                  <button key={v} onClick={() => switchBodyView(v)}
                    className={`rounded-md px-2 py-0.5 transition-colors ${bodyView === v ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
                  >{v === 'preview' ? '미리보기' : '소스'}</button>
                ))}
              </div>
            </div>
            {bodyView === 'source'
              ? <textarea
                  className="min-h-0 flex-1 w-full resize-none rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm leading-relaxed focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-colors font-mono"
                  value={body}
                  onChange={e => setBody(e.target.value)}
                />
              : body.trim()
                /* 미리보기 — 기사형(상단 히어로 + prose 본문). 반드시 sanitizeHtml 경유, raw 금지. */
                ? <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-slate-200 bg-white/80">
                    {heroSrc && <img src={heroSrc} alt="" onError={e => { e.currentTarget.style.display = 'none'; }} className="max-h-[360px] w-full rounded-t-lg bg-slate-50 object-contain" />}
                    <div
                      className={`px-4 py-3 text-sm text-slate-700 ${PROSE_CLS}`}
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(bodyRender) }}
                    />
                  </div>
                : <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg border border-dashed border-slate-200 text-xs text-slate-300">본문 없음 — 소스 탭에서 편집하거나 재생성</div>}
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-400">태그</label>
            <TagInput values={tags} onChange={setTags} placeholder="태그 입력 후 Enter" />
          </div>
        </div>

        {/* 우: 채널 프리뷰 — 그룹 채널 유형별 분기 */}
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto border-l border-white/60 bg-white/45 backdrop-blur-md p-4">
          <h3 className="text-xs font-mono font-semibold uppercase tracking-wide text-slate-500">📰 기사 미리보기</h3>
          {(() => {
            const channelName = group?.name?.trim() || '채널';
            const ct: ChannelType = profile?.channelType ?? 'news_media';
            const BADGE: Record<ChannelType, { label: string; bg: string }> = {
              news_media: { label: '기사', bg: 'bg-slate-700' },
              vertical_curation: { label: '큐레이션', bg: 'bg-indigo-600' },
              brand_corporate: { label: '공식', bg: 'bg-indigo-600' },
              creator_newsletter: { label: '뉴스레터', bg: 'bg-amber-600' },
            };
            const badge = BADGE[ct] ?? BADGE.news_media;
            return (
              // 뉴스 기사형 레이아웃 (X/소셜 카드 폐기) — 헤드라인 + 히어로 + 렌더된 본문(prose)
              <article className="overflow-hidden rounded-2xl border border-white/70 bg-white shadow-sm">
                {heroSrc && <img src={heroSrc} alt="" onError={e => { e.currentTarget.style.display = 'none'; }} className="max-h-[360px] w-full bg-slate-50 object-contain" />}
                <div className="p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="truncate text-[11px] font-semibold text-slate-500">{channelName}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-mono font-bold text-white ${badge.bg}`}>{badge.label}</span>
                  </div>
                  <h2 className="text-base font-bold leading-snug text-slate-900">{stripHtml(headline) || '헤드라인'}</h2>
                  {/* 본문 HTML 렌더 — 반드시 sanitizeHtml(DOMPurify) 경유. raw 금지. 자르기는 max-h+overflow. */}
                  {body.trim()
                    ? <div
                        className={`mt-2 max-h-80 max-w-none overflow-y-auto text-sm text-slate-700 ${PROSE_CLS}`}
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(bodyRender) }}
                      />
                    : <p className="mt-2 text-xs text-slate-300">본문 미리보기</p>}
                  {tags.length > 0 && <p className="mt-3 text-xs text-slate-400">{tags.map(t => `#${t}`).join(' ')}</p>}
                </div>
              </article>
            );
          })()}
          <p className="text-xs text-slate-400">발행하면 연결된 배포 채널로 전송됩니다.</p>
        </div>
      </div>

      {/* 하단 액션 바 */}
      <div className="flex items-center gap-2 border-t border-slate-200/60 bg-white/70 backdrop-blur-md px-5 py-2.5">
        <button onClick={saveDraft} className="rounded-full border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">임시저장</button>
        <button onClick={publish} className="rounded-full bg-slate-900 px-5 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-700 transition-colors">발행</button>
        <button onClick={() => setDiscarding(v => !v)} className="rounded-full px-4 py-1.5 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors">폐기</button>
        {discarding && (
          <div className="flex items-center gap-1">
            {DISCARD_REASONS.map(r => (
              <button key={r.value} onClick={() => discard(r.value)} className="rounded-full border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 transition-colors">{r.label}</button>
            ))}
          </div>
        )}
        <span className="ml-auto text-xs font-mono text-slate-400">예약 발행 (캘린더 — Hydra)</span>
      </div>
    </div>
  );
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
}

// 기사 prose 타이포 — 단락 여백/줄간격/이미지 블록/리스트/인용. 미리보기 2곳 공통(@tailwindcss/typography 없이 동작).
const PROSE_CLS =
  '[&_p]:mb-3 [&_p]:leading-7 [&_h2]:mt-4 [&_h2]:mb-1 [&_h2]:text-base [&_h2]:font-bold [&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:font-semibold ' +
  '[&_img]:my-3 [&_img]:mx-auto [&_img]:block [&_img]:max-w-full [&_img]:max-h-96 [&_img]:object-contain [&_img]:rounded-lg [&_figure]:my-3 [&_figcaption]:mt-1 [&_figcaption]:text-center [&_figcaption]:text-xs [&_figcaption]:text-slate-400 ' +
  '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 ' +
  '[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-slate-200 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-slate-500 [&_strong]:font-semibold';

/** 유효 이미지 URL인가 — http(s) 절대경로만(빈문자/상대/data 스킵). */
function isValidImg(u?: string | null): u is string {
  return !!u && /^https?:\/\//i.test(u);
}
/** 핫링크 차단 잦은 도메인(조선 resizer 등) → 히어로 후순위. */
function isFlakyImg(u: string): boolean {
  return /chosun.*(resize|resizer)|img\.(chosun|donga)/i.test(u);
}
/** 본문 HTML 첫 인라인 <img>의 유효 src (히어로 후보). 빈 src는 무시. */
function firstImgSrc(html: string): string | undefined {
  const src = html.match(/<img[^>]+src=["']([^"']*)["']/i)?.[1];
  return isValidImg(src) ? src : undefined;
}
/** 첫 <img> 태그 1개 제거 (히어로로 끌어올린 이미지 본문 중복 방지). */
function stripFirstImg(html: string): string {
  return html.replace(/<img[^>]*>/i, '');
}
/** src 없는/빈 <img> 제거 (깨진 이미지 노출 방지 — 미리보기단 이중안전, 근본은 sanitizeHtml). */
function stripEmptyImg(html: string): string {
  return html.replace(/<img(?![^>]*\bsrc=["'][^"']+["'])[^>]*>/gi, '');
}
/** 히어로 선택 — 인라인 첫 유효 img → 전체 원문 이미지 → 썸네일. 핫링크 잦은 도메인 후순위. */
function pickHero(body: string, srcArticles: { images?: { url: string }[]; thumbnail?: string }[]): string | undefined {
  const inline = firstImgSrc(body);
  if (inline) return inline;
  const candidates = [
    ...srcArticles.flatMap(a => (a.images ?? []).map(i => i.url)),
    ...srcArticles.map(a => a.thumbnail),
  ].filter(isValidImg);
  return candidates.find(u => !isFlakyImg(u)) ?? candidates[0];
}
