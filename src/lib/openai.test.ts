import { describe, it, expect, vi, beforeEach } from 'vitest';
import { chatJson, getLlmConcurrency, MAX_CONCURRENT_LLM, getLlmCircuitState, resetLlmCircuit, _setNowFn, _setSleepFn, setMaxConcurrentLlm } from './openai';

const MAX_429_RETRIES = 3;
// 429 응답 mock 헬퍼 — retry-after 헤더 지원
const res429 = (retryAfter?: string) => ({
  ok: false, status: 429,
  headers: { get: (k: string) => (k.toLowerCase() === 'retry-after' ? (retryAfter ?? null) : null) },
  json: async () => ({ error: { message: 'rate' } }),
}) as unknown as Response;

beforeEach(() => {
  vi.restoreAllMocks();
  resetLlmCircuit();
  _setNowFn(() => Date.now());
  _setSleepFn(async () => {});   // 테스트는 백오프 즉시 통과
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

    expect(result.data).toEqual({ hello: 'world' });
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

  it('throws OpenAIError on rate limit (재시도 소진 후)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res429()));
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

  it('기본 동시성 상한 3 (gemini RPM 보호 + 비용효율)', () => {
    expect(MAX_CONCURRENT_LLM).toBe(3);
  });

  it('setMaxConcurrentLlm 런타임 조정 + 1 미만 무시', async () => {
    const orig = MAX_CONCURRENT_LLM;
    setMaxConcurrentLlm(2);
    let inFlight = 0, peak = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      inFlight++; peak = Math.max(peak, inFlight);
      await new Promise(r => setTimeout(r, 10)); inFlight--;
      return { ok: true, json: async () => ({ choices: [{ message: { content: '{"ok":1}' } }] }) } as unknown as Response;
    }));
    await Promise.all(Array.from({ length: 6 }, () => chatJson({ apiKey: 'k', model: 'm', system: 's', user: 'u' })));
    expect(peak).toBeLessThanOrEqual(2);
    setMaxConcurrentLlm(0);            // 무시
    expect(MAX_CONCURRENT_LLM).toBe(2);
    setMaxConcurrentLlm(orig);         // 복원
  });
});

describe('chatJson 429 서킷브레이커', () => {
  it('429 재시도 소진 후 서킷 open → 이후 호출은 fetch 없이 즉시 차단', async () => {
    const fetchMock = vi.fn(async () => res429());
    vi.stubGlobal('fetch', fetchMock);

    // 1차: 429 × (재시도 3 + 최초 1) = 4회 fetch 후 트립
    await expect(chatJson({ apiKey: 'k', model: 'm', system: 's', user: 'u' })).rejects.toMatchObject({ status: 429 });
    expect(getLlmCircuitState().open).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(MAX_429_RETRIES + 1);

    // 2차: 서킷 open → fetch 호출 안 하고 즉시 throw
    await expect(chatJson({ apiKey: 'k', model: 'm', system: 's', user: 'u' })).rejects.toMatchObject({ status: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(MAX_429_RETRIES + 1); // 늘지 않음
  });

  it('cooldown 경과 후 다시 호출 허용', async () => {
    let t = 1_000_000;
    _setNowFn(() => t);
    vi.stubGlobal('fetch', vi.fn(async () => res429()));
    await expect(chatJson({ apiKey: 'k', model: 'm', system: 's', user: 'u' })).rejects.toMatchObject({ status: 429 });
    expect(getLlmCircuitState().open).toBe(true);
    t += 61_000; // 60s cooldown 경과
    expect(getLlmCircuitState().open).toBe(false);
  });

  it('연속 429면 cooldown 지수 증가', async () => {
    let t = 0; _setNowFn(() => t);
    vi.stubGlobal('fetch', vi.fn(async () => res429()));
    await chatJson({ apiKey: 'k', model: 'm', system: 's', user: 'u' }).catch(() => {});
    const until1 = getLlmCircuitState().until;            // +60s
    t = until1; // 해제 시점으로
    await chatJson({ apiKey: 'k', model: 'm', system: 's', user: 'u' }).catch(() => {});
    const until2 = getLlmCircuitState().until;            // +120s
    expect(until2 - t).toBeGreaterThan(until1 - 0);        // 2번째 cooldown이 더 김
    expect(getLlmCircuitState().consecutive429).toBe(2);
  });

  it('성공하면 서킷 리셋', async () => {
    // 먼저 429로 트립
    vi.stubGlobal('fetch', vi.fn(async () => res429()));
    await chatJson({ apiKey: 'k', model: 'm', system: 's', user: 'u' }).catch(() => {});
    let t = getLlmCircuitState().until; _setNowFn(() => t); // cooldown 해제
    // 성공 응답
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: '{"ok":1}' } }] }) } as unknown as Response)));
    await chatJson({ apiKey: 'k', model: 'm', system: 's', user: 'u' });
    expect(getLlmCircuitState().consecutive429).toBe(0);
    expect(getLlmCircuitState().open).toBe(false);
  });
});

describe('chatJson 429 지수 백오프 재시도', () => {
  it('일시적 429 후 성공하면 재시도로 흡수 (서킷 트립 안 함)', async () => {
    let call = 0;
    const fetchMock = vi.fn(async () => {
      call++;
      if (call <= 2) return res429();   // 처음 2번 429
      return { ok: true, json: async () => ({ choices: [{ message: { content: '{"ok":1}' } }] }) } as unknown as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await chatJson({ apiKey: 'k', model: 'm', system: 's', user: 'u' });
    expect(result.data).toEqual({ ok: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(3);          // 429,429,성공
    expect(getLlmCircuitState().open).toBe(false);       // 트립 안 함
    expect(getLlmCircuitState().consecutive429).toBe(0);
  });

  it('Retry-After 헤더를 백오프 대기에 반영', async () => {
    const delays: number[] = [];
    _setSleepFn(async (ms) => { delays.push(ms); });
    let call = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      call++;
      if (call === 1) return res429('5');   // Retry-After: 5초
      return { ok: true, json: async () => ({ choices: [{ message: { content: '{"ok":1}' } }] }) } as unknown as Response;
    }));
    await chatJson({ apiKey: 'k', model: 'm', system: 's', user: 'u' });
    // 5초(5000ms) 요청, cap 8000 이내 → 5000 반영
    expect(delays[0]).toBe(5000);
  });

  it('최대 재시도 횟수 초과 시 throw + 서킷 트립', async () => {
    const fetchMock = vi.fn(async () => res429());
    vi.stubGlobal('fetch', fetchMock);
    await expect(chatJson({ apiKey: 'k', model: 'm', system: 's', user: 'u' })).rejects.toMatchObject({ status: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(MAX_429_RETRIES + 1);
    expect(getLlmCircuitState().open).toBe(true);
  });
});
