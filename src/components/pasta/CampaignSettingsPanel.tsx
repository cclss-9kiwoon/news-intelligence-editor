import { useState } from 'react';
import { useCampaigns } from '../../state/CampaignContext';
import type { Campaign, SourceConfig, TopicReviewConfig, GenerationConfig, FinalReviewConfig, ArticleWindow } from '../../types';
import { DEFAULT_PROMPT_CONFIG } from '../../lib/defaultSettings';
import { makeAllkpopCampaignSettings } from '../../lib/allkpopPreset';

const WINDOWS: { value: ArticleWindow; label: string }[] = [
  { value: '1h', label: '1시간' },
  { value: '24h', label: '24시간' },
  { value: '7d', label: '7일' },
  { value: '30d', label: '30일' },
  { value: 'breaking', label: '속보' },
];

type Step = 1 | 2 | 3 | 4;
// 칸반 단계 컬러 체계와 1:1 — 자동(서칭/주제검수/생성)=블루, 결과물검수=앰버
const STEPS: { n: Step; label: string; short: string; auto: boolean; active: string; dot: string }[] = [
  { n: 1, label: '서칭',        short: '①', auto: true,  active: 'bg-blue-500',  dot: 'bg-blue-500' },
  { n: 2, label: '주제 검수',    short: '②', auto: true,  active: 'bg-blue-500',  dot: 'bg-blue-500' },
  { n: 3, label: '생성',        short: '③', auto: true,  active: 'bg-blue-500',  dot: 'bg-blue-500' },
  { n: 4, label: '결과물 검수',  short: '④', auto: false, active: 'bg-amber-500', dot: 'bg-amber-500' },
];

