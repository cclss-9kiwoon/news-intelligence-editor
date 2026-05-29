# NIE (News Intelligence Editor) — 인수인계 문서

> 작성일: 2026-05-29
> 마지막 커밋: d589c21 (main)
> 미커밋 변경: 16파일, +1010 / -83 lines

---

## 1. 프로젝트 개요

한국 연예 뉴스 편집자를 위한 **브라우저 전용 React SPA**. RSS/네이버 뉴스에서 기사를 수집하고, 같은 이슈 기사를 클러스터링한 뒤, LLM(OpenAI/Gemini 호환)으로 종합 드래프트를 생성한다.

**핵심 워크플로:**
```
기사 수집 → 자동 클러스터링 → 이슈 선택 → ✨ 가치 평가 & 종합 → 드래프트 편집 → CMS 붙여넣기
```

**스택:** Vite 6 + React 19 + TypeScript + TailwindCSS 4 + Bun (패키지 매니저)
**배포:** GitHub Pages (정적 빌드), 프록시는 dev only (프로덕션은 Cloudflare Pages Functions 예정)

---

## 2. 디렉토리 구조

```
src/
├── App.tsx                    # 루트 — 6개 Context Provider 중첩
├── types.ts                   # 모든 타입 정의
├── components/
│   ├── Header.tsx             # 상단 네비게이션
│   ├── AlertBanner.tsx        # 속보 알림 배너
│   ├── ClusterPicker.tsx      # 좌측: 이슈 목록 + 카테고리 필터 + 수동입력
│   ├── Workbench.tsx          # 우측 상단: 원문 뷰어 + 드래프트 편집 + 이미지 후보
│   ├── StoryPreview.tsx       # 우측 하단: 종합 결과 미리보기
│   ├── SettingsModal.tsx      # 설정 모달 (5탭: AI, RSS, 알림, 프롬프트, 카테고리)
│   ├── HistoryPanel.tsx       # 이력 패널
│   ├── GuideModal.tsx         # 사용 가이드
│   ├── TutorialOverlay.tsx    # 튜토리얼
│   └── VerticalSplitter.tsx   # 드래그 리사이즈 스플리터
├── state/
│   ├── SettingsContext.tsx     # 설정 관리 (localStorage + 파일 백업)
│   ├── ArticlesContext.tsx     # 기사 수집/enrichment 파이프라인
│   ├── ClustersContext.tsx     # 자동 클러스터링 + 수동 분리/합치기
│   ├── ConversionContext.tsx   # LLM 변환 상태 (analyze → story → translate)
│   ├── BreakingContext.tsx     # 속보 감지
│   └── HistoryContext.tsx      # 드래프트 이력 (localStorage)
├── lib/
│   ├── scraper.ts             # ★ 전문 추출 파이프라인 (Jina + proxy 이중)
│   ├── naver.ts               # 네이버 검색 API + #dic_area 추출
│   ├── rss.ts                 # RSS 피드 파싱 (rss2json 프록시)
│   ├── promptChain.ts         # LLM 프롬프트 조립 + story 생성 + 번역
│   ├── openai.ts              # OpenAI 호환 API 클라이언트
│   ├── clustering.ts          # Jaccard 유사도 기반 클러스터링
│   ├── storage.ts             # localStorage 래퍼 + 파일 백업
│   ├── defaultSettings.ts     # 기본 설정값 (RSS 소스, 프롬프트 등)
│   ├── defaultCategories.ts   # 5개 기본 카테고리
│   ├── breakingDetector.ts    # 속보 키워드 감지
│   ├── clipboard.ts           # 클립보드 유틸
│   └── bannedWords.ts         # 금지 표현 체크
└── test/
    └── setup.ts               # vitest 셋업
```

---

## 3. 데이터 흐름 (전체 아키텍처)

