import { describe, it, expect } from 'vitest';
import { makeCampaign, migrateCampaign, makeDefaultCampaignSettings } from './defaultCampaign';
import { resolveStageLLM } from './stageLLM';
import { DEFAULT_SETTINGS } from './defaultSettings';

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

describe('fastModel tier — ②④ 경량, ③ 글로벌', () => {
  const s = makeDefaultCampaignSettings();
  const settings = { ...DEFAULT_SETTINGS, apiKey: 'k', model: 'gemini-2.5-pro', fastModel: 'gemini-2.5-flash' };

  it('stage pin 제거됨(②④ llm 미설정)', () => {
    expect(s.topicReview.llm).toBeUndefined();
    expect(s.finalReview.llm).toBeUndefined();
    expect(s.generation.llm).toBeUndefined();
  });

  it("tier 'fast' → fastModel 사용", () => {
    expect(resolveStageLLM(settings, undefined, s.topicReview.llm, 'fast').model).toBe('gemini-2.5-flash');
    expect(resolveStageLLM(settings, undefined, s.finalReview.llm, 'fast').model).toBe('gemini-2.5-flash');
  });

  it("tier 'main'(③) → 글로벌 model", () => {
    expect(resolveStageLLM(settings, undefined, s.generation.llm, 'main').model).toBe('gemini-2.5-pro');
    expect(resolveStageLLM(settings, undefined, s.generation.llm).model).toBe('gemini-2.5-pro'); // 기본 main
  });

  it('fastModel 비면 fast도 settings.model로 폴백(하위호환)', () => {
    const noFast = { ...settings, fastModel: undefined };
    expect(resolveStageLLM(noFast, undefined, undefined, 'fast').model).toBe('gemini-2.5-pro');
  });

  it('stage 명시 model이 fastModel보다 우선', () => {
    expect(resolveStageLLM(settings, undefined, { model: 'custom-x' }, 'fast').model).toBe('custom-x');
  });

  it("provider/키는 글로벌 상속(fast tier여도)", () => {
    const r = resolveStageLLM(settings, undefined, undefined, 'fast');
    expect(r.provider).toBe(settings.provider);
    expect(r.apiKey).toBe('k');
  });
});
