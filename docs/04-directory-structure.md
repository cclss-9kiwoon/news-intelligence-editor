# 04 — 디렉토리 구조

```
news-intelligence-editor/
├── README.md                   # 프로젝트 진입점 (간결)
├── docs/                       # 이 문서 패키지 (인수인계용)
├── public/
│   ├── favicon.ico             # 브라우저 탭 아이콘 (placeholder)
│   └── ping.mp3                # 속보 알림음 (placeholder, 4KB)
├── src/
│   ├── main.tsx                # 엔트리. createRoot → <App />
│   ├── App.tsx                 # Provider 스택 + AppShell + 모달 관리
│   ├── index.css               # Tailwind directives + 글로벌 (튜토리얼 highlight)
│   ├── types.ts                # 모든 TypeScript 타입 한 곳
│   │
│   ├── components/             # 화면 컴포넌트 (10개)
│   ├── state/                  # React Context 6개
│   ├── lib/                    # 순수 함수 라이브러리 (11개)
│   ├── data/                   # 정적 데이터 (가이드 콘텐츠)
│   └── test/                   # Vitest setup
│
├── index.html                  # Vite 진입 HTML
├── vite.config.ts              # Vite + Vitest 설정
├── tailwind.config.js          # Tailwind + typography 플러그인
├── postcss.config.js           # PostCSS + autoprefixer
├── tsconfig.json               # TypeScript 컴파일러 옵션
├── package.json
└── .gitignore
```

## src/components/ — 화면 컴포넌트

| 파일 | 책임 | 주요 props/Context |
|---|---|---|
| `Header.tsx` | 상단 헤더. 타이틀, 가이드/이력/설정 버튼, 알림 카운트 | onOpen* 콜백들 |
| `AlertBanner.tsx` | 화면 상단 빨간 속보 배너 (BreakingContext) | — |
| `ClusterPicker.tsx` | 좌측 사이드바. 클러스터 목록 + 펼치기 + ⇄ Move / ✂ Split + 직접 입력 | ClustersContext, ArticlesContext |
| `Workbench.tsx` | 중앙. 원문 carousel + 종합 드래프트 textarea + KO/EN 토글 + 모델 dropdown + [채널 생성] | ClustersContext, ConversionContext, SettingsContext |
| `FactCheckLog.tsx` | 워크벤치 아래 정보 칩 ("원본에서 추출된 팩트") | ConversionContext |
| `OutputTabs.tsx` | 하단 본 사이트/X/Medium editable textarea + 복사 | ConversionContext |
| `SettingsModal.tsx` | ⚙ 설정 전체 (Provider, 키, 모델, RSS, 클러스터링, 알림 등) | SettingsContext, HistoryContext |
| `HistoryPanel.tsx` | 우측 슬라이드 패널. 최근 20건 변환 이력 | HistoryContext, ConversionContext |
| `GuideModal.tsx` | 📖 가이드 모달. 좌측 목차 + 우측 마크다운 본문 | (data/guideContent.ts) |
| `TutorialOverlay.tsx` | 단계별 튜토리얼 오버레이 (요소 강조 + popover) | (data/guideContent.ts) |

## src/state/ — Context

| 파일 | 책임 |
|---|---|
| `SettingsContext.tsx` | 모든 사용자 설정 (Provider, API 키, 모델, RSS 소스, 클러스터 임계값, 알림 등). localStorage 동기화 |
| `ArticlesContext.tsx` | RSS 자동 폴링 (settings.rssPollMinutes 기반), 직접 입력 기사 추가, articles[] 보관 |
| `ClustersContext.tsx` | articles → clusters 변환. 수동 분리(splitOut) / 합치기(manualMerges) override 보관 |
| `ConversionContext.tsx` | LLM 호출 흐름 (analyze → switchLanguage → regenerateChannels). currentResult + 편집 액션 |
| `HistoryContext.tsx` | localStorage 최근 20건 FIFO 관리. 항목 클릭 시 currentResult 복원 |
| `BreakingContext.tsx` | 속보 감지 (키워드/접두어), 알림음 재생, 시뮬레이터, 알림 → 클러스터 점프 |

자세한 책임/시그니처는 [06-state-management.md](./06-state-management.md).

## src/lib/ — 순수 함수

대부분 React-free, 테스트 친화적.

