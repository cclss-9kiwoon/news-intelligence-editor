import { describe, it, expect } from 'vitest';
import { promotionBudget } from './promotion';
import type { Task } from '../types';

const NOW = 1_700_000_000_000;
const HOUR = 3_600_000;

function task(over: Partial<Task> = {}): Task {
  return {
    id: Math.random().toString(36), campaignId: 'c1', status: 'topic_review',
    title: 't', clusterId: 'x', sources: [], imageCount: 0,
    createdAt: NOW, updatedAt: NOW, ...over,
  };
}

describe('promotionBudget', () => {
  it('승급 이력 없으면 maxPerHour 전부', () => {
    expect(promotionBudget([], 'c1', 3, NOW)).toBe(3);
  });

  it('최근 1시간 승급수만큼 차감', () => {
    const tasks = [task({ promotedAt: NOW - 1000 }), task({ promotedAt: NOW - 2000 })];
    expect(promotionBudget(tasks, 'c1', 3, NOW)).toBe(1);
  });

  it('상한 도달/초과 시 0 (음수 안 됨)', () => {
    const tasks = Array.from({ length: 5 }, () => task({ promotedAt: NOW - 1000 }));
    expect(promotionBudget(tasks, 'c1', 3, NOW)).toBe(0);
  });

  it('1시간 지난 승급은 카운트 제외', () => {
    const tasks = [task({ promotedAt: NOW - HOUR - 1000 }), task({ promotedAt: NOW - 1000 })];
    expect(promotionBudget(tasks, 'c1', 3, NOW)).toBe(2);
  });

  it('다른 캠페인 승급은 무관', () => {
    const tasks = [task({ campaignId: 'other', promotedAt: NOW - 1000 })];
    expect(promotionBudget(tasks, 'c1', 3, NOW)).toBe(3);
  });

  it('maxPerHour 0이면 무제한', () => {
    expect(promotionBudget([task({ promotedAt: NOW })], 'c1', 0, NOW)).toBe(Infinity);
  });

  it('promotedAt 없는(미승급) 태스크는 카운트 안 함', () => {
    const tasks = [task({ status: 'searching' }), task({ status: 'searching' })];
    expect(promotionBudget(tasks, 'c1', 3, NOW)).toBe(3);
  });
});
