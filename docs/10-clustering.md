# 10 — 클러스터링 알고리즘

여러 매체의 같은 사건을 한 묶음으로 만드는 로직. `src/lib/clustering.ts`에 구현.

## 목적

매체 간 교차검증 가능하게 — 같은 사건을 다룬 N개 기사를 한 클러스터에 모아 LLM에 통째로 보내고 종합 드래프트 생성.

## 알고리즘

### 1단계: 엔티티 추출

`extractEntities(text)`:
- 영문 대문자 시작 단어 ≥ 2글자 (`BLACKPINK`, `Seoul`) — 정규식 `/\b[A-Z][A-Za-z]{1,}\b/g`
- 한국어 2~4글자 연속 (`아이유`, `소속사`) — `/[가-힣]{2,4}/g`
- 알려진 한국어 조사·어미 (KOREAN_PARTICLES) 제외
- Set으로 unique 보장

### 2단계: 토큰화

`tokenize(text)`:
- 구두점 제거 (`[](){}『』「」"'…—·` 등)
- 공백 분리
- 한국어 토큰: 조사·어미 strip (`은/는/이/가/을/를/의/에/와/과/로/도/만/에서/에게/했다/한다/됐다/되었다/이다/이라고/라고`)
- 영문 토큰: 소문자화 + stopwords 제거 (`the/a/an/is/are/was/...`)
- 최소 2글자

### 3단계: 유사도

```ts
similarity(a, b) = 0.6 × Jaccard(entitiesA, entitiesB)
                 + 0.4 × Jaccard(titleTokensA, titleTokensB)
```

- **Jaccard** = |A ∩ B| / |A ∪ B| (0~1)
- 엔티티는 제목+설명 합쳐서 추출
- 제목 토큰은 제목만 (설명은 노이즈 많음)
- 가중치 0.6/0.4: 엔티티(인물·장소)가 같은 사건의 가장 강한 시그널이라 더 중요

### 4단계: 그룹화 (greedy)

`groupIntoClusters(articles, opts)`:

1. 24시간 윈도우 필터 (옵션: `windowMs`)
2. 시간순으로 articles 순회
3. 각 article을 기존 cluster들의 첫 멤버(head)와 유사도 비교
4. 유사도 ≥ threshold(0.35 기본)인 첫 클러스터에 합류
5. 어디에도 안 맞으면 새 클러스터 시작

```
for article in articles:
  placed = false
  for cluster in buckets:
    if similarity(article, cluster[0]) >= threshold:
      cluster.push(article)
      placed = true
      break
  if not placed:
    buckets.push([article])
```

복잡도: O(n × k) — n 기사, k 클러스터 수. 200개 기준 충분히 빠름.

### 5단계: Cluster 객체 생성

각 bucket에 대해:
- `id`: articleIds를 sorted한 후 FNV-1a hash → `'c-' + hexHash`. 같은 멤버 조합은 항상 같은 ID (안정성)
- `articleIds`: bucket 멤버
- `representativeTitle`: 가장 최근(`fetchedAt` 최대) article의 제목
- `entities`: 모든 멤버의 엔티티 합집합
- `createdAt`: 가장 최근 fetchedAt

## 파라미터 / 기본값

```ts
const DEFAULTS = {
  threshold: 0.35,         // ⚙ 설정에서 0.20~0.60 슬라이더로 조절
  windowMs: 24 * 3600_000  // 24시간
};
const ENTITY_WEIGHT = 0.6;
const TITLE_WEIGHT = 0.4;
```

## ClustersContext의 보정 레이어

자동 클러스터링 결과 위에 사용자 수동 보정 적용:

### splitOut (Set<articleId>)
- 자동 클러스터에서 빼냄
- 해당 article은 단독 클러스터 (`id: 'solo-' + articleId`)로 분리

### manualMerges (Record<articleId, anchorId>)
- mover article을 anchor article이 속한 클러스터로 강제 합침
- splitOut에 있어도 manualMerges가 우선 (override)

### 적용 순서

```
auto clusters from groupIntoClusters
  ↓ apply splitOut: split-out된 article들을 solo 클러스터로 분리
  ↓ apply manualMerges: mover를 anchor 위치로 이동
  ↓ sort by createdAt desc
```

