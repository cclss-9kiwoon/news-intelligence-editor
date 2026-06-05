import { useState } from 'react';
import { useCampaigns } from '../../state/CampaignContext';
import { useSettings } from '../../state/SettingsContext';
import type { Campaign, SourceConfig, TopicReviewConfig, GenerationConfig, FinalReviewConfig, ArticleWindow, SearchProviderConfig, SearchProviderId } from '../../types';
import { DEFAULT_PROMPT_CONFIG } from '../../lib/defaultSettings';
import { makeAllkpopCampaignSettings } from '../../lib/allkpopPreset';
import { extractArticleText } from '../../lib/scraper';
import { testNaverConnection } from '../../lib/naver';
import { testDaumConnection } from '../../lib/daum';
import { HelpTip } from './HelpTip';
import type { ReferenceArticle } from '../../types';

const WINDOWS: { value: ArticleWindow; label: string }[] = [
  { value: '1h', label: '1시간' },
  { value: '24h', label: '24시간' },
  { value: '7d', label: '7일' },
  { value: '30d', label: '30일' },
  { value: 'breaking', label: '속보' },
];

type Step = 1 | 2 | 3 | 4;
type ApiStatus = { state: 'idle' | 'testing' | 'ok' | 'error'; message: string };
// 칸반 단계 컬러 체계와 1:1 — 자동(서칭/주제검수/생성)=블루, 결과물검수=앰버
const STEPS: { n: Step; label: string; short: string; auto: boolean; active: string; dot: string }[] = [
  { n: 1, label: '기사 찾기',    short: '①', auto: true,  active: 'bg-blue-500',  dot: 'bg-blue-500' },
  { n: 2, label: '주제 검수',    short: '②', auto: true,  active: 'bg-blue-500',  dot: 'bg-blue-500' },
  { n: 3, label: '기사 작성',    short: '③', auto: true,  active: 'bg-blue-500',  dot: 'bg-blue-500' },
  { n: 4, label: '최종 검수',    short: '④', auto: false, active: 'bg-amber-500', dot: 'bg-amber-500' },
];

