# 07 — 화면 기획서

이 프로젝트는 **단일 페이지 앱(SPA)**이며 라우터를 사용하지 않습니다. 모든 화면은 하나의 페이지에서 모달/패널/사이드바 토글로 표시됩니다.

## 전체 레이아웃

```
┌────────────────────────────────────────────────────────────────────────┐
│ 📰 News Intelligence Editor [MVP] [?]   [📖 가이드][📜 이력][⚙ 설정][🔔]│ ← Header
├────────────────────────────────────────────────────────────────────────┤
│ 🚨 [속보 배너 — 있을 때만, 30초 자동 사라짐]                            │ ← AlertBanner
├────────────────────────────────────────────────────────────────────────┤
│ ⚠ OpenAI API 키가 설정되지 않았습니다. [설정 열기]                       │ ← Missing key warning
├──────────────┬─────────────────────────────────────────────────────────┤
│              │  📝 클러스터 제목 · N개 소스    [모델][✨ 가치 평가]      │
│ 🗂 사건 목록  │ ─────────────────────────────────────────────────────── │
│  (cluster    │  ┌────────────────┬───────────────────────────────┐     │
│   list)      │  │  원문 carousel │  종합 드래프트 textarea         │     │
│              │  │  (← 1/N → )    │  [KO|EN] [채널 (재)생성]        │     │
│              │  │                │                                 │     │
│              │  │  ...           │  ...                            │     │
│              │  └────────────────┴───────────────────────────────┘     │
│              │  ℹ 원본에서 추출된 팩트 (참고용)                          │ ← FactCheckLog (정보 칩)
│              │  ─────────────────────────────────────────────────────  │
│              │  [본 사이트][X 스레드][Medium]  단어 / 글자 [복사]        │ ← OutputTabs
│              │  editable textarea (현재 active 언어 채널)                │
└──────────────┴─────────────────────────────────────────────────────────┘
```

레이아웃은 `flex` + `grid` 조합. 좌측 사이드바 폭 340px 고정, 나머지가 워크벤치 + 출력.

## 1. Header

**파일**: `src/components/Header.tsx`

| 영역 | 컴포넌트 |
|---|---|
| 좌측 | 📰 타이틀 + MVP 뱃지 + [?] 튜토리얼 버튼 |
| 우측 | [📖 가이드] / [📜 이력] / [⚙ 설정] / 🔔 알림 카운트 |

[?] 클릭 → `TutorialOverlay` 열림  
[📖 가이드] → `GuideModal` 열림  
[📜 이력] → `HistoryPanel` (우측 슬라이드)  
[⚙ 설정] → `SettingsModal`

## 2. AlertBanner

**파일**: `src/components/AlertBanner.tsx`

`BreakingContext.alerts`가 비어있지 않으면 가장 최신(첫) 알림을 빨간 펄스 배너로 표시.

| 요소 | 동작 |
|---|---|
| ⚠ severity 뱃지 | 'medium' / 'high' / 'critical' |
| 기사 제목 | 한 줄 truncate |
| 🧪 시뮬레이션 라벨 | inputType==='simulator'일 때만 |
| [지금 변환 →] | jumpToAlert → 클러스터 선택 |
| [×] | dismissAlert |

30초 후 자동 사라짐.

## 3. ClusterPicker (좌측 사이드바)

**파일**: `src/components/ClusterPicker.tsx`

### 상단 헤더

`🗂 사건 (N) · 기사 M` + [✂ 리셋] / [🔄 새로고침] / [＋ 직접 입력]

### 직접 입력 패널 (＋ 토글)

- 제목 (선택)
- 원본 URL (선택)
- 본문 textarea
- [추가] → `addManualArticle`

### 이동 모드 배너

`mergeModeSourceId`가 있을 때만 표시 — 파란 배너 + 어떤 기사를 옮기는 중인지 + [×] 취소

### 클러스터 목록

각 클러스터:
- ▶/▼ 펼치기 토글
- N건 뱃지 + 🚨 속보 뱃지 + 매체명들
- 대표 제목 (line-clamp-2)
- 🔖 엔티티들 (상위 5개)
- 이동 모드 시: 우측 [⬇ 여기로] 버튼 (클릭 시 합치기)

### 클러스터 펼침 시 (멤버 기사 리스트)

각 기사:
- 매체명 + 🧪 시뮬레이터 표시
- 제목 (line-clamp-2)
- 원문 ↗ 링크 (외부)
- [⇄ Move] — 이동 모드 시작
- [✂ Split] — 단독 분리 (1건짜리 클러스터는 표시 안 함)

## 4. Workbench (중앙 워크벤치)

**파일**: `src/components/Workbench.tsx`

### 헤더

| 위치 | 요소 |
|---|---|
| 좌측 | 클러스터 대표 제목 + N개 소스 |
| 우측 | Provider 뱃지 + 모델 select + [✨ 가치 평가 & 종합 (한국어)] |

### 에러 배너

`status==='error'`이면 빨간 배너 표시. 사용자 [닫기]로 해제.