```
                          ┌─────────────────────┐
                          │   SettingsContext    │
                          │ (provider, model,    │
                          │  API keys, prompt    │
                          │  config, categories) │
                          └──────────┬──────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              ▼                      ▼                      ▼
    ┌─────────────────┐   ┌─────────────────┐   ┌──────────────────┐
    │ ArticlesContext  │   │ ConversionCtx   │   │  BreakingContext  │
    │                  │   │                  │   │                  │
    │ RSS fetch        │   │ generateStory()  │   │ keyword detect   │
    │ Naver fetch      │   │ translateEN()    │   │ alert banner     │
    │ enrichment       │   │ result state     │   │                  │
    └───────┬──────────┘   └────────┬─────────┘   └──────────────────┘
            │                       │
            ▼                       ▼
    ┌─────────────────┐   ┌─────────────────┐
    │ ClustersContext  │   │  HistoryContext  │
    │                  │   │                  │
    │ groupIntoClusters│   │ localStorage     │
    │ manual split/    │   │ max 20 entries   │
    │ merge            │   │                  │
    └─────────────────┘   └─────────────────┘
```

### 3-1. 기사 수집 파이프라인 (ArticlesContext)

```
fetchClassifyAndEnrich()  ← 마운트 시 + 폴링 (rssPollMinutes 간격)
│
├── hasNaver? (네이버 API 키 있으면)
│   ├── fetchNaverArticles(queries)    ← 네이버 검색 API
│   │   ├── searchNaver() × N queries  ← /api/naver-search 프록시
│   │   ├── dedupe by link
│   │   └── extractNaverArticle()      ← /api/naver-article 프록시 → #dic_area 파싱
│   │       └── returns Article[] with fullText + images
│   │
│   └── fetchRss(enabledSources)       ← 보조 소스 (Soompi, 연합뉴스 등)
│
├── !hasNaver
│   └── fetchRss(enabledSources) only
│
├── classifyArticleCategory(article)   ← 키워드 매칭 (music/screen/people/gossip/events)
├── setArticles(dedupeAndMerge)        ← 즉시 화면에 표시
│
└── 배경 enrichment (fullText 없는 기사)
    └── enrichArticlesWithFullText()
        └── extractArticleText(url)    ← ★ 이중 파이프라인
            ├── Korean site? → extractViaProxy() → extractViaJina() fallback
            └── Other site?  → extractViaJina()  → extractViaProxy() fallback
```

### 3-2. 전문 추출 파이프라인 (scraper.ts) ★ 이번 세션에서 재작성

```
extractArticleText(url)
│
├── isKoreanSite(url)?  (.kr, naver.com, daum.net, chosun.com, etc.)
│   │
│   ├── 1차: extractViaProxy(url)
│   │   ├── naver URL → extractNaverArticle() → #dic_area 셀렉터
│   │   └── 기타 → /api/naver-article?url=... → HTML fetch → DOMParser
│   │       └── ARTICLE_SELECTORS 순회 (#dic_area, article, [itemprop], etc.)
│   │       └── 이미지 전체 수집 (img 태그 → ArticleImage[])
│   │
│   └── 2차 (폴백): extractViaJina(url)
│       └── /api/extract?url=... → Jina Reader API (r.jina.ai)
│       └── JSON 응답 파싱 (content, images)
│       └── 레이트 리밋: 3.5초 간격 (~17 req/min)
│
└── !isKoreanSite(url)?
    │
    ├── 1차: extractViaJina(url)
    └── 2차 (폴백): extractViaProxy(url)

반환: ExtractResult { ok, title, text, thumbnail, images[], method }
```

### 3-3. LLM 종합 파이프라인 (promptChain.ts)

```
generateStory(articles, settings, category)
│
├── enrichMissingFullText(articles)      ← on-demand: fullText 없는 기사 재추출
│
├── buildStorySystem(category, settings) ← 시스템 프롬프트 조립
│   ├── settings.promptConfig.editorRole
│   ├── settings.promptConfig.publishingGuide
│   ├── settings.promptConfig.taskInstructions
│   ├── category.criteria + category.tone
│   ├── settings.referenceArticles (있으면 예시로 포함)
│   ├── settings.promptConfig.bannedExpressions
│   └── 출력 포맷 (JSON 6키: summary, headline, body, tags, imagePrompt, sourceFacts)
│
├── buildStoryUser(articles)             ← 유저 프롬프트 (기사 N건 나열)
│
└── chatJson<StoryOutput>(...)           ← OpenAI 호환 API 호출
    └── sanitizeBody() 후처리
```

