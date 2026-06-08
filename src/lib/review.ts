import type { Settings, StoryOutput, ReviewFinding, ReviewResult, ProjectProfile } from '../types';
import { llmCall, llmBackendFrom } from './llmBackend';

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

/** 검수 부가 컨텍스트 — 소스 매체/이미지(태스크 단계에서 주입). 없으면 draft-level만. */
export type ReviewContext = {
  sources?: { source: string }[];
  images?: { url: string }[];
};

// 이미지 워터마크 의심 URL 휴리스틱 — 매칭 시 '사람 확인'(불확실). 비전 판별 한계라 확정 아님.
const WATERMARK_URL_HINTS = ['watermark', 'dispatch', 'starnews', 'mnet', 'logo', 'preview', 'sample', '_wm', 'thumb'];

export function runRuleChecks(draft: DraftFields, profile: ProjectProfile, ctx?: ReviewContext): ReviewFinding[] {
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
        message: `금지 매체 "${media}" 가 본문/출처에 인용됨.`,
      });
    }
  }

  // 클로징 에디토리얼 첨언 금지 — 본문 마지막 문장이 질문/응원/기대로 끝나면 위반
  if (f.noEditorialClosing) {
    const plain = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    // 마지막 문장(., !, ?, 다., 까? 등 기준) 추출
    const lastSentence = plain.split(/(?<=[.!?。])\s+/).filter(Boolean).pop() || plain;
    const editorialClose =
      /[?？]\s*$/.test(lastSentence) ||  // 질문으로 종료
      /(응원|기대|축하|바란다|바랍니다|기원|주목된다|귀추가 주목|관심이 모[아이]|화이팅|파이팅|행보가 기대)/.test(lastSentence);
    if (editorialClose) {
      findings.push({
        ruleId: 'fmt-editorial-closing', label: '클로징 첨언', severity: 'warn', source: 'rule', field: 'body',
        message: `마지막 문장이 에디토리얼 첨언(질문/응원/기대)으로 끝남: "${lastSentence.slice(-40)}". 팩트로 종료해야 합니다.`,
      });
    }
  }

  // 소스 교차검증 — N≥2 + 금지(2차 영문) 매체 차단 (ctx.sources 있을 때만)
  if (ctx?.sources) {
    const distinct = new Set(ctx.sources.map(s => s.source));
    if (distinct.size < 2) {
      findings.push({
        ruleId: 'gate-cross-verify', label: '교차검증', severity: 'block', source: 'rule', field: 'body',
        message: `소스 매체 ${distinct.size}곳 — 교차검증 최소 2곳 미달.`,
      });
    }
    for (const media of profile.bannedMedia) {
      if (!media.trim()) continue;
      if ([...distinct].some(s => s.toLowerCase().includes(media.toLowerCase()))) {
        findings.push({
          ruleId: `gate-banned-source-${media}`, label: '금지 소스', severity: 'block', source: 'rule', field: 'body',
          message: `금지(2차) 매체 "${media}"가 소스에 포함됨 — 1차 매체만 사용.`,
        });
      }
    }
  }

  // 워터마크 의심 이미지 — URL 휴리스틱. 불확실이라 warn(사람 확인). (ctx.images 있을 때만)
  if (ctx?.images) {
    const suspect = ctx.images.filter(im => {
      const u = im.url.toLowerCase();
      return WATERMARK_URL_HINTS.some(h => u.includes(h));
    });
    if (suspect.length > 0) {
      findings.push({
        ruleId: 'gate-watermark', label: '워터마크 의심', severity: 'warn', source: 'rule', field: 'imagePrompt',
        message: `워터마크/로고 의심 이미지 ${suspect.length}건(URL 휴리스틱) — 사람 확인 필요.`,
      });
    }
  }

  // 헤드라인 케이싱(영문) — lower-minor: 전치사·접속사·관사는 소문자
  if (f.headlineCasing === 'lower-minor' && /[A-Za-z]/.test(draft.headline)) {
    const MINOR = new Set(['a', 'an', 'the', 'and', 'but', 'or', 'nor', 'for', 'of', 'to', 'in', 'on', 'at', 'by', 'with', 'as', 'from', 'into', 'over', 'per', 'vs']);
    const words = draft.headline.split(/\s+/);
    const offenders = words.filter((w, i) => {
      if (i === 0) return false; // 첫 단어는 대문자 허용
      const bare = w.replace(/[^A-Za-z]/g, '');
      return bare && MINOR.has(bare.toLowerCase()) && /^[A-Z]/.test(bare);
    });
    if (offenders.length > 0) {
      findings.push({
        ruleId: 'fmt-headline-casing', label: '헤드라인 케이싱', severity: 'warn', source: 'rule', field: 'headline',
        message: `전치사·접속사는 소문자여야 함: ${offenders.join(', ')}`,
      });
    }
  }

  return findings;
}

