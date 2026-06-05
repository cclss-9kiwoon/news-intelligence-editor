import type { Settings } from '../types';
import { chatJson } from './openai';

/**
 * ② 주제 적합성 판정 (LLM judge).
 * 캠페인 주제정의(intent, 자연어)에 비춰 이 소재가 적합한지 판단.
 * topic_review 단계에서 부적합 클러스터/기사를 탈락시키는 게이트.
 *
 * fail-open: intent 비었거나 키 없거나 호출 실패 시 adequate=true(막지 않음).
 * chatJson 통과 → 글로벌 동시성 상한 적용.
 */
export type TopicAdequacy = { adequate: boolean; reason?: string };

type AdequacyResponse = { adequate?: boolean; reason?: string };

export async function judgeTopicAdequacy(
  subject: { title: string; snippets: string[] },
  intent: string,
  settings: Settings,
): Promise<TopicAdequacy> {
  // 게이트 비활성 / 키 없음 → 통과 (fail-open)
  if (!intent.trim()) return { adequate: true };
  if (!settings.apiKey) return { adequate: true };

  const system = [
    '당신은 매체 편집국의 주제 선별 데스크입니다.',
    '아래 [주제 정의]에 비춰, 주어진 기사 소재가 이 매체에서 다룰 만한지 판정하세요.',
    '',
    '[주제 정의]',
    intent.trim(),
    '',
    '판정 기준: 주제 정의의 범위·대상·성격에 부합하면 adequate=true. 벗어나면 false + reason(한 줄, 왜 부적합한지).',
    '경계가 모호하면 포용적으로 adequate=true(놓치는 것보다 사람이 거르는 게 낫다).',
    '',
    '오직 valid JSON: { "adequate": boolean, "reason"?: string }',
  ].join('\n');

  const user = [
    `제목: ${subject.title}`,
    '',
    '소재 발췌:',
    ...subject.snippets.slice(0, 5).map(s => `- ${s.slice(0, 300)}`),
  ].join('\n');

  try {
    const out = await chatJson<AdequacyResponse>({
      apiKey: settings.apiKey,
      baseUrl: settings.apiBaseUrl,
      model: settings.model,
      system,
      user,
      temperature: 0.1,
    });
    // 명시적 false만 부적합 — 누락/파싱불가는 통과(fail-open)
    return { adequate: out.adequate !== false, reason: out.adequate === false ? out.reason : undefined };
  } catch {
    return { adequate: true };
  }
}
