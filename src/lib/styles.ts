// 단일 통합 지침(가치 기준 + 말투). 에디터가 settings.customStyleInstruction를
// 비워두면 이 기본값이 엔진에 전달된다.
export const DEFAULT_STYLE_INSTRUCTION =
  '발행 가치 기준: 단순 가십·홍보성·근거가 빈약한 기사는 보류(Fail). ' +
  '사실관계가 분명하고 독자 관심도가 높은 사건은 통과(Pass). ' +
  '말투: 신뢰감 있는 한국어 저널리즘 문체. 짧고 명료한 문장, 과장·홍보 표현 자제, 핵심 사실 우선.';

export function getStyleInstruction(customInstruction: string): string {
  return customInstruction.trim() || DEFAULT_STYLE_INSTRUCTION;
}
