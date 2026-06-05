import type { Settings } from '../types';
import { chatJson, getLlmCircuitState } from './openai';

/**
 * ② 주제 적합성 판정 (LLM judge).
 * 캠페인 주제정의(intent, 자연어)에 비춰 이 소재가 적합한지 판단.
 * topic_review 단계에서 부적합 클러스터/기사를 탈락시키는 게이트.
 *
 * fail-CLOSED (PM): LLM이 판단 못 하면 통과 금지 = 보류(decided:false).
 * 적합성은 "명확 부합만 통과"라 판단 불가 시 흘려보내면 필터가 무력화됨.
 * → intent 있는데 판단 불가(429/서킷/오류/파싱실패)면 decided:false로 ②에 잡아둠.
 *   키 꽂혀 서킷 풀리면 다음 사이클 재판단.
 * intent 비었으면 게이트 비활성 → {adequate:true, decided:true}.
 */
export type TopicAdequacy = {
  adequate: boolean;   // 주제 부합 여부 (decided일 때만 의미)
  decided: boolean;    // 판단 완료 여부. false=판단 불가(보류)
  reason?: string;
};

type AdequacyResponse = { adequate?: boolean; reason?: string };

export async function judgeTopicAdequacy(
  subject: { title: string; snippets: string[] },
  intent: string,
  settings: Settings,
): Promise<TopicAdequacy> {
  // 게이트 비활성(주제정의 없음) → 통과. 게이트 자체가 꺼진 거라 decided.
  if (!intent.trim()) return { adequate: true, decided: true };
  // 키 없음 / 서킷 open(429 소진) → 판단 불가 = 보류 (fail-closed)
  if (!settings.apiKey) return { adequate: false, decided: false, reason: 'API 키 없음 — AI 판단 대기' };
  if (getLlmCircuitState().open) return { adequate: false, decided: false, reason: 'LLM 한도 소진 — AI 판단 대기(키 확인)' };

  const system = [
    '당신은 매체 편집국의 주제 선별 데스크입니다. 캠페인당 "완전 부합 소수정예"만 통과시킵니다.',
    '아래 [주제 정의]에 비춰, 주어진 기사 소재가 이 캠페인의 핵심 주제에 정확히 부합하는지 판정하세요.',
    '',
    '[주제 정의]',
    intent.trim(),
    '',
    '판정 기준 (보수적 — 빡세게):',
    '- 주제 정의의 대상·범위·성격에 명확히 부합할 때만 adequate=true.',
    '- "관련 있어 보임"·주변부·간접 언급·애매하면 adequate=false(컷). 확신 없으면 false.',
    '- 잘못 통과시키는 것이 놓치는 것보다 나쁨(소수정예 원칙). 의심되면 떨어뜨린다.',
    '- false면 reason 한 줄(왜 핵심 주제와 어긋나는지).',
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
    // 응답에 adequate 불리언이 없으면(파싱 모호) 판단 불가 = 보류 (fail-closed)
    if (typeof out.adequate !== 'boolean') {
      return { adequate: false, decided: false, reason: 'AI 응답 불명확 — 보류' };
    }
    return { adequate: out.adequate, decided: true, reason: out.adequate ? undefined : out.reason };
  } catch {
    // 호출 실패(429 등) → 보류 (통과 금지)
    return { adequate: false, decided: false, reason: 'AI 판단 실패 — 보류(키·한도 확인)' };
  }
}
