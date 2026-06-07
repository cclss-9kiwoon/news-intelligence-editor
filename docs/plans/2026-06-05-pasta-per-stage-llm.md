# Pasta 단계별 LLM 오버라이드

> 단계마다 LLM 키/모델을 따로 꽂을 수 있게. 비우면 글로벌 기본값 상속.
> 목적: 단계별 모델 최적화(비용↓) + 키 분산(429 완화) + 단계 담당자별 본인 쿼터.

## 지금 (AS-IS)
- 글로벌 1개(`Settings.provider/apiKey/model/apiBaseUrl`)로 전 단계 호출.
- LLM 작동 지점:
  - ② 주제 검수: `judgeExcludedTopic` (제외주제 설정 시만)
  - ③ 기사 작성: `generateStory` (항상, **비용 본체**)
  - ④ 최종 검수: `reviewDraft`(검수규칙 LLM부분) + `translateToEnglish`(영문 출력 시) + 재생성(generateStory)
  - ① 기사 찾기: LLM 없음

## 제안 (TO-BE)
단계별 선택적 LLM 오버라이드. **강제 아님 — 비우면 글로벌 상속.**

### 데이터
```ts
type StageLLM = {            // 전부 optional, 비면 글로벌 상속
  provider?: ProviderId;
  apiKey?: string;
  model?: ModelId;
  baseUrl?: string;
};
```
- 캠페인 설정에 단계별로 부착:
  - `CampaignSettings.topicReview.llm?: StageLLM`   // ②
  - `CampaignSettings.generation.llm?: StageLLM`    // ③
  - `CampaignSettings.finalReview.llm?: StageLLM`   // ④
- 해석 헬퍼: `resolveStageLLM(stageLLM, globalSettings)` → 필드별 `stage.x ?? global.x`. 빈 키면 글로벌 키 사용.

### 호출부 연결
- `generateStory` → generation.llm 해석값 사용
- `judgeExcludedTopic` → topicReview.llm
- `reviewDraft` / `translateToEnglish` → finalReview.llm
- chatJson은 그대로(apiKey/model/baseUrl 인자 받음) — 호출부에서 해석된 값 주입.
- 재생성(워크스페이스) = ③ generation.llm 사용.

### UI (CampaignSettingsPanel ②③④ 각 단계)
- 접이식 "이 단계 LLM (비우면 기본 키 사용)" 섹션:
  - provider 드롭다운 / model / API 키 입력
  - [연결 테스트] + 상태 배지(⚪✅❌, 기존 ApiStatusBadge 재사용)
  - "기본값(글로벌) 사용 중" 표시 when empty
- 키 입력은 사용자가 직접. (PM/AI가 키 입력 안 함 — 보안)

## 비용 가이드(UI 안내 문구로)
- ②judge·④review = 가벼움 → 싼·빠른 모델 권장(flash/mini)
- ③writing = 비용 본체 → 품질 필요시만 고급 모델
- 단계별 무료 티어 키 분산 시 합산 한도↑ (429 완화)

## 범위
- v1: 데이터 + 해석 헬퍼 + 호출부 연결 + ②③④ UI 오버라이드 섹션.
- 마이그레이션: llm 미지정 = 글로벌 상속(기존 동작 그대로).

## 검증
- 오버라이드 없을 때 = 현행과 동일 동작.
- ③에만 다른 키 꽂으면 ③ 호출만 그 키로 나가는지(네트워크 확인).
- tsc 0 · vitest green.