| 파일 | 역할 | 테스트 |
|---|---|---|
| `bannedWords.ts` | LLM 상투구 (delve, furthermore 등) 정규식 스캔 | ✅ `bannedWords.test.ts` |
| `breakingDetector.ts` | 기사 → BreakingAlert 변환. mock 생성기 포함 | ✅ `breakingDetector.test.ts` |
| `clipboard.ts` | navigator.clipboard 또는 legacy execCommand 폴백 | (no test) |
| `clustering.ts` | 엔티티 추출, 토큰화, Jaccard, similarity, groupIntoClusters | ✅ `clustering.test.ts` |
| `defaultSettings.ts` | 초기 설정 + 기본 RSS 소스 7개 | (no test) |
| `factCheck.ts` | facts vs 출력 매칭 (현재 UI에서는 정보용으로만 사용) | ✅ `factCheck.test.ts` |
| `openai.ts` | `chatJson()` — Provider 호환 fetch 래퍼 + OpenAIError | ✅ `openai.test.ts` |
| `promptChain.ts` | analyzeKorean / translateDraft / formatChannels / buildInitialResult | ✅ `promptChain.test.ts` |
| `rss.ts` | rss2json fetch, FNV-1a article ID, dedupe, 5분 캐시, 30분 backoff | ✅ `rss.fetch.test.ts` + `rss.test.ts` |
| `storage.ts` | localStorage JSON 래퍼 (quota-safe) | ✅ `storage.test.ts` |
| `styles.ts` | 5개 스타일 프리셋 (kpop/ap/bloomberg/techcrunch/custom) | ✅ `styles.test.ts` |

## src/data/

| 파일 | 내용 |
|---|---|
| `guideContent.ts` | `TUTORIAL_STEPS[]` (7단계) + `GUIDE_SECTIONS[]` (12개 가이드 섹션) — 모달/오버레이가 사용 |

## src/test/

| 파일 | 내용 |
|---|---|
| `setup.ts` | `import '@testing-library/jest-dom'` 단 한 줄 |

## docs/ — 인수인계 문서 (이 폴더)

| 파일 | 내용 |
|---|---|
| `README.md` | 인덱스 + 읽는 순서 |
| `01-overview.md` | 프로젝트 무엇·왜 |
| `02-getting-started.md` | 환경 세팅 |
| `03-architecture.md` | 전체 시스템 구조 |
| `04-directory-structure.md` | 이 파일 |
| `05-data-model.md` | 타입 / 인터페이스 |
| `06-state-management.md` | 6개 Context 상세 |
| `07-screens.md` | 화면 기획서 |
| `08-user-flows.md` | 유저 시나리오 |
| `09-llm-prompt-design.md` | 프롬프트 설계 |
| `10-clustering.md` | 클러스터링 알고리즘 상세 |
| `11-glossary.md` | 용어 정의 |
| `12-troubleshooting.md` | 트러블슈팅 |
| `13-roadmap.md` | 향후 작업 (참고용) |
| `superpowers/` | 작업 이력 (specs + plans) |

## 파일 책임 빠른 검색

| "X를 수정하려면?" | 파일 |
|---|---|
| RSS 소스 추가/변경 | `src/lib/defaultSettings.ts` 의 `DEFAULT_RSS_SOURCES` |
| 클러스터링 가중치 조정 | `src/lib/clustering.ts` 의 `ENTITY_WEIGHT`, `TITLE_WEIGHT` |
| 금지어 추가 | `src/lib/bannedWords.ts` 의 `BANNED_PATTERNS` |
| 스타일 프리셋 추가 | `src/lib/styles.ts` 의 `STYLE_PRESETS` |
| Provider 추가 (예: Groq) | `src/types.ts` 의 `PROVIDERS` |
| 채널 출력 길이/포맷 변경 | `src/lib/promptChain.ts` 의 `buildChannelsSystem` |
| 가이드 / 튜토리얼 내용 | `src/data/guideContent.ts` |
| 글로벌 CSS | `src/index.css` |
| 컴포넌트 추가 | `src/components/`, App.tsx에 mount |

## 다음

- 타입과 데이터 흐름: [05-data-model.md](./05-data-model.md)
- 각 Context 시그니처: [06-state-management.md](./06-state-management.md)
