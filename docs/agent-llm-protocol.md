# NIE B 모드 — LLM 에이전트 위임 프로토콜

> **테스트/dev 전용.** gemini 크레딧 0으로도 ②③④ 파이프라인을 e2e로 돌리기 위한 경로.
> 본선은 A(API 직결). 상용 시 제거(아래 "제거" 참고).

## 개요

NIE는 LLM 호출(주제판정/작성/검수)을 직접 gemini API로 보내는 대신(A 모드),
Khala 메신저로 **임의의 LLM 에이전트**(사용자가 구독한 Claude Code / ChatGPT / Gemini 등)에 위임할 수 있다(B 모드).

- 추상화 지점: `src/lib/llmBackend.ts`의 `llmCall()` 한 곳. 파이프라인·게이트·카드는 모드 무관 동일.
- 전송: dev proxy `/api/khala/*` → `https://mcp.khala.to/api/*` (Khala API키는 dev 서버 env `KHALA_API_KEY`로 주입, 브라우저 노출/CORS 없음).
- 비동기: 요청 send 후 응답을 NIE inbox에서 폴링, `correlationId`로 매칭.

## 설정 (settings)

| 필드 | 값 | 설명 |
|--|--|--|
| `llmBackend` | `'api'` \| `'agent'` | `api`=gemini 직결(본선), `agent`=위임(테스트) |
| `agentInboxCode` | string | 위임할 LLM 에이전트 inbox code (임의) |
| `khalaInboxCode` | string | 응답 수신용 NIE inbox code (recv session_code) |

UI 라벨: "완전 자동(API)" / "테스트: 내 LLM 위임".

## 메시지 규약 (LLM 무관)

### 요청 — NIE → 에이전트 (`khala_send`)
메시지 body는 아래 JSON 문자열:

```json
{
  "type": "nie_llm_request",
  "correlationId": "judgeTopic-<uuid>",
  "stage": "judgeTopic | generateStory | review | translate",
  "system": "<시스템 프롬프트>",
  "user": "<유저 프롬프트>",
  "expects": "json",
  "replyTo": "<NIE inbox code>"
}
```

### 응답 — 에이전트 → NIE (`khala_send`, recipient=`replyTo`)
```json
{
  "type": "nie_llm_response",
  "correlationId": "<요청과 동일>",
  "ok": true,
  "json": { /* stage가 기대하는 JSON 객체 그대로 */ },
  "error": "<ok=false일 때 사유>"
}
```

- `json`은 해당 stage가 A 모드에서 받던 것과 **동일 스키마**여야 한다(아래).
- `correlationId`는 요청 값을 그대로 되돌려준다(매칭 키).

## 에이전트 측 핸들러 (위임받는 LLM이 할 일)

1. 자기 inbox에서 `type: "nie_llm_request"` 메시지 수신.
2. `system` + `user`를 그대로 프롬프트로 LLM 추론 실행. **오직 valid JSON만** 생성(설명/마크다운 금지).
3. 결과를 `nie_llm_response`로 `replyTo` inbox에 회신(`correlationId` 그대로).
4. 실패 시 `ok:false, error:"..."`.

### stage별 기대 JSON 스키마
- `judgeTopic`: `{ "adequate": boolean, "excluded": boolean, "matched"?: string, "reason"?: string }`
- `generateStory`: `{ "summary": string, "headline": string, "body": string, "tags": string[], "imagePrompt": string, "sourceFacts": string[] }`
- `review`: `{ "findings": [{ "field": string, "pass": boolean, "issue"?: string }], "sensitive": { "flag": boolean, "reason"?: string } }`
- `translate`: `{ "summary": string, "headline": string, "body": string, "tags": string[] }`

(system 프롬프트에 정확한 출력 형식이 이미 지시되어 있으므로, 에이전트는 그대로 따르면 됨.)

## 타임아웃 / 실패 / 폴백
- 타임아웃 180s(턴기반이라 길게). 초과 → 호출 reject → 기존 fail 경로 그대로(judgeTopic 보류, generateStory 재시도).
- 폴백: API 키가 있으면 agent 실패 시 api로 폴백 가능(옵션, 미구현 시 단순 실패).

## 한계
- 에이전트는 턴기반 → 24h 완전무인 부적합. 반자동·소량·데모/키없음 e2e용.
- dev proxy 전용(배포본 B 미지원).

## 제거 (상용화)
1. `settings.llmBackend` 등 3필드 제거.
2. `src/lib/llmBackend.ts`의 "B(agent) 경로 — 격리 구역" 이하 전부 삭제.
3. `llmCall`을 `chatJson` 별칭으로 축소(또는 호출부를 chatJson으로 되돌림).
4. `vite.config.ts`의 `/api/khala` proxy 제거.
→ 핵심 파이프라인에 B 흔적 없음.
