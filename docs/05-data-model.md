# 05 — 데이터 모델 / 타입

모든 타입은 `src/types.ts` 한 파일에 정의되어 있습니다.

## RssSource

```ts
type RssSource = {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
};
```

⚙ 설정에서 사용자가 enable/disable 토글. localStorage에 저장.

## Article

수집된 기사 한 건. RSS, 직접 입력(URL/text), 시뮬레이터 모두 동일 구조.

```ts
type Article = {
  id: string;                  // FNV-1a hash of normalized link
  title: string;
  description: string;         // 요약 (HTML stripped)
  fullText?: string;           // 직접 입력 시 원문 전체
  link: string;                // 원본 URL
  pubDate: string;             // RFC 822 (rss2json 기본)
  source: string;              // 매체명 (RssSource.name 또는 "URL 입력"/"직접 입력")
  inputType: 'rss' | 'url' | 'paste' | 'simulator';
  category?: string;
  thumbnail?: string;
  isBreaking?: boolean;        // detect() 결과
  fetchedAt: number;           // Date.now() at collection time
};
```

### id 생성

`src/lib/rss.ts` `makeArticleId`:
1. `normalizeLink(link)` — utm_* 쿼리 파라미터 제거
2. FNV-1a 32bit hash → hex 문자열

같은 기사가 utm tracking만 다른 URL로 들어와도 동일 ID로 매칭됨.

## Cluster

같은 사건으로 묶인 기사 집합.

```ts
type Cluster = {
  id: string;                  // 'c-' + FNV hash of sorted articleIds, or 'solo-X', 'manual-Y'
  articleIds: string[];
  representativeTitle: string; // 가장 최근 기사의 제목
  entities: string[];          // 인물/엔티티 통합 (UI 표시용)
  createdAt: number;           // 가장 최근 fetchedAt
};
```

`src/lib/clustering.ts` `groupIntoClusters()`가 자동 생성. ClustersContext에서 splitOut/manualMerges 적용 후 최종 결과 도출.

## Facts / FactReport

```ts
type Facts = {
  people: string[];
  numbers: string[];
  places: string[];
  dates: string[];
};

type FactReport = {
  ok: boolean;
  missing: Array<{ category: keyof Facts; value: string }>;
};
```

- `Facts` — LLM이 한국어 종합 단계에서 추출한 핵심 사실. ConvertedResult에 항상 저장
- `FactReport` — `factCheck.ts verify()` 결과 (예전 사용). 현재는 UI에서 사용하지 않음. 타입 자체는 향후 검증 기능 추가 가능성 때문에 보존

## DraftLanguage

```ts
type DraftLanguage = 'ko' | 'en';
```

워크벤치/채널 출력의 현재 표시 언어.

## Provider 모델

```ts
type ProviderId = 'openai' | 'gemini' | 'custom';

type ModelOption = {
  id: string;
  label: string;
  note?: string;
};

type ProviderConfig = {
  id: ProviderId;
  name: string;
  baseUrl: string;
  models: ModelOption[];
  keyLabel: string;
  keyHelp: string;
};

const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  openai: { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', ... },
  gemini: { name: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', ... },
  custom: { name: '커스텀', baseUrl: '', ... },
};
```

새 Provider 추가는 `PROVIDERS`에 항목 하나 추가하면 됨 — 코드 다른 곳 수정 불필요.

## Settings

```ts
type Settings = {
  // Provider 관련
  provider: ProviderId;
  apiKey: string;
  apiBaseUrl: string;          // 커스텀일 때 사용자 입력값
  model: ModelId;              // string (Provider별로 다름)

  // RSS
  rss2jsonApiKey: string;
  rssSources: RssSource[];
  rssPollMinutes: number;      // 5/10/15/30/60

  // 클러스터링
  clusterThreshold: number;    // 0.20~0.60

  // 스타일
  stylePreset: StylePresetKey;
  customStyleInstruction: string;

  // 알림
  simulatorEnabled: boolean;
  simulatorIntervalSec: number;
  alertSoundEnabled: boolean;
  browserNotificationsEnabled: boolean;
};
```

localStorage 키: `nie:settings`. `SettingsContext`가 자동 동기화.

## ChannelKey / ChannelSet / ChannelBannedHits

```ts
type ChannelKey = 'site' | 'x' | 'medium';

type ChannelSet = {
  site: string;
  x: string;
  medium: string;
};

type ChannelBannedHits = Record<ChannelKey, string[]>;
```

