import { describe, it, expect, beforeEach } from 'vitest';
import { loadJson, saveJson } from './storage';

beforeEach(() => {
  localStorage.clear();
});

describe('storage', () => {
  it('saveJson + loadJson round trip', () => {
    saveJson('nie:test', { a: 1, b: 'two' });
    expect(loadJson('nie:test', null)).toEqual({ a: 1, b: 'two' });
  });

  it('loadJson returns default when key missing', () => {
    expect(loadJson('nie:missing', { fallback: true })).toEqual({ fallback: true });
  });

  it('loadJson returns default when value is invalid JSON', () => {
    localStorage.setItem('nie:bad', '{not json');
    expect(loadJson('nie:bad', { fallback: true })).toEqual({ fallback: true });
  });

  it('saveJson swallows quota errors gracefully', () => {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new DOMException('quota', 'QuotaExceededError'); };
    expect(() => saveJson('nie:big', { x: 1 })).not.toThrow();
    Storage.prototype.setItem = orig;
  });
});
