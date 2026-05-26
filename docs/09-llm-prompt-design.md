# 09 — LLM 프롬프트 설계

모든 LLM 통신은 `src/lib/openai.ts`의 `chatJson()`을 통해 이루어지며, 도메인 로직은 `src/lib/promptChain.ts`에 있습니다.

## chatJson — 공통 호출 래퍼

```ts
// src/lib/openai.ts
async function chatJson<T>(args: {
  apiKey: string;
  model: ModelId;
  system: string;
  user: string;
  temperature?: number;
  baseUrl?: string;
}): Promise<T>
```

요청 본문:
```json
{
  "model": "gemini-2.5-flash",
  "temperature": 0.5,
  "response_format": { "type": "json_object" },
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ]
}
```

- **response_format: json_object**: OpenAI/Gemini 모두 지원. LLM이 반드시 valid JSON 출력
- Authorization 헤더: `Bearer <apiKey>`
- 에러 시 `OpenAIError(message, status)` throw

JSON parse 실패 시에도 `OpenAIError`로 throw — 사용자에게 "Response was not valid JSON" 메시지 노출.

## Provider 추상화

```ts
// src/lib/openai.ts
const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

function buildEndpoint(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
}
```

settings.apiBaseUrl이 들어오면 그 base URL을 사용 — OpenAI 호환 endpoint 어디든 동작.

테스트된 Provider:
- OpenAI (`https://api.openai.com/v1`)
- Google Gemini (`https://generativelanguage.googleapis.com/v1beta/openai`)
- Groq (`https://api.groq.com/openai/v1`) — 호환됨, MODEL_OPTIONS만 추가하면 즉시 사용 가능

## 3단계 LLM 호출 구조 (promptChain.ts)

```
1. analyzeKorean(articles, settings)
   → 한국어 종합 드래프트 + facts + valueScore
2. translateDraft({ text, from, to, settings })
   → 반대 언어 드래프트
3. formatChannels({ draft, language, facts, settings })
   → 본 사이트/X/Medium 3채널 출력
```

### 1) analyzeKorean — 가치 평가 + 종합

**System Prompt**:
```
당신은 한국 연예/K-pop 분야의 시니어 에디터입니다.
여러 매체가 동일한 사건을 다룬 한국어 기사 N건을 입력으로 받습니다.
당신의 임무: 이 기사들을 교차검증하여 단일 한국어 종합 드래프트를 작성합니다.
각 매체를 따로 번역/요약하지 말고 한 편의 글로 합치세요.
숫자/날짜/이름이 매체 간 충돌하면 가장 일관된 값을 채택하고
마지막에 "Sources disagree on: ..."로 표기.
한 매체만 언급한 사실은 본문에 포함하되 인라인으로 "(◯◯ 보도)"로 출처 표시 가능.
톤/스타일: "<프리셋 라벨>" (한국어로). 가이드: <styleInstruction>
다음 영어 LLM 상투구는 본 글이 영어로 번역될 때도 등장해선 안 되니
사고 단계에서 회피: delve, in conclusion, furthermore, ...
people/numbers/places/dates 팩트를 원문 그대로 추출.
오직 valid JSON만 출력:
{
  "valueScore": 1-10 (뉴스 가치),
  "valueReason": string (간단한 이유, 한국어),
  "facts": { "people": string[], "numbers": string[], "places": string[], "dates": string[] },
  "koreanDraft": string (400-600자, 전문적인 톤)
}
```

**User Prompt** (N개 소스 enumerate):
```
[같은 사건을 다룬 N개 소스 기사]

--- 소스 1: <매체명> ---
제목: <title>
본문: <fullText or description>
발행: <pubDate>

--- 소스 2: <매체명> ---
...
```

**핵심 설계 결정**:
- 한국어 드래프트를 먼저 생성 (영문 X) — 사용자가 한국어로 검수
- 교차검증 명시 — 매체 간 충돌 시 표기 의무
- facts 추출 → 채널 생성 단계에서 prompt에 재주입 (사실 보존성 ↑)
- 영어 금지어 사고 단계 회피 — 번역 시 등장 방지

### 2) translateDraft — KO ↔ EN 번역

**System Prompt**:
```
You are a professional translator. Translate the given <from> draft into <to>.
Preserve facts exactly (people/numbers/places/dates). Keep paragraph structure.
Adopt the editorial style: <styleInstruction>
[to=='en'면] NEVER use these banned English phrases: delve, ...
[to=='ko'면] 평범하고 자연스러운 한국어로.
Respond ONLY with valid JSON: { "translated": string }
```

**User Prompt**: 원문 텍스트 그대로.

**핵심 설계**:
- 번역 + 스타일 가이드 동시 적용 — 단순 번역이 아니라 톤도 일관되게
- 단일 필드 JSON 출력 → 파싱 단순

### 3) formatChannels — 3채널 생성

