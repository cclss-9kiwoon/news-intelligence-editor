# 03 — 아키텍처

## 한눈에 보기

```
┌──────────────────────────────────────────────────────────────────────────┐
│                            브라우저 (SPA)                                 │
│                                                                          │
│  ┌────────────────┐    ┌──────────────────┐    ┌────────────────────┐   │
│  │   RSS 수집     │───▶│   클러스터링      │───▶│   워크벤치 + UI    │   │
│  │  (ArticlesCtx) │    │  (ClustersCtx)   │    │  (Components)      │   │
│  └────────────────┘    └──────────────────┘    └─────────┬──────────┘   │
│           ▲                                              │              │
│           │                                              ▼              │
│  ┌────────────────┐    ┌──────────────────┐    ┌────────────────────┐   │
│  │ rss2json (외부) │    │ localStorage      │    │  ConversionCtx     │   │
│  │ CORS proxy +   │    │ (settings, cache, │    │  (LLM 호출 흐름)   │   │
│  │ JSON 변환      │    │  history)         │    └─────────┬──────────┘   │
│  └────────────────┘    └──────────────────┘              │              │
│                                                          ▼              │
│                                                ┌────────────────────┐   │
│                                                │  promptChain.ts    │   │
│                                                │  - analyzeKorean   │   │
│                                                │  - translateDraft  │   │
│                                                │  - formatChannels  │   │
│                                                └─────────┬──────────┘   │
└──────────────────────────────────────────────────────────┼──────────────┘
                                                           ▼
                                          ┌──────────────────────────────┐
                                          │ OpenAI 호환 endpoint (외부)   │
                                          │ - api.openai.com              │
                                          │ - generativelanguage.google   │
                                          │ - 커스텀 (Groq 등)            │
                                          └──────────────────────────────┘
```

## 핵심 원칙

### 1. 백엔드 없음

자체 서버, DB, 인증 모두 없음. 모든 처리는 브라우저 단독:

- **RSS 수집**: rss2json (외부 무료 서비스)로 CORS 우회
- **LLM 호출**: OpenAI 호환 endpoint에 직접 fetch
- **저장**: localStorage (설정, RSS 캐시, 변환 이력)
- **인증**: 없음 — 단일 사용자 자기 브라우저

### 2. Provider 추상화

LLM Provider는 **OpenAI 호환 endpoint를 가진 어떤 서비스든** 가능:

```ts
// src/types.ts
export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  openai: { baseUrl: 'https://api.openai.com/v1', ... },
  gemini: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', ... },
  custom: { baseUrl: '', ... },
}
```

`src/lib/openai.ts`의 `chatJson()` 함수가 base URL을 인자로 받음:

```ts
const res = await fetch(buildEndpoint(args.baseUrl || DEFAULT_BASE_URL), {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${args.apiKey}`, ... },
  body: JSON.stringify({ model, messages, response_format: { type: 'json_object' } }),
});
```

새 Provider 추가는 `PROVIDERS` 객체에 항목 하나만 추가하면 됨.

### 3. 사람 검수 우선

LLM이 만든 모든 결과는 **editable textarea**로 표시:

- 한국어 종합 드래프트 (`src/components/Workbench.tsx`)
- 영문 번역 드래프트 (동일)
- 각 채널 출력 본 사이트 / X / Medium (`src/components/OutputTabs.tsx`)

사용자 편집 내용은 `ConversionContext.setDraftText`, `setChannelText`로 즉시 `currentResult`에 반영. 자동 재호출 없음.

### 4. 단방향 데이터 흐름

```
RSS → Article[] → Cluster[] (자동 + 수동 보정)
                       │
                       ▼
                   ConvertedResult (= 가치 평가 결과)
                       │
                       ▼
                drafts.ko / drafts.en (편집 가능)
                       │
                       ▼
            channels.ko / channels.en (편집 가능)
                       │
                       ▼
                   클립보드 → 외부
