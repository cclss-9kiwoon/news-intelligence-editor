import { useState } from 'react';
import { useCampaigns } from '../../state/CampaignContext';
import { useTasks } from '../../state/TaskContext';
import { HelpTip } from './HelpTip';
import type { Group, ChannelType, FormalityLevel, SourceStrictness, ArticleWindow, Campaign, Task } from '../../types';

const WINDOW_LABEL: Record<ArticleWindow, string> = {
  '1h': '1시간', '24h': '24시간', '7d': '7일', '30d': '30일', breaking: '속보',
};

// 자동 단계에서 작업이 돌아가는 중인지 (칸반 taskActive와 동일 기준)
function taskActive(t: Task): boolean {
  if (t.error) return false;
  if (t.status === 'searching' || t.status === 'topic_review') return true;
  if (t.status === 'producing' && !t.draft) return true;
  return false;
}

function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg className={`animate-spin motion-reduce:animate-none ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.4 0 0 5.4 0 12h4z" />
    </svg>
  );
}

// 캠페인 설정 요약 — 어떤 설정의 캠페인인지 한눈에
function summarize(c: Campaign) {
  const s = c.settings.searching;
  const apiOn = s.apiEnabled ?? true;
  const rssOn = s.rssEnabled ?? true;
  const sources = [apiOn && 'API', rssOn && 'RSS'].filter(Boolean).join('·') || '수집 꺼짐';
  const queryCount = s.searchProviders
    ? s.searchProviders.filter(p => p.enabled && p.query.trim()).length
    : (s.naverQueries?.length ?? 0) + (s.daumQueries?.length ?? 0);
  const reviewCount = c.settings.finalReview.reviewRules.filter(r => r.enabled).length;
  return {
    window: WINDOW_LABEL[s.articleWindow] ?? s.articleWindow,
    sources, collectionOn: apiOn || rssOn, queryCount, reviewCount,
    keywordCount: s.topicKeywords.length,
  };
}

const CHANNEL_TYPES: { value: ChannelType; label: string; icon: string }[] = [
  { value: 'news_media', label: '전문 보도 매체', icon: '📰' },
  { value: 'vertical_curation', label: '버티컬/큐레이션', icon: '🎯' },
  { value: 'brand_corporate', label: '브랜드/기업', icon: '🏢' },
  { value: 'creator_newsletter', label: '개인/뉴스레터', icon: '✍️' },
];
// 엄격류=앰버 통일 (교차검증), 표준=인디고, 느슨=슬레이트
// 향후 언어 추가는 이 배열에만
const LANGUAGES: { value: string; label: string }[] = [
  { value: 'ko', label: '한국어' },
  { value: 'en', label: '영어' },
];
const SOURCE_STRICTNESS: { value: SourceStrictness; label: string; active: string; dot: string }[] = [
  { value: 'cross_verified', label: '교차검증', active: 'border-amber-400 bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  { value: 'standard',       label: '표준',     active: 'border-indigo-500 bg-indigo-50 text-indigo-700', dot: 'bg-indigo-500' },
  { value: 'loose',          label: '느슨',     active: 'border-slate-400 bg-slate-100 text-slate-700', dot: 'bg-slate-400' },
];
const FORMALITY: { value: FormalityLevel; label: string; active: string; dot: string }[] = [
  { value: 'strict',   label: '엄격',   active: 'border-amber-400 bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  { value: 'standard', label: '표준',   active: 'border-indigo-500 bg-indigo-50 text-indigo-700', dot: 'bg-indigo-500' },
  { value: 'casual',   label: '캐주얼', active: 'border-slate-400 bg-slate-100 text-slate-700', dot: 'bg-slate-400' },
];

function formatRelative(ts?: number): string {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  return `${Math.floor(hr / 24)}일 전`;
}

export function GroupPanel({ group, onOpenCampaign }: { group: Group; onOpenCampaign: (id: string) => void }) {
  const { renameGroup, campaigns, addCampaign, duplicateCampaign, updateGroupProfile } = useCampaigns();
  const { tasks } = useTasks();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  const groupCampaigns = campaigns.filter(c => c.groupId === group.id);
  const p = group.profile;
  const inputCls = 'w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100';

  const createCampaign = () => {
    if (!newName.trim()) return;
    const c = addCampaign(group.id, newName.trim());
    setNewName(''); setAdding(false);
    onOpenCampaign(c.id);
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <p className="text-xs font-mono uppercase tracking-wide text-slate-400">배포 그룹</p>
      <div className="mb-6 flex items-center justify-between">
        <input
          className="w-full max-w-lg border-b border-transparent bg-transparent text-2xl font-bold text-slate-900 hover:border-slate-300 focus:border-indigo-500 focus:outline-none"
          value={group.name}
          onChange={e => renameGroup(group.id, e.target.value)}
        />
        {adding ? (
          <input
            autoFocus
            className="rounded-lg border border-slate-200 bg-white/80 px-3 py-1.5 text-sm"
            value={newName}
            placeholder="캠페인 이름"
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') createCampaign(); else if (e.key === 'Escape') { setAdding(false); setNewName(''); } }}
            onBlur={() => { setAdding(false); setNewName(''); }}
          />
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="shrink-0 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition-colors"
          >✨ 새 캠페인</button>
        )}
      </div>

      {/* 배포 맥락 (profile) 편집 — 캠페인에 상속 */}
      <div className="mb-5 rounded-2xl border border-white/70 bg-white/70 p-5 shadow-sm backdrop-blur-md">
        <h3 className="mb-1 font-bold text-slate-800">🎯 배포 맥락</h3>
        <p className="mb-4 text-xs text-slate-400">채널 정체성. 이 그룹의 모든 캠페인에 자동 적용됩니다.</p>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-600">배포 채널 유형<HelpTip text="이 채널이 어떤 곳인지에 따라 주제 선정·작성 톤·검수 기준이 자동으로 달라집니다. 전문 보도 매체일수록 팩트와 검수가 엄격하고, 개인 채널일수록 자유롭습니다." /></label>
            <div className="grid grid-cols-2 gap-2">
              {CHANNEL_TYPES.map(t => (
                <button key={t.value} onClick={() => updateGroupProfile(group.id, { channelType: t.value })}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-all ${p.channelType === t.value ? 'border-slate-900 bg-slate-900 text-white shadow-sm' : 'border-slate-200 bg-white/70 text-slate-600 hover:border-slate-300 hover:bg-white'}`}>
                  <span className="text-base leading-none">{t.icon}</span>{t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-600">전문성·격식 수준 <span className="font-mono text-[10px] uppercase tracking-wide text-slate-400">④검수 엄격도 연동</span><HelpTip text="검수 엄격도를 결정합니다. 엄격 = 모든 검수 항목 위반 시 발행 차단 / 표준 = 위반 시 주의 표시 / 캐주얼 = 핵심만 검사, 톤 자유." /></label>
            <div className="flex gap-1.5">
              {FORMALITY.map(f => (
                <button key={f.value} onClick={() => updateGroupProfile(group.id, { formalityLevel: f.value })}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-sm font-semibold transition-all ${p.formalityLevel === f.value ? f.active : 'border-slate-200 bg-white/70 text-slate-500 hover:bg-white'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${p.formalityLevel === f.value ? f.dot : 'bg-slate-300'}`} />
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">출처 확인 강도 <span className="font-mono text-[10px] uppercase tracking-wide text-slate-400">①기사 찾기 연동</span><HelpTip text="기사 출처를 얼마나 깐깐하게 보는지. 교차검증 = 서로 다른 원문 2곳 이상 확인된 사실만 / 표준 = 균형 / 느슨 = 2차 매체·SNS 인용도 허용." /></label>
              <div className="flex gap-1.5">
                {SOURCE_STRICTNESS.map(ss => (
                  <button key={ss.value} onClick={() => updateGroupProfile(group.id, { sourceStrictness: ss.value })}
                    className={`flex flex-1 items-center justify-center gap-1 rounded-lg border px-1.5 py-1.5 text-xs font-semibold transition-all ${p.sourceStrictness === ss.value ? ss.active : 'border-slate-200 bg-white/70 text-slate-500 hover:bg-white'}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${p.sourceStrictness === ss.value ? ss.dot : 'bg-slate-300'}`} />
                    {ss.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">언어 <span className="font-mono text-[10px] uppercase tracking-wide text-slate-400">②③ 연동</span><HelpTip text="채널 언어. 주제 인지도 판단 기준 언어권과 기사 출력 언어를 결정합니다. (예: ko=한국어, en=영어)" /></label>
              <select className={inputCls} value={p.language} onChange={e => updateGroupProfile(group.id, { language: e.target.value })}>
                {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label} ({l.value})</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">채널 성격<HelpTip text="이 채널이 무엇을 다루는 곳인지. 어떤 주제를 고르고 어떤 방향으로 쓸지에 반영됩니다. (예: K-pop 전문 영문 매체)" /></label>
            <input className={inputCls} value={p.character} placeholder="예: K-pop 전문 영문 매체" onChange={e => updateGroupProfile(group.id, { character: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">타겟 독자<HelpTip text="누가 읽는지. 주제 선정 기준과 글의 톤·난이도에 반영됩니다. (예: 글로벌 K-pop 팬)" /></label>
              <input className={inputCls} value={p.audience} placeholder="예: 글로벌 K-pop 팬" onChange={e => updateGroupProfile(group.id, { audience: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">전반 톤·스타일<HelpTip text="생성되는 모든 기사의 문체 기본값입니다. (예: 팩트 중심, 중립적)" /></label>
              <input className={inputCls} value={p.toneBase} placeholder="예: 팩트 중심, 중립적" onChange={e => updateGroupProfile(group.id, { toneBase: e.target.value })} />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/70 bg-white/70 p-5 shadow-sm backdrop-blur-md">
        <h3 className="font-bold text-slate-800">📋 캠페인 ({groupCampaigns.length})</h3>
        {groupCampaigns.length === 0 ? (
          <div className="mt-3 flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-slate-200 py-10 text-center">
            <p className="text-3xl">✨</p>
            <p className="text-sm text-slate-500">예약된 캠페인이 없어요</p>
            <button
              onClick={() => setAdding(true)}
              className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >새 캠페인 시작</button>
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {groupCampaigns.map(c => {
              const sum = summarize(c);
              const activeCount = tasks.filter(t => t.campaignId === c.id && taskActive(t)).length;
              const status = activeCount > 0
                ? { label: `작동 중 · ${activeCount}건`, cls: 'bg-blue-50 text-blue-700', spin: true, dot: '' }
                : sum.collectionOn
                  ? { label: '대기', cls: 'bg-slate-100 text-slate-500', spin: false, dot: 'bg-emerald-400' }
                  : { label: '정지', cls: 'bg-slate-100 text-slate-400', spin: false, dot: 'bg-slate-300' };
              return (
                <div
                  key={c.id}
                  onClick={() => onOpenCampaign(c.id)}
                  className="pasta-springy group flex cursor-pointer flex-col rounded-xl border border-slate-200 bg-white/70 p-3.5 text-left shadow-sm hover:border-slate-300 hover:shadow-md"
                >
                  {/* 상단: 이름 + 상태 */}
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">📋 {c.name}</span>
                    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-mono font-semibold ${status.cls}`}>
                      {status.spin
                        ? <Spinner className="h-2.5 w-2.5 text-blue-500" />
                        : <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />}
                      {status.label}
                    </span>
                  </div>

                  {/* 설정 요약 칩 */}
                  <div className="mt-2.5 flex flex-wrap gap-1.5 text-[11px] font-mono">
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-slate-600">⏱ {sum.window}</span>
                    <span className={`rounded-md px-1.5 py-0.5 ${sum.collectionOn ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>📡 {sum.sources}</span>
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-slate-600">🔎 검색어 {sum.queryCount}</span>
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-slate-600">🏷 키워드 {sum.keywordCount}</span>
                    <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-amber-700">✔ 검수 {sum.reviewCount}</span>
                  </div>

                  {/* 하단: 갱신 시각 + 액션 */}
                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2">
                    <span className="text-[11px] text-slate-300">{formatRelative(c.updatedAt) || '—'}</span>
                    <span className="flex items-center gap-2">
                      <button
                        title="복제"
                        aria-label={`캠페인 복제: ${c.name}`}
                        onClick={e => { e.stopPropagation(); const copy = duplicateCampaign(c.id); if (copy) onOpenCampaign(copy.id); }}
                        className="text-slate-300 hover:text-indigo-500"
                      >📑</button>
                      <span className="text-xs font-semibold text-slate-400 group-hover:text-slate-700">설정 →</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
