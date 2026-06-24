# Hydra 용어·개념 정의서 (Glossary)

> 목적: 혼재된 개념 정리. 모든 설정·워크플로 용어의 단일 정의 기준.
> 기준일: 2026-06-15 / 출처: 코드(autosquad-hydra dev, 라우트·스키마·moduledoc) + 오너(우동기) 확정 정의.
> ⚠️ 코드는 변경하지 않음. 이 문서는 **용어/개념 정의**만. 코드 현실과의 간극은 각 항목에 ⚠️로 표기.

---

## 0. 큰 그림 — 프로젝트 허브 안의 "두 세계"

Hydra는 한 **프로젝트** 아래 성격이 다른 **두 콘텐츠 세계**가 공존한다. 프로젝트 허브(`/project-lab/:id`)가 둘의 진입점을 한 화면에 묶는다:

```
조직 (Organization)
  └─ 프로젝트 (Project = distribution_group)         ← "프로젝트 허브"
       │
       ├─ 〔포스팅 세계〕  사람이 글 작성 → 예약/발행
       │     ├─ 포스트(=Hydra.Campaigns)   ← 허브 진입점 "새 글쓰기"
       │     ├─ 템플릿 (Templates)
       │     └─ 캘린더 (Calendar)
       │
       └─ 〔뉴스 세계〕  자동 수집·제작 → (수동/자동) 발행
             └─ 뉴스룸(=news_settings)      ← 허브 진입점 "뉴스룸"(news2)
                  └─ 태스크 → 아티클 → 발행
```

> ⚠️ **"캠페인" 이름 충돌 (가장 큰 혼동):** 코드에 `campaign`이 **두 개의 다른 것**을 가리킨다.
> - **Hydra.Campaigns** (`campaigns` 테이블) = **포스팅 1건**(소셜/글 작성·예약). 허브에선 "새 글쓰기".
> - **news_settings** = **뉴스 자동화 설정 1벌**. UI가 "캠페인"/"뉴스룸"이라 부름.
> 이 문서는 혼동 방지를 위해 전자를 **포스트(Post)**, 후자를 **뉴스룸(Newsroom)**으로 부른다.

---

## 1. 계층·엔티티

| 레벨 | 코드 엔티티 | 정의 |
|---|---|---|
| **조직** | organization | 최상위 소유 단위 (예: allkpop) |
| **프로젝트** | distribution_group | 발행 타깃·브랜드 단위. 카테고리·기본 출력언어·브랜드톤·포맷규칙(project_profile)의 "집". UI 명칭 = **프로젝트 허브** |
| **포스트** | Hydra.Campaigns (`campaigns`) | 〔포스팅〕 사람이 작성한 **글/소셜 포스트 1건**. status·예약시각 보유. ⚠️ 코드명은 `campaign` |
| **템플릿** | Templates | 〔포스팅〕 포스트 작성용 프리셋(플랫폼별 규칙·본문·기본 예약시간) |
| **뉴스룸** | news_settings | 〔뉴스〕 **자동 수집·제작 설정 1벌**(소스·주제·신선도·모델·검수·발행). ⚠️ UI/코드가 "캠페인"이라고도 부름 |
| **태스크** | Task | 〔뉴스〕 클러스터 1개가 파이프라인 타는 작업 단위. **뉴스룸에만 존재** |
| **아티클** | Story (코드 스키마명) | **작성 완료된 기사 결과물.** ⚠️ 코드 스키마는 `Story` |
| **원본기사 (raw)** | news_articles / article | **수집된 원본 소스 기사**(작성 전). ⚠️ 코드 `article`은 이 원본 — 완성 아티클과 혼동 주의 |

---

## 2. 3가지 작업 모드 (오너 확정) ★핵심

> 모드 = "자동화 정도" 축. 모드명에 "캠페인"을 쓰지 않는다(엔티티명과 충돌).