export function CampaignSettingsPanel({ campaign, onOpen }: { campaign: Campaign; onOpen: () => void }) {
  const { renameCampaign, updateCampaignSettings, groups } = useCampaigns();
  const [step, setStep] = useState<Step>(1);
  const [savedSteps, setSavedSteps] = useState<Set<Step>>(new Set());
  const s = campaign.settings;
  const group = groups.find(g => g.id === campaign.groupId);

  // 설정은 onChange로 이미 자동 저장됨. 이 버튼은 단계 확정 + 다음 단계 전환 + 연결선 진행.
  const saveAndNext = (n: Step) => {
    setSavedSteps(prev => new Set(prev).add(n));
    if (n < 4) setStep((n + 1) as Step);
  };

  const setSearching = (patch: Partial<SourceConfig>) =>
    updateCampaignSettings(campaign.id, { searching: { ...s.searching, ...patch } });
  const setTopic = (patch: Partial<TopicReviewConfig>) =>
    updateCampaignSettings(campaign.id, { topicReview: { ...s.topicReview, ...patch } });
  const setGen = (patch: Partial<GenerationConfig>) =>
    updateCampaignSettings(campaign.id, { generation: { ...s.generation, ...patch } });
  const setGenPrompt = (key: keyof typeof s.generation.promptConfig, val: string) =>
    setGen({ promptConfig: { ...s.generation.promptConfig, [key]: val } });
  const setReview = (patch: Partial<FinalReviewConfig>) =>
    updateCampaignSettings(campaign.id, { finalReview: { ...s.finalReview, ...patch } });

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      {/* 헤더 */}
      <div className="mb-4 flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs text-slate-400">🏢 {group?.name ?? '—'}{group?.profile.character ? ` · ${group.profile.character}` : ''}</p>
          <input
            className="mt-1 w-full max-w-lg border-b border-transparent bg-transparent text-2xl font-bold text-slate-900 hover:border-slate-300 focus:border-indigo-500 focus:outline-none"
            value={campaign.name}
            onChange={e => renameCampaign(campaign.id, e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { if (confirm('allkpop 프리셋을 적용하시겠습니까? 현재 캠페인 설정을 덮어씁니다.')) updateCampaignSettings(campaign.id, makeAllkpopCampaignSettings()); }}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          >allkpop 프리셋</button>
          <button
            onClick={onOpen}
            className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-700 transition-colors"
          >이 캠페인으로 작업 →</button>
        </div>
      </div>

      {/* 4단계 스텝 인디케이터 (칸반 단계와 1:1, 컬러 동일) */}
      <div className="mb-5 flex items-center rounded-2xl border border-white/60 bg-white/55 px-4 py-3 backdrop-blur-md">
        {STEPS.map((st, i) => (
          <div key={st.n} className="flex flex-1 items-center last:flex-none">
            <button onClick={() => setStep(st.n)} className="flex items-center gap-2.5 group">
              {/* 번호 원형 */}
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${
                savedSteps.has(st.n)
                  ? `${st.dot} text-white shadow-sm`
                  : step === st.n
                    ? `${st.active} text-white shadow-sm ring-4 ${st.auto ? 'ring-blue-100' : 'ring-amber-100'}`
                    : 'bg-white text-slate-400 border border-slate-200'
              }`}>
                {savedSteps.has(st.n) ? '✓' : st.short}
              </span>
              {/* 라벨 + 자동/사람 */}
              <span className="flex flex-col items-start leading-tight">
                <span className={`text-sm font-semibold transition-colors ${step === st.n ? 'text-slate-900' : 'text-slate-400 group-hover:text-slate-600'}`}>
                  {st.label}
                </span>
                <span className={`text-[9px] font-mono uppercase tracking-wide ${st.auto ? 'text-blue-500' : 'text-amber-500'}`}>
                  {st.auto ? 'AUTO' : 'HUMAN'}
                </span>
              </span>
            </button>
            {/* 연결선 (마지막 제외) — 저장 시 색이 쭉 채워짐 */}
            {i < STEPS.length - 1 && (
              <div className="mx-3 h-1 flex-1 overflow-hidden rounded-full bg-slate-200">
                <div className={`h-full rounded-full transition-all duration-500 ease-out ${st.dot} ${savedSteps.has(st.n) ? 'w-full' : 'w-0'}`} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ① 서칭 */}
      {step === 1 && (
        <Section title="📌 서칭" desc="어디서 어떤 기사를 가져올지" auto onSave={() => saveAndNext(1)} saved={savedSteps.has(1)}>
          <Field label="RSS 소스">
            <div className="space-y-1">
              {s.searching.rssSources.map(src => (
                <label key={src.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={src.enabled}
                    onChange={e => setSearching({ rssSources: s.searching.rssSources.map(x => x.id === src.id ? { ...x, enabled: e.target.checked } : x) })} />
                  <span className={src.enabled ? 'text-slate-800' : 'text-slate-400'}>{src.name}</span>
                </label>
              ))}
            </div>
          </Field>
          <Field label="네이버 검색어 (쉼표)">
            <input className="w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm"
              value={s.searching.naverQueries.join(', ')}
              onChange={e => setSearching({ naverQueries: e.target.value.split(',').map(x => x.trim()).filter(Boolean) })} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="포함 키워드 (쉼표)">
              <input className="w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm" placeholder="컴백, 앨범, 차트"
                value={s.searching.topicKeywords.join(', ')}
                onChange={e => setSearching({ topicKeywords: e.target.value.split(',').map(x => x.trim()).filter(Boolean) })} />
            </Field>
            <Field label="제외 키워드 (쉼표)">
              <input className="w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm" placeholder="정치, 경제"
                value={s.searching.excludeKeywords.join(', ')}
                onChange={e => setSearching({ excludeKeywords: e.target.value.split(',').map(x => x.trim()).filter(Boolean) })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="시간 윈도우">
              <select className="w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm"
                value={s.searching.articleWindow} onChange={e => setSearching({ articleWindow: e.target.value as ArticleWindow })}>
                {WINDOWS.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
              </select>
            </Field>
            <Field label="태스크 생성 최소 매체 수">
              <input type="number" min={1} max={10} className="w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm"
                value={s.searching.minMediaCount}
                onChange={e => setSearching({ minMediaCount: Math.max(1, Number(e.target.value) || 1) })} />
            </Field>
          </div>
        </Section>
      )}

      {/* ② 주제 검수 */}
      {step === 2 && (
        <Section title="📌 주제 검수" desc="어떤 주제를 고르나 + 쓸 만한 소스가 모였나" auto onSave={() => saveAndNext(2)} saved={savedSteps.has(2)}>
          <PromptField label="주제 선정 기준" value={s.topicReview.selectionCriteria}
            onChange={v => setTopic({ selectionCriteria: v })} onReset={() => setTopic({ selectionCriteria: '' })} rows={3} />
          <PromptField label="중복·앵글 회피 규칙" value={s.topicReview.dedupeRules}
            onChange={v => setTopic({ dedupeRules: v })} onReset={() => setTopic({ dedupeRules: '' })} rows={3} />
          <PromptField label="우선순위" value={s.topicReview.priority}
            onChange={v => setTopic({ priority: v })} onReset={() => setTopic({ priority: '' })} rows={2} />
        </Section>
      )}

      {/* ③ 생성 */}
      {step === 3 && (
        <Section title="📌 생성" desc="어떻게 쓰나 (LLM 프롬프트 + 표기 규칙)" auto onSave={() => saveAndNext(3)} saved={savedSteps.has(3)}>
          <PromptField label="에디터 역할" value={s.generation.promptConfig.editorRole}
            onChange={v => setGenPrompt('editorRole', v)} onReset={() => setGenPrompt('editorRole', DEFAULT_PROMPT_CONFIG.editorRole)} rows={1} />
          <PromptField label="발행 가이드" value={s.generation.promptConfig.publishingGuide}
            onChange={v => setGenPrompt('publishingGuide', v)} onReset={() => setGenPrompt('publishingGuide', DEFAULT_PROMPT_CONFIG.publishingGuide)} rows={6} />
          <PromptField label="작업 지침" value={s.generation.promptConfig.taskInstructions}
            onChange={v => setGenPrompt('taskInstructions', v)} onReset={() => setGenPrompt('taskInstructions', DEFAULT_PROMPT_CONFIG.taskInstructions)} rows={6} />
          <PromptField label="금지 표현 (쉼표)" value={s.generation.promptConfig.bannedExpressions}
            onChange={v => setGenPrompt('bannedExpressions', v)} onReset={() => setGenPrompt('bannedExpressions', DEFAULT_PROMPT_CONFIG.bannedExpressions)} rows={2} />
          <Field label="표기 규칙">
            <div className="grid grid-cols-2 gap-2 text-sm text-slate-600">
              <label className="flex items-center justify-between rounded border border-slate-200 bg-white/60 px-2 py-1">
                곡명 인용
                <select className="rounded border-slate-200 bg-transparent text-xs" value={s.generation.formatRules.quoteSong}
                  onChange={e => setGen({ formatRules: { ...s.generation.formatRules, quoteSong: e.target.value as 'double' | 'single' } })}>
                  <option value="double">"double"</option><option value="single">'single'</option>
                </select>
              </label>
              <label className="flex items-center justify-between rounded border border-slate-200 bg-white/60 px-2 py-1">
                앨범/쇼 인용
                <select className="rounded border-slate-200 bg-transparent text-xs" value={s.generation.formatRules.quoteWork}
                  onChange={e => setGen({ formatRules: { ...s.generation.formatRules, quoteWork: e.target.value as 'double' | 'single' } })}>
                  <option value="double">"double"</option><option value="single">'single'</option>
                </select>
              </label>
            </div>
          </Field>
        </Section>
      )}

      {/* ④ 결과물 검수 */}
      {step === 4 && (
        <Section title="📌 결과물 검수" desc="무엇을 검수하나 (block=자동 차단, warn=사람 판단)" isLast onSave={() => saveAndNext(4)} saved={savedSteps.has(4)}>
          <Field label="금지 소스 매체 (쉼표)">
            <input className="w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm" placeholder="Soompi, Koreaboo"
              value={s.finalReview.bannedMedia.join(', ')}
              onChange={e => setReview({ bannedMedia: e.target.value.split(',').map(x => x.trim()).filter(Boolean) })} />
          </Field>
          <Field label={`검수 규칙 (${s.finalReview.reviewRules.length})`}>
            <div className="space-y-1">
              {s.finalReview.reviewRules.map(r => (
                <div key={r.id} className="flex items-center justify-between rounded border border-slate-200 bg-white/60 px-2 py-1.5 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={r.enabled}
                      onChange={e => setReview({ reviewRules: s.finalReview.reviewRules.map(x => x.id === r.id ? { ...x, enabled: e.target.checked } : x) })} />
                    <span className={r.enabled ? 'text-slate-700' : 'text-slate-400'}>{r.label}</span>
                  </label>
                  <span className={`rounded-full px-1.5 text-xs ${r.severity === 'block' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>
                    {r.severity === 'block' ? '자동 차단' : '사람 판단'}
                  </span>
                </div>
              ))}
            </div>
          </Field>
        </Section>
      )}
    </div>
  );
}

