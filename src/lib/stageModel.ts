import type { Settings, ProviderId } from '../types';

/**
 * 단계별 모델 정책.
 * - 주제 판단(②)·검수(④) = 자동 저렴 모델 고정 (분류·점검은 싼 모델로 충분, quota 절약).
 * - 작성(③) = 사용자 선택 모델 (높을수록 품질↑). 비우면 글로벌 기본.
 *
 * 모두 같은 키/baseUrl 유지하고 model 필드만 교체 → quota 분산 + 비용 절감.
 * custom provider는 모델 목록을 알 수 없어 글로벌 그대로 사용.
 */
const CHEAP_MODEL: Record<ProviderId, string | null> = {
  gemini: 'gemini-2.0-flash',
  openai: 'gpt-4o-mini',
  custom: null, // 알 수 없음 → 글로벌 유지
};

/** ②④ 저렴 모델용 settings (model만 교체) */
export function cheapStageSettings(settings: Settings): Settings {
  const cheap = CHEAP_MODEL[settings.provider];
  if (!cheap || cheap === settings.model) return settings;
  return { ...settings, model: cheap };
}

/** ③ 작성용 settings (사용자 지정 writingModel, 비면 글로벌) */
export function writingStageSettings(settings: Settings, writingModel?: string): Settings {
  if (!writingModel || writingModel === settings.model) return settings;
  return { ...settings, model: writingModel };
}
