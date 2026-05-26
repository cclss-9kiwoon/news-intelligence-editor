# 11 — 용어 정의서

알파벳/가나다 순으로 자주 쓰이는 용어 정리.

## A

### activeLanguage
`ConvertedResult.activeLanguage` 필드. 'ko' 또는 'en'. 워크벤치 textarea와 채널 출력에 표시되는 현재 언어. KO/EN 토글로 전환.

### analyzeKorean
`promptChain.ts`의 함수. 클러스터의 N개 기사를 LLM에 보내 한국어 종합 드래프트 + valueScore + facts 생성. LLM 호출 1회 (재시도 시 2회).

### Article
수집된 기사 한 건. RSS, 직접 입력(URL/text), 시뮬레이터 모두 동일한 `Article` 타입. id는 link로부터 FNV-1a 해시.

## B

### Backoff (rss2json)
`src/lib/rss.ts`. RSS 소스가 429 응답을 받으면 그 소스를 30분간 호출하지 않음. localStorage 마커로 추적. 다른 소스에는 영향 없음.

### BannedWords
영어 LLM 상투구. `src/lib/bannedWords.ts`에 정규식 패턴 9개. delve / in conclusion / furthermore / testament / moreover / "it is important to note" / "not only ... but also" / "as an AI" / "I think/believe/feel".

### Breaking
속보. `src/lib/breakingDetector.ts`가 제목/본문에서 [속보]/[단독]/[긴급] 접두어 또는 키워드 (결혼/이혼/사망/컴백 등) 매칭으로 감지. severity: critical / high / medium.

## C

### chatJson
`src/lib/openai.ts`의 함수. OpenAI 호환 endpoint에 POST 요청. `response_format: json_object` 강제. 모든 LLM 호출의 공통 래퍼.

### ChannelKey
'site' | 'x' | 'medium'. 3개 출력 채널 식별자.

### ChannelSet
`{ site, x, medium }` 구조. 한 언어의 3채널 출력 텍스트.

### Cluster (사건)
같은 사건을 다룬 기사들의 묶음. `src/lib/clustering.ts`에서 자동 생성, `ClustersContext`에서 수동 보정 적용.

### clusterThreshold
`Settings.clusterThreshold`. 0.20~0.60 사이. 두 기사의 유사도가 이 값 이상이면 같은 클러스터로 묶임. 기본 0.35.

### ConvertedResult
워크벤치의 "현재 작업물". 가치 평가 + 한국어/영문 드래프트 + 양 언어 3채널 + 메타 정보. localStorage 이력에 저장됨.

