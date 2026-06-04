import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, RotateCcw, Check } from 'lucide-react';
import { useSettings } from '../state/SettingsContext';
import type {
  ProjectProfile, FormatRules, ReviewRule,
  QuoteStyle, HeadlineCasing, ArtistMarkup, ImageMarkup, OutputLanguage,
} from '../types';

/**
 * 프로젝트 프로필 설정 탭.
 * 포맷·검수 규칙의 SSOT(단일 진실 소스). 생성 프롬프트 + 검수 엔진이 동일하게 읽는다.
 *
 * 다른 탭과 달리 명시적 [저장] 버튼으로 커밋한다. 편집은 로컬 draft에서,
 * 저장 시에만 settings에 반영(=localStorage + 파일 백업).
 */
export function ProjectProfileTab() {
  const { settings, updateProjectProfile } = useSettings();

  const [draft, setDraft] = useState<ProjectProfile>(settings.projectProfile);
  const [savedFlash, setSavedFlash] = useState(false);

  // 외부에서 settings.projectProfile이 바뀌면(리셋 등) draft 동기화
  useEffect(() => { setDraft(settings.projectProfile); }, [settings.projectProfile]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(settings.projectProfile);

  const save = () => {
    updateProjectProfile(draft);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  };
  const revert = () => setDraft(settings.projectProfile);

  // draft 헬퍼
  const setProfile = (patch: Partial<ProjectProfile>) => setDraft(d => ({ ...d, ...patch }));
  const setFormat = (patch: Partial<FormatRules>) => setDraft(d => ({ ...d, formatRules: { ...d.formatRules, ...patch } }));
  const addRule = () => setDraft(d => ({
    ...d,
    reviewRules: [...d.reviewRules, { id: `rule-${Date.now()}`, label: '새 검수 항목', instruction: '', severity: 'warn', enabled: true } as ReviewRule],
  }));
  const updateRule = (id: string, patch: Partial<ReviewRule>) => setDraft(d => ({
    ...d, reviewRules: d.reviewRules.map(r => r.id === id ? { ...r, ...patch } : r),
  }));
  const removeRule = (id: string) => setDraft(d => ({ ...d, reviewRules: d.reviewRules.filter(r => r.id !== id) }));

  const p = draft;
  const f = draft.formatRules;

  const quoteOpts: { v: QuoteStyle; label: string }[] = [
    { v: 'double', label: '큰따옴표 ""' },
    { v: 'single', label: '작은따옴표 \'\'' },
  ];

  return (
    <div className="relative">
      <div className="space-y-6 p-5 pb-20">
        <p className="text-xs text-slate-500">
          이 프로젝트(매체)의 <b>기사 포맷·검수 규칙</b>을 정합니다. 여기 설정한 규칙은 기사 <b>생성</b>과 <b>검수</b>에 동시에 적용됩니다(SSOT). 변경 후 아래 <b>저장</b>을 눌러야 반영됩니다.
        </p>

        {/* 아이덴티티 */}
        <section>
          <h3 className="mb-2 font-semibold text-sm">프로젝트 아이덴티티</h3>
          <div className="space-y-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">매체/프로젝트명</label>
              <input
                value={p.publicationName}
                onChange={e => setProfile({ publicationName: e.target.value })}
                placeholder="예: allkpop"
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">출력 언어</label>
              <select
                value={p.outputLanguage}
                onChange={e => setProfile({ outputLanguage: e.target.value as OutputLanguage })}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="ko">한국어</option>
                <option value="en">영어</option>
                <option value="both">한국어 + 영어</option>
              </select>
            </div>
          </div>
        </section>

        {/* 소스 매체 정책 */}
        <section>
          <h3 className="mb-2 font-semibold text-sm">소스 매체 정책</h3>
          <div className="space-y-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">허용 매체 (쉼표 구분, 비우면 전체 허용)</label>
              <input
                value={p.allowedMedia.join(', ')}
                onChange={e => setProfile({ allowedMedia: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                placeholder="예: 디스패치, OSEN, 스타뉴스"
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">금지 매체 (쉼표 구분)</label>
              <input
                value={p.bannedMedia.join(', ')}
                onChange={e => setProfile({ bannedMedia: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                placeholder="예: Soompi, Korea Herald, Koreaboo"
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
        </section>

        {/* 포맷 규칙 (구조화) */}
        <section>
          <h3 className="mb-2 font-semibold text-sm">포맷 규칙</h3>
          <p className="mb-2 text-xs text-slate-500">구조화된 규칙은 검수 시 자동으로 검사됩니다.</p>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-500">곡명/트랙명 인용부호</span>
                <select value={f.quoteSong} onChange={e => setFormat({ quoteSong: e.target.value as QuoteStyle })} className="w-full rounded border border-slate-300 px-2 py-1 text-sm">
                  {quoteOpts.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-500">앨범/쇼/투어명 인용부호</span>
                <select value={f.quoteWork} onChange={e => setFormat({ quoteWork: e.target.value as QuoteStyle })} className="w-full rounded border border-slate-300 px-2 py-1 text-sm">
                  {quoteOpts.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-500">인용구 부호</span>
                <select value={f.quoteQuotation} onChange={e => setFormat({ quoteQuotation: e.target.value as QuoteStyle })} className="w-full rounded border border-slate-300 px-2 py-1 text-sm">
                  {quoteOpts.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-500">헤드라인 케이싱</span>
                <select value={f.headlineCasing} onChange={e => setFormat({ headlineCasing: e.target.value as HeadlineCasing })} className="w-full rounded border border-slate-300 px-2 py-1 text-sm">
                  <option value="none">규칙 없음</option>
                  <option value="lower-minor">전치사·접속사 소문자 (영문)</option>
                  <option value="title">Title Case (영문)</option>
                  <option value="sentence">Sentence case</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-500">본문 아티스트명 마크업</span>
                <select value={f.artistMarkup} onChange={e => setFormat({ artistMarkup: e.target.value as ArtistMarkup })} className="w-full rounded border border-slate-300 px-2 py-1 text-sm">
                  <option value="strong">{'<strong>이름</strong>'}</option>
                  <option value="link">링크 {'<a href>'}</option>
                  <option value="plain">일반 텍스트</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-500">이미지 배치</span>
                <select value={f.imageMarkup} onChange={e => setFormat({ imageMarkup: e.target.value as ImageMarkup })} className="w-full rounded border border-slate-300 px-2 py-1 text-sm">
                  <option value="img-direct">{'<img> 직접 배치'}</option>
                  <option value="figure">{'<figure> 허용'}</option>
                </select>
              </label>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={f.noEditorialClosing} onChange={e => setFormat({ noEditorialClosing: e.target.checked })} />
              클로징 에디토리얼 첨언 금지 (축하·응원·질문으로 끝내지 않고 팩트로 종료)
            </label>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <span className="text-xs font-semibold text-slate-500">본문 길이</span>
                <input type="number" min={0} value={f.bodyMinChars} onChange={e => setFormat({ bodyMinChars: Number(e.target.value) })} className="w-20 rounded border border-slate-300 px-2 py-1 text-sm" />
                <span className="text-xs text-slate-400">~</span>
                <input type="number" min={0} value={f.bodyMaxChars} onChange={e => setFormat({ bodyMaxChars: Number(e.target.value) })} className="w-20 rounded border border-slate-300 px-2 py-1 text-sm" />
                <span className="text-xs text-slate-400">자 (0 = 무제한)</span>
              </label>
            </div>
          </div>
        </section>

        {/* 자유 가이드라인 */}
        <section>
          <h3 className="mb-1 font-semibold text-sm">추가 가이드라인 (자유 서술)</h3>
          <p className="mb-2 text-xs text-slate-500">위 항목으로 표현 안 되는 규칙. LLM이 생성·검수 시 참고합니다.</p>
          <textarea
            value={p.styleGuide}
            onChange={e => setProfile({ styleGuide: e.target.value })}
            rows={5}
            placeholder="예: News Article URL 필드는 비운다. 단일 소스 링크를 본문에 넣지 않는다."
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm leading-relaxed"
          />
        </section>

        {/* 커스텀 검수 항목 */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold text-sm">검수 항목 (LLM 검사)</h3>
            <button onClick={addRule} className="flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">
              <Plus size={12} /> 항목 추가
            </button>
          </div>
          <p className="mb-2 text-xs text-slate-500">기본 검수(팩트 정합·엔티티)에 더해, 이 매체만의 검수 기준을 추가합니다. <b>block</b>=발행 차단, <b>warn</b>=경고만.</p>
          <div className="space-y-2">
            {p.reviewRules.map(r => (
              <div key={r.id} className="rounded border border-slate-200 p-2">
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={r.enabled} onChange={e => updateRule(r.id, { enabled: e.target.checked })} title="활성화" />
                  <input
                    value={r.label}
                    onChange={e => updateRule(r.id, { label: e.target.value })}
                    className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm font-semibold"
                    placeholder="검수 항목 이름"
                  />
                  <select
                    value={r.severity}
                    onChange={e => updateRule(r.id, { severity: e.target.value as 'block' | 'warn' })}
                    className="rounded border border-slate-300 px-2 py-1 text-xs"
                  >
                    <option value="block">block</option>
                    <option value="warn">warn</option>
                  </select>
                  <button onClick={() => removeRule(r.id)} className="rounded p-1 text-red-500 hover:bg-red-50" aria-label="삭제">
                    <Trash2 size={14} />
                  </button>
                </div>
                <textarea
                  value={r.instruction}
                  onChange={e => updateRule(r.id, { instruction: e.target.value })}
                  rows={2}
                  placeholder="LLM에게 무엇을 검사하라고 지시할지"
                  className="mt-2 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                />
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* 저장 바 (하단 고정) */}
      <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
        {dirty && <span className="mr-auto text-xs text-amber-600">저장되지 않은 변경 있음</span>}
        {savedFlash && <span className="mr-auto flex items-center gap-1 text-xs text-green-600"><Check size={12} /> 저장됨</span>}
        <button
          onClick={revert}
          disabled={!dirty}
          className="flex items-center gap-1 rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-white disabled:opacity-40"
        >
          <RotateCcw size={14} /> 되돌리기
        </button>
        <button
          onClick={save}
          disabled={!dirty}
          className="flex items-center gap-1 rounded bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40"
        >
          <Save size={14} /> 저장
        </button>
      </div>
    </div>
  );
}
