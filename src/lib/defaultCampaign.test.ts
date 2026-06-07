import { describe, it, expect } from 'vitest';
import { makeCampaign, migrateCampaign } from './defaultCampaign';

describe('migrateCampaign — autoProcess', () => {
  it('autoProcess 없으면 autoCollect.enabled로 초기화 (ON 보존)', () => {
    const raw = { id: 'c1', groupId: 'g', name: 'n', autoCollect: { enabled: true, intervalMin: 30 } };
    expect(migrateCampaign(raw).autoProcess).toEqual({ enabled: true });
  });

  it('autoCollect OFF였으면 autoProcess도 OFF로 초기화', () => {
    const raw = { id: 'c1', groupId: 'g', name: 'n', autoCollect: { enabled: false, intervalMin: 30 } };
    expect(migrateCampaign(raw).autoProcess).toEqual({ enabled: false });
  });

  it('autoCollect도 없으면 autoProcess 기본 ON', () => {
    const raw = { id: 'c1', groupId: 'g', name: 'n' };
    expect(migrateCampaign(raw).autoProcess).toEqual({ enabled: true });
  });

  it('기존 autoProcess 있으면 그대로 보존', () => {
    const raw = { id: 'c1', groupId: 'g', name: 'n', autoProcess: { enabled: false }, autoCollect: { enabled: true, intervalMin: 30 } };
    expect(migrateCampaign(raw).autoProcess).toEqual({ enabled: false });
  });

  it('미지/신규 필드 보존 (재구성 시 누락 방지)', () => {
    const raw = { id: 'c1', groupId: 'g', name: 'n', someNewField: 42, configured: true };
    const out = migrateCampaign(raw) as any;
    expect(out.someNewField).toBe(42);
    expect(out.configured).toBe(true);
  });

  it('makeCampaign은 autoProcess ON 기본', () => {
    expect(makeCampaign('g', 'n').autoProcess).toEqual({ enabled: true });
  });
});
