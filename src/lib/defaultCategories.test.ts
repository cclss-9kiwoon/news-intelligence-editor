import { describe, it, expect } from 'vitest';
import { DEFAULT_CATEGORIES } from './defaultCategories';

describe('DEFAULT_CATEGORIES', () => {
  it('has five categories with unique ids', () => {
    expect(DEFAULT_CATEGORIES).toHaveLength(5);
    const ids = DEFAULT_CATEGORIES.map(c => c.id);
    expect(new Set(ids).size).toBe(5);
    expect(ids).toContain('screen');
  });

  it('every category has non-empty label, criteria, tone', () => {
    for (const c of DEFAULT_CATEGORIES) {
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.criteria.length).toBeGreaterThan(20);
      expect(c.tone.length).toBeGreaterThan(10);
    }
  });

  it('screen category treats pre-release promo as valid content', () => {
    const screen = DEFAULT_CATEGORIES.find(c => c.id === 'screen')!;
    expect(screen.criteria).toContain('홍보');
  });
});
