import type { Settings, GroupProfile, StageLLMConfig, ProviderId } from '../types';

/**
 * 단계별 LLM 설정 해석 — 우선순위 stage → group → global(settings).
 * enabled===false인 레벨은 무시하고 상위로 폴백.
 * chatJson 인자({apiKey, model, baseUrl})로 바로 쓸 수 있는 resolved 반환.
 *
 * 흡수: 기존 cheapStageSettings(②④ 저렴)/writingStageSettings(③ 사용자모델)을
 * stageConfig.model로 표현 → 호출부는 resolveStageLLM 하나로 통일.
 */
export type ResolvedLLM = {
  provider: ProviderId;
  apiKey: string;
  model: string;
  baseUrl: string;
};

/** enabled===false면 해당 레벨 통째 무시 */
function active(cfg?: StageLLMConfig): StageLLMConfig | undefined {
  return cfg && cfg.enabled !== false ? cfg : undefined;
}

/**
 * tier 'fast' = ②판단·④검수 — model 폴백에 settings.fastModel 삽입(stage→group→fastModel→model).
 * tier 'main'(기본) = ③작성 등 — 기존대로 stage→group→model. fastModel 비면 둘 다 settings.model.
 */
export type StageTier = 'fast' | 'main';

export function resolveStageLLM(
  settings: Settings,
  group?: GroupProfile,
  stageConfig?: StageLLMConfig,
  tier: StageTier = 'main',
): ResolvedLLM {
  const stage = active(stageConfig);
  const grp = active(group?.llm);
  const fastFallback = tier === 'fast' && settings.fastModel ? settings.fastModel : undefined;
  return {
    provider: stage?.provider ?? grp?.provider ?? settings.provider,
    apiKey: stage?.apiKey ?? grp?.apiKey ?? settings.apiKey,
    model: stage?.model ?? grp?.model ?? fastFallback ?? settings.model,
    baseUrl: stage?.baseUrl ?? grp?.baseUrl ?? settings.apiBaseUrl,
  };
}

// ─── 활성 상태 설명 (배지 UI용) ─────────────────────────────────────
export type LLMLevel = 'stage' | 'group' | 'global';
export type StageLLMStatus = {
  resolved: ResolvedLLM;
  keySource: LLMLevel;     // 실제 적용된 apiKey가 온 레벨
  modelSource: LLMLevel;   // 실제 적용된 model이 온 레벨
  active: boolean;         // 키 존재 → LLM 호출 가능
};

const LEVEL_LABEL: Record<LLMLevel, string> = { stage: '단계', group: '그룹', global: '전역' };
export function llmLevelLabel(level: LLMLevel): string { return LEVEL_LABEL[level]; }

/** 단계 LLM이 어느 레벨에서 키·모델을 가져와 활성인지 — 배지 표시용 */
export function describeStageLLM(
  settings: Settings,
  group?: GroupProfile,
  stageConfig?: StageLLMConfig,
): StageLLMStatus {
  const stage = active(stageConfig);
  const grp = active(group?.llm);
  const resolved = resolveStageLLM(settings, group, stageConfig);
  const keySource: LLMLevel = stage?.apiKey ? 'stage' : grp?.apiKey ? 'group' : 'global';
  const modelSource: LLMLevel = stage?.model ? 'stage' : grp?.model ? 'group' : 'global';
  return { resolved, keySource, modelSource, active: resolved.apiKey.trim() !== '' };
}
