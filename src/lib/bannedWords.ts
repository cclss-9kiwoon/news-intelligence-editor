export const BANNED_PATTERNS: RegExp[] = [
  /\bdelve\b/i,
  /\bin conclusion\b/i,
  /\bfurthermore\b/i,
  /\btestament\b/i,
  /\bmoreover\b/i,
  /\bit is important to note\b/i,
  /\bnot only [^,.]+ but also\b/i,
  /\bas an AI\b/i,
  /\bI (think|believe|feel)\b/i,
];

export type ScanResult = { ok: boolean; hits: string[] };

export function scan(text: string): ScanResult {
  const hits: string[] = [];
  for (const pattern of BANNED_PATTERNS) {
    const m = text.match(pattern);
    if (m) hits.push(m[0]);
  }
  return { ok: hits.length === 0, hits };
}
