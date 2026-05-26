# 06 — 상태 관리 (Context)

이 프로젝트는 Redux/Zustand/Jotai 같은 외부 상태 관리 라이브러리를 사용하지 않고 **React Context 6개**로 관리합니다. 도메인이 크지 않고 cross-context 의존이 명확하기 때문.

## Provider 스택 (`src/App.tsx`)

```tsx
<SettingsProvider>          // 1. 모든 설정의 원천
  <HistoryProvider>          // 2. settings 의존성 없음
    <ArticlesProvider>       // 3. settings 사용 (RSS 폴링)
      <ClustersProvider>     // 4. articles + settings 사용
        <ConversionProvider> // 5. settings + history 사용
          <BreakingProvider> // 6. articles + clusters + settings 사용
            <AppShell />
          </BreakingProvider>
        </ConversionProvider>
      </ClustersProvider>
    </ArticlesProvider>
  </HistoryProvider>
</SettingsProvider>
```

순서 중요 — 안쪽 Provider가 바깥 Provider의 hook을 호출.

---

## 1. SettingsContext

**파일**: `src/state/SettingsContext.tsx`  
**저장**: `localStorage['nie:settings']` (자동 동기화)

### State

`settings: Settings` (전체 [05-data-model.md](./05-data-model.md#settings) 참조)

### Actions

| Action | 설명 |
|---|---|
| `setApiKey(k)` | Provider API 키 |
| `setRss2jsonApiKey(k)` | rss2json 키 (선택) |
| `setProvider(p)` | Provider 전환. baseUrl과 model을 PROVIDERS[p] 기본값으로 리셋. API 키도 비움 (보안) |
| `setApiBaseUrl(u)` | 커스텀 Provider일 때 사용자 입력 |
| `setModel(m)` | 모델 ID |
| `setStylePreset(p)` | 'kpop'/'ap'/'bloomberg'/'techcrunch'/'custom' |
| `setCustomStyleInstruction(s)` | custom 프리셋일 때 사용자 입력 |
| `setRssSources(rs)` | 전체 교체 |
| `toggleRssSource(id)` | 한 소스 enable 토글 |
| `setRssPollMinutes(n)` | 5/10/15/30/60 |
| `setClusterThreshold(n)` | 0.20~0.60 |
| `setSimulatorEnabled(b)`, `setSimulatorIntervalSec(n)` | 속보 시뮬레이터 |
| `setAlertSoundEnabled(b)`, `setBrowserNotificationsEnabled(b)` | 알림 |
| `resetSettings()` | DEFAULT_SETTINGS로 |

### 다른 Context가 사용하는 곳

- `ArticlesContext` — rssSources, rssPollMinutes, rss2jsonApiKey
- `ClustersContext` — clusterThreshold
- `ConversionContext` — apiKey, apiBaseUrl, model, stylePreset 등 (settings 통째로 promptChain에 전달)
- `BreakingContext` — alertSoundEnabled, simulatorEnabled 등

---

## 2. HistoryContext

**파일**: `src/state/HistoryContext.tsx`  
**저장**: `localStorage['nie:history']` (자동 동기화)

### State

`history: ConvertedResult[]` — 최신순. 최대 20건 FIFO.

### Actions

| Action | 설명 |
|---|---|
| `addEntry(entry)` | 추가 (앞에 prepend). 20건 초과 시 가장 오래된 항목 제거 |
| `removeEntry(id)` | 개별 삭제 |
| `clear()` | 전체 삭제 |

### 누가 호출하나

- `ConversionContext.analyze` — 가치 평가 직후 자동 저장
- `ConversionContext.switchLanguage` — 번역 후 갱신 저장
- `ConversionContext.regenerateChannels` — 채널 생성 후 갱신 저장

같은 사건의 진행 단계별로 여러 번 addEntry 호출되지만 id가 동일하므로 같은 entry로 덮어쓰지 않고 prepend됨. 이력 패널에서는 동일 id가 여러 번 나올 수 있음 (의도). 향후 dedupe 정책 추가 가능 — [13-roadmap.md](./13-roadmap.md).

---

## 3. ArticlesContext

**파일**: `src/state/ArticlesContext.tsx`

### State

```ts
articles: Article[]              // 최대 200개 (MAX_ARTICLES)
selectedArticle: Article | null  // (현재 사용 안 함 — 클러스터 기반으로 옮김)
```

### Actions

| Action | 설명 |
|---|---|
| `selectArticle(a)` | (deprecated, 호환용으로 유지) |
| `addManualArticle(input)` | 사용자 직접 입력 → Article 객체 생성 + articles에 추가 |
| `refreshNow()` | 즉시 폴링 (다음 30초 사이클 안 기다림) |

### 폴링 로직

- `setInterval(pollOnce, settings.rssPollMinutes * 60_000)`
- 비활성 탭일 땐 폴링 간격 × 3
- 최소 1분 보장 (`MIN_POLL_MS`)
- StrictMode/settings 변경에도 안정적이도록 `useRef` 패턴

`pollOnce`:
1. enabled RSS 소스 필터링
2. 각 소스 병렬 `fetchRss(s, rss2jsonKey)`
3. 결과 flat + `dedupeAndMerge` (기존 + 신규 합치고 200개 캡)
4. 같은 article id는 첫 등장값 우선 (existing-wins) → fetchedAt 기준 정렬

---

## 4. ClustersContext

**파일**: `src/state/ClustersContext.tsx`

### State

```ts
clusters: Cluster[]                          // 자동 + 수동 보정 적용 후 최종
selectedClusterId: string | null
selectedCluster: Cluster | null              // memoized
selectedArticles: Article[]                  // selectedCluster의 articleIds → articles

splitOut: Set<string>                        // 자동 클러스터에서 빼낸 article id들
manualMerges: Record<string, string>         // { 옮길 articleId: 합칠 anchorId }
mergeModeSourceId: string | null             // 이동 모드 활성 시
```

### Actions

| Action | 설명 |
|---|---|
| `selectCluster(id)` | 워크벤치에 표시할 클러스터 |
| `splitArticleOut(articleId)` | 자동 클러스터에서 분리해 단독 클러스터로 |
| `resetSplits()` | 모든 splitOut 리셋 |
| `startMergeMode(articleId)` | 이동 모드 시작 (UI에 [⬇ 여기로] 버튼 표시) |
| `cancelMergeMode()` | 이동 모드 취소 |
| `mergeIntoCluster(targetClusterId)` | mergeModeSourceId 기사를 target 클러스터로 합침 |
| `resetMerges()` | 모든 manualMerges 리셋 |

### 클러스터 derive 로직

`useMemo`:
1. `groupIntoClusters(articles, threshold)` → 자동 클러스터
2. `splitOut`에 있는 article은 자기 클러스터에서 빼서 별도 solo 클러스터로
3. `manualMerges`의 (mover, anchor) 쌍 — mover를 현재 위치에서 빼고 anchor가 속한 클러스터에 합침
4. `createdAt` 내림차순 정렬

자세한 알고리즘은 [10-clustering.md](./10-clustering.md).

---

## 5. ConversionContext

**파일**: `src/state/ConversionContext.tsx`

### State

```ts
status: 'idle' | 'analyzing' | 'translating' | 'generating' | 'error'
error: string | null
currentResult: ConvertedResult | null
```

### Actions

| Action | 설명 |
|---|---|
| `analyze(articles)` | 1차 LLM 호출. ConvertedResult 새로 생성. status: analyzing → idle |
| `setDraftText(text)` | 현재 active 언어 드래프트 직접 갱신 (LLM 호출 없음) |
| `setChannelText(channel, text)` | 현재 active 언어의 특정 채널 출력 직접 갱신 |
| `switchLanguage(target)` | target 언어 드래프트가 없으면 LLM 번역, 있으면 즉시 전환 |
| `regenerateChannels()` | 현재 active 언어 드래프트로 3채널 생성 |
| `loadResult(result)` | 이력에서 복원 |
| `clearError()` | 에러 메시지 제거 |

### 에러 메시지 변환

`toErrorMessage(err)`:
- `OpenAIError`(401) → "인증 실패 — API 키 다시 입력"
- `OpenAIError`(404) → "모델 ID 또는 base URL 잘못됨"
- `OpenAIError`(429) → "API 한도/잔액 초과 — Provider/모델 전환 또는 결제 확인"
- 그 외 → err.message 그대로

---

## 6. BreakingContext

**파일**: `src/state/BreakingContext.tsx`

### State

```ts
alerts: BreakingAlert[]      // 최대 5개, 30초 자동 dismiss
```

### Actions

| Action | 설명 |
|---|---|
| `dismissAlert(articleId)` | 특정 알림 제거 |
| `jumpToAlert(alert)` | 알림 article이 속한 클러스터 선택 (ClustersContext.selectCluster) + 알림 제거 |

### 효과

- `articles` 변경 시 새 기사들에 대해 `detect()` 실행 → 속보면 `pushAlert`
- `settings.simulatorEnabled` 시 setInterval로 mock 속보 발생
- `pushAlert`: 알림음 재생 + 브라우저 알림 (권한 시) + 30초 timer로 자동 dismiss

---

## Cross-context 호출 다이어그램

```
Settings ──→ Articles    (RSS 폴링 설정)
Settings ──→ Clusters    (threshold)
Settings ──→ Conversion  (모든 LLM 호출에 전달)
Settings ──→ Breaking    (알림 설정, 시뮬레이터)

Articles ──→ Clusters    (articles → clusters)
Articles ──→ Breaking    (새 기사 → detect)

Clusters ──→ Breaking    (jumpToAlert가 selectCluster 호출)

History  ←── Conversion  (analyze/translate/regenerate 후 addEntry)
```

순환 의존성 없음. Provider 순서가 모든 의존을 만족.

## Context 외부에서 Context 호출 (불가능 → 항상 hook)

모든 Context는 hook으로만 접근:

```tsx
const { settings, setApiKey } = useSettings();
const { clusters, selectCluster } = useClusters();
// ...
```

훅이 Provider 밖에서 호출되면 에러 throw — 모든 사용처가 AppShell 안쪽이라 안전.

## 다음

- 화면별 어떤 Context를 어떻게 쓰는지: [07-screens.md](./07-screens.md)
- LLM 호출 흐름 상세: [09-llm-prompt-design.md](./09-llm-prompt-design.md)
