import { describe, it, expect } from 'vitest';
import { verify } from './factCheck';
import type { Facts, ChannelOutput } from '../types';

const baseFacts: Facts = {
  people: ['BLACKPINK Lisa', 'YG Entertainment'],
  numbers: ['10 million', '2026'],
  places: ['Seoul'],
  dates: ['May 25, 2026'],
};

function outputs(text: string): ChannelOutput {
  return { site: text, x: text, medium: text };
}

describe('factCheck.verify', () => {
  it('returns ok=true when all facts appear in outputs', () => {
    const text = 'BLACKPINK Lisa from YG Entertainment sold 10 million in 2026 in Seoul on May 25, 2026.';
    const r = verify(baseFacts, outputs(text));
    expect(r.ok).toBe(true);
    expect(r.missing).toEqual([]);
  });

  it('flags missing person', () => {
    const text = 'YG Entertainment sold 10 million in 2026 in Seoul on May 25, 2026.';
    const r = verify(baseFacts, outputs(text));
    expect(r.ok).toBe(false);
    expect(r.missing.some(m => m.category === 'people' && m.value === 'BLACKPINK Lisa')).toBe(true);
  });

  it('flags missing exact number (no loose matching)', () => {
    const text = 'BLACKPINK Lisa from YG Entertainment sold 11 million in 2026 in Seoul on May 25, 2026.';
    const r = verify(baseFacts, outputs(text));
    expect(r.ok).toBe(false);
    expect(r.missing.some(m => m.category === 'numbers' && m.value === '10 million')).toBe(true);
  });

  it('considers a fact present if it appears in at least one channel', () => {
    const text = 'BLACKPINK Lisa from YG Entertainment sold 10 million in 2026 in Seoul on May 25, 2026.';
    const r = verify(baseFacts, { site: text, x: 'short', medium: 'short' });
    expect(r.ok).toBe(true);
  });

  it('loose-matches people regardless of case', () => {
    const text = 'blackpink lisa from yg entertainment sold 10 million in 2026 in seoul on May 25, 2026.';
    const r = verify(baseFacts, outputs(text));
    expect(r.missing.filter(m => m.category === 'people')).toEqual([]);
  });
});