### 3-4. 클러스터링 (clustering.ts)

```
groupIntoClusters(articles, { threshold, windowMs })
│
├── 시간 윈도우 필터 (1h/24h/7d/30d)
├── 각 기사 쌍의 유사도 계산
│   ├── extractEntities() → 고유명사 추출 (한국어 2~4자, 영어 대문자)
│   ├── tokenize() → 토큰화 (한국어 조사 제거, 영어 불용어 제거)
│   └── similarity = 0.6 × jaccard(entities) + 0.4 × jaccard(title_tokens)
├── threshold(0.35) 이상이면 같은 클러스터
└── 수동 split/merge는 ClustersContext에서 관리
```

---

## 4. Vite Dev Server 프록시 구성 (vite.config.ts)

```
localhost:5180 (strictPort: true)
│
├── /api/naver-article?url=<encoded>     ← naverArticleProxy() 플러그인
│   └── 아무 URL의 HTML을 fetch해서 반환
│   └── EUC-KR 등 charset 자동 감지 (Content-Type → meta 태그 → TextDecoder)
│
├── /api/extract?url=<encoded>           ← Vite proxy → https://r.jina.ai/{url}
│   └── Jina Reader API (Accept: application/json)
│
├── /api/naver-search?query=&display=    ← Vite proxy → https://openapi.naver.com/v1/search/news.json
│   └── 클라이언트가 X-Naver-Client-Id/Secret 헤더 전달
│
└── /api/settings-backup                 ← settingsBackupPlugin()
    ├── GET  → .nie-settings-backup.json 읽기 (없으면 404)
    └── POST → .nie-settings-backup.json 쓰기
```

---

## 5. 타입 시스템 (types.ts)

### 핵심 타입

```typescript
ArticleImage { url, alt?, caption?, source? }

Article {
  id, title, description, fullText?, link, pubDate, source,
  inputType: 'rss' | 'url' | 'paste' | 'simulator',
  category?, thumbnail?, images?: ArticleImage[], isBreaking?, fetchedAt
}

Cluster { id, articleIds[], representativeTitle, entities[], createdAt }

StoryOutput { summary, headline, body, tags[], imagePrompt, sourceFacts?[] }

ConvertedResult = StoryOutput & {
  schemaVersion(3), id, sourceArticleIds[], sourceTitle, createdAt,
  model, categoryId, en?: TranslatedFields
}

Settings {
  provider: 'openai' | 'gemini' | 'custom',
  apiKey, apiBaseUrl, rss2jsonApiKey, model,
  categories: Category[], activeCategoryId,
  articleWindow: '1h' | '24h' | '7d' | '30d' | 'breaking',
  rssSources: RssSource[], rssPollMinutes, clusterThreshold,
  simulatorEnabled, simulatorIntervalSec,
  alertSoundEnabled, browserNotificationsEnabled,
  naverClientId, naverClientSecret, naverQueries[],
  promptConfig: PromptConfig, referenceArticles: ReferenceArticle[]
}

PromptConfig { editorRole, publishingGuide, taskInstructions, bannedExpressions }
ReferenceArticle { id, url, title, body, fetchedAt }
Category { id, label, criteria, tone }
```

---

## 6. 설정 저장 구조

```
localStorage (port-scoped: localhost:5180)
├── nie:settings          ← Settings 전체 JSON
├── nie:history.v2        ← ConvertedResult[] (max 20)
└── nie:workbench-collapsed ← boolean

.nie-settings-backup.json  ← 파일 기반 백업 (API 키 포함, gitignored)
└── Settings 변경될 때마다 2초 debounce로 자동 저장
└── localStorage 비어있으면(포트 변경 등) 자동 복원
```

---

## 7. 이번 세션 변경사항 (미커밋)

### 7-1. Phase 1: 전문 추출 안정화

**파일:** `src/lib/scraper.ts` (완전 재작성, 388줄)

