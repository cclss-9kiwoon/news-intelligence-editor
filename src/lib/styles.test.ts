import { describe, it, expect } from 'vitest';
import { STYLE_PRESETS, getStyleInstruction } from './styles';

describe('styles.STYLE_PRESETS', () => {
  it('contains all five preset keys', () => {
    expect(Object.keys(STYLE_PRESETS).sort()).toEqual(
      ['ap', 'bloomberg', 'custom', 'kpop', 'techcrunch']
    );
  });

  it('each non-custom preset has non-empty instruction and label', () => {
    for (const key of ['kpop', 'ap', 'bloomberg', 'techcrunch'] as const) {
      expect(STYLE_PRESETS[key].label.length).toBeGreaterThan(0);
      expect(STYLE_PRESETS[key].instruction.length).toBeGreaterThan(20);
    }
  });

  it('custom preset has empty default instruction', () => {
    expect(STYLE_PRESETS.custom.instruction).toBe('');
  });
});

describe('styles.getStyleInstruction', () => {
  it('returns built-in instruction for non-custom preset', () => {
    expect(getStyleInstruction('kpop', '')).toBe(STYLE_PRESETS.kpop.instruction);
  });

  it('returns user override for custom preset', () => {
    expect(getStyleInstruction('custom', 'My tone is X')).toBe('My tone is X');
  });

  it('falls back to kpop instruction if custom is empty', () => {
    expect(getStyleInstruction('custom', '')).toBe(STYLE_PRESETS.kpop.instruction);
  });
});
