import { describe, it, expect, vi, beforeEach } from 'vitest';
import { chatJson, getLlmConcurrency, MAX_CONCURRENT_LLM } from './openai';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('openai.chatJson', () => {
  it('sends Authorization header and parses JSON content', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ hello: 'world' }) } }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await chatJson({
      apiKey: 'sk-test',
      model: 'gpt-4o-mini',
      system: 'sys',
      user: 'usr',
    });

    expect(result).toEqual({ hello: 'world' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer sk-test');
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('gpt-4o-mini');
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.messages[0]).toEqual({ role: 'system', content: 'sys' });
    expect(body.messages[1]).toEqual({ role: 'user', content: 'usr' });
  });

  it('throws OpenAIError with status on 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'invalid key' } }),
    }));
    await expect(chatJson({ apiKey: 'x', model: 'gpt-4o-mini', system: 's', user: 'u' }))
      .rejects.toMatchObject({ status: 401 });
  });

  it('throws OpenAIError on rate limit', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: { message: 'rate' } }),
    }));
    await expect(chatJson({ apiKey: 'x', model: 'gpt-4o-mini', system: 's', user: 'u' }))
      .rejects.toMatchObject({ status: 429 });
  });

  it('throws when content is not valid JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'not json' } }] }),
    }));
    await expect(chatJson({ apiKey: 'x', model: 'gpt-4o-mini', system: 's', user: 'u' }))
      .rejects.toThrow(/JSON/);
  });
});

describe('chatJson 글로벌 동시성 상한', () => {
  it(`동시 실행이 MAX_CONCURRENT_LLM(${MAX_CONCURRENT_LLM})을 넘지 않는다`, async () => {
    let inFlight = 0;
    let peak = 0;
    const fetchMock = vi.fn(async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise(r => setTimeout(r, 10));
      inFlight--;
      return { ok: true, json: async () => ({ choices: [{ message: { content: '{"ok":true}' } }] }) } as unknown as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    const N = MAX_CONCURRENT_LLM * 3;
    const calls = Array.from({ length: N }, () =>
      chatJson({ apiKey: 'k', model: 'm', system: 's', user: 'u' }));

    expect(getLlmConcurrency().active).toBeLessThanOrEqual(MAX_CONCURRENT_LLM);

    await Promise.all(calls);

    expect(fetchMock).toHaveBeenCalledTimes(N);
    expect(peak).toBeLessThanOrEqual(MAX_CONCURRENT_LLM);
    expect(getLlmConcurrency()).toEqual({ active: 0, queued: 0 });
  });

  it('호출이 실패해도 슬롯을 반납한다 (누수 없음)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) } as unknown as Response)));
    await Promise.allSettled(
      Array.from({ length: MAX_CONCURRENT_LLM + 2 }, () =>
        chatJson({ apiKey: 'k', model: 'm', system: 's', user: 'u' })));
    expect(getLlmConcurrency()).toEqual({ active: 0, queued: 0 });
  });
});
