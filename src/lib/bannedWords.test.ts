import { describe, it, expect } from 'vitest';
import { scan, BANNED_PATTERNS } from './bannedWords';

describe('bannedWords.scan', () => {
  it('returns ok=true and empty hits for clean text', () => {
    const r = scan('A well-written news article about K-pop.');
    expect(r.ok).toBe(true);
    expect(r.hits).toEqual([]);
  });

  it('detects "delve" as case-insensitive whole word', () => {
    const r = scan('Let us delve into the details.');
    expect(r.ok).toBe(false);
    expect(r.hits.some(h => /delve/i.test(h))).toBe(true);
  });

  it('does not flag substrings ("delver" should not match "delve")', () => {
    const r = scan('She is a delver in the cave.');
    expect(r.ok).toBe(true);
  });

  it('detects "in conclusion"', () => {
    const r = scan('In conclusion, the team won.');
    expect(r.ok).toBe(false);
  });

  it('detects "furthermore"', () => {
    expect(scan('Furthermore, this matters.').ok).toBe(false);
  });

  it('detects "moreover"', () => {
    expect(scan('Moreover, fans reacted.').ok).toBe(false);
  });

  it('detects "testament"', () => {
    expect(scan('It is a testament to talent.').ok).toBe(false);
  });

  it('detects "it is important to note"', () => {
    expect(scan('It is important to note the date.').ok).toBe(false);
  });

  it('detects "not only ... but also" pattern', () => {
    expect(scan('Not only sang but also danced.').ok).toBe(false);
  });

  it('detects "as an AI"', () => {
    expect(scan('As an AI, I think this.').ok).toBe(false);
  });

  it('detects first-person AI references "I think/believe/feel"', () => {
    expect(scan('I think this is true.').ok).toBe(false);
    expect(scan('I believe the data.').ok).toBe(false);
    expect(scan('I feel this matters.').ok).toBe(false);
  });

  it('exports BANNED_PATTERNS as non-empty array', () => {
    expect(BANNED_PATTERNS.length).toBeGreaterThan(5);
  });
});
