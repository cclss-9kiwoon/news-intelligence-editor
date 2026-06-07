import { describe, it, expect } from 'vitest';
import { staleTaskIds, hoursToMs } from './taskCleanup';
import type { Task } from '../types';

const NOW = 1_700_000_000_000;
const H = 3_600_000;

function task(over: Partial<Task> = {}): Task {
  return {
    id: Math.random().toString(36).slice(2), campaignId: 'c1', status: 'topic_review',
    title: 't', clusterId: 'x', sources: [], imageCount: 0,
    createdAt: NOW, updatedAt: NOW, ...over,
  };
}

describe('staleTaskIds', () => {
  it('olderThanMs 초과분만 반환', () => {
    const tasks = [
      task({ id: 'old', createdAt: NOW - 7 * H }),
      task({ id: 'fresh', createdAt: NOW - 1 * H }),
    ];
    expect(staleTaskIds(tasks, 'c1', hoursToMs(6), NOW)).toEqual(['old']);
  });

  it('다른 캠페인 제외', () => {
    const tasks = [task({ id: 'x', campaignId: 'other', createdAt: NOW - 99 * H })];
    expect(staleTaskIds(tasks, 'c1', hoursToMs(6), NOW)).toEqual([]);
  });

  it('status 옵션 — 해당 단계만', () => {
    const tasks = [
      task({ id: 'tr', status: 'topic_review', createdAt: NOW - 9 * H }),
      task({ id: 'pr', status: 'producing', createdAt: NOW - 9 * H }),
    ];
    expect(staleTaskIds(tasks, 'c1', hoursToMs(6), NOW, { status: 'producing' })).toEqual(['pr']);
  });

  it('발행분은 기본 보존, includePublished로 포함', () => {
    const tasks = [task({ id: 'pub', published: true, createdAt: NOW - 9 * H })];
    expect(staleTaskIds(tasks, 'c1', hoursToMs(6), NOW)).toEqual([]);
    expect(staleTaskIds(tasks, 'c1', hoursToMs(6), NOW, { includePublished: true })).toEqual(['pub']);
  });

  it('hoursToMs', () => {
    expect(hoursToMs(24)).toBe(86_400_000);
  });
});
