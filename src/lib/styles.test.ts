import { describe, it, expect } from 'vitest';
import { DEFAULT_STYLE_INSTRUCTION, getStyleInstruction } from './styles';

describe('styles.getStyleInstruction', () => {
  it('returns the editor instruction when provided', () => {
    expect(getStyleInstruction('가치 기준 X / 말투 Y')).toBe('가치 기준 X / 말투 Y');
  });

  it('trims and returns custom instruction', () => {
    expect(getStyleInstruction('  My tone  ')).toBe('My tone');
  });

  it('falls back to the default instruction when empty', () => {
    expect(getStyleInstruction('')).toBe(DEFAULT_STYLE_INSTRUCTION);
    expect(getStyleInstruction('   ')).toBe(DEFAULT_STYLE_INSTRUCTION);
  });

  it('default instruction is non-empty', () => {
    expect(DEFAULT_STYLE_INSTRUCTION.length).toBeGreaterThan(20);
  });
});