// ─── 2. LLM 검수 ────────────────────────────────────────────────────

type LlmFinding = { ruleId: string; pass: boolean; message: string; field?: string };
type SensitiveJudgment = { flag: boolean; reason?: string };
type LlmResponse = { findings: LlmFinding[]; sensitive?: SensitiveJudgment };

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
  lines.push('[민감주제 분류 — 자율발행 안전장치]');
  lines.push('이 기사가 민감 주제(논란·사건사고·법적분쟁·사망/건강·정치)에 해당하면 sensitive.flag=true + reason(한 줄).');
  lines.push('단순 컴백·발매·시상·일상은 민감 아님(flag=false). 민감이면 자동발행을 막고 사람이 확인한다.');
  lines.push('');
  lines.push('오직 valid JSON: { "findings": [ { "ruleId": string, "pass": boolean, "message": string, "field"?: string } ], "sensitive": { "flag": boolean, "reason"?: string } }');
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

export type LlmCheckResult = { findings: ReviewFinding[]; sensitive: SensitiveJudgment };

export async function runLlmChecks(draft: DraftFields, settings: Settings): Promise<LlmCheckResult> {
  const enabled = settings.projectProfile.reviewRules.filter(r => r.enabled);
  if (enabled.length === 0) return { findings: [], sensitive: { flag: false } };

  const out = await llmCall<LlmResponse>({
    apiKey: settings.apiKey,
    baseUrl: settings.apiBaseUrl,
    model: settings.model,
    system: buildReviewSystem(settings.projectProfile),
    user: buildReviewUser(draft),
    temperature: 0.2,
    backend: llmBackendFrom(settings),
    stage: 'review',
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
  return { findings, sensitive: out.sensitive ?? { flag: false } };
}

// ─── 통합 검수 ──────────────────────────────────────────────────────

export async function reviewDraft(draft: DraftFields, settings: Settings, ctx?: ReviewContext): Promise<ReviewResult> {
  const ruleFindings = runRuleChecks(draft, settings.projectProfile, ctx);

  let llmFindings: ReviewFinding[] = [];
  let sensitive: SensitiveJudgment = { flag: false };
  let llmFailed = false;
  try {
    const r = await runLlmChecks(draft, settings);
    llmFindings = r.findings;
    sensitive = r.sensitive;
  } catch (err) {
    // LLM 검수 실패해도 규칙기반 결과는 반환. 단 LLM 판정 불가 = 불확실 → 사람 확인.
    llmFailed = true;
    llmFindings = [{
      ruleId: 'llm-error', label: 'LLM 검수 오류', severity: 'warn', source: 'llm',
      message: err instanceof Error ? err.message : 'LLM 검수 호출 실패',
    }];
  }

  const findings = [...ruleFindings, ...llmFindings];
  const passed = !findings.some(f => f.severity === 'block');

  // 자율발행 안전장치 — needsHuman: block 존재 OR 민감주제 OR LLM 검수 불확실(실패)
  const reasons: string[] = [];
  for (const f of findings) {
    if (f.severity === 'block') reasons.push(`차단: ${f.label}`);
  }
  if (sensitive.flag) reasons.push(`민감 주제${sensitive.reason ? ` — ${sensitive.reason}` : ''}`);
  if (llmFailed) reasons.push('LLM 검수 불가(불확실) — 사람 확인 필요');
  // 워터마크 의심(불확실) → 사람 확인 (자동발행 차단)
  if (findings.some(f => f.ruleId === 'gate-watermark')) reasons.push('워터마크 의심 이미지 — 사람 확인 필요');
  const needsHuman = reasons.length > 0;

  return { passed, findings, checkedAt: Date.now(), needsHuman, needsHumanReasons: reasons };
}
