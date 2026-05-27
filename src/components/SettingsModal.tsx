import { useState } from 'react';
import { X, Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import { useSettings } from '../state/SettingsContext';
import { useHistory } from '../state/HistoryContext';
import { PROVIDERS, type ProviderId } from '../types';

type Props = { open: boolean; onClose: () => void };

export function SettingsModal({ open, onClose }: Props) {
  const {
    settings, setApiKey, setRss2jsonApiKey, setProvider, setApiBaseUrl,
    setModel,
    addCategory, updateCategory, removeCategory,
    setRssSources, toggleRssSource, setRssPollMinutes, setClusterThreshold,
    setSimulatorEnabled, setSimulatorIntervalSec,
    setAlertSoundEnabled, setBrowserNotificationsEnabled,
  } = useSettings();
  const providerCfg = PROVIDERS[settings.provider];
  const providerModels = providerCfg.models;
  const { clear } = useHistory();
  const [showKey, setShowKey] = useState(false);
  const [showRssKey, setShowRssKey] = useState(false);
  const [newRssName, setNewRssName] = useState('');
  const [newRssUrl, setNewRssUrl] = useState('');
  const [tab, setTab] = useState<'ai' | 'category'>('ai');

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
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-xl"
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
            onClick={() => setTab('category')}
            className={'px-3 py-2 text-sm font-medium border-b-2 ' + (tab === 'category' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700')}
          >🎯 카테고리</button>
        </div>

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
            <h3 className="mb-2 font-semibold">{providerCfg.keyLabel}</h3>
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

          <section>
            <h3 className="mb-2 font-semibold">RSS 소스</h3>
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
              💡 rss2json 무료 한도: <b>분당 10건</b>. 활성 소스가 많거나 폴링이 잦으면 429 발생.
              429 발생 시 해당 소스는 자동으로 30분간 호출 중단됩니다.
              응답은 5분 캐시됩니다.
            </p>
          </section>

          <section>
            <h3 className="mb-2 font-semibold">사건 묶기(클러스터링) 민감도</h3>
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
              낮을수록 더 많은 기사가 한 사건으로 묶임 (포용적). 높을수록 엄격히 분리.
              기본 0.35.
            </p>
          </section>

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

        <div className={'space-y-4 p-5 ' + (tab === 'category' ? '' : 'hidden')}>
          <p className="text-xs text-slate-500">
            카테고리(렌즈)별로 <b>선별·정리 기준</b>과 <b>말투</b>를 정해둡니다. 워크벤치 상단 드롭다운에서 선택한 카테고리가 변환에 사용됩니다.
          </p>
          {settings.categories.map(c => (
            <div key={c.id} className="rounded border border-slate-200 p-3">
              <div className="mb-2 flex items-center gap-2">
                <input
                  value={c.label}
                  onChange={e => updateCategory(c.id, { label: e.target.value })}
                  className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm font-semibold"
                  placeholder="카테고리 이름"
                />
                <button
                  onClick={() => { if (confirm(`'${c.label}' 카테고리를 삭제할까요?`)) removeCategory(c.id); }}
                  className="rounded p-1 text-red-600 hover:bg-red-50"
                  aria-label="카테고리 삭제"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">선별·정리 기준</label>
              <textarea
                value={c.criteria}
                onChange={e => updateCategory(c.id, { criteria: e.target.value })}
                className="mb-2 w-full rounded border border-slate-300 px-2 py-1 text-sm h-20"
                placeholder="이 카테고리에서 무엇을 어떻게 다룰지"
              />
              <label className="mb-1 block text-xs font-semibold text-slate-500">말투</label>
              <textarea
                value={c.tone}
                onChange={e => updateCategory(c.id, { tone: e.target.value })}
                className="w-full rounded border border-slate-300 px-2 py-1 text-sm h-16"
                placeholder="문체·어조"
              />
            </div>
          ))}
          <button
            onClick={addCategory}
            className="flex items-center gap-1 rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            <Plus size={14} /> 카테고리 추가
          </button>
        </div>
      </div>
    </div>
  );
}
