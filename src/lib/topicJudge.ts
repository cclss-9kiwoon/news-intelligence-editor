import type { Settings } from '../types';
import { getLlmCircuitState } from './openai';
import { llmCall, llmBackendFrom } from './llmBackend';

/**
 * ② 주제 판정 통합 — 주제 적합성(intent) + 제외 주제(excludeTopics)를
 * 단일 LLM 콜로 판정한다. 둘 다 같은 입력(title+snippets)을 쓰므로 한 프롬프트에서 동시 판정.
 * ② 검수 단계 LLM 콜 2→1 = 속도 2배 + 토큰 절반 (flash tier 유지).
 *
 * fail-CLOSED (PM): 미결정(키없음/429/서킷/파싱실패/예외) → decided:false 보류 = ②에 잡아둠.
 *   키 꽂혀 서킷 풀리면 다음 사이클 재판단.
 * 게이트 동작 보존:
 *   - intent 비면 적합 자동 통과(adequate:true) — 적합 판정 스킵.
 *   - excludeTopics 비면 제외 판정 스킵(excluded:false).
 *   - 둘 다 비면 게이트 전체 OFF → LLM 콜 없이 {decided:true, adequate:true, excluded:false}.
 *
 * 상위 게이트(SearchingPipeline ②) 적용 규칙:
 *   !decided                       → 보류(재판단)
 *   decided && (!adequate||excluded)→ 폐기(off_topic)
 *   decided && adequate && !excluded→ 통과(intentChecked+topicChecked 동시 set)
 */
export type TopicJudgment = {
  decided: boolean;          // 판단 완료 여부. false=판단 불가(보류, fail-closed)
  adequate: boolean;         // 주제 적합 (intent 비면 true). decided일 때만 유효.
  excluded: boolean;         // 제외 주제 해당 (excludeTopics 비면 false). decided일 때만 유효.
  excludedMatch?: string;    // 해당된 제외 주제 라벨
  reason?: string;
};

type JudgmentResponse = { adequate?: boolean; excluded?: boolean; matched?: string; reason?: string };

export async function judgeTopic(
  subject: { title: string; snippets: string[] },
  intent: string,
  excludeTopics: string[],
  settings: Settings,
): Promise<TopicJudgment> {
  const wantIntent = intent.trim();
  const topics = excludeTopics.filter(t => t.trim());

  // 게이트 전체 비활성(주제정의·제외주제 모두 없음) → LLM 콜 없이 통과. decided.
  if (!wantIntent && topics.length === 0) return { decided: true, adequate: true, excluded: false };
  // API 직결 모드 사전 가드(fail-closed): 키 없음 / 서킷 open(429 소진) → 보류.
  // agent(위임) 모드는 gemini 키·API 서킷과 무관하므로 이 가드를 건너뛴다(크레딧 0 가동).
  const isAgent = settings.llmBackend === 'agent';
  if (!isAgent) {
    if (!settings.apiKey) return { decided: false, adequate: false, excluded: false, reason: 'API 키 없음 — AI 판단 대기' };
    if (getLlmCircuitState().open) return { decided: false, adequate: false, excluded: false, reason: 'LLM 한도 소진 — AI 판단 대기(키 확인)' };
  }

  const tasks: string[] = [];
  const jsonKeys: string[] = [];
  if (wantIntent) {
    tasks.push(
      '[A. 주제 적합성]',
      '아래 [주제 정의]에 비춰 이 소재가 캠페인 핵심 주제에 정확히 부합하는지 판정.',
      '- 명확히 부합할 때만 adequate=true. 주변부·간접·애매하면 adequate=false. 확신 없으면 false.',
      '- 잘못 통과가 놓치는 것보다 나쁨(소수정예). false면 reason 한 줄.',
      '',
      '[주제 정의]',
      wantIntent,
      '',
    );
    jsonKeys.push('"adequate": boolean', '"reason"?: string');
  }
  if (topics.length > 0) {
    tasks.push(
      '[B. 제외 주제]',
      '이 기사가 아래 [제외 주제] 중 하나와 본질적으로 같은 주제인지 판정(단어 일치가 아니라 의미 단위).',
      '예: 제외 "열애설"이면 "두 사람 사귄다 보도"·"연인 인정"도 같은 주제 → excluded=true.',
      '- 확실히 해당할 때만 excluded=true, matched=해당 제외 주제. 애매하면 false.',
      '',
      '[제외 주제]',
      ...topics.map((t, i) => `${i + 1}. ${t}`),
      '',
    );
    jsonKeys.push('"excluded": boolean', '"matched"?: string');
  }

  const system = [
    '당신은 매체 편집국의 주제 선별 데스크입니다. 아래 작업을 모두 수행해 한 번에 판정하세요.',
    '',
    ...tasks,
    `오직 valid JSON: { ${jsonKeys.join(', ')} }`,
  ].join('\n');

  const user = [
    `제목: ${subject.title}`,
    '',
    '소재 발췌:',
    ...subject.snippets.filter(Boolean).slice(0, 5).map(s => `- ${s.slice(0, 300)}`),
  ].join('\n');

  try {
    const out = await llmCall<JudgmentResponse>({
      apiKey: settings.apiKey,
      baseUrl: settings.apiBaseUrl,
      model: settings.model,
      system,
      user,
      temperature: 0.1,
      backend: llmBackendFrom(settings),
      stage: 'judgeTopic',
    });

    // 적합성: intent 활성인데 불리언 없으면 판단 모호 → 보류(fail-closed).
    let adequate = true;
    if (wantIntent) {
      if (typeof out.adequate !== 'boolean') {
        return { decided: false, adequate: false, excluded: false, reason: 'AI 응답 불명확 — 보류' };
      }
      adequate = out.adequate;
    }
    // 제외: excludeTopics 비면 스킵. 모호하면 컷 아님(false) — 적합성 게이트가 별도로 잡음.
    const excluded = topics.length > 0 && out.excluded === true;
    const excludedMatch = excluded ? (out.matched ?? '') : undefined;
    const reason = !adequate ? out.reason : excluded ? `제외 주제: ${excludedMatch}` : undefined;

    return { decided: true, adequate, excluded, ...(excludedMatch ? { excludedMatch } : {}), ...(reason ? { reason } : {}) };
  } catch {
    // 호출 실패(429 등) → 보류 (통과 금지, fail-closed)
    return { decided: false, adequate: false, excluded: false, reason: 'AI 판단 실패 — 보류(키·한도 확인)' };
  }
}
