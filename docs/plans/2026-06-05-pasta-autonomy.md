# Pasta 자율 발행 (24h 무인 + 신뢰도 게이트)

> 비전: 1인 운영, 사실상 24시간 무인 자동발행. 사람은 예외만.
> "작성≠검수"를 사람 체인 아닌 **자동 다단계 게이트(다른 LLM 교차검증)**로 구현.
> 정책: 평소 무인, **민감주제 + 게이트 불확실** 시만 사람 큐(2번=안전 자율).

## 검수 파이프라인 (자동 다단계)
```
③ 작성 (generation.llm = LLM-A)
  ↓
검수1 규칙(즉시·무료): 표기/소스 N≥2/1차매체/워터마크 URL/클로징
검수2 LLM 교차검증(finalReview.llm = LLM-B, A와 분리 권장): 팩트 정합/동명이인/톤/민감주제 분류
검수3 이미지 비전: 워터마크 시각판별(가능하면 비전모델)
  ↓ 종합 판정
```

## 판정 → 자율/사람 분기
각 게이트 결과 = pass / **block**(확정 위반) / **uncertain**(불확실).
- **block 0 AND uncertain 0 AND 민감 아님** → 🤖 자동발행(Hydra 핸드오프)
- 그 외(block 있음 / uncertain 있음 / 민감) → 🙋 사람 큐(보류 + 알림)

신뢰도 다이얼: uncertain 플래그가 자율성↔안전 조절. AI가 "애매" 하면 사람으로.

- 민감주제(논란/사건/건강) = 기본 **사람 보류**(쓸지/버릴지 사람 결정). 설정으로 자동스킵 전환 가능.
- 워터마크 비전 불가/애매 = uncertain → 사람.

## 데이터
- ReviewResult에 `needsHuman?: boolean` + `reasons: string[]` (uncertain/민감 사유).
- ReviewFinding severity에 'uncertain' 추가 or 게이트가 confidence 반환.
- 자동발행 조건 = `review.passed(block 0) && !review.needsHuman && autoPublish on`.
- 검수 LLM = finalReview.llm (작성 generation.llm과 다른 모델 권장 — 자기검토 편향 제거. 단계별 LLM 기획 활용).
- 민감주제 분류 = LLM-B 검수 항목.

## 무인의 기술 전제 (못 풀면 24h 자동 불가)
- 이미지 워터마크 **비전 자동판별** (URL 휴리스틱 한계 보완).
- 썸네일/CMS 주입 **Hydra API 자동화** (uploadifive 우회) — Pasta 밖, Hydra 의존.
- 이 둘 미해결 구간은 uncertain→사람으로 안전하게 흘림(자율 점진 확대).

## 분담
- NIE_개발(로직): 게이트 결과에 uncertain/confidence 추가, needsHuman 종합 판정, 민감주제 LLM 분류, 검수=LLM-B(finalReview.llm) 분리 호출.
- Engineer(UI/Context): 자동발행 분기(passed&&!needsHuman), 사람 큐 표시(보류 사유), 알림, ReviewResult.needsHuman 배선.
- Hydra(별도): 워터마크 비전, 썸네일/CMS API.

## 범위
v1: 다단계 자동검수 + uncertain/needsHuman 판정 + 신뢰도 기반 자동발행/사람분기 + 민감 사람보류. 비전/썸네일 자동화는 Hydra 협의(미해결 시 사람폴백).
