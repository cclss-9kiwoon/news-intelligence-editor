import type { Facts, FactReport, ChannelOutput } from '../types';

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

function containsLoose(haystack: string, needle: string): boolean {
  return normalize(haystack).includes(normalize(needle));
}

function containsExact(haystack: string, needle: string): boolean {
  return haystack.includes(needle);
}

export function verify(facts: Facts, outputs: ChannelOutput): FactReport {
  const allText = `${outputs.site}\n${outputs.x}\n${outputs.medium}`;
  const missing: FactReport['missing'] = [];

  for (const p of facts.people) {
    if (!containsLoose(allText, p)) missing.push({ category: 'people', value: p });
  }
  for (const n of facts.numbers) {
    if (!containsExact(allText, n)) missing.push({ category: 'numbers', value: n });
  }
  for (const p of facts.places) {
    if (!containsLoose(allText, p)) missing.push({ category: 'places', value: p });
  }
  for (const d of facts.dates) {
    if (!containsLoose(allText, d)) missing.push({ category: 'dates', value: d });
  }

  return { ok: missing.length === 0, missing };
}
