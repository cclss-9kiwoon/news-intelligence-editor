import { useState } from 'react';
import { X, Eye, EyeOff, Plus, Trash2, ChevronDown, ChevronRight, RotateCcw, Loader2 } from 'lucide-react';
import { useSettings } from '../state/SettingsContext';
import { useHistory } from '../state/HistoryContext';
import { PROVIDERS, type ProviderId, type ArticleWindow, type PromptConfig } from '../types';
import { extractArticleText } from '../lib/scraper';
import { ProjectProfileTab } from './ProjectProfileTab';

type Props = { open: boolean; onClose: () => void };

export function SettingsModal({ open, onClose }: Props) {
  const {
    settings, setApiKey, setRss2jsonApiKey, setProvider, setApiBaseUrl,
    setModel,
    addCategory, updateCategory, removeCategory, setArticleWindow,
    setRssSources, toggleRssSource, setRssPollMinutes, setClusterThreshold,
    setSimulatorEnabled, setSimulatorIntervalSec,
    setAlertSoundEnabled, setBrowserNotificationsEnabled,
    updatePromptConfig, resetPromptConfigField,
    addReferenceArticle, removeReferenceArticle,
    setNaverClientId, setNaverClientSecret, setNaverQueries, setDaumRestApiKey, setDaumQueries,
  } = useSettings();
  const providerCfg = PROVIDERS[settings.provider];
  const providerModels = providerCfg.models;
  const { clear } = useHistory();
  const [showKey, setShowKey] = useState(false);
  const [showRssKey, setShowRssKey] = useState(false);
  const [showNaverKey, setShowNaverKey] = useState(false);
  const [showDaumKey, setShowDaumKey] = useState(false);
  const [newRssName, setNewRssName] = useState('');
  const [newRssUrl, setNewRssUrl] = useState('');
  const [tab, setTab] = useState<'ai' | 'rss' | 'alerts' | 'category' | 'prompt' | 'project'>('ai');
  const [categoryOpen, setCategoryOpen] = useState<Record<string, boolean>>({});
  const [refUrl, setRefUrl] = useState('');
  const [refFetching, setRefFetching] = useState(false);
  const [refError, setRefError] = useState('');

  if (!open) return null;

  const addRss = () => {
    if (!newRssName.trim() || !newRssUrl.trim()) return;
    setRssSources([
      ...settings.rssSources,
      { id: `custom-${Date.now()}`, name: newRssName.trim(), url: newRssUrl.trim(), enabled: true },
    ]);
    setNewRssName(''); setNewRssUrl('');
  };

  const removeRss = (id: string) => {
    setRssSources(settings.rssSources.filter(r => r.id !== id));
  };

  const requestNotifications = async () => {
    if (!('Notification' in window)) { alert('브라우저가 알림을 지원하지 않습니다.'); return; }
    const result = await Notification.requestPermission();
    setBrowserNotificationsEnabled(result === 'granted');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex h-[640px] max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="text-lg font-semibold">⚙ 설정</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-slate-100" aria-label="닫기">
            <X size={18} />
          </button>
        </div>

        <div className="flex border-b border-slate-200 px-5">
          <button
            onClick={() => setTab('ai')}
            className={'px-3 py-2 text-sm font-medium border-b-2 ' + (tab === 'ai' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700')}
          >⚙ AI·연결</button>
          <button
            onClick={() => setTab('rss')}
            className={'px-3 py-2 text-sm font-medium border-b-2 ' + (tab === 'rss' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700')}
          >📡 RSS·클러스터</button>
          <button
            onClick={() => setTab('alerts')}
            className={'px-3 py-2 text-sm font-medium border-b-2 ' + (tab === 'alerts' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700')}
          >🔔 알림</button>
          <button
            onClick={() => setTab('project')}
            className={'px-3 py-2 text-sm font-medium border-b-2 ' + (tab === 'project' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700')}
          >📋 프로젝트</button>
          <button
            onClick={() => setTab('prompt')}
            className={'px-3 py-2 text-sm font-medium border-b-2 ' + (tab === 'prompt' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700')}
          >✏️ 프롬프트</button>
          <button
            onClick={() => setTab('category')}
            className={'px-3 py-2 text-sm font-medium border-b-2 ' + (tab === 'category' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700')}
          >🎯 카테고리</button>
        </div>

        <div className="flex-1 overflow-y-auto">
        <div className={'space-y-6 p-5 ' + (tab === 'ai' ? '' : 'hidden')}>
          <section>
            <h3 className="mb-2 font-semibold">AI Provider</h3>
            <div className="flex flex-wrap gap-3 text-sm">
              {(Object.keys(PROVIDERS) as ProviderId[]).map(p => (
                <label key={p} className="flex items-center gap-1">
                  <input
                    type="radio"
                    checked={settings.provider === p}
                    onChange={() => setProvider(p)}
                  />
                  {PROVIDERS[p].name}
                </label>
              ))}
            </div>
            {settings.provider === 'custom' && (
              <input
                type="text"
                value={settings.apiBaseUrl}
                onChange={e => setApiBaseUrl(e.target.value)}
                placeholder="Base URL (예: https://api.groq.com/openai/v1)"
                className="mt-2 w-full rounded border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            )}
          </section>

          <section>
            <h3 className="mb-2 flex items-center gap-2 font-semibold">
              {providerCfg.keyLabel}
              {settings.apiKey.trim()
                ? <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">✓ 연결됨 · {providerCfg.name}</span>
                : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">키 미설정</span>}
            </h3>
            <div className="flex gap-2">
              <input
                type={showKey ? 'text' : 'password'}
                value={settings.apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={settings.provider === 'openai' ? 'sk-...' : 'API 키 붙여넣기'}
                className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm font-mono"
              />
              <button
                onClick={() => setShowKey(v => !v)}
                className="rounded border border-slate-300 px-2 hover:bg-slate-50"
                aria-label="토글"
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500">{providerCfg.keyHelp}</p>
            <p className="mt-0.5 text-xs text-slate-500">키는 이 브라우저의 localStorage에만 저장됩니다.</p>
          </section>

          <section>
            <h3 className="mb-2 font-semibold">모델</h3>
            <div className="space-y-1 text-sm">
              {providerModels.map(m => (
                <label key={m.id} className="flex items-start gap-2">
                  <input
                    type="radio"
                    checked={settings.model === m.id}
                    onChange={() => setModel(m.id)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="font-mono">{m.label}</span>
                    {m.note && <span className="ml-2 text-xs text-slate-500">{m.note}</span>}
                  </span>
                </label>
              ))}
              <label className="mt-2 flex items-center gap-2">
                <span className="text-xs text-slate-500">커스텀:</span>
                <input
                  type="text"
                  placeholder="모델 ID 직접 입력"
                  value={providerModels.some(m => m.id === settings.model) ? '' : settings.model}
                  onChange={e => setModel(e.target.value)}
                  className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs font-mono"
                />
              </label>
            </div>
          </section>
        </div>

        <div className={'space-y-6 p-5 ' + (tab === 'rss' ? '' : 'hidden')}>
          <section>
            <h3 className="mb-2 font-semibold">rss2json API 키 (선택)</h3>
            <div className="flex gap-2">
              <input
                type={showRssKey ? 'text' : 'password'}
                value={settings.rss2jsonApiKey}
                onChange={e => setRss2jsonApiKey(e.target.value)}
                placeholder="rss2json.com 회원가입 후 발급 (없어도 무료 한도로 동작)"
                className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm font-mono"
              />
              <button
                onClick={() => setShowRssKey(v => !v)}
                className="rounded border border-slate-300 px-2 hover:bg-slate-50"
                aria-label="토글"
              >
                {showRssKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              미입력 시 익명 한도 (분당 10건 / 일 10,000건). 키 등록 시 한도 상향.
              <br />rss2json 사이트에서 키 생성 시 <b>API restrictions: HTTP Referrers</b> 선택 +
              <span className="ml-1 font-mono">http://localhost:5173/*</span> 등록.
            </p>
          </section>

          <section>
            <h3 className="mb-2 font-semibold">매체 (RSS)</h3>
            <ul className="space-y-1 text-sm">
              {settings.rssSources.map(r => (
                <li key={r.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={r.enabled}
                    onChange={() => toggleRssSource(r.id)}
                  />
                  <span className="flex-1 truncate">{r.name}</span>
                  <span className="truncate text-xs text-slate-400 w-48">{r.url}</span>
                  <button
                    onClick={() => removeRss(r.id)}
                    className="rounded p-1 hover:bg-red-50 text-red-600"
                    aria-label="삭제"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex gap-2">
              <input
                value={newRssName}
                onChange={e => setNewRssName(e.target.value)}
                placeholder="이름"
                className="w-32 rounded border border-slate-300 px-2 py-1 text-sm"
              />
              <input
                value={newRssUrl}
                onChange={e => setNewRssUrl(e.target.value)}
                placeholder="RSS URL"
                className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
              />
              <button
                onClick={addRss}
                className="flex items-center gap-1 rounded bg-slate-900 px-3 py-1 text-sm text-white"
              >
                <Plus size={14} /> 추가
              </button>
            </div>
            <div className="mt-3 flex items-center gap-2 text-sm">
              <span>폴링 간격:</span>
              <select
                value={settings.rssPollMinutes}
                onChange={e => setRssPollMinutes(Number(e.target.value))}
                className="rounded border border-slate-300 px-2 py-0.5 text-sm"
              >
                <option value={5}>5분 (권장)</option>
                <option value={10}>10분</option>
                <option value={15}>15분</option>
                <option value={30}>30분</option>
                <option value={60}>60분</option>
              </select>
            </div>
            <p className="mt-2 text-xs text-amber-700">
              💡 rss2json 무료 한도: <b>분당 10건</b>. 활성 매체가 많거나 폴링이 잦으면 일시적으로 요청이 거부될 수 있습니다.
              이 경우 해당 매체는 자동으로 30분간 호출을 멈췄다가 재시도합니다. 응답은 5분 캐시됩니다.
            </p>
          </section>

          <section>
            <h3 className="mb-2 font-semibold">이슈 묶기(클러스터링) 민감도</h3>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 w-16">느슨 0.20</span>
              <input
                type="range"
                min="0.20"
                max="0.60"
                step="0.05"
                value={settings.clusterThreshold}
                onChange={e => setClusterThreshold(Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-xs text-slate-500 w-16 text-right">0.60 엄격</span>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-sm font-mono w-14 text-center">
                {settings.clusterThreshold.toFixed(2)}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              낮을수록 더 많은 기사가 한 이슈로 묶임 (포용적). 높을수록 엄격히 분리.
              기본 0.35.
            </p>
          </section>

          <section>
            <h3 className="mb-2 font-semibold">이슈 묶는 기사 범위</h3>
            <select
              value={settings.articleWindow}
              onChange={e => setArticleWindow(e.target.value as ArticleWindow)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="1h">최근 1시간</option>
              <option value="24h">최근 24시간 (오늘)</option>
              <option value="7d">최근 7일</option>
              <option value="30d">최근 30일</option>
              <option value="breaking">속보만</option>
            </select>
            <p className="mt-1 text-xs text-slate-500">
              가져온 시각 기준으로 이 범위 안의 기사만 이슈로 묶습니다. '속보만'은 속보로 분류된 기사만 모읍니다.
            </p>
          </section>
        </div>

        <div className={'space-y-6 p-5 ' + (tab === 'alerts' ? '' : 'hidden')}>
          <section>
            <h3 className="mb-2 font-semibold">알림</h3>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.simulatorEnabled}
                onChange={e => setSimulatorEnabled(e.target.checked)}
              />
              속보 시뮬레이터 사용 (데모용)
            </label>
            <label className="mt-1 flex items-center gap-2 text-sm">
              <span>시뮬레이터 주기:</span>
              <select
                value={settings.simulatorIntervalSec}
                onChange={e => setSimulatorIntervalSec(Number(e.target.value))}
                className="rounded border border-slate-300 px-2 py-0.5 text-sm"
              >
                <option value={30}>30초</option>
                <option value={60}>60초</option>
                <option value={90}>90초</option>
                <option value={120}>120초</option>
              </select>
            </label>
            <label className="mt-1 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.alertSoundEnabled}
                onChange={e => setAlertSoundEnabled(e.target.checked)}
              />
              알림음 재생
            </label>
            <button
              onClick={requestNotifications}
              className="mt-2 rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50"
            >
              브라우저 알림 권한 요청
              {settings.browserNotificationsEnabled && <span className="ml-1 text-green-600">✓</span>}
            </button>
          </section>
        </div>

        <div className={'space-y-6 p-5 ' + (tab === 'ai' ? '' : 'hidden')}>
          <section>
            <h3 className="mb-2 font-semibold">네이버 뉴스 API (전문 수집)</h3>
            <div className="space-y-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Client ID</label>
                <input
                  type="text"
                  value={settings.naverClientId}
                  onChange={e => setNaverClientId(e.target.value)}
                  placeholder="네이버 개발자센터에서 발급"
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Client Secret</label>
                <div className="flex gap-2">
                  <input
                    type={showNaverKey ? 'text' : 'password'}
                    value={settings.naverClientSecret}
                    onChange={e => setNaverClientSecret(e.target.value)}
                    placeholder="Client Secret"
                    className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm font-mono"
                  />
                  <button
                    onClick={() => setShowNaverKey(v => !v)}
                    className="rounded border border-slate-300 px-2 hover:bg-slate-50"
                    aria-label="토글"
                  >
                    {showNaverKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              <a href="https://developers.naver.com/apps/" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">developers.naver.com</a>에서 앱 등록 → 검색 API 사용.
              일 25,000건 무료. 미입력 시 Jina 추출기로 fallback.
            </p>
            {settings.naverClientId && settings.naverClientSecret && (
              <>
                <p className="mt-1 text-xs text-green-600">✓ 네이버 전문 수집 활성 (주 출처)</p>
                <div className="mt-3">
                  <label className="mb-1 block text-xs font-semibold text-slate-500">검색어 (쉼표로 구분)</label>
                  <input
                    type="text"
                    value={settings.naverQueries.join(', ')}
                    onChange={e => setNaverQueries(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                    placeholder="연예, K-pop 아이돌, 한국 드라마 영화"
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  />
                  <p className="mt-0.5 text-xs text-slate-500">이 키워드로 네이버 뉴스를 검색합니다. 검색어가 많을수록 다양한 기사 수집.</p>
                </div>
              </>
            )}
          </section>

          <section>
            <h3 className="mb-2 font-semibold">다음/Kakao 검색 API (보조 출처)</h3>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">REST API Key</label>
              <div className="flex gap-2">
                <input
                  type={showDaumKey ? 'text' : 'password'}
                  value={settings.daumRestApiKey}
                  onChange={e => setDaumRestApiKey(e.target.value)}
                  placeholder="Kakao Developers REST API 키"
                  className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm font-mono"
                />
                <button
                  onClick={() => setShowDaumKey(v => !v)}
                  className="rounded border border-slate-300 px-2 hover:bg-slate-50"
                  aria-label="토글"
                >
                  {showDaumKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              <a href="https://developers.kakao.com/" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">developers.kakao.com</a>에서 앱 REST API 키 발급. 미입력 시 다음 검색 트랙은 건너뜁니다.
            </p>
            {settings.daumRestApiKey && (
              <div className="mt-3">
                <label className="mb-1 block text-xs font-semibold text-slate-500">검색어 (쉼표로 구분)</label>
                <input
                  type="text"
                  value={settings.daumQueries.join(', ')}
                  onChange={e => setDaumQueries(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  placeholder="연예, K-pop 아이돌, 한국 드라마 영화"
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                />
                <p className="mt-0.5 text-xs text-green-600">✓ 다음 검색 보조 수집 활성</p>
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-2 font-semibold">이력 관리</h3>
            <button
              onClick={() => { if (confirm('변환 이력을 모두 삭제하시겠습니까?')) clear(); }}
              className="rounded border border-red-300 px-3 py-1 text-sm text-red-700 hover:bg-red-50"
            >
              변환 이력 전체 삭제
            </button>
          </section>
        </div>

        <div className={tab === 'project' ? '' : 'hidden'}>
          <ProjectProfileTab />
        </div>

        <div className={'space-y-6 p-5 ' + (tab === 'prompt' ? '' : 'hidden')}>
          {([
            {
              field: 'editorRole' as keyof PromptConfig,
              label: '에디터 역할',
              desc: 'LLM이 맡는 역할. 매체 성격에 맞게 변경. 예: "글로벌 테크 미디어의 수석 기자"',
              rows: 2,
            },
            {
              field: 'publishingGuide' as keyof PromptConfig,
              label: '발행 가이드',
              desc: '기사 작성 규칙. 문체, 구조, 분량, 인용 방식 등.',
              rows: 6,
            },
            {
              field: 'taskInstructions' as keyof PromptConfig,
              label: '작업 지침',
              desc: 'LLM이 기사를 종합하는 방식. 교차검증, 팩트 처리 규칙.',
              rows: 6,
            },
            {
              field: 'bannedExpressions' as keyof PromptConfig,
              label: '금지 표현',
              desc: '쉼표로 구분. LLM이 이 표현을 쓰지 않도록 지시.',
              rows: 3,
            },
          ]).map(({ field, label, desc, rows }) => (
            <section key={field}>
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-sm">{label}</h3>
                <button
                  onClick={() => resetPromptConfigField(field)}
                  className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-100"
                  title="기본값 복원"
                >
                  <RotateCcw size={12} /> 기본값 복원
                </button>
              </div>
              <textarea
                value={settings.promptConfig[field]}
                onChange={e => updatePromptConfig(field, e.target.value)}
                rows={rows}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm font-mono leading-relaxed"
              />
              <p className="mt-0.5 text-xs text-slate-500">{desc}</p>
            </section>
          ))}

          <section>
            <h3 className="mb-2 font-semibold text-sm">참고 기사 (최대 5개)</h3>
            <p className="mb-2 text-xs text-slate-500">
              우리 매체가 실제로 발행한 기사 URL을 등록하면 LLM이 문체·구조를 참고합니다.
            </p>
            {settings.referenceArticles.map(ref => (
              <div key={ref.id} className="mb-2 flex items-start gap-2 rounded border border-slate-200 p-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{ref.title || ref.url}</div>
                  <div className="text-xs text-slate-400 truncate">{ref.url}</div>
                  <div className="text-xs text-green-600 mt-0.5">
                    ✅ 전문 수집 완료 ({ref.body.length.toLocaleString()}자)
                  </div>
                </div>
                <button
                  onClick={() => removeReferenceArticle(ref.id)}
                  className="rounded p-1 text-red-500 hover:bg-red-50"
                  aria-label="삭제"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {settings.referenceArticles.length < 5 && (
              <div className="flex gap-2">
                <input
                  value={refUrl}
                  onChange={e => { setRefUrl(e.target.value); setRefError(''); }}
                  placeholder="기사 URL 입력"
                  className="flex-1 rounded border border-slate-300 px-3 py-1.5 text-sm"
                  disabled={refFetching}
                />
                <button
                  onClick={async () => {
                    const url = refUrl.trim();
                    if (!url || !url.startsWith('http')) { setRefError('올바른 URL을 입력하세요.'); return; }
                    setRefFetching(true);
                    setRefError('');
                    try {
                      const result = await extractArticleText(url);
                      if (!result.ok || !result.text) {
                        setRefError(result.error || '전문을 추출할 수 없습니다.');
                        return;
                      }
                      addReferenceArticle({
                        id: `ref-${Date.now()}`,
                        url,
                        title: result.title || url,
                        body: result.text,
                        fetchedAt: Date.now(),
                      });
                      setRefUrl('');
                    } catch (err: any) {
                      setRefError(err.message || '추출 실패');
                    } finally {
                      setRefFetching(false);
                    }
                  }}
                  disabled={refFetching || !refUrl.trim()}
                  className="flex items-center gap-1 rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
                >
                  {refFetching ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  추가
                </button>
              </div>
            )}
            {refError && <p className="mt-1 text-xs text-red-600">{refError}</p>}
          </section>
        </div>

        <div className={'space-y-4 p-5 ' + (tab === 'category' ? '' : 'hidden')}>
          <p className="text-xs text-slate-500">
            카테고리(렌즈)별로 <b>선별·정리 기준</b>과 <b>말투</b>를 정해둡니다. 워크벤치 상단 드롭다운에서 선택한 카테고리가 변환에 사용됩니다.
          </p>
          {settings.categories.map(c => {
            const open = !!categoryOpen[c.id];
            return (
              <div key={c.id} className="rounded border border-slate-200">
                <div className="flex items-center gap-2 p-2">
                  <button
                    onClick={() => setCategoryOpen(prev => ({ ...prev, [c.id]: !prev[c.id] }))}
                    className="rounded p-1 text-slate-500 hover:bg-slate-100"
                    aria-label={open ? '접기' : '펼치기'}
                    title={open ? '접기' : '펼치기'}
                  >
                    {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  <span className="flex-1 truncate text-sm font-semibold">{c.label}</span>
                  <button
                    onClick={() => { if (confirm(`'${c.label}' 카테고리를 삭제할까요?`)) removeCategory(c.id); }}
                    className="rounded p-1 text-red-600 hover:bg-red-50"
                    aria-label="카테고리 삭제"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                {open && (
                  <div className="space-y-2 border-t border-slate-100 p-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-500">이름</label>
                      <input
                        value={c.label}
                        onChange={e => updateCategory(c.id, { label: e.target.value })}
                        className="w-full rounded border border-slate-300 px-2 py-1 text-sm font-semibold"
                        placeholder="카테고리 이름"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-500">선별·정리 기준</label>
                      <textarea
                        value={c.criteria}
                        onChange={e => updateCategory(c.id, { criteria: e.target.value })}
                        className="w-full rounded border border-slate-300 px-2 py-1 text-sm h-20"
                        placeholder="이 카테고리에서 무엇을 어떻게 다룰지"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-500">말투</label>
                      <textarea
                        value={c.tone}
                        onChange={e => updateCategory(c.id, { tone: e.target.value })}
                        className="w-full rounded border border-slate-300 px-2 py-1 text-sm h-16"
                        placeholder="문체·어조"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <button
            onClick={addCategory}
            className="flex items-center gap-1 rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            <Plus size={14} /> 카테고리 추가
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}