| 모드 | 세계 | 제작 주체 | Hydra 역할 | 엔티티 | 위치 |
|---|---|---|---|---|---|
| **새글쓰기** | 포스팅 | **사람** 직접 작성 | 발행만 도움 | 포스트(Hydra.Campaigns) | 허브 "새 글쓰기" |
| **수동 워크벤치** | 뉴스 | **자동** 수집·제작 | 사람 **마지막 터치 후** 발행 | 뉴스룸 (`auto_publish=false`) | `/news` "수동 워크벤치(뉴스1)" 🔧 |
| **자동 뉴스룸** | 뉴스 | **풀 자동** | 설정대로 **무인 발행** | 뉴스룸 (`auto_publish=true`) | 프로젝트 허브 "뉴스룸"(news2) |

```
프로젝트
 ├─ 포스트(새글쓰기)   ← 사람 작성, 발행만 보조. 뉴스룸/파이프라인 무관
 └─ 뉴스룸
      ├─ [수동 워크벤치]  auto_publish=false → 자동 수집·제작 후 사람 검수·발행
      └─ [자동 뉴스룸]    auto_publish=true  → 무인 수집→제작→발행
```

- **새글쓰기** = 뉴스룸/캠페인 ❌. 포스팅 세계의 사람 작성 글.
- **수동 워크벤치 / 자동 뉴스룸** = 둘 다 **뉴스룸(news_settings)**, 차이는 **발행 게이트(`auto_publish`)** 하나. 수집·제작 로직 동일.

---

## 3. 〔포스팅 세계〕 용어

### 포스트 (Hydra.Campaigns)
- 사람이 주제 입력 → AI 초안 → 채널별 편집 → 예약/발행하는 **글 1건**.
- 작성 UI(`/dg/:id/campaigns/new`): ①무엇을(주제+템플릿+대상채널) → ②포스트(AI초안+플랫폼별 편집+글자수) → ③언제(지금/예약+추천시간).
- 버튼 2개: **초안 저장**(검증 무시) / **예약 발행**.
- 이름 자동: 주제 앞 60자에서 파생(별도 name 입력 없음).

| 상태(status) | 의미 |
|---|---|
| draft | 초안 |
| pending_approval | 승인 대기 |
| scheduled | 예약됨 |
| publishing | 발행 중 |
| done / failed / canceled | 완료 / 실패 / 취소 |

### 템플릿 (Templates) — `/templates`
- 포스트 작성용 **프리셋**. master-detail 라이브러리(최근 사용순).
- 필드: `platform_rules`(플랫폼별 규칙), `platform_bodies`(플랫폼별 본문), `default_schedule_hint`(기본 예약시간), `visibility`(private/공유), `usage_count`/`last_used_at`.
- 캠페인 작성 ①블록에서 선택해 초안 시드로 사용.

### 캘린더 (Calendar) — `/calendar`
- **발행 캘린더.** 월(기본)/주/일 뷰. 날짜 클릭 → 그날 예약된 포스트를 우측 패널에.
- 데이터: `Campaigns.list_scheduled_between/3` (예약된 포스트).
- = 포스트 **발행 일정 관리** 도구.

### 채널/연동 (Integrations) — `/dg/:id/integrations`
- 프로젝트가 발행하는 대상 플랫폼 연결(OAuth 등). 포스트의 "대상 채널".

---

## 4. 〔뉴스 세계〕 파이프라인 (뉴스룸)

```
수집 → ① 기사찾기(searching) → ② 주제검수(topic_review) → ③ 기사작성(producing) → ④ 최종검수(final_review) → 발행(publish)
```

| 단계 | 코드 stage | 하는 일 |
|---|---|---|
| **수집** | Poller | 소스에서 원본기사 가져옴 (벡터풀/Naver/Daum/RSS) |
| **① 기사찾기** | searching / claim | 클러스터링 → 뉴스룸 스코프로 후보 선별(태스크 생성) |
| **② 주제검수** | topic_review | 원문 수집 후 TopicJudge(LLM)가 적합/제외 판정 |
| **③ 기사작성** | producing | generateStory(LLM)로 아티클 작성 + 이미지 |
| **④ 최종검수** | final_review | 룰기반 검수(11종) + (옵션)AI 정밀검수 |
| **발행** | publish | CMS(allkpop)로 발행 |

