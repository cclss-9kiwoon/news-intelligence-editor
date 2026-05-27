# NIE Phase 1 — 카테고리 기반 단일 소스 드래프트 엔진

작성일: 2026-05-27 · 상태: 설계 승인 대기

## Context (왜)

STEP 6에서 다채널 파이프라인을 "단일 가치 평가 + 드래프트 엔진"으로 축소했으나, 실제로 써보니 네 가지 문제가 드러났다:

1. **Pass/Fail 판정이 에디터 의도와 충돌** — K-pop·연예 큐레이터에게 드라마 방영 전 홍보는 *발행 대상*인데, 엔진이 "사실관계 분명한 하드뉴스" 기준으로 "발행 가치 낮음 → Fail" 판정했다.
2. **holdReason이 판단조** — "~ 발행 가치가 낮다고 판단됩니다"처럼 AI가 발행 여부를 결정. 사용자는 판단이 아니라 *빠른 파악용 요약*을 원함.
3. **본문에 내부 섹션 라벨이 박힘** — `## 2. 스토리텔링형 본문` 등 구분 라벨이 storyDraft에 그대로 들어가, 지우는 걸 깜빡하면 발행본에 노출될 위험.
4. **카테고리(렌즈) 부재** — 모든 기사를 동일 잣대로 평가. 장르별 기준이 없다.

원인은 "단일 자유 텍스트 필드(customStyleInstruction)"가 가치 기준을 흐릿하게 담은 것. 해결책은 **카테고리별 기준/말투 템플릿**을 도입하고, **발행 판정을 제거**하고, 출력을 **구조화 필드**로 쪼개 발행본을 깨끗하게 만드는 것.

## Goals (Phase 1)

- 카테고리(렌즈) 부활: 워크벤치 드롭다운에서 선택, 설정에서 템플릿 편집.
- Pass/Fail 제거 → 중립 요약(summary).
- 출력 구조화: `summary / headline / body / tags / imagePrompt`. `body`는 라벨 없는 발행용 본문.
- 필드별 개별 복사.

## Non-goals (이후 Phase)

- 드래프트를 초안으로 AI와 대화하며 수정 — **Phase 2**.
- AI 이미지 생성 + 다운로드 — **Phase 3**. 영상 생성은 백엔드 없는 SPA에 부적합 → 범위 외(프롬프트 복사 → 외부 툴 유지).

---

## 1. 데이터 모델

### Category
```ts
export type Category = {
  id: string;
  label: string;
  criteria: string;  // 선별/평가 기준 템플릿 (편집 가능)
  tone: string;      // 말투/문체 템플릿 (편집 가능)
};
```

기본 5종 (`src/lib/defaultCategories.ts` 신규, 각 criteria/tone 프리필 — 사용자가 직접 편집/추가):

| id | label | criteria(요지) | tone(요지) |
|---|---|---|---|
| `music` | 🎵 음악·K-pop | 컴백/신곡/음원·앨범, 차트·판매량, 콘서트. 구체 수치 우선. | 팬 친화·업계용어, 과장 자제, 짧은 문장 |
| `screen` | 🎬 드라마·영화·예능 | 방영·개봉 일정, 캐스팅, 줄거리·설정, 예고편, 시청률. **방영 전 홍보·티저도 정상 콘텐츠로 취급.** | 작품 소개 톤, 스포일러·과장 자제 |
| `people` | 🧑‍🎤 배우·아이돌 인물 | 특정 인물 활동·근황·인터뷰·화보·수상. 사실 중심. | 인물 중심 친근, 간결 |
| `gossip` | 💕 연애·결혼·가십 | 열애·결별·결혼 등 사생활. **출처·확인 여부 명확히**(공식 입장 vs 보도/추측 구분). | 신중, 단정 대신 출처 명시, 자극 자제 |
| `events` | 🏆 시상식·행사·차트 | 수상·후보·라인업·차트 순위·기록. 구체 사실 우선. | 정리·요약, 리스트성 명확 문장 |

### Settings 변경
- **추가**: `categories: Category[]`, `activeCategoryId: string`
- **제거**: `customStyleInstruction` (카테고리 criteria/tone가 대체)
- `SettingsProvider`가 이미 `DEFAULT_SETTINGS` 머지 → 구 설정 로드 시 categories 기본값 자동 주입.

### 엔진 출력 / ConvertedResult
```ts
export type StoryOutput = {
  summary: string;     // 중립 요약 1~2줄 (판단 X)
  headline: string;
  body: string;        // 발행용 깨끗한 본문 (섹션 라벨 없음)
  tags: string[];
  imagePrompt: string; // 순수 영문(Midjourney)
};

export type ConvertedResult = StoryOutput & {
  schemaVersion: 3;
  id: string;
  sourceArticleIds: string[];
  sourceTitle: string;
  createdAt: number;
  model: ModelId;
  categoryId: string;  // 사용한 렌즈
};
```
- `valueDecision` 제거, `holdReason`→`summary`, `storyDraft`→구조화 5필드.
- `schemaVersion: 3` → [HistoryContext](src/state/HistoryContext.tsx)의 로드 가드가 `=== 3`만 통과(v2 자동 폐기). 스토리지 키 그대로 재사용.