언어별로 system prompt가 다름.

**Korean Version** (lang === 'ko'):
```
당신은 다채널 뉴스 포맷터입니다. 주어진 한국어 드래프트를 3개 채널에 맞게 변환하세요.
다음 핵심 팩트(인물/숫자/장소/날짜)는 가능한 한 본문에 포함시키세요: <factSummary>
톤/스타일: <styleInstruction>

채널 규칙:
1. site: 독립형 한국어 기사. 800-1200자. 헤드라인 + 리드 + 본문 + 마무리. 마크다운 없음.
2. x: X(트위터) 스레드, 5-8개 트윗, 각 280자 이내. 첫 트윗은 hook. "1/", "2/" 번호. 이모지 1-2개.
3. medium: 롱폼 블로그. 마크다운. H1 제목 + 이탤릭 부제 + H2 섹션(도입/본문/결론). 1500-2500자.

오직 valid JSON만 출력: { "site": string, "x": string, "medium": string }
```

**English Version** (lang === 'en'):
```
You are a multi-channel news formatter. Convert the given English draft into three channel-ready outputs.
You MUST preserve ALL of these extracted facts: <factSummary>
You MUST NEVER use banned words: delve, in conclusion, ...
Style: <styleInstruction>

Channel rules:
1. site: Standalone English article. 400-600 words. Headline + lead + body + closing. NO markdown.
2. x: Twitter thread, 5-8 tweets, each <= 280 chars. First tweet = hook. Number tweets "1/", "2/", etc. 1-2 emojis per tweet max.
3. medium: Long-form blog. Markdown. H1 title, italic subtitle, H2 section headers (Intro / Body / Conclusion). 800-1200 words.

Respond ONLY with valid JSON: { "site": string, "x": string, "medium": string }
```

**핵심 설계**:
- 채널별 분량을 명시 — LLM이 채널 특성에 맞춰 재작성
- facts 재주입 — 한국어 종합에서 추출한 사실이 채널 출력에도 포함되도록
- 영문은 금지어 필터 추가 — 한국어는 불필요
- JSON 응답 후 클라이언트에서 영문일 때만 `scan()`으로 금지어 검출

## 자동 재시도 — 금지어 1회 retry

`analyzeKorean`은 결과 `koreanDraft`에 금지어가 들어가면 자동으로 1회 재시도 (system prompt에 stricter note 추가):

```ts
let call1 = await chatJson(...);
if (!scan(call1.englishDraft).ok) {  // 한국어 단계에서는 영어 금지어가 거의 없지만 안전망
  call1 = await chatJson(..., stricter=true);
}
```

(현재 코드 상 `koreanDraft`에 영어 단어가 거의 없으므로 retry는 드물게만 발생.)

## 비용 / 토큰 추정 (Gemini 2.5 Flash 기준)

| 단계 | 입력 토큰 | 출력 토큰 | 비용* |
|---|---|---|---|
| analyzeKorean (2건 입력) | ~1,500 | ~700 | 무료 |
| translateDraft | ~1,000 | ~800 | 무료 |
| formatChannels (KO) | ~2,000 | ~2,500 | 무료 |
| formatChannels (EN) | ~1,500 | ~2,000 | 무료 |

*Gemini 무료 한도(일 1,500건) 안에 있으면 비용 0. 그 이상은 paid mode 단가 적용.

OpenAI 비교 (gpt-4o-mini 기준):
- 1사건 KO만 = ~$0.003
- 1사건 KO + EN = ~$0.006

## 프롬프트 수정 가이드

**스타일 프리셋 추가**:
1. `src/lib/styles.ts`의 `STYLE_PRESETS`에 항목 추가
2. SettingsModal의 select에 자동 반영 (별도 코드 X)

**채널 길이 변경**:
- `promptChain.ts`의 `buildChannelsSystem` 내 숫자 직접 수정

**금지어 추가**:
- `src/lib/bannedWords.ts`의 `BANNED_PATTERNS` 배열에 RegExp 추가
- promptChain의 `BANNED_LIST_FOR_PROMPT` 문자열도 함께 갱신 (LLM에게 알려주는 부분)

**Provider 추가**:
- `src/types.ts`의 `PROVIDERS` 객체에 항목 추가
- 모델 옵션도 함께 등록
- 코드 다른 곳 수정 불필요

## 디버깅 — LLM 요청·응답 보기

브라우저 DevTools Network 탭에서 `chat/completions` 요청 필터링:
- Request payload: system + user 메시지 확인
- Response: LLM JSON 응답 확인

문제 있으면 [12-troubleshooting.md](./12-troubleshooting.md) 참조.

## 다음

- 클러스터링이 N개 소스를 모으는 방식: [10-clustering.md](./10-clustering.md)
- 트러블슈팅: [12-troubleshooting.md](./12-troubleshooting.md)