### news2 화면들 (`/news2/...`)
| 경로 | 화면 |
|---|---|
| board | 파이프라인 보드(①~④ 진행) |
| status / history / decisions | 상태 / 이력 / 판정로그 |
| published / discarded | 발행됨 / 폐기됨 |
| images (ImageLibrary) | 이미지 라이브러리 |
| settings / campaign | 뉴스룸 설정 |
| llm-settings (StageLLMEditor) | 단계별 LLM 설정 |

---

## 5. 뉴스룸 설정 용어 (news_settings 필드)

### 소스·수집
| 용어 | 필드 | 정의 |
|---|---|---|
| 벡터풀 | (autosquad) | publ-dev-main RDS 글로벌 임베딩 풀. 디폴트 소스 |
| 네이버/다음 검색어 | naver_queries / kakao_queries | 키워드 기반 소스 수집어 |
| 자동수집 | auto_collect | 주기 수집 on/off |
| 수집 주기 | poll_minutes | 몇 분마다 수집(기본 5) |
| **신선도** | article_window | 가져올 시간범위 1h/24h/7d/30d. ⚠️ 벡터풀 raw는 현재 24h 캡 |

### 주제·선별
| 용어 | 필드 | 정의 |
|---|---|---|
| **다룰 주제(의도)** | intent | 다룰 주제 정의. ②판정 + 벡터 앵커 추출에 사용 |
| **제외 주제** | exclude_topics | 거를 주제 키워드(칩). ①prefilter + ②판정 |
| 카테고리 | categories | 분류 라벨(+positive 키워드원) |
| 출력/소스 언어 | output_language / source_language | 생성 언어 / 소스 언어 필터 |
| 클러스터 임계 | cluster_threshold | 같은 사건 묶는 민감도(기본 0.3) |

### 제작·검수
| 용어 | 필드 | 정의 |
|---|---|---|
| AI 제공자/모델 | ai_provider / ai_model / fast_model | ③생성·②판정 LLM 백엔드 |
| 발행가이드/포맷규칙 | prompt_config.publishing_guide / project_profile.format_rules | 분량·구조·따옴표·마크업 |
| 교차검증 최소소스 | min_media_for_write | 작성 전 필요한 소스 수 |
| 시간당 처리한도 | max_per_hour | ②로 promote하는 시간당 건수(페이싱) |

### 자동화·발행
| 용어 | 필드 | 정의 |
|---|---|---|
| 자동 제작 | auto_process | ②③ 자동 진행 |
| **자동 발행** | auto_publish | ④ 통과분 자동 발행 (= 수동워크벤치/자동뉴스룸 구분) |
| 발행 모드 | publish_mode | immediate 등 |
| 발행 타깃 | distribution_group_id | 어느 프로젝트(CMS)로 |
| 보관(삭제) | archived_at | soft-delete 표시 |

---

## 6. project_profile (프로젝트 레벨 포맷규칙)

`prompt_config.project_profile` — 발행물 스타일:
곡명=double / 앨범·작품=single 따옴표, 헤드라인 casing, 아티스트 `<strong>`, 에디토리얼 클로징 금지, 허용/금지 매체.

---

## 7. allkpop CMS 발행 — 실측 필드 + 실사용 (오너 확정 2026-06-15)

> CMS 새글쓰기 화면(`/juniornl2/article/new_article.php`) 직접 확인 + 오너 실사용 기준.
> ⚠️ **실제 쓰는 것만** 자동발행에 반영. 나머지는 건드리지 않음(기본값).

### 본문 HTML 규칙 (변환)
- 단락 `<p>`, 단락 사이 빈 `<p></p>`, `<br>` 금지. 소제목 `<p><strong>`, 캡션 `<p><em>`.
- 허용태그: p/strong/em/img/figure·figcaption/a/ul·li.
- See Also: 본문 끝 `[SEEALSO][/SEEALSO]` 숏코드(자동).

