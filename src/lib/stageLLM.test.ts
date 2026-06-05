import { describe, it, expect } from 'vitest';
import { resolveStageLLM, describeStageLLM } from './stageLLM';
import { DEFAULT_SETTINGS } from './defaultSettings';
import type { Settings, GroupProfile } from '../types';

const SETTINGS: Settings = { ...DEFAULT_SETTINGS, provider: 'openai', apiKey: 'global-key', model: 'global-model', apiBaseUrl: 'https://global' };

const baseGroup: GroupProfile = {
  channelType: 'news_media', formalityLevel: 'standard', sourceStrictness: 'standard',
  language: 'ko', character: '', audience: '', toneBase: '',
};

describe('resolveStageLLM', () => {
  it('아무 오버라이드 없으면 글로벌 settings', () => {
    expect(resolveStageLLM(SETTINGS)).toEqual({
      provider: 'openai', apiKey: 'global-key', model: 'global-model', baseUrl: 'https://global',
    });
  });

  it('그룹 llm이 글로벌 오버라이드', () => {
    const group: GroupProfile = { ...baseGroup, llm: { apiKey: 'group-key', model: 'group-model' } };
    const r = resolveStageLLM(SETTINGS, group);
    expect(r.apiKey).toBe('group-key');
    expect(r.model).toBe('group-model');
    expect(r.baseUrl).toBe('https://global'); // 미지정 필드는 글로벌
  });

  it('단계 llm이 그룹·글로벌 오버라이드 (최우선)', () => {
    const group: GroupProfile = { ...baseGroup, llm: { apiKey: 'group-key', model: 'group-model' } };
    const r = resolveStageLLM(SETTINGS, group, { model: 'stage-model', apiKey: 'stage-key' });
    expect(r.apiKey).toBe('stage-key');
    expect(r.model).toBe('stage-model');
  });

  it('단계 enabled=false면 단계 무시 → 그룹 폴백', () => {
    const group: GroupProfile = { ...baseGroup, llm: { model: 'group-model' } };
    const r = resolveStageLLM(SETTINGS, group, { model: 'stage-model', enabled: false });
    expect(r.model).toBe('group-model');
  });

  it('그룹 enabled=false면 그룹 무시 → 글로벌 폴백', () => {
    const group: GroupProfile = { ...baseGroup, llm: { model: 'group-model', enabled: false } };
    const r = resolveStageLLM(SETTINGS, group);
    expect(r.model).toBe('global-model');
  });

  it('단계 provider/baseUrl도 개별 폴백', () => {
    const r = resolveStageLLM(SETTINGS, undefined, { provider: 'gemini', baseUrl: 'https://stage' });
    expect(r.provider).toBe('gemini');
    expect(r.baseUrl).toBe('https://stage');
    expect(r.apiKey).toBe('global-key'); // 미지정은 글로벌
  });
});

describe('describeStageLLM', () => {
  it('전역만 — keySource/modelSource=global, active', () => {
    const s = describeStageLLM(SETTINGS);
    expect(s.keySource).toBe('global');
    expect(s.modelSource).toBe('global');
    expect(s.active).toBe(true);
  });

  it('그룹 키 → keySource=group', () => {
    const group: GroupProfile = { ...baseGroup, llm: { apiKey: 'g' } };
    const s = describeStageLLM(SETTINGS, group);
    expect(s.keySource).toBe('group');
    expect(s.modelSource).toBe('global'); // 그룹이 model 미지정
  });

  it('단계 모델 + 그룹 키 → modelSource=stage, keySource=group', () => {
    const group: GroupProfile = { ...baseGroup, llm: { apiKey: 'g' } };
    const s = describeStageLLM(SETTINGS, group, { model: 'sm' });
    expect(s.modelSource).toBe('stage');
    expect(s.keySource).toBe('group');
  });

  it('키 전무면 active=false', () => {
    const s = describeStageLLM({ ...SETTINGS, apiKey: '' });
    expect(s.active).toBe(false);
  });

  it('enabled=false 단계는 무시 → 그룹/전역으로', () => {
    const group: GroupProfile = { ...baseGroup, llm: { apiKey: 'g' } };
    const s = describeStageLLM(SETTINGS, group, { apiKey: 'stagekey', enabled: false });
    expect(s.keySource).toBe('group');
  });
});