자세한 코드: `src/state/ClustersContext.tsx` `useMemo`.

## 케이스 스터디

### 케이스 1: 같은 사건 묶기 성공

```
A: "BLACKPINK 5월 25일 서울 컴백 발표" (연합, 인물: BLACKPINK)
B: "BLACKPINK Comeback Teaser Drops" (Soompi, 인물: BLACKPINK)

entitiesA = {BLACKPINK, Seoul}
entitiesB = {BLACKPINK}
entSim = Jaccard = 1/2 = 0.5

titleA = {blackpink, 5월, 25일, 서울, 컴백, 발표}
titleB = {blackpink, comeback, teaser, drops}
공통: {blackpink}
titleSim = 1/9 ≈ 0.11

similarity = 0.6 × 0.5 + 0.4 × 0.11 = 0.344
→ 0.35 미만으로 살짝 부족. threshold 0.30이면 묶임.
```

→ K-pop 기사처럼 매체 간 표기 차이(영문/한글)가 크면 0.30~0.35로 조절 권장.

### 케이스 2: 다른 사건이 인물만 같음 (분리되어야 함)

```
A: "BLACKPINK 5월 컴백" (연합)
B: "BLACKPINK 멤버 지수 결혼" (스포츠서울)

entitiesA = {BLACKPINK}
entitiesB = {BLACKPINK, 지수}
entSim = 1/2 = 0.5

titleA = {blackpink, 5월, 컴백}
titleB = {blackpink, 멤버, 지수, 결혼}
공통: {blackpink}
titleSim = 1/6 = 0.17

similarity = 0.6 × 0.5 + 0.4 × 0.17 = 0.368
→ 0.35 살짝 넘김 → 같은 클러스터로 묶일 수 있음 ✗

대응: 사용자가 [✂ Split] 또는 임계값을 0.40~0.45로 올림.
```

→ 인물 1명만 잡힌 짧은 제목은 분리 어려움. 수동 보정 + 임계값 조절 필요.

### 케이스 3: 한·영 표기 차이로 분리

```
A: "BLACKPINK 컴백 발표" (Soompi 영문)
B: "블랙핑크 컴백 발표" (연합 한글)

entitiesA = {BLACKPINK}     ← 영문만 추출
entitiesB = {블랙핑크}        ← 한글만 추출  
entSim = 0  ← 일치 안 함

titleA = {blackpink, 컴백, 발표}
titleB = {블랙핑크, 컴백, 발표}
공통: {컴백, 발표}
titleSim = 2/4 = 0.5

similarity = 0 + 0.4 × 0.5 = 0.2
→ 0.35 미만 → 다른 클러스터로 분리 ✗

대응: 사용자가 [⇄ Move]로 수동 합치기. 또는 향후 한·영 동일시 사전 추가 (Roadmap).
```

## 한계 + 향후 개선 후보

| 한계 | 후보 해결책 (참고용, [13-roadmap.md](./13-roadmap.md)에 있음) |
|---|---|
| 한·영 표기 다름 (BLACKPINK ≠ 블랙핑크) | 동일시 사전 추가, 또는 LLM 기반 normalization |
| 인물 1명만 잡혀 다른 사건도 묶임 | 이벤트 동사 추가 (컴백/결혼/입대 등) 별도 가중치 |
| 짧은 제목 (3 토큰 이하) 매칭 어려움 | 본문 일부 토큰도 가중치 적게 추가 |
| greedy → 순서 의존 | hierarchical/k-means로 교체. 비용은 ↑ |
| 시간 윈도우 고정 24h | 사용자 조절 옵션 (⚙ 설정) |

## 테스트

`src/lib/clustering.test.ts` — 16개 케이스:
- extractEntities, tokenize, jaccard 단위
- similarity 시나리오 (높은/낮은)
- groupIntoClusters greedy 동작, 시간 윈도우, ID 안정성

## 다음

- 사용자가 보는 화면 흐름: [07-screens.md](./07-screens.md), [08-user-flows.md](./08-user-flows.md)
- 향후 개선 후보: [13-roadmap.md](./13-roadmap.md)