### 발행 필드 — 실사용 매핑

| CMS 필드 | 쓰나? | 값/규칙 | 종류 |
|---|---|---|---|
| **Title** | ✅ | 기사 제목 | 건별 |
| **Content** | ✅ | 본문 HTML(위 규칙) | 건별 |
| **Status** | ✅ | **draft 또는 publish** (사람검수 게이트와 연동) | 캠페인/게이트 |
| **Comment** 플래그 | ✅ | **항상 ON** (댓글 열기) | 고정 |
| Breaking/Exclusive/Pin/Spoiler/Img Top/Promoted/Disable ADX | ❌ | **안 건드림**(기본값) | — |
| **Schedule for** | ❌ | **안 씀** — Hydra 자체 예약 기능 사용. 발행은 즉시(또는 Hydra가 시점 제어) | — |
| **Thumbnail** | ✅ | **기사 본문 최상단 이미지**를 썸네일로 업로드(서치/og:image용) | 건별(본문 첫 이미지) |
| **Artist Tags** | ✅ | **그 기사의 인물(아티스트)만.** kpop/music 등 일반어 ❌. 인물 엔티티만 | 건별 |
| 일반 Tags | ❌ | 안 씀 | — |
| **Country** | (기본 All) | 안 건드림 | 고정 |
| **Author** | (spjw99) | 기본 작성자 | 고정 |
| **Category** | ✅ | **동적 규칙(아래)** | 건별 |
| Youtube URL | (비디오 기사 시) | 비디오는 **Youtube URL만**(임베드/공유URL 아님) | 건별 |

### Category 규칙 (동적)
- 기본 = **News** (Entertainment > News)
- **비디오 있는 기사** = Music Video 등 비디오 카테고리
- **kpop 무관 주제(여행·음식·패션 등)** = **Lifestyle & Culture** 하위 카테고리
- (teaser 이미지 기사 → NEWS)

### Posting Tips (allkpop 원 규칙 참고)
- teaser 이미지 = category NEWS
- 비디오 = Youtube URL ONLY (embed/share URL ❌)
- 외부 URL 이미지 = 에디터에 URL 붙여넣기
- 본문 내 비디오/SNS(FB·트위터·IG) = 임베드 버튼

### ⚠️ 코드(client payload) 갭
- Pin / Disable Google ADX / News Article URL = 우리 payload에 없음 (단 ★실사용 안 함 → 무시 OK)
- 썸네일 업로드 = 파일 업로드 전용(현 client 미지원) → **본문 첫 이미지를 썸네일로** 보내는 경로 필요
- artisttag = **인물 엔티티 추출 + CMS 아티스트풀 매칭** 로직 필요
- category 동적 규칙(News/비디오/Lifestyle) = 매핑 로직 필요

---

## 8. 발행 대비 제작 — 2층 모델 (정책 vs 자동도출) ★확정

> 발행(POST)은 hydra-pm 쪽. **우리(③ 제작) 책임 = 아티클이 발행 가능한 "완성형"으로 나오게.**
> 발행 직전 급조 X — 제작 단계에서 category·artisttag·썸네일·CMS본문이 이미 채워져 나옴.

### 2층 구조
```
[① 상류 = 캠페인 설정 "정책"]   유저가 미리 적음
      ↓ 제작 제약
[③ 콘텐츠 생성]
      ↓ 생성된 콘텐츠를 읽고
[② 하류 = "구체값" 자동도출]    시스템이 계산 (유저가 못 적음)
      ↓
[Story가 완성형으로 보유]  → 발행(hydra-pm)이 그대로 POST
```

