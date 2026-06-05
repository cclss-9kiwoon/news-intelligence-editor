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

export function resolveStageLLM(
  settings: Settings,
  group?: GroupProfile,
  stageConfig?: StageLLMConfig,
): ResolvedLLM {
  const stage = active(stageConfig);
  const grp = active(group?.llm);
  return {
    provider: stage?.provider ?? grp?.provider ?? settings.provider,
    apiKey: stage?.apiKey ?? grp?.apiKey ?? settings.apiKey,
    model: stage?.model ?? grp?.model ?? settings.model,
    baseUrl: stage?.baseUrl ?? grp?.baseUrl ?? settings.apiBaseUrl,
  };
}