## AnalyzeKoreanOutput

LLM 1차 호출의 JSON 응답 스키마.

```ts
type AnalyzeKoreanOutput = {
  valueScore: number;          // 1-10
  valueReason: string;
  facts: Facts;
  koreanDraft: string;         // 400-600자
};
```

`promptChain.analyzeKorean()` 반환.

## ConvertedResult

가치 평가 결과 + 변환 진행 상태를 한 곳에 모은 워크벤치의 "현재 작업물".

```ts
type ConvertedResult = {
  id: string;                  // `${anchorArticleId}-${createdAt}`
  sourceArticleIds: string[];  // 묶인 클러스터의 모든 article id
  sourceTitle: string;         // 가장 최근 기사 제목 (이력 표시용)
  createdAt: number;

  // LLM 분석 결과
  valueScore: number;
  valueReason: string;
  facts: Facts;

  // 양 언어 드래프트 (편집 가능)
  drafts: { ko: string; en: string };
  activeLanguage: DraftLanguage;

  // 양 언어 채널 출력 (편집 가능)
  channels: { ko: ChannelSet; en: ChannelSet };
  channelsGenerated: { ko: boolean; en: boolean };
  bannedHits: { ko: ChannelBannedHits; en: ChannelBannedHits };

  // 메타
  stylePreset: StylePresetKey;
  model: ModelId;
};
```

- `drafts.en` / `channels.en` / `channelsGenerated.en` 모두 처음엔 빈 상태
- 사용자가 [EN] 토글하면 `drafts.en` 채워짐 (LLM 번역 1회)
- 사용자가 [EN 채널 생성] 클릭하면 `channels.en`, `channelsGenerated.en = true`
- 양 언어가 메모리에 함께 보존되어 KO/EN 토글로 자유롭게 전환

이력 저장 시 ConvertedResult 통째로 직렬화 (localStorage). 복원 시에도 통째로 복원 — 편집본 모두 유지.

## 상태 머신 다이어그램 — ConvertedResult 진행 상태

```
[ null ]
   │
   │ analyze(articles)
   ▼
[ ko: draft, en: '', channels.ko: empty, channels.en: empty,
  channelsGenerated: { ko:false, en:false } ]
   │
   ├─── setDraftText (ko 편집) → drafts.ko 갱신
   │
   ├─── switchLanguage('en')
   │      │  drafts.en 비어있으면 translateDraft 호출
   │      ▼
   │   [ activeLanguage: 'en', drafts.en 채워짐 ]
   │
   ├─── regenerateChannels()  // activeLanguage='ko'일 때
   │      ▼
   │   [ channels.ko 채워짐, channelsGenerated.ko: true ]
   │
   ├─── regenerateChannels()  // activeLanguage='en'일 때
   │      ▼
   │   [ channels.en 채워짐, channelsGenerated.en: true ]
   │
   └─── setChannelText(channel, text) → channels[activeLanguage][channel] 갱신
```

## BreakingAlert

```ts
type BreakingAlert = {
  article: Article;
  matchedKeywords: string[];
  severity: 'medium' | 'high' | 'critical';
  firedAt: number;
  dismissedAt?: number;
};
```

`breakingDetector.detect(article)` 반환. `BreakingContext`가 보관.

## ChannelOutput (LLM raw)

```ts
type ChannelOutput = {
  site: string;
  x: string;
  medium: string;
};
```

`formatChannels`의 LLM 응답 JSON. ChannelSet과 동일 구조지만 의미 분리 (LLM 응답 vs 저장값).

## 데이터 흐름 도표

```
RssSource[] (settings.rssSources)
       │  rss.ts fetchRss
       ▼
Article[] (ArticlesContext.articles)
       │  clustering.ts groupIntoClusters
       ▼
Cluster[] (ClustersContext.clusters)
       │  사용자 클릭
       ▼
selectedCluster + selectedArticles
       │  ConversionContext.analyze
       ▼
ConvertedResult                            ┌─→ HistoryContext (localStorage)
       │  사용자 편집·번역·채널 생성       │
       ├──────────────────────────────────┘
       │  사용자 [복사]
       ▼
   clipboard (브라우저)
       │  사용자 외부 발행
       ▼
   X / Medium / 본 사이트 CMS
```

## 다음

- Context별 상세 시그니처: [06-state-management.md](./06-state-management.md)
- 화면별 어떤 타입을 어디서 보여주는지: [07-screens.md](./07-screens.md)
