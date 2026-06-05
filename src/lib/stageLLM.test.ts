import { describe, it, expect } from 'vitest';
import { resolveStageLLM } from './stageLLM';
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