### CORS proxy
브라우저에서 다른 도메인 RSS를 직접 fetch할 수 없어, [rss2json.com](https://rss2json.com)이 중간에서 가져와 JSON으로 변환해주는 서비스.

## D

### draftLanguage
'ko' | 'en'. activeLanguage의 별칭.

### dedupeAndMerge
`src/lib/rss.ts`. 기존 articles + 신규 articles를 합치고 id 기준 중복 제거. 기존 entry 우선 (existing-wins). 200개 캡 + fetchedAt 내림차순.

## E

### Entity (엔티티)
사람·조직·지명 등 고유명사. `extractEntities(text)`로 추출. 영문 대문자 시작 단어 + 한국어 2~4글자.

## F

### Facts
`{ people, numbers, places, dates }`. 한국어 종합 단계에서 LLM이 원본 기사에서 추출한 핵심 사실. 채널 생성 시 prompt에 재주입 + FactCheckLog 정보 칩에 표시.

### FactCheckLog
컴포넌트. 워크벤치 아래 facts 칩 표시. **경고가 아니라 정보**. 발행 차단 안 함.

### FactReport
`{ ok, missing }`. `factCheck.ts verify()` 결과. 현재 UI에서는 사용 안 함. 타입은 보존.

### FNV-1a
Article ID 생성에 쓰는 빠른 비암호 해시. 32bit hex.

### formatChannels
`promptChain.ts`의 함수. 현재 언어 드래프트를 받아 3채널 출력 생성. LLM 호출 1회.

## G

### Gemini
Google AI Studio의 Gemini API. OpenAI 호환 endpoint 제공. 무료 한도 후함.

### Greedy clustering
`groupIntoClusters`의 그룹화 전략. 새 article을 기존 클러스터들의 head와 순서대로 비교해 처음 통과하는 곳에 합류. 첫 적합 cluster에 들어가서 끝.

## H

### History
ConvertedResult 이력. localStorage 최근 20개 FIFO. `HistoryContext` 관리.

## J

### Jaccard
집합 유사도. `|A∩B| / |A∪B|`. 0~1. 엔티티 집합, 제목 토큰 집합 비교에 사용.

## K

### K-pop 프리셋
`src/lib/styles.ts`의 'kpop' 스타일. 기본 선택. Soompi / Allkpop 스타일 톤.

## L

### localStorage 키

| 키 | 내용 |
|---|---|
| `nie:settings` | Settings 전체 |
| `nie:history` | ConvertedResult[] 최대 20개 |
| `nie:rss-cache:<sourceId>` | RSS 응답 캐시 (5분 TTL) |
| `nie:rss-backoff:<sourceId>` | 429 backoff 마커 (30분) |

## M

### manualMerges
`ClustersContext` state. `{ moverArticleId: anchorArticleId }`. 수동 합치기 override.

### Medium 미리보기
OutputTabs의 Medium 탭에 [미리보기↔편집] 토글. 마크다운 렌더 결과 vs textarea.

## P

### Provider
LLM 제공자. OpenAI / Gemini / 커스텀. `PROVIDERS` 상수에 baseUrl과 모델 옵션 정의.

### Prompt chain
`promptChain.ts`의 3단계 호출 흐름: analyzeKorean → translateDraft → formatChannels.

## R

### rss2json
[rss2json.com](https://rss2json.com). 무료 RSS → JSON 변환 서비스. CORS 우회 목적. 분당 10건 한도 (회원가입 시 ↑).

### RssSource
RSS 피드 한 개의 메타 (id, name, url, enabled). ⚙ 설정에서 사용자가 추가/삭제/토글.

### Regenerate channels
사용자 액션. 현재 active 언어 드래프트로 3채널 다시 생성 (Call 2).

## S

### Settings
모든 사용자 설정. localStorage에 자동 저장. [05-data-model.md](./05-data-model.md#settings).

### similarity (유사도)
두 article의 유사도 점수. `0.6 × entity Jaccard + 0.4 × title token Jaccard`. 0~1.

### Simulator (속보 시뮬레이터)
`breakingDetector.ts`의 `generateMockBreaking()`. 데모용으로 가짜 K-pop 속보 헤드라인 10개를 순환. ⚙ 설정에서 활성/주기 조절.

### Split (분리)
ClustersContext 액션. 자동 클러스터에서 article을 빼서 단독 클러스터로.

### Style preset
글 스타일. 'kpop' / 'ap' / 'bloomberg' / 'techcrunch' / 'custom'. `src/lib/styles.ts`.

## T

### threshold
clusterThreshold 약칭.

### Tier (OpenAI)
사용자 사용 단계. Free → Tier 1 ($5 결제) → Tier 2~5. 한도가 단계별로 증가.

### translateDraft
`promptChain.ts`. 한 언어 드래프트를 반대 언어로 번역. LLM 호출 1회.

### Tutorial / Guide
- **Tutorial** = TutorialOverlay. 단계별 안내. [?] 아이콘으로 실행.
- **Guide** = GuideModal. 상세 마크다운 레퍼런스. [📖 가이드] 버튼으로 실행.

## U

### useSettings / useClusters / useArticles / useConversion / useHistory / useBreaking
각 Context의 hook. Provider 밖에서 호출 시 에러 throw.

## V

### valueScore
LLM이 매기는 뉴스 가치 1~10점. analyzeKorean의 출력. 워크벤치 드래프트 헤더와 이력 패널에 표시.

### Vite
Vite는 빌드 도구 + dev 서버. `vite.config.ts`. Vitest는 같은 설정 공유.

### Vitest
테스트 러너. jest와 호환되는 API. `npm test`로 실행.

## W

### Workbench
중앙 작업 영역. 원문 carousel + 종합 드래프트 textarea + 모델/Provider 선택 + [가치 평가] 버튼.

## 단축형

- KO / EN — 한국어 / 영어 (DraftLanguage)
- SPA — Single Page Application
- LLM — Large Language Model
- RSS — Really Simple Syndication (뉴스 피드 표준)
- TTL — Time To Live (캐시 만료 시간)