### 본문 (2단)

#### 좌측 — 원문 carousel

`selectedArticles[sourceIdx]`만 표시. 헤더에 `N/M` + [← →] 페이지네이션 (N>1일 때).

표시 내용:
- 매체명 뱃지
- 발행 시간
- 제목
- 본문 (`fullText` || `description`)
- 원문 보기 ↗ 링크

#### 우측 — 종합 드래프트

헤더:
- "종합 드래프트 · 가치 N/10"
- 분석/번역/생성 진행 시 상태 표시
- [KO|EN] segmented control — 클릭 시 `switchLanguage`
- [채널 (재)생성] — `activeLanguage` 기준

본문:
- valueReason (italic, gray)
- editable textarea (현재 active 언어 드래프트)
- 비어있을 때 placeholder

## 5. FactCheckLog (정보 칩)

**파일**: `src/components/FactCheckLog.tsx`

워크벤치와 OutputTabs 사이.

표시:
- ℹ "원본에서 추출된 팩트 — 채널 출력에 포함되도록 LLM에 전달했습니다 (참고용)"
- facts의 인물·숫자·장소·날짜를 카테고리별 색상 칩으로 나열

**경고/차단 동작 없음** — 단순 정보. 발행 막지 않음.

## 6. OutputTabs (하단 채널 출력)

**파일**: `src/components/OutputTabs.tsx`

### 상태

- `currentResult` 없으면 "변환 결과가 여기에 표시됩니다"
- `channelsGenerated[activeLanguage] === false`면 "[채널 생성] 버튼을 눌러주세요" 안내
- 생성됐으면 본문 표시

### 헤더

- 탭 [본 사이트] [X 스레드] [Medium]
- 현재 언어 뱃지 (KO/EN)
- 우측: 단어 / 글자 / 금지어(있으면) / [미리보기↔편집 토글 — Medium만] / [복사]

### 본문

각 채널은 editable textarea (Medium은 [미리보기] 시 ReactMarkdown 렌더).

금지어 있으면 하단에 빨간 안내.

## 7. SettingsModal (⚙)

**파일**: `src/components/SettingsModal.tsx`

전체 모달 (90vh max). 섹션들:

1. **AI Provider** — OpenAI / Gemini / 커스텀 라디오 + custom일 때 base URL 입력
2. **API 키** — Provider 라벨에 맞춤 + 👁 토글
3. **rss2json API 키** (선택)
4. **모델** — Provider의 모델 라디오 + 커스텀 ID 입력 칸
5. **글 스타일** — 프리셋 select + custom 일 때 instruction textarea
6. **RSS 소스** — 체크리스트 + URL 표시 + 🗑 삭제 + 추가 폼 + 폴링 간격 select
7. **사건 묶기 민감도** — 0.20~0.60 슬라이더
8. **알림** — 시뮬레이터 활성/주기, 알림음, 브라우저 알림 권한
9. **이력 관리** — 전체 삭제 버튼

## 8. HistoryPanel (📜)

**파일**: `src/components/HistoryPanel.tsx`

우측에서 슬라이드 인. 너비 384px.

각 항목:
- 생성 시각 (ko-KR locale) · 스타일 프리셋 · 가치 N/10
- 사건 제목
- KO 채널 / EN 채널 뱃지 (해당 언어 생성됐을 때만)
- 금지어 뱃지 (영문 채널에 있을 때)
- 🗑 개별 삭제

클릭 시 `loadResult(h)` 호출 → 워크벤치 복원 → 패널 닫힘.

## 9. GuideModal (📖)

**파일**: `src/components/GuideModal.tsx`

대형 모달 (90vh).

- 좌측: 12개 섹션 목차 (`GUIDE_SECTIONS`)
- 우측: 마크다운 본문 (`ReactMarkdown` + Tailwind typography)

ESC / ✕ / 백드롭 클릭으로 닫기.

## 10. TutorialOverlay (?)

**파일**: `src/components/TutorialOverlay.tsx`

화면 하단 가운데에 popover (480px). 단계별:

- 진행 표시 (1/7)
- 제목 + 본문 (whitespace-pre-line)
- [이전] [다음] / 마지막엔 [상세 가이드 보기]
- ESC / 키보드 ← → 지원

타겟 셀렉터가 있는 단계는 해당 element에 indigo ring + 화면 나머지를 dim (`.nie-tutorial-highlight` CSS).

## 모달/패널 z-index 순서

| 레이어 | z-index |
|---|---|
| Header / 본문 | 0 |
| Tutorial highlight target | 55 |
| AlertBanner (sticky) | normal |
| TutorialOverlay popover | 60 |
| HistoryPanel | 40 |
| SettingsModal / GuideModal | 50 |

## 반응형?

데스크탑 가정 (최소 1024px 권장). 모바일은 의도적 비목표.

## 다음

- 실제 사용 시나리오: [08-user-flows.md](./08-user-flows.md)
- 컴포넌트가 호출하는 LLM 흐름: [09-llm-prompt-design.md](./09-llm-prompt-design.md)