| 이전 | 이후 |
|------|------|
| HTML proxy만 사용 (`/api/naver-article`) | Jina Reader + HTML proxy 이중 파이프라인 |
| 모든 URL 동일 경로 | 한국 사이트=proxy 우선, 해외=Jina 우선 |
| 첫 이미지만 thumbnail | 모든 이미지 ArticleImage[] 수집 |
| enrichViaNaver() 의존 | 독립 추출 (Naver API 키 불필요) |

핵심 함수:
- `extractArticleText(url)` — 진입점. isKoreanSite()로 분기
- `extractViaJina(url)` — Jina Reader API, 레이트 리밋 3.5초
- `extractViaProxy(url)` — HTML proxy + DOMParser
- `enrichArticlesWithFullText()` — 배치 enrichment (MAX_CONCURRENT=3)

### 7-2. Phase 2: 프롬프트 설정 시스템 (이전 세션에서 완료)

이미 구현 완료:
- `PromptConfig` 타입 + `DEFAULT_PROMPT_CONFIG` 기본값
- Settings 모달 "✏️ 프롬프트" 탭 (4개 textarea + 기본값 복원 버튼)
- 레퍼런스 기사 URL 등록 (최대 5개, 전문 추출 후 저장)
- `buildStorySystem()`이 promptConfig에서 동적 조립

### 7-3. Phase 3: 이미지 소싱

**파일:** `src/types.ts`, `src/lib/naver.ts`, `src/components/Workbench.tsx`

| 이전 | 이후 |
|------|------|
| `Article.thumbnail?: string` (1개) | `Article.images?: ArticleImage[]` (전체) |
| 기사당 1개 이미지 표시 | 클러스터 내 모든 기사의 이미지 모아서 표시 |
| 출처 표시만 | 출처 + 캡션 오버레이 |

Workbench 이미지 패널:
- 클러스터 내 모든 기사의 images[] + thumbnail을 합침
- URL 기준 중복 제거
- 클릭 → URL 복사
- 출처 매체명 (하단 오버레이) + 캡션 (상단 오버레이)

### 7-4. 설정 파일 백업

**파일:** `vite.config.ts`, `src/lib/storage.ts`, `src/state/SettingsContext.tsx`

문제: localStorage가 port-scoped라서 포트 변경(5173→5180) 시 API 키 손실
해결:
- `settingsBackupPlugin()` — Vite 플러그인, `/api/settings-backup` GET/POST
- `backupSettingsToFile()` — 2초 debounce 자동 저장
- `restoreSettingsFromFile()` — 마운트 시 localStorage 비었으면 복원
- `hasUserConfig()` — apiKey/naverClientId 등 존재 여부 체크

### 7-5. 기타 변경

- `ArticlesContext.tsx` — proxyStatus 항상 'available' (Jina는 API 키 불필요)
- `ClusterPicker.tsx` — proxyStatus 조건 제거, 상태 텍스트 단순화
- `promptChain.ts` — on-demand 추출 시 images/thumbnail도 설정

---

## 8. 알려진 이슈 / 기술 부채

### Critical (코드 리뷰에서 발견)

1. **설정 백업에 API 키 평문 저장** — `/api/settings-backup` GET이 인증 없이 모든 키 노출. 같은 localhost의 다른 프로세스가 읽을 수 있음. → 민감 필드 제외하거나 토큰 체크 필요

