# Pasta 검수 게이트 강화 + HTML 네이티브 (실제 발행 에이전트 인터뷰 반영)

> 출처: akp-rw / akp_contents / akp-editor-publisher / akp-pm 인터뷰.
> 핵심 통찰: 갭 대부분이 "검수 과정". → ④ 검수를 **설정 가능한 게이트 묶음**으로.
> 발행 직전은 휴먼/멀티 게이트로 막되, 게이트를 풍부히 하면 자동발행 신뢰도↑.

## A. ④ 검수 = 설정 가능한 게이트 (핵심)
기존 `ReviewRule{id,label,instruction,severity:block|warn,enabled}` 구조 그대로 활용.
인터뷰 표준 게이트를 **프리셋으로 추가** + 사용자가 항목별 on·off·심각도 조절(캠페인 ④ 설정 UI).

표준 게이트 카탈로그 (allkpopPreset 기본 제공, 범용은 스키마):
| 게이트 | 방식 | 기본 심각도 |
|---|---|---|
| 소스 N≥2 교차검증 | 규칙(소스 수) | block |
| 1차 매체만(2차 영문 금지) | 규칙(화이트/블랙리스트) | block |
| 이미지 워터마크/출처 | URL 휴리스틱 + (가능시 비전) → 불확실하면 사람확인 | block |
| 자체 중복(의미) | allkpop 검색/의미중복 — 가능 범위, 아니면 warn | block/warn |
| 팩트 정합(날짜/수치/순위) | LLM 검수 | block |
| 동명이인/태그 오링크 | LLM 검수 | block |
| 민감주제(논란/사건/건강) | LLM 분류 → 휴먼게이트 강제 | block(자동발행 금지) |
| 표기 규칙(quotes/bold초회/헤드라인) | 규칙(regex) | warn |
| 클로징 첨언 금지 | 규칙(패턴) | warn |

- 규칙기반은 즉시검사(무료), LLM기반은 judge 호출(단계별 LLM = finalReview.llm 사용).
- 워터마크 시각판별은 URL/휴리스틱 한계 — 불확실 시 "사람 확인" 플래그(자동발행 보수적).

## B. ③ HTML 네이티브 출력
- generateStory body = **HTML로 생성**(CMS 직주입용). 텍스트→HTML 변환 통증(figure/bold재언급/빈<p>) 원천 회피.
- 표기·태그 규칙(quotes, bold 초회만, `<img>` 직접, `<a>` 금지, 빈 `<p>` 보존)을 생성 프롬프트 + 검수에 반영.

## C. ④ 에디터 = 사람이 텍스트로 편집
- ③이 HTML 만들지만, ④ 워크스페이스 에디터는 **사람이 텍스트처럼 보고 수정**(raw 태그 노출 X).
- WYSIWYG/렌더 편집(contenteditable 등) 또는 렌더뷰↔HTML소스 토글. 저장은 항상 HTML.
- 목표: 비개발자가 본문 자연스럽게 손보고, 결과물은 CMS용 HTML.

## D. 자동발행 = 게이트 통과 시만
- review.passed(=block 0건) 이면 Verified. 게이트 풍부해질수록 자동발행 자연히 강해짐.
- 민감주제 게이트 = 자동발행 강제 차단(사람).
- 썸네일/CMS 주입/이미지 업로드 = **발행(Hydra) 영역** — Pasta 스코프 밖. Pasta는 ④까지 + Hydra 핸드오프(드래프트 HTML + 이미지 후보 + 메타).

## 분담
- Engineer(UI/Context): ④ 검수설정 패널(게이트 on·off·심각도) + ④ 에디터 텍스트편집(WYSIWYG) + ③ HTML 출력 연동 + 자동발행 게이트 연동.
- NIE_개발(로직/lib): 게이트 규칙 로직(소스 N≥2, 워터마크 URL휴리스틱, 표기/클로징 regex) + LLM 검수 instruction(팩트/동명이인/민감) + allkpopPreset 게이트 시드.
- Hydra(별도): 썸네일 저장소·CMS 업로드 API.

## 범위
- v1: 검수 게이트 카탈로그 + 설정 UI + HTML 출력 + 텍스트 에디터 + 자동발행 게이트 연동.
- 비전 워터마크/allkpop 실검색 중복 = 가능 범위부터, 한계는 사람 플래그.
