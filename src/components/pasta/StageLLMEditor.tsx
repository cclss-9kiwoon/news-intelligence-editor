import { useSettings } from '../../state/SettingsContext';
import { PROVIDERS } from '../../types';
import type { StageLLMConfig, ProviderId, GroupProfile } from '../../types';
import { describeStageLLM, llmLevelLabel } from '../../lib/stageLLM';
import { HelpTip } from './HelpTip';

/**
 * 캠페인 단계(②③④) LLM 오버라이드 에디터.
 * 비우면 그룹→전역 상속. 활성 배지(describeStageLLM)로 실제 어느 키/모델이 쓰이는지 표시.
 * provider = Gemini/OpenAI 2종(PM 정정).
 */
export function StageLLMEditor({ stageLabel, llm, group, onChange }: {
  stageLabel: string;
  llm: StageLLMConfig | undefined;
  group?: GroupProfile;
  onChange: (patch: Partial<StageLLMConfig>) => void;
}) {
  const { settings } = useSettings();
  const info = describeStageLLM(settings, group, llm);
  const provider = llm?.provider;

  return (
    <div className="rounded-xl border border-slate-200 bg-white/60 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-slate-600">
          {stageLabel} AI 모델 <HelpTip text="이 단계만 다른 모델/키를 쓰려면 지정합니다. 비우면 그룹 AI 설정 → 전역 설정을 상속합니다. (예: 검수는 싼 모델, 작성은 고급)" />
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${info.active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
          {info.active ? `✓ ${info.resolved.model} (${llmLevelLabel(info.keySource)}키)` : '키 없음'}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select className="rounded-lg border border-slate-200 bg-white/80 px-2 py-1.5 text-sm" value={provider ?? ''}
          onChange={e => onChange({ provider: (e.target.value || undefined) as ProviderId | undefined, baseUrl: e.target.value ? PROVIDERS[e.target.value as ProviderId]?.baseUrl : undefined })}>
          <option value="">상속(그룹/전역)</option>
          {Object.values(PROVIDERS).filter(p => p.id === 'openai' || p.id === 'gemini').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className="rounded-lg border border-slate-200 bg-white/80 px-2 py-1.5 text-sm" value={llm?.model ?? ''} disabled={!provider}
          onChange={e => onChange({ model: e.target.value || undefined })}>
          <option value="">{provider ? '(제공자 기본)' : '제공자 먼저'}</option>
          {(provider ? PROVIDERS[provider]?.models ?? [] : []).map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
        {provider && (
          <input type="password" className="col-span-2 rounded-lg border border-slate-200 bg-white/80 px-2 py-1.5 text-sm"
            value={llm?.apiKey ?? ''} placeholder="이 단계 전용 키(비우면 그룹/전역 상속)"
            onChange={e => onChange({ apiKey: e.target.value || undefined })} />
        )}
      </div>
    </div>
  );
}
