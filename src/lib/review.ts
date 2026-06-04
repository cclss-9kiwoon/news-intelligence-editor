import type { Settings, StoryOutput, ReviewFinding, ReviewResult, ProjectProfile } from '../types';
import { chatJson } from './openai';

/**
 * 검수 엔진 (CM 역할).
 *
 * 2단계:
 *   1. 규칙기반(regex/string) — formatRules로 즉시 검사 (금지태그·길이·금지매체·클로징)
 *   2. LLM 검수 — projectProfile.reviewRules(활성) + sourceFacts 팩트 대조
 *
 * 둘 다 buildProjectRulesText와 같은 ProjectProfile을 읽음(SSOT).
 * passed = block 심각도 0건.
 */

type DraftFields = Pick<StoryOutput, 'summary' | 'headline' | 'body' | 'tags'> & {
  sourceFacts?: string[];
};

// ─── 1. 규칙기반 검사 ────────────────────────────────────────────────

export function runRuleChecks(draft: DraftFields, profile: ProjectProfile): ReviewFinding[] {
  const findings: ReviewFinding[] = [];
  const f = profile.formatRules;
  const body = draft.body || '';

  // 이미지: img-direct면 <figure> 금지
  if (f.imageMarkup === 'img-direct' && /<figure[\s>]/i.test(body)) {
    findings.push({
      ruleId: 'fmt-figure-banned', label: '이미지 태그', severity: 'block', source: 'rule', field: 'body',
      message: '<figure> 태그 사용됨. 이미지는 <img>로 직접 배치해야 합니다.',
    });
  }

  // 아티스트 마크업: strong이면 본문 <a href> 금지
  if (f.artistMarkup === 'strong' && /<a\s[^>]*\bhref\s*=/i.test(body)) {
    findings.push({
      ruleId: 'fmt-link-banned', label: '아티스트 마크업', severity: 'warn', source: 'rule', field: 'body',
      message: '본문에 <a href> 링크가 있습니다. 아티스트명은 <strong>으로 감싸야 합니다.',
    });
  }

  // 본문 길이
  const len = body.replace(/<[^>]+>/g, '').length; // 태그 제외 순수 텍스트 길이
  if (f.bodyMaxChars > 0 && len > f.bodyMaxChars) {
    findings.push({
      ruleId: 'fmt-len-max', label: '본문 길이', severity: 'warn', source: 'rule', field: 'body',
      message: `본문 ${len}자 — 최대 ${f.bodyMaxChars}자 초과.`,
    });
  }
  if (f.bodyMinChars > 0 && len < f.bodyMinChars) {
    findings.push({
      ruleId: 'fmt-len-min', label: '본문 길이', severity: 'warn', source: 'rule', field: 'body',
      message: `본문 ${len}자 — 최소 ${f.bodyMinChars}자 미달.`,
    });
  }

  // 금지 매체 언급
  for (const media of profile.bannedMedia) {
    if (!media.trim()) continue;
    if (body.includes(media) || (draft.sourceFacts || []).some(s => s.includes(media))) {
      findings.push({
        ruleId: `fmt-banned-media-${media}`, label: '금지 매체', severity: 'block', source: 'rule', field: 'body',
        message: `금지 매체 "${media}" 가 본문/소스에 인용됨.`,
      });
    }
  }

  return findings;
}

// ─── 2. LLM 검수 ────────────────────────────────────────────────────

type LlmFinding = { ruleId: string; pass: boolean; message: string; field?: string };
type LlmResponse = { findings: LlmFinding[] };

function buildReviewSystem(profile: ProjectProfile): string {
  const enabled = profile.reviewRules.filter(r => r.enabled);
  const lines: string[] = [
    '당신은 기사 발행 전 검수 에디터입니다.',
    '주어진 드래프트(headline/body/tags)를 아래 검수 항목 각각에 대해 검사하세요.',
    '원문 핵심 사실(sourceFacts)이 함께 주어지면 팩트 대조에 사용하세요.',
    '',
    '[검수 항목]',
  ];
  enabled.forEach(r => {
    lines.push(`- id="${r.id}" (${r.label}): ${r.instruction}`);
  });
  lines.push('');
  lines.push('각 항목마다 통과 여부를 판정. 문제 있으면 pass=false + 구체적 message(무엇이 어디서 어긋났는지).');
  lines.push('문제 없으면 pass=true.');
  lines.push('field는 headline/body/tags 중 해당되는 곳(없으면 생략).');
  lines.push('');
  lines.push('오직 valid JSON: { "findings": [ { "ruleId": string, "pass": boolean, "message": string, "field"?: string } ] }');
  return lines.join('\n');
}

function buildReviewUser(draft: DraftFields): string {
  return [
    `[headline]\n${draft.headline}`,
    `[body]\n${draft.body}`,
    `[tags]\n${draft.tags.join(', ')}`,
    `[sourceFacts]\n${(draft.sourceFacts || []).map(s => `- ${s}`).join('\n') || '(없음)'}`,
  ].join('\n\n');
}

export async function runLlmChecks(draft: DraftFields, settings: Settings): Promise<ReviewFinding[]> {
  const enabled = settings.projectProfile.reviewRules.filter(r => r.enabled);
  if (enabled.length === 0) return [];

  const out = await chatJson<LlmResponse>({
    apiKey: settings.apiKey,
    baseUrl: settings.apiBaseUrl,
    model: settings.model,
    system: buildReviewSystem(settings.projectProfile),
    user: buildReviewUser(draft),
    temperature: 0.2,
  });

  const ALLOWED_FIELDS: ReviewFinding['field'][] = ['headline', 'body', 'tags', 'imagePrompt'];
  const findings: ReviewFinding[] = [];
  for (const lf of out.findings || []) {
    if (lf.pass) continue;
    const rule = enabled.find(r => r.id === lf.ruleId);
    // LLM이 활성화 안 된/존재하지 않는 ruleId를 반환하면 skip (날조 finding 방지)
    if (!rule) continue;
    // field 검증: 허용 목록에 없으면 'body'로 폴백
    const field = ALLOWED_FIELDS.includes(lf.field as ReviewFinding['field'])
      ? (lf.field as ReviewFinding['field'])
      : 'body';
    findings.push({
      ruleId: lf.ruleId,
      label: rule.label,
      severity: rule.severity,
      message: lf.message,
      field,
      source: 'llm',
    });
  }
  return findings;
}

// ─── 통합 검수 ──────────────────────────────────────────────────────

export async function reviewDraft(draft: DraftFields, settings: Settings): Promise<ReviewResult> {
  const ruleFindings = runRuleChecks(draft, settings.projectProfile);

  let llmFindings: ReviewFinding[] = [];
  try {
    llmFindings = await runLlmChecks(draft, settings);
  } catch (err) {
    // LLM 검수 실패해도 규칙기반 결과는 반환
    llmFindings = [{
      ruleId: 'llm-error', label: 'LLM 검수 오류', severity: 'warn', source: 'llm',
      message: err instanceof Error ? err.message : 'LLM 검수 호출 실패',
    }];
  }

  const findings = [...ruleFindings, ...llmFindings];
  const passed = !findings.some(f => f.severity === 'block');
  return { passed, findings, checkedAt: Date.now() };
}
