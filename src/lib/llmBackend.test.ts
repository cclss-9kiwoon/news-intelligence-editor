import { describe, it, expect, vi, afterEach } from 'vitest';
import { llmCall, llmBackendFrom, _resetAgentState, type NieLlmRequest } from './llmBackend';

afterEach(() => { vi.unstubAllGlobals(); _resetAgentState(); });

describe('llmBackendFrom', () => {
  it('settings → 백엔드 설정 매핑 (기본 api)', () => {
    expect(llmBackendFrom({})).toEqual({ mode: 'api', agentInboxCode: undefined, selfInboxCode: undefined });
    expect(llmBackendFrom({ llmBackend: 'agent', agentInboxCode: 'A', khalaInboxCode: 'S' }))
      .toEqual({ mode: 'agent', agentInboxCode: 'A', selfInboxCode: 'S' });
  });
});

describe('llmCall api 모드', () => {
  it('api 모드는 chatJson(=/chat/completions fetch) 경유', async () => {
    const fetchMock = vi.fn(async (_url: string) => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"hello":"world"}' } }] }),
    } as unknown as Response));
    vi.stubGlobal('fetch', fetchMock);

    const out = await llmCall<{ hello: string }>({
      apiKey: 'k', model: 'm', system: 's', user: 'u',
      backend: llmBackendFrom({ llmBackend: 'api' }),
    });
    expect(out).toEqual({ hello: 'world' });
    expect(String(fetchMock.mock.calls[0][0])).toContain('/chat/completions');
  });
});

describe('llmCall agent 모드 (Khala 위임)', () => {
  it('send→recv 라운드트립으로 correlationId 매칭 후 json 반환', async () => {
    let sentCorrelationId = '';
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/api/khala/send')) {
        const body = JSON.parse(String(init?.body));
        const req = JSON.parse(body.body) as NieLlmRequest;
        sentCorrelationId = req.correlationId;
        expect(body.sender_inbox_code).toBe('SELF');
        expect(body.recipient_inbox_code).toBe('AGENT');
        expect(req.type).toBe('nie_llm_request');
        expect(req.replyTo).toBe('SELF');
        return { ok: true, json: async () => ({ ok: true }) } as unknown as Response;
      }
      // recv → 방금 보낸 correlationId로 응답 에코
      return {
        ok: true,
        json: async () => ({
          data: { message: { body: JSON.stringify({
            type: 'nie_llm_response',
            correlationId: sentCorrelationId,
            ok: true,
            json: { adequate: true, excluded: false },
          }) } },
        }),
      } as unknown as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    const out = await llmCall<{ adequate: boolean; excluded: boolean }>({
      apiKey: '', model: 'm', system: 's', user: 'u', stage: 'judgeTopic',
      backend: llmBackendFrom({ llmBackend: 'agent', agentInboxCode: 'AGENT', khalaInboxCode: 'SELF' }),
    });
    expect(out).toEqual({ adequate: true, excluded: false });
  });

  it('inbox code 미설정이면 에러', async () => {
    await expect(llmCall({
      apiKey: '', model: 'm', system: 's', user: 'u',
      backend: { mode: 'agent' }, // inbox code 없음
    })).rejects.toThrow(/agent 백엔드 미설정/);
  });

  it('correlationId 다른 메시지는 무시하고 매칭만 resolve', async () => {
    let sentCorrelationId = '';
    let recvCall = 0;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/api/khala/send')) {
        const body = JSON.parse(String(init?.body));
        sentCorrelationId = (JSON.parse(body.body) as NieLlmRequest).correlationId;
        return { ok: true, json: async () => ({ ok: true }) } as unknown as Response;
      }
      recvCall++;
      // 첫 recv = 무관 correlationId, 둘째 = 매칭
      const cid = recvCall === 1 ? 'other-xyz' : sentCorrelationId;
      return {
        ok: true,
        json: async () => ({ data: { message: { body: JSON.stringify({
          type: 'nie_llm_response', correlationId: cid, ok: true, json: { n: recvCall },
        }) } } }),
      } as unknown as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    const out = await llmCall<{ n: number }>({
      apiKey: '', model: 'm', system: 's', user: 'u', stage: 'review',
      backend: { mode: 'agent', agentInboxCode: 'AGENT', selfInboxCode: 'SELF' },
    });
    expect(out).toEqual({ n: 2 }); // 무관 메시지(1) 버려지고 매칭(2)만 resolve
  });
});
