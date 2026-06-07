import { describe, it, expect } from 'vitest';
import { shouldDiscardAfterExtractFail, MAX_EXTRACT_ATTEMPTS } from './extractRetry';

describe('shouldDiscardAfterExtractFail', () => {
  it('임계 미만이면 재시도(false)', () => {
    expect(shouldDiscardAfterExtractFail(1)).toBe(false);
    expect(shouldDiscardAfterExtractFail(2)).toBe(false);
  });

  it('임계(기본 3) 도달 시 폐기(true)', () => {
    expect(shouldDiscardAfterExtractFail(3)).toBe(true);
    expect(shouldDiscardAfterExtractFail(4)).toBe(true);
  });

  it('max 커스텀', () => {
    expect(shouldDiscardAfterExtractFail(2, 2)).toBe(true);
    expect(shouldDiscardAfterExtractFail(1, 2)).toBe(false);
  });

  it('MAX_EXTRACT_ATTEMPTS 기본 3', () => {
    expect(MAX_EXTRACT_ATTEMPTS).toBe(3);
  });
});
