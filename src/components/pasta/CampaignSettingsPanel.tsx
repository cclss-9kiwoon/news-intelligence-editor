import { useCampaigns } from '../../state/CampaignContext';
import type { Campaign, SourceConfig, ArticleWindow } from '../../types';
import { DEFAULT_PROMPT_CONFIG } from '../../lib/defaultSettings';

const WINDOWS: { value: ArticleWindow; label: string }[] = [
  { value: '1h', label: '1시간' },
  { value: '24h', label: '24시간' },
  { value: '7d', label: '7일' },
  { value: '30d', label: '30일' },
  { value: 'breaking', label: '속보' },
];

export function CampaignSettingsPanel({ campaign, onOpen }: { campaign: Campaign; onOpen: () => void }) {
  const { renameCampaign, updateCampaignSettings, groups } = useCampaigns();
  const s = campaign.settings;
  const group = groups.find(g => g.id === campaign.groupId);

  const setSource = (patch: Partial<SourceConfig>) =>
    updateCampaignSettings(campaign.id, { source: { ...s.source, ...patch } });

  const setPrompt = (key: keyof typeof s.promptConfig, val: string) =>
    updateCampaignSettings(campaign.id, { promptConfig: { ...s.promptConfig, [key]: val } });

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      {/* 헤더 */}
      <div className="mb-6 flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs text-gray-400">🏢 {group?.name ?? '—'}</p>
          <input
            className="mt-1 w-full max-w-lg border-b border-transparent text-2xl font-bold hover:border-gray-300 focus:border-blue-500 focus:outline-none"
            value={campaign.name}
            onChange={e => renameCampaign(campaign.id, e.target.value)}
          />
        </div>
        <button
          onClick={onOpen}
          className="rounded-lg bg-blue-600 px-5 py-2 text-white hover:bg-blue-700"
        >이 캠페인으로 작업 →</button>
      </div>

      {/* 소스 설정 */}
      <Section title="📌 소스 설정" desc="어디서 어떤 기사를 가져올지">
        <Field label="RSS 소스">
          <div className="space-y-1">
            {s.source.rssSources.map(src => (
              <label key={src.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={src.enabled}
                  onChange={e => setSource({
                    rssSources: s.source.rssSources.map(x =>
                      x.id === src.id ? { ...x, enabled: e.target.checked } : x),
                  })}
                />
                <span className={src.enabled ? 'text-gray-800' : 'text-gray-400'}>{src.name}</span>
              </label>
            ))}
          </div>
        </Field>

        <Field label="네이버 검색어 (쉼표 구분)">
          <input
            className="w-full rounded border px-3 py-2 text-sm"
            value={s.source.naverQueries.join(', ')}
            onChange={e => setSource({ naverQueries: e.target.value.split(',').map(x => x.trim()).filter(Boolean) })}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="포함 키워드 (쉼표)">
            <input
              className="w-full rounded border px-3 py-2 text-sm"
              placeholder="컴백, 앨범, 차트"
              value={s.source.topicKeywords.join(', ')}
              onChange={e => setSource({ topicKeywords: e.target.value.split(',').map(x => x.trim()).filter(Boolean) })}
            />
          </Field>
          <Field label="제외 키워드 (쉼표)">
            <input
              className="w-full rounded border px-3 py-2 text-sm"
              placeholder="정치, 경제"
              value={s.source.excludeKeywords.join(', ')}
              onChange={e => setSource({ excludeKeywords: e.target.value.split(',').map(x => x.trim()).filter(Boolean) })}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="시간 윈도우">
            <select
              className="w-full rounded border px-3 py-2 text-sm"
              value={s.source.articleWindow}
              onChange={e => setSource({ articleWindow: e.target.value as ArticleWindow })}
            >
              {WINDOWS.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
            </select>
          </Field>
          <Field label="태스크 생성 최소 매체 수">
            <input
              type="number" min={1} max={10}
              className="w-full rounded border px-3 py-2 text-sm"
              value={s.source.minMediaCount}
              onChange={e => setSource({ minMediaCount: Math.max(1, Number(e.target.value) || 1) })}
            />
          </Field>
        </div>
      </Section>

      {/* 아티클 포맷 */}
      <Section title="📌 아티클 포맷" desc="LLM 프롬프트 구성. CMS·매체별로 다름">
        <PromptField
          label="에디터 역할" value={s.promptConfig.editorRole}
          onChange={v => setPrompt('editorRole', v)}
          onReset={() => setPrompt('editorRole', DEFAULT_PROMPT_CONFIG.editorRole)}
          rows={1}
        />
        <PromptField
          label="발행 가이드" value={s.promptConfig.publishingGuide}
          onChange={v => setPrompt('publishingGuide', v)}
          onReset={() => setPrompt('publishingGuide', DEFAULT_PROMPT_CONFIG.publishingGuide)}
          rows={6}
        />
        <PromptField
          label="작업 지침" value={s.promptConfig.taskInstructions}
          onChange={v => setPrompt('taskInstructions', v)}
          onReset={() => setPrompt('taskInstructions', DEFAULT_PROMPT_CONFIG.taskInstructions)}
          rows={6}
        />
        <PromptField
          label="금지 표현 (쉼표)" value={s.promptConfig.bannedExpressions}
          onChange={v => setPrompt('bannedExpressions', v)}
          onReset={() => setPrompt('bannedExpressions', DEFAULT_PROMPT_CONFIG.bannedExpressions)}
          rows={2}
        />
      </Section>
    </div>
  );
}

function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="font-semibold text-gray-800">{title}</h3>
      <p className="mb-4 text-xs text-gray-400">{desc}</p>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-600">{label}</label>
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
        <label className="text-sm font-medium text-gray-600">{label}</label>
        <button onClick={onReset} className="text-xs text-blue-600 hover:underline">기본값 복원</button>
      </div>
      <textarea
        className="w-full rounded border px-3 py-2 text-sm font-mono"
        rows={rows}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}