---

## 2. 엔진 (`src/lib/promptChain.ts`)

`generateStory(articles, settings, category): Promise<StoryOutput>`

- system 프롬프트에 `category.criteria` + `category.tone` 주입.
- 지시 요지:
  - **발행 여부를 판단하지 마라.** 이 카테고리 기준으로 사실을 정리·종합만 한다.
  - `summary`: 무엇에 관한 기사인지 중립적으로 1~2줄(누가/무엇/핵심). 가치 평가·권고 금지.
  - `body`: 라벨·머리표(`#`, `## 2.` 등) 없이 깨끗한 발행용 본문. 매체 간 충돌 시 가장 일관된 값 채택, 충돌 사실은 **summary에 명시**(발행본 body는 깨끗하게 유지).
  - 원문에 없는 사실 창작 금지(Hallucination). 핵심 엔티티 누락 금지.
  - `tags`: 해시태그 배열. `imagePrompt`: 순수 영문.
  - 영어 LLM 상투구(delve/furthermore 등) 회피.
- 출력: 정확히 위 5개 키 JSON.
- **후처리(안전망)**: `body`에서 `^#{1,6}\s*\d+\.` 패턴(섹션 라벨 잔재) 제거 + `scan(body)` 금지어 검출.
- `styles.ts`(getStyleInstruction/DEFAULT_STYLE_INSTRUCTION)는 카테고리 모델로 대체 → 제거. 컴파일 로직은 promptChain 내부로.

---

## 3. UI

### 워크벤치 헤더 ([Workbench.tsx](src/components/Workbench.tsx))
- 모델 셀렉터 옆에 **카테고리 `<select>`** 추가(`activeCategoryId`). `✨ 가치 평가 & 종합` 클릭 시 선택된 카테고리로 변환.

### 워크벤치 우측 — 필드별 박스
- `[요약] [헤드라인] [본문] [태그] [이미지 프롬프트]` 각 라벨 박스, 각자 편집 + **개별 복사 버튼**.
- 태그는 박스에서 공백/쉼표 구분 텍스트로 편집하고 내부적으로 `string[]`로 보관(복사 시 `#a #b` 형태).
- 생성 전 빈 상태: 각 박스 라벨/placeholder가 구조 안내 역할(스캐폴딩 텍스트는 실제 드래프트에 안 들어감).
- `setDraftText` → `setField(field, value)`로 일반화.

### 하단 미리보기 ([StoryPreview.tsx](src/components/StoryPreview.tsx))
- `headline + body`만 마크다운 렌더(발행 형태 확인). `summary`/`imagePrompt`는 발행 미리보기에서 제외.
- `body` 금지어 스캔 경고 유지.

### 설정 ([SettingsModal.tsx](src/components/SettingsModal.tsx)) — 2탭
- **탭 ⚙ AI·연결**: Provider/키/모델/RSS/클러스터링/알림 (기존 그대로 이동).
- **탭 🎯 카테고리**: 카테고리 목록 + 각 카테고리의 `label/criteria/tone` 편집, 카테고리 추가·삭제.

### 이력 ([HistoryPanel.tsx](src/components/HistoryPanel.tsx))
- Pass/Fail 표기 제거 → `생성시각 · 카테고리 label · sourceTitle`. (필요 시 summary 한 줄 미리보기)

---

## 4. 영향 받는 파일

- 신규: `src/lib/defaultCategories.ts`, `src/components/StoryPreview` 필드화(또는 분리)
- 수정: `types.ts`, `promptChain.ts`, `ConversionContext.tsx`, `HistoryContext.tsx`(v3 가드), `SettingsContext.tsx`, `SettingsModal.tsx`(탭), `Workbench.tsx`(셀렉터+필드박스), `StoryPreview.tsx`, `HistoryPanel.tsx`, `defaultSettings.ts`, `guideContent.ts`(문구)
- 제거: `src/lib/styles.ts`(+test)
- 테스트: `promptChain.test.ts`(새 스키마·카테고리 컴파일), `HistoryContext.test.tsx`(v3)

---

## 5. 검증 (Definition of Done)

1. `npm run build` 통과 — 제거 식별자(valueDecision/holdReason/storyDraft/customStyleInstruction/styles) 잔여 참조 0.
2. `npx vitest run` 전체 통과(갱신 테스트 포함).
3. `npm run dev` 수동:
   - 🎬 드라마 카테고리로 드라마 홍보 클러스터 변환 → **더 이상 깎이지 않고** 깨끗한 본문 생성.
   - `body`에 `##`/`#N.` 섹션 라벨 없음.
   - 필드별 개별 복사 동작, summary는 중립(판단 문구 없음).
   - 카테고리 드롭다운 전환 → 다른 렌즈로 재변환.
   - §5(imagePrompt) 순수 영문.
4. 새로고침 시 구 v2 이력 미로드(콘솔 에러 0).