### ① 상류 — 유저가 캠페인 설정에 적는 "정책"
- 다룰 주제(intent) / 제외주제 / 출력언어 / 소스·신선도
- 본문 포맷규칙(project_profile.format_rules) / 발행규칙(publish_format)
- **status 기본값**(draft) / **comment on/off** / **아티스트태그 정책**(인물만) / **카테고리 규칙**(기본 News·비디오→MV·비-kpop→Lifestyle, 또는 프리셋)
- = 콘텐츠를 **어떻게 만들지** 제약. allkpop 값은 기본 프리셋, 매체별 변경 가능.

### ② 하류 — 시스템이 콘텐츠 보고 "자동 도출" (유저 입력 불가)
- **구체 카테고리** (이 기사가 비디오냐/kpop무관이냐 판정 → 정책의 카테고리 적용)
- **구체 아티스트 인물명** (본문 엔티티 추출 → CMS 아티스트풀 매칭)
- **썸네일** (본문 첫 이미지 선정)
- **CMS 본문 HTML** (포맷규칙대로 변환)
- = "그 기사가 나와봐야 아는 값". 코드가 **판단·추출**.

### Story가 들고 가야 할 발행 인터페이스 (제작 산출)
`category` · `artist_tags`(인물) · `thumbnail_url`(본문 첫 이미지) · `cms_body_html` · `status` · `comment=on`
→ 발행(hydra-pm)은 이 필드를 읽어 CMS POST. **제작/발행 경계 = 이 필드셋.**

### 작업 분담 (코드 미변경 현황 기준)
- **설정으로 뺀다(하드코딩 X):** 정책 값은 캠페인 설정 칸 + allkpop 기본 프리셋.
- **Engineer(핫경로):** ③ generate_story 통합 + Story 필드 추가 + 캠페인 설정 스키마.
- **dev-support(독립 헬퍼 후보):** category 판정 / 인물 엔티티 추출 / 첫 이미지 선정 = 순수함수 모듈.
- **외부 의존:** CMS 아티스트풀 소스(인물명→CMS 유효명 매칭)는 소스 확보 후.

---

## 부록 A. 자주 혼동되는 짝

| A | B | 차이 |
|---|---|---|
| 포스트(Hydra.Campaigns) | 뉴스룸(news_settings) | ⚠️ **둘 다 코드명 "campaign"이지만 다른 것.** 포스트=사람작성 글1건 / 뉴스룸=뉴스 자동화 설정 |
| 캠페인(엔티티) | 자동 뉴스룸(모드) | 엔티티 vs 그 모드 |
| 자동 뉴스룸 | 수동 워크벤치 | 둘 다 뉴스룸. 차이는 `auto_publish` |
| 새글쓰기 | 수동 워크벤치 | 새글=포스팅(사람작성) / 워크벤치=뉴스 자동제작+사람발행 |
| 프로젝트 | 뉴스룸/포스트 | 프로젝트=발행타깃·브랜드(상위) / 하위 작업단위 |
| 아티클(완성품) | 원본기사 raw | ⚠️ 코드명 거꾸로(Story=완성, article=원본) |
| 템플릿 | 프리셋(allkpop preset) | 템플릿=포스팅 작성 프리셋 / allkpop preset=뉴스룸 초기설정 일괄주입 |
| 캘린더 | 신선도 | 캘린더=포스트 발행일정 / 신선도=뉴스 수집 시간범위 |
| 다룰주제(intent) | 제외주제(exclude) | 포함 의도 / 배제 키워드 |

## 부록 B. ⚠️ 코드 ↔ 용어 간극 (정리 필요 후보, 코드 미변경)

1. **`campaign` 이름 이중사용** — Hydra.Campaigns(포스트) vs news_settings(뉴스룸). 최대 혼동원.
2. **`Story` = 완성 아티클, `article` = 원본** — 비즈니스 용어와 반대.
3. **모드 "자동 뉴스룸"** 이 코드에 그 이름으로 있진 않음 — 개념상 `auto_publish`로 구분.
4. **프로젝트 레벨 저장소**(distribution_groups.config) 일부 마이그 후 활성 — 프로젝트 카테고리/기본언어 편집 대기.