```

각 단계는 명시적인 사용자 액션으로 진행 (자동 트리거 X). LLM 호출 비용 통제와 사용자 통제권 확보.

## 5개 Context (상태 관리)

자세한 내용은 [06-state-management.md](./06-state-management.md) 참조. 한 줄 요약:

| Context | 책임 |
|---|---|
| `SettingsContext` | API 키, 모델, RSS 소스, 폴링 간격, 클러스터링 임계값 등 모든 설정. localStorage 동기화 |
| `ArticlesContext` | RSS 폴링, 직접 입력 기사, 캐시·백오프, articles[] 보관 |
| `ClustersContext` | articles → clusters 변환 (clustering.ts 호출), 수동 분리/합치기 override |
| `ConversionContext` | LLM 호출 흐름 (analyzeKorean, translate, formatChannels), currentResult 관리 |
| `HistoryContext` | localStorage 최근 20건 FIFO, 복원 |
| `BreakingContext` | 속보 감지, 알림음, 시뮬레이터 |

Provider 스택 (`src/App.tsx`):
```tsx
<SettingsProvider>
  <HistoryProvider>
    <ArticlesProvider>
      <ClustersProvider>
        <ConversionProvider>
          <BreakingProvider>
            <AppShell />
          </BreakingProvider>
        </ConversionProvider>
      </ClustersProvider>
    </ArticlesProvider>
  </HistoryProvider>
</SettingsProvider>
```

## 데이터 흐름 — 1건 변환 시 일어나는 일

```
[사용자] 클러스터 클릭 (ClusterPicker)
     │
     ▼
ClustersContext.selectCluster(clusterId)
  → selectedCluster, selectedArticles 갱신
     │
     ▼
[사용자] [✨ 가치 평가] 클릭 (Workbench)
     │
     ▼
ConversionContext.analyze(selectedArticles)
  → promptChain.analyzeKorean(articles, settings)
     → src/lib/openai.ts chatJson() — Provider HTTP 호출 1회
     → 결과: { valueScore, valueReason, facts, koreanDraft }
  → promptChain.buildInitialResult(articles, analyzed, settings)
     → ConvertedResult 객체 생성
  → setCurrentResult(result)
  → HistoryContext.addEntry(result)  // localStorage 자동 저장
     │
     ▼
Workbench가 currentResult 받음 → textarea에 koreanDraft 표시
FactCheckLog가 facts 칩 표시
     │
     ▼
[사용자] textarea 편집 → setDraftText(text) → currentResult.drafts.ko 갱신
     │
     ▼
[사용자] [EN] 토글 클릭 (Workbench)
     │
     ▼
ConversionContext.switchLanguage('en')
  → drafts.en 비어있으면 promptChain.translateDraft() 호출
  → activeLanguage = 'en' 변경
     │
     ▼
[사용자] textarea 편집 (영문) → setDraftText
     │
     ▼
[사용자] [EN 채널 생성] 클릭
     │
     ▼
ConversionContext.regenerateChannels()
  → promptChain.formatChannels({ draft, language: 'en', facts, settings })
     → 영문 본 사이트 + X + Medium 생성
  → channels.en, channelsGenerated.en = true
     │
     ▼
OutputTabs가 channels.en 표시 → 각 탭 editable textarea
     │
     ▼
[사용자] [복사] → clipboard.ts copyToClipboard() → 클립보드
     │
     ▼
[사용자] 외부 발행 도구에 붙여넣기
```

## 의존성 다이어그램 (주요)

```
src/App.tsx
  ├─ src/state/SettingsContext     (no deps)
  ├─ src/state/HistoryContext      → lib/storage
  ├─ src/state/ArticlesContext     → lib/rss → rss2json (외부)
  ├─ src/state/ClustersContext     → lib/clustering, ArticlesContext, SettingsContext
  ├─ src/state/ConversionContext   → lib/promptChain → lib/openai → Provider (외부)
  ├─ src/state/BreakingContext     → lib/breakingDetector, ArticlesContext, ClustersContext
  └─ src/components/*              → 각종 Context + lib/clipboard
```

## 외부 의존성

런타임:
- `react` 18, `react-dom` 18
- `lucide-react` (아이콘)
- `react-markdown` (Medium 미리보기, 가이드 모달)

개발:
- `vite`, `@vitejs/plugin-react`
- `typescript`, `@types/*`
- `tailwindcss`, `@tailwindcss/typography`, `postcss`, `autoprefixer`
- `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`

외부 서비스 (런타임 호출):
- **rss2json.com** — 한국 RSS 피드의 CORS 우회 + JSON 변환
- **OpenAI 호환 endpoint** — LLM 호출 (사용자 선택)

## 더 읽을 거리

- 파일별 책임: [04-directory-structure.md](./04-directory-structure.md)
- 타입 / 데이터 모델: [05-data-model.md](./05-data-model.md)
- 화면 단위 흐름: [07-screens.md](./07-screens.md)