2. **`/api/naver-article` SSRF** — 아무 URL이나 fetch 가능 (file://, 내부 IP 등). → URL 스킴/IP 검증 필요

### Medium

3. **React 상태 직접 변경** — `enrichMissingFullText()` (promptChain.ts)와 `enrichArticlesWithFullText()` (scraper.ts)가 Article 객체를 직접 mutate. React 리렌더 누락 가능. → 반환값으로 merge하는 패턴으로 변경

4. **배경 enrichment 레이스 컨디션** — 폴링과 enrichment .then()이 겹치면 stale 데이터 merge 가능

5. **`forceRefresh`가 `inFlightRef` 가드 안 거침** — 수동 새로고침과 자동 폴링 동시 실행 가능

6. **`scraper.ts` ↔ `naver.ts` 순환 임포트** — 현재 동작하지만 fragile

### Low

7. `proxyStatus` 상태가 항상 'available'인데 아직 Context에 남아있음 → 제거
8. `isProxyAvailable()` 항상 true 반환, 데드 코드 → 제거
9. `extractSourceName`의 도메인맵에서 `www.sbs.co.kr` 키가 www. 제거 후 매칭 안 됨
10. 이미지 URL 필터 (`icon`, `logo` 포함 제외)가 정상 이미지도 걸러낼 수 있음

### Pre-existing

11. **4개 테스트 파일(18개 테스트) 실패** — jsdom 환경에서 localStorage undefined. setup.ts에 localStorage mock 필요
12. **프로덕션 프록시 미구현** — 현재 모든 프록시가 Vite dev server 전용. Cloudflare Pages Functions 이관 필요

---

## 9. 로컬 개발 환경

```bash
# 패키지 매니저: bun (npm 아님!)
bun install
bun run dev          # http://localhost:5180
bun run build        # dist/ 정적 빌드
bunx vitest run      # 테스트 (54 pass, 18 pre-existing fail)
bunx tsc --noEmit    # 타입 체크
```

### 필요한 API 키 (Settings 모달에서 입력)

| 키 | 용도 | 필수? |
|----|------|-------|
| LLM API 키 (OpenAI/Gemini) | 기사 종합 드래프트 생성 | ✅ 드래프트 생성에 필수 |
| 네이버 Client ID/Secret | 네이버 검색 API (기사 소스) | ❌ 없어도 RSS로 동작 |
| rss2json API 키 | RSS 파싱 프록시 | ❌ 없으면 직접 파싱 시도 |

### 포트

- **5180** (strictPort: true) — 다른 포트로 안 바뀜
- 주의: 다른 프로젝트들이 5173~5175 사용 중 (Deriva, Kookie, allkpop shorts)

---

## 10. 주요 컴포넌트 동작

### ClusterPicker (좌측 340px)
- 이슈 목록: 클러스터별 대표 제목, 건수, 매체명, 엔티티 태그
- 카테고리 필터: 전체/음악·K-pop/드라마·영화·예능/배우·아이돌/연애·결혼/시상식
- 수동 분리(Split): 기사를 클러스터에서 빼서 단독 이슈로
- 수동 합치기(Merge): 기사를 다른 클러스터로 이동
- 직접 입력(+): 제목+URL+본문 수동 추가
- 전문 수집 상태: 녹색 점 + "N건 전문 확보"

### Workbench (우측 상단)
- 원문 탭: 클러스터 내 기사 순회 (◀ ▶)
- 드래프트 편집: 헤드라인, 본문, 태그, AI 이미지 프롬프트
- 원문 이미지 후보: 클러스터 전체 이미지 수평 스크롤, 클릭=URL 복사
- ✨ 가치 평가 & 종합 버튼: LLM 호출

### StoryPreview (우측 하단)
- 종합 결과 마크다운 렌더링
- 소스 팩트 체크리스트 (sourceFacts)
- KO/EN 토글
- 복사 버튼 (마크다운/플레인텍스트)

### SettingsModal (5탭)
1. ⚙ AI·연결: Provider(OpenAI/Gemini/커스텀), API 키, 모델 선택
2. 📡 RSS·클러스터: RSS 소스 on/off, 네이버 API 키, 검색 쿼리, 폴링 간격
3. 🔔 알림: 속보 사운드, 브라우저 알림, 시뮬레이터
4. ✏️ 프롬프트: 에디터 역할, 발행 가이드, 작업 지침, 금지 표현, 레퍼런스 기사
5. 🎯 카테고리: 카테고리 추가/수정/삭제 (label, criteria, tone)

---

## 11. 다음 작업 후보

1. **Critical 보안 이슈 수정** — 설정 백업 API 키 노출 + SSRF
2. **React mutation 패턴 수정** — enrichment 결과를 immutable하게 merge
3. **프로덕션 프록시** — Cloudflare Pages Functions로 /api/* 이관
4. **테스트 환경 수정** — jsdom localStorage mock 추가 (18개 테스트 복구)
5. **proxyStatus / isProxyAvailable 데드 코드 제거**
6. **순환 임포트 정리** — scraper ↔ naver 공통 로직을 별도 모듈로
