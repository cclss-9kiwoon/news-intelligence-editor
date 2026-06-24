// ── AI cliché detection + forced replacement (2-A) ──

/** Regex patterns that flag AI-generated phrasing. */
export const BANNED_PATTERNS: RegExp[] = [
  // Original set
  /\bdelve\b/gi,
  /\bin conclusion\b/gi,
  /\bfurthermore\b/gi,
  /\btestament\b/gi,
  /\bmoreover\b/gi,
  /\bit is important to note\b/gi,
  /\bnot only [^,.]+ but also\b/gi,
  /\bas an AI\b/gi,
  /\bI (?:think|believe|feel)\b/gi,
  // PM-specified verbs
  /\bshowcased\b/gi,
  /\bcaptivated\b/gi,
  /\bdemonstrated\b/gi,
  /\bresonated\b/gi,
  /\bheartfelt\b/gi,
  /\bsolidified\b/gi,
  /\bcemented\b/gi,
  /\bunderscored\b/gi,
  /\bgarnered\b/gi,
  /\bleveraged\b/gi,
  // Additional AI clichés
  /\bunveiled\b/gi,
  /\bspearheaded\b/gi,
  /\bnavigated\b/gi,
  /\bembodied\b/gi,
  // Phrases
  /\bit is worth noting that\b/gi,
  /\bit remains to be seen\b/gi,
  /\bfans were quick to\b/gi,
  /\bthe internet was abuzz\b/gi,
  /\bit is known that\b/gi,
  /\bit was revealed that\b/gi,
  /\baccording to reports\b/gi,
  // Triple-adjective pattern (e.g. "stunning, breathtaking, and unforgettable")
  /\b\w+(?:ing|ful|ive|ous|able|ent|ant),\s*\w+(?:ing|ful|ive|ous|able|ent|ant),\s*and\s+\w+(?:ing|ful|ive|ous|able|ent|ant)\b/gi,
];

/** Word/phrase → replacement mapping for forced post-processing. */
export const REPLACEMENT_MAP: [RegExp, string][] = [
  // PM-specified 10 pairs
  [/\bshowcased\b/gi, 'showed'],
  [/\bcaptivated\b/gi, 'drew attention from'],
  [/\bdemonstrated\b/gi, 'showed'],
  [/\bresonated\b/gi, 'connected'],
  [/\bheartfelt\b/gi, 'sincere'],
  [/\bsolidified\b/gi, 'strengthened'],
  [/\bcemented\b/gi, 'established'],
  [/\bunderscored\b/gi, 'highlighted'],
  [/\bgarnered\b/gi, 'received'],
  [/\bleveraged\b/gi, 'used'],
  // Additional replacements
  [/\bunveiled\b/gi, 'announced'],
  [/\bspearheaded\b/gi, 'led'],
  [/\bnavigated\b/gi, 'handled'],
  [/\bembodied\b/gi, 'represented'],
  [/\bdelve\b/gi, 'explore'],
  [/\btestament\b/gi, 'sign'],
  [/\bfurthermore\b/gi, 'also'],
  [/\bmoreover\b/gi, 'also'],
  // Phrase replacements
  [/\bit is worth noting that\b/gi, ''],
  [/\bit is important to note\b/gi, ''],
  [/\bin conclusion\b/gi, ''],
  [/\bit remains to be seen\b/gi, 'it is unclear'],
  [/\bfans were quick to\b/gi, 'fans'],
  [/\bthe internet was abuzz\b/gi, 'online reactions spread'],
  [/\bit is known that\b/gi, ''],
  [/\bit was revealed that\b/gi, ''],
  [/\baccording to reports\b/gi, ''],
];

export type ScanResult = { ok: boolean; hits: string[] };

/** Scan text for banned AI patterns. Returns matched strings. */
export function scan(text: string): ScanResult {
  const hits: string[] = [];
  for (const pattern of BANNED_PATTERNS) {
    pattern.lastIndex = 0;
    const m = text.match(pattern);
    if (m) hits.push(m[0]);
  }
  return { ok: hits.length === 0, hits };
}

/** Force-replace all banned words/phrases in text. */
export function deAiSmell(text: string): string {
  let result = text;
  for (const [pattern, replacement] of REPLACEMENT_MAP) {
    pattern.lastIndex = 0;
    result = result.replace(pattern, replacement);
  }
  // Clean up double spaces and leading spaces after phrase removal
  result = result.replace(/  +/g, ' ');
  result = result.replace(/^ /gm, '');
  // Clean up orphaned sentence-start lowercase after phrase removal (", also" → ". Also")
  result = result.replace(/\.\s+([a-z])/g, (_, c) => `. ${c.toUpperCase()}`);
  return result;
}