function Section({ title, desc, children, onSave, saved, isLast, auto }: {
  title: string; desc: string; children: React.ReactNode;
  onSave?: () => void; saved?: boolean; isLast?: boolean; auto?: boolean;
}) {
  const btnColor = auto ? 'bg-blue-500 hover:bg-blue-600' : 'bg-amber-500 hover:bg-amber-600';
  return (
    <div className="mb-5 rounded-2xl border border-white/70 bg-white/70 p-5 shadow-sm backdrop-blur-md">
      <h3 className="font-bold text-slate-800">{title}</h3>
      <p className="mb-4 text-xs text-slate-400">{desc}</p>
      <div className="space-y-4">{children}</div>
      {onSave && (
        <div className="mt-5 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
          {saved && <span className="text-xs font-mono text-green-600">✓ 저장됨</span>}
          <button
            onClick={onSave}
            className={`rounded-full px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors ${btnColor}`}
          >{saved ? '저장됨 ✓' : isLast ? '저장 완료' : '저장하고 다음 →'}</button>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-600">{label}</label>
      {children}
    </div>
  );
}

function PromptField({ label, value, onChange, onReset, rows }: {
  label: string; value: string; onChange: (v: string) => void; onReset: () => void; rows: number;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="text-sm font-medium text-slate-600">{label}</label>
        <button onClick={onReset} className="text-xs text-indigo-500 hover:underline">기본값 복원</button>
      </div>
      <textarea
        className="w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm font-mono focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-colors"
        rows={rows}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}