export function CampaignSettingsPanel({ campaign, onOpen }: { campaign: Campaign; onOpen: () => void }) {
  const { renameCampaign, updateCampaignSettings, groups } = useCampaigns();
  const {
    settings,
    setNaverClientId,
    setNaverClientSecret,
    setNaverQueries,
    setDaumRestApiKey,
    setDaumQueries,
  } = useSettings();
  const [step, setStep] = useState<Step>(1);
  const [savedSteps, setSavedSteps] = useState<Set<Step>>(new Set());
  const [refUrl, setRefUrl] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [naverStatus, setNaverStatus] = useState<ApiStatus>({ state: 'idle', message: '미확인' });
  const [daumStatus, setDaumStatus] = useState<ApiStatus>({ state: 'idle', message: '미확인' });
  const s = campaign.settings;
  const group = groups.find(g => g.id === campaign.groupId);

  // #5 레퍼런스 기사: URL → 전문 추출 → 문체 참고용 저장 (최대 5개)
  const addReference = async () => {
    const url = refUrl.trim();
    if (!url || s.generation.referenceArticles.length >= 5) return;
    if (s.generation.referenceArticles.some(r => r.url === url)) { setRefUrl(''); return; }
    setExtracting(true);
    try {
      const r = await extractArticleText(url);
      if (r.ok && r.text) {
        const ref: ReferenceArticle = { id: crypto.randomUUID(), url, title: r.title || url, body: r.text, fetchedAt: Date.now() };
        setGen({ referenceArticles: [...s.generation.referenceArticles, ref] });
        setRefUrl('');
      } else {
        alert('전문 추출 실패 — URL을 확인하세요.');
      }
    } catch {
      alert('추출 중 오류가 발생했습니다.');
    } finally {
      setExtracting(false);
    }
  };
  const removeReference = (id: string) =>
    setGen({ referenceArticles: s.generation.referenceArticles.filter(r => r.id !== id) });

  const testNaver = async () => {
    setNaverStatus({ state: 'testing', message: '확인 중...' });
    const result = await testNaverConnection(settings.naverClientId, settings.naverClientSecret);
    setNaverStatus({ state: result.ok ? 'ok' : 'error', message: result.message });
  };

  const testDaum = async () => {
    setDaumStatus({ state: 'testing', message: '확인 중...' });
    const result = await testDaumConnection(settings.daumRestApiKey);
    setDaumStatus({ state: result.ok ? 'ok' : 'error', message: result.message });
  };

  // 설정은 onChange로 이미 자동 저장됨. 이 버튼은 단계 확정 + 다음 단계 전환 + 연결선 진행.
  const saveAndNext = (n: Step) => {
    setSavedSteps(prev => new Set(prev).add(n));
    if (n < 4) setStep((n + 1) as Step);
  };

  const setSearching = (patch: Partial<SourceConfig>) =>
    updateCampaignSettings(campaign.id, { searching: { ...s.searching, ...patch } });
  const searchProviders = s.searching.searchProviders ?? [
    ...s.searching.naverQueries.map(query => ({ provider: 'naver' as const, enabled: true, query })),
    ...((s.searching.daumQueries ?? []).map(query => ({ provider: 'daum' as const, enabled: false, query }))),
  ];
  const apiEnabled = s.searching.apiEnabled ?? true;
  const rssEnabled = s.searching.rssEnabled ?? true;
  const setSearchProviders = (providers: SearchProviderConfig[]) => {
    const naverQueries = providers.filter(p => p.provider === 'naver' && p.enabled).map(p => p.query).filter(Boolean);
    const daumQueries = providers.filter(p => p.provider === 'daum' && p.enabled).map(p => p.query).filter(Boolean);
    setSearching({
      searchProviders: providers,
      naverQueries,
      daumQueries,
    });
    setNaverQueries(naverQueries);
    setDaumQueries(daumQueries);
  };
  const updateSearchProvider = (idx: number, patch: Partial<SearchProviderConfig>) => {
    setSearchProviders(searchProviders.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };
  const addSearchProvider = (provider: SearchProviderId) => {
    setSearchProviders([...searchProviders, { provider, enabled: true, query: '' }]);
  };
  const removeSearchProvider = (idx: number) => {
    setSearchProviders(searchProviders.filter((_, i) => i !== idx));
  };
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

      {/* ① 기사 찾기 */}
      {step === 1 && (
        <Section title="📌 기사 찾기" desc="어디서 어떤 기사를 가져올지" auto onSave={() => saveAndNext(1)} saved={savedSteps.has(1)}>
          <div className="rounded-2xl border border-slate-200 bg-white/65 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-slate-800">① 검색 API 설정</h4>
                <p className="text-xs text-slate-400">네이버/다음 검색 API로 넓게 찾습니다.</p>
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                <input
                  type="checkbox"
                  checked={apiEnabled}
                  onChange={e => setSearching({ apiEnabled: e.target.checked })}
                />
                검색 API 사용
              </label>
            </div>
            <div className={`space-y-3 rounded-xl border border-slate-200 bg-white/60 p-3 transition-opacity ${apiEnabled ? '' : 'pointer-events-none opacity-45'}`}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span>네이버 Client ID</span>
                    <a href="https://developers.naver.com/apps/#/register" target="_blank" rel="noopener" className="font-normal text-slate-400 hover:text-indigo-600">발급받기 ↗</a>
                  </label>
                  <input
                    className="w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm font-mono"
                    value={settings.naverClientId}
                    onChange={e => setNaverClientId(e.target.value)}
                    placeholder="Naver Client ID"
                  />
                </div>
                <div>
                  <label className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span>네이버 Client Secret</span>
                  </label>
                  <input
                    type="password"
                    className="w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm font-mono"
                    value={settings.naverClientSecret}
                    onChange={e => setNaverClientSecret(e.target.value)}
                    placeholder="Naver Client Secret"
                  />
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <button
                    onClick={testNaver}
                    disabled={naverStatus.state === 'testing'}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-white disabled:opacity-50"
                  >연결 테스트</button>
                  <ApiStatusBadge status={naverStatus} />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span>Kakao REST API Key (다음 검색)</span>
                    <a href="https://developers.kakao.com/console/app" target="_blank" rel="noopener" className="font-normal text-slate-400 hover:text-indigo-600">발급받기 ↗</a>
                  </label>
                  <input
                    type="password"
                    className="w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm font-mono"
                    value={settings.daumRestApiKey}
                    onChange={e => setDaumRestApiKey(e.target.value)}
                    placeholder="Kakao REST API Key"
                  />
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <button
                    onClick={testDaum}
                    disabled={daumStatus.state === 'testing'}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-white disabled:opacity-50"
                  >연결 테스트</button>
                  <ApiStatusBadge status={daumStatus} />
                </div>
              </div>
              <div className="space-y-2">
                {searchProviders.map((provider, idx) => (
                  <div key={`${provider.provider}-${idx}`} className="grid grid-cols-[auto_96px_1fr_auto] items-center gap-2">
                    <input
                      type="checkbox"
                      checked={provider.enabled}
                      onChange={e => updateSearchProvider(idx, { enabled: e.target.checked })}
                    />
                    <select
                      value={provider.provider}
                      onChange={e => updateSearchProvider(idx, { provider: e.target.value as SearchProviderId })}
                      className="rounded-lg border border-slate-200 bg-white/80 px-2 py-2 text-sm"
                    >
                      <option value="naver">네이버</option>
                      <option value="daum">다음</option>
                    </select>
                    <input
                      className="rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm"
                      value={provider.query}
                      onChange={e => updateSearchProvider(idx, { query: e.target.value })}
                      placeholder="검색어"
                    />
                    <button
                      onClick={() => removeSearchProvider(idx)}
                      className="rounded-lg border border-slate-200 px-2 py-2 text-xs text-slate-500 hover:bg-slate-50"
                    >삭제</button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => addSearchProvider('naver')} className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50">+ 네이버 검색어</button>
                <button onClick={() => addSearchProvider('daum')} className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50">+ 다음 검색어</button>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <p className="mb-3 text-xs leading-relaxed text-slate-500">
                  검색 API(네이버/다음)로 들어온 기사의 원문 매체를 거릅니다. 허용 목록이 있으면 그 매체만, 차단 목록은 항상 제외. RSS는 직접 선택한 피드라 대부분 통과됩니다.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={<span>허용 매체 (쉼표) <HelpTip text="검색 API로 찾은 기사 중 이 매체 기사만 통과시킵니다. 비우면 모든 매체를 허용합니다." /></span>}>
                    <input className="w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm" placeholder="디스패치, 스타뉴스"
                      value={(s.searching.allowedSources ?? []).join(', ')}
                      onChange={e => setSearching({ allowedSources: e.target.value.split(',').map(x => x.trim()).filter(Boolean) })} />
                  </Field>
                  <Field label={<span>차단 매체 (쉼표) <HelpTip text="검색 API로 찾은 기사 중 제외할 매체입니다. 허용 목록보다 우선 적용됩니다." /></span>}>
                    <input className="w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm" placeholder="Soompi, Koreaboo"
                      value={(s.searching.bannedSources ?? []).join(', ')}
                      onChange={e => setSearching({ bannedSources: e.target.value.split(',').map(x => x.trim()).filter(Boolean) })} />
                  </Field>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/65 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-slate-800">② RSS 설정</h4>
                <p className="text-xs text-slate-400">직접 고른 구독 피드에서 가져옵니다.</p>
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                <input
                  type="checkbox"
                  checked={rssEnabled}
                  onChange={e => setSearching({ rssEnabled: e.target.checked })}
                />
                RSS 사용
              </label>
            </div>
            <div className={`space-y-1 transition-opacity ${rssEnabled ? '' : 'pointer-events-none opacity-45'}`}>
              {s.searching.rssSources.map(src => (
                <label key={src.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={src.enabled}
                    onChange={e => setSearching({ rssSources: s.searching.rssSources.map(x => x.id === src.id ? { ...x, enabled: e.target.checked } : x) })} />
                  <span className={src.enabled ? 'text-slate-800' : 'text-slate-400'}>{src.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/65 p-4">
            <div className="mb-3">
              <h4 className="font-semibold text-slate-800">③ 공통 설정</h4>
              <p className="text-xs text-slate-400">API/RSS 어느 방식으로 들어와도 같이 적용됩니다.</p>
            </div>
            {!apiEnabled && !rssEnabled && (
              <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                API 수집과 RSS 수집이 모두 꺼져 있습니다. 이 캠페인은 새 기사를 수집하지 않습니다.
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
            <Field label={<span>포함 키워드 (쉼표) <HelpTip text="이 단어가 들어간 기사만 우선 검토합니다. 캠페인 주제와 직접 관련된 단어를 넣습니다." /></span>}>
              <input className="w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm" placeholder="컴백, 앨범, 차트"
                value={s.searching.topicKeywords.join(', ')}
                onChange={e => setSearching({ topicKeywords: e.target.value.split(',').map(x => x.trim()).filter(Boolean) })} />
            </Field>
            <Field label={<span>제외 키워드 (쉼표) <HelpTip text="이 단어가 들어간 기사는 제외합니다. 캠페인과 상관없는 분야나 금지 주제를 넣습니다." /></span>}>
              <input className="w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm" placeholder="정치, 경제"
                value={s.searching.excludeKeywords.join(', ')}
                onChange={e => setSearching({ excludeKeywords: e.target.value.split(',').map(x => x.trim()).filter(Boolean) })} />
            </Field>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
            <Field label={<span>기사 시간 범위 <HelpTip text="최근 몇 시간 또는 며칠 기사까지 볼지 정합니다. 좁을수록 최신 이슈 중심입니다." /></span>}>
              <select className="w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm"
                value={s.searching.articleWindow} onChange={e => setSearching({ articleWindow: e.target.value as ArticleWindow })}>
                {WINDOWS.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
              </select>
            </Field>
            <Field label={<span>주제 묶는 기준 <HelpTip text="비슷한 기사를 같은 주제로 묶는 기준. 느슨하면 큰 덩어리로, 엄격하면 잘게 나뉩니다." /></span>}>
              <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-slate-200 bg-white/80 text-sm">
                {([
                  { label: '느슨하게', value: 0.25 },
                  { label: '보통', value: 0.35 },
                  { label: '엄격하게', value: 0.50 },
                ] as const).map(opt => (
                  <button
                    key={opt.label}
                    onClick={() => setSearching({ clusterThreshold: opt.value })}
                    className={`px-3 py-2 font-semibold transition-colors ${
                      Math.abs(s.searching.clusterThreshold - opt.value) < 0.01
                        ? 'bg-blue-500 text-white'
                        : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >{opt.label}</button>
                ))}
              </div>
            </Field>
            <Field label={<span>기사로 만들 최소 매체 수 <HelpTip text="같은 주제를 다룬 매체가 이 수 이상 모이면 기사 후보로 만듭니다. 높을수록 검증은 강해지고 후보는 줄어듭니다." /></span>}>
              <input type="number" min={1} max={10} className="w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm"
                value={s.searching.minMediaCount}
                onChange={e => setSearching({ minMediaCount: Math.max(1, Number(e.target.value) || 1) })} />
            </Field>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/65 p-4">
            <div className="mb-3">
              <h4 className="font-semibold text-slate-800">④ 중복·범위 보강</h4>
              <p className="text-xs text-slate-400">인물·브랜드 단위로 범위와 중복을 다듬습니다. 비우면 적용 안 함.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label={<span>허용 인물·브랜드 (쉼표) <HelpTip text="이 인물·브랜드가 언급된 기사만 후보로 만듭니다. 비우면 모두 허용합니다." /></span>}>
                <input className="w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm" placeholder="BTS, BLACKPINK, aespa"
                  value={(s.searching.entityAllowlist ?? []).join(', ')}
                  onChange={e => setSearching({ entityAllowlist: e.target.value.split(',').map(x => x.trim()).filter(Boolean) })} />
              </Field>
              <Field label={<span>제외 주제 (쉼표) <HelpTip text="이 구문이 들어간 기사는 후보에서 뺍니다. 제외 키워드보다 주제·구문 단위로 넓게 거릅니다." /></span>}>
                <input className="w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm" placeholder="열애설, 논란"
                  value={(s.searching.excludeTopics ?? []).join(', ')}
                  onChange={e => setSearching({ excludeTopics: e.target.value.split(',').map(x => x.trim()).filter(Boolean) })} />
              </Field>
              <Field label={<span>인물·브랜드당 하루 최대 건수 <HelpTip text="같은 인물·브랜드 기사를 하루에 몇 건까지 만들지 제한합니다. 0이면 무제한. 허용 인물·브랜드 목록이 있어야 동작합니다." /></span>}>
                <input type="number" min={0} max={20} className="w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm"
                  value={s.searching.maxPerEntityPerDay ?? 0}
                  onChange={e => setSearching({ maxPerEntityPerDay: Math.max(0, Number(e.target.value) || 0) })} />
              </Field>
              <Field label={<span>자체 기보도 중복 회피 <HelpTip text="이미 제작·발행한 기사 제목과 겹치는 주제는 새로 만들지 않습니다." /></span>}>
                <label className="flex h-[42px] items-center gap-2 rounded-lg border border-slate-200 bg-white/80 px-3 text-sm text-slate-700">
                  <input type="checkbox" checked={s.searching.ownSiteDedupe ?? false}
                    onChange={e => setSearching({ ownSiteDedupe: e.target.checked })} />
                  기보도 제목과 중복 시 스킵
                </label>
              </Field>
            </div>
            <div className="mt-4">
              <Field label={<span>이미지 출처 정책 <HelpTip text="허용/금지 이미지 출처를 적습니다. 기사 생성 가이드에 그대로 주입됩니다." /></span>}>
                <textarea className="w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm" rows={2}
                  placeholder="타 매체 워터마크 금지. 공식 프로모·소속사 제공분만 허용."
                  value={s.searching.imageSourcePolicy ?? ''}
                  onChange={e => setSearching({ imageSourcePolicy: e.target.value })} />
              </Field>
            </div>
          </div>
        </Section>
      )}

      {/* ② 주제 검수 */}
      {step === 2 && (
        <Section title="📌 주제 검수" desc="어떤 주제를 고르나 + 쓸 만한 출처가 모였나" auto onSave={() => saveAndNext(2)} saved={savedSteps.has(2)}>
          <PromptField label="주제 선정 기준" help="AI가 어떤 주제를 기사로 고를지 판단하는 기준입니다. 최신성·인지도·다양성 같은 우선 가치를 적습니다." value={s.topicReview.selectionCriteria}
            onChange={v => setTopic({ selectionCriteria: v })} onReset={() => setTopic({ selectionCriteria: '' })} rows={3} />
          <PromptField label="같은 내용 중복 피하기" help="이미 다룬 주제를 또 쓰지 않도록 하는 규칙. 같은 소재라도 다른 관점이면 허용할지 등을 적습니다." value={s.topicReview.dedupeRules}
            onChange={v => setTopic({ dedupeRules: v })} onReset={() => setTopic({ dedupeRules: '' })} rows={3} />
          <PromptField label="우선순위" help="후보가 많을 때 무엇을 먼저 쓸지 순서를 정합니다. 예: 속보 > 발표 > 차트 > 일반." value={s.topicReview.priority}
            onChange={v => setTopic({ priority: v })} onReset={() => setTopic({ priority: '' })} rows={2} />
        </Section>
      )}

      {/* ③ 생성 */}
      {step === 3 && (
        <Section title="📌 기사 작성" desc="어떻게 쓸지 정합니다 (AI 지시문 + 표기 규칙)" auto onSave={() => saveAndNext(3)} saved={savedSteps.has(3)}>
          <PromptField label="에디터 역할" help="AI가 어떤 매체의 어떤 에디터로서 글을 쓸지 정합니다. 매체 성격과 전문 분야를 적습니다." value={s.generation.promptConfig.editorRole}
            onChange={v => setGenPrompt('editorRole', v)} onReset={() => setGenPrompt('editorRole', DEFAULT_PROMPT_CONFIG.editorRole)} rows={1} />
          <PromptField label="발행 가이드" help="분량·구조·인용 방식 등 기사 작성의 큰 원칙입니다. 리드문 구성, 단어 수, 인용 패턴 등을 적습니다." value={s.generation.promptConfig.publishingGuide}
            onChange={v => setGenPrompt('publishingGuide', v)} onReset={() => setGenPrompt('publishingGuide', DEFAULT_PROMPT_CONFIG.publishingGuide)} rows={6} />
          <PromptField label="작업 지침" help="기사마다 반드시 지킬 세부 규칙입니다. 교차검증, 중복 확인, 수치 정확성 같은 체크 항목을 적습니다." value={s.generation.promptConfig.taskInstructions}
            onChange={v => setGenPrompt('taskInstructions', v)} onReset={() => setGenPrompt('taskInstructions', DEFAULT_PROMPT_CONFIG.taskInstructions)} rows={6} />
          <PromptField label="금지 표현 (쉼표)" help="기사에 쓰면 안 되는 표현·상투어입니다. AI가 이 단어들을 피해서 작성합니다." value={s.generation.promptConfig.bannedExpressions}
            onChange={v => setGenPrompt('bannedExpressions', v)} onReset={() => setGenPrompt('bannedExpressions', DEFAULT_PROMPT_CONFIG.bannedExpressions)} rows={2} />
          <Field label={<span>표기 규칙 <HelpTip text="곡명, 앨범명, 아티스트명, 이미지 HTML 같은 반복 표기 방식을 정합니다. 작성과 최종 검수에 같이 반영됩니다." /></span>}>
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
          <Field label={<span>참고 기사 ({s.generation.referenceArticles.length}/5) <HelpTip text="우리 매체의 실제 기사 URL을 넣으면 AI가 문체와 구조를 참고합니다. 사실 근거로 쓰는 용도는 아닙니다." /></span>}>
            <p className="mb-1.5 text-xs text-slate-400">우리 매체 실제 기사 URL을 등록하면 전문을 추출해 AI가 문체·구조를 참고합니다.</p>
            <div className="mb-2 space-y-1">
              {s.generation.referenceArticles.map(r => (
                <div key={r.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-white/60 px-2 py-1.5 text-xs">
                  <span className="truncate text-slate-700">📄 {r.title} <span className="text-slate-400">({r.body.length}자)</span></span>
                  <button onClick={() => removeReference(r.id)} className="ml-2 shrink-0 text-slate-300 hover:text-red-500">🗑</button>
                </div>
              ))}
            </div>
            {s.generation.referenceArticles.length < 5 && (
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm"
                  placeholder="기사 URL"
                  value={refUrl}
                  onChange={e => setRefUrl(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addReference(); }}
                />
                <button onClick={addReference} disabled={extracting || !refUrl.trim()}
                  className="rounded-lg bg-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-300 disabled:opacity-50">
                  {extracting ? '추출 중...' : '+ 추가'}
                </button>
              </div>
            )}
          </Field>
        </Section>
      )}

      {/* ④ 최종 검수 */}
      {step === 4 && (
        <Section title="📌 최종 검수" desc="발행 전 무엇을 확인할지 정합니다 (block=자동 차단, warn=사람 판단)" isLast onSave={() => saveAndNext(4)} saved={savedSteps.has(4)}>
          <Field label={<span>금지 매체 (쉼표) <HelpTip text="최종 검수에서 출처로 쓰면 안 되는 매체입니다. 발견되면 발행 전 차단됩니다." /></span>}>
            <input className="w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm" placeholder="Soompi, Koreaboo"
              value={s.finalReview.bannedMedia.join(', ')}
              onChange={e => setReview({ bannedMedia: e.target.value.split(',').map(x => x.trim()).filter(Boolean) })} />
          </Field>
          <Field label={<span>검수 규칙 ({s.finalReview.reviewRules.length}) <HelpTip text="켜진 항목만 검사합니다. 자동 차단은 발행 전 막고, 사람 판단은 경고만 표시합니다." /></span>}>
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

function ApiStatusBadge({ status }: { status: ApiStatus }) {
  const icon = status.state === 'ok' ? '✅' : status.state === 'error' ? '❌' : '⚪';
  const tone = status.state === 'ok'
    ? 'bg-green-50 text-green-700 border-green-200'
    : status.state === 'error'
      ? 'bg-red-50 text-red-700 border-red-200'
      : 'bg-slate-50 text-slate-500 border-slate-200';
  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {icon} {status.message}
    </span>
  );
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-600">{label}</label>
      {children}
    </div>
  );
}

function PromptField({ label, value, onChange, onReset, rows, help }: {
  label: string; value: string; onChange: (v: string) => void; onReset: () => void; rows: number; help?: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="flex items-center text-sm font-medium text-slate-600">{label}{help && <HelpTip text={help} />}</label>
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
