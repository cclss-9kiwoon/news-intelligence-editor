# NIE 워크플로 개선 기획안

> 실무 편집자의 기사 재생산 워크플로에 맞춰 NIE 파이프라인을 개선한다.

## 배경: 실무 워크플로

연예 뉴스 편집자의 실제 작업 흐름:

1. 여러 매체를 돌며 기사거리 발굴
2. 주제 A를 정했으면, A를 다룬 여러 매체 기사를 수집
3. 매체별로 팩트는 동일하나 추가 정보/앵글이 다름 → 교차비교
4. **우리 매체 발행 가이드**에 맞게, 팩트 전달 + 추가 정보 팩트체크 후 병합
5. 이미지 소싱 (공식 배포 이미지 우선, 타 매체 워터마크 이미지 회피)
6. CMS에 붙여넣기 → 발행

## 현재 NIE의 갭

| 영역 | 현재 상태 | 문제 |
|---|---|---|
| 전문 수집 | RSS description(1~3문장) + 별도 프록시 서버 필요 | 프록시 안 띄우면 요약만으로 종합 → 품질 저하 |
| 발행 가이드 | 카테고리 criteria/tone (범용적 한두 줄) | 매체 고유 문체/구조/규칙 반영 불가 |
| 종합 방향 | "원문 없는 사실 창작 금지" + 카테고리 톤 적용 | 매체별 추가 정보 팩트체크·병합 로직 없음 |
| 이미지 | AI 이미지 프롬프트(Midjourney) 생성 | 실무에서는 실제 사진 필요, AI 생성 이미지 안 씀 |

---

## 개선 항목

### 1. 전문 수집 안정화 — 범용 추출기 메인 + 네이버 폴백

**목표**: 어떤 URL이든 기사 전문을 안정적으로 수집한다. 특정 플랫폼에 종속되지 않는다.

**설계 원칙**: 범용성 우선. 어느 분야(연예, 테크, 경제 등), 어느 국가(한국, 해외)든 RSS 소스만 등록하면 전문 수집이 동작해야 한다.

**현재 구조 (문제)**:
- `proxy-server.ts` (localhost:3456) — 정규식 기반 HTML 파싱, 별도 서버 기동 필요
- `src/lib/scraper.ts` — 프록시 호출 클라이언트
- `src/state/ArticlesContext.tsx` — 프록시 상태 체크 + enrichment
- 프록시 안 띄우면 RSS description(1~3문장 요약)만으로 LLM 종합 → 품질 저하

**변경 방향: 범용 추출기 + 네이버 폴백**

```
기사 URL 확보 (RSS 수집 or 수동 입력)
        │
        ▼
  1차: 범용 전문 추출 (Jina Reader API 등)
       어떤 URL이든 → 전문 + 이미지 추출
        │
        ├── 성공 → fullText + images 저장
        │
        └── 실패 → 폴백
              ├── 네이버 뉴스 URL이면 → #dic_area 추출 (한국 뉴스 보너스)
              └── 그 외 → description으로 대체 (전문 없이 진행)
```

**범용 추출기 후보 (개발자가 판단)**:
- Jina Reader API (`r.jina.ai/{url}`) — 무료 분당 20건, CORS 프리, 마크다운 반환
- Mozilla Readability 라이브러리 — 서버사이드에서 실행 시 무료/무제한
- 기타 유사 서비스

**네이버 뉴스 폴백**:
- 범용 추출 실패 시, URL이 `n.news.naver.com` 형태면 `#dic_area` 셀렉터로 전문 추출 시도
- 네이버 검색 API는 필수가 아닌 선택 기능 (API 키 없어도 NIE가 동작해야 함)
- 추후 네이버 검색 API를 별도 기사 소스로 추가하는 건 가능하지만 이번 스코프 밖

**CORS 처리**:
- Jina Reader API는 CORS 프리 → 브라우저에서 직접 호출 가능
- 네이버 뉴스 폴백은 CORS 차단됨 → 서버사이드 중계 필요
- 해결: proxy-server.ts를 경량 CORS 프록시로 유지 (네이버 폴백 + 기타 CORS 차단 사이트 대응)
- 장기적으로 Cloudflare Worker 등 서버리스로 이관 가능

**기존 RSS 수집과의 관계**:
- RSS = 기사 발굴 + 목록 수집 (기존 역할 그대로 유지)
- 범용 추출기 = RSS로 들어온 기사 URL에서 전문 추출 (보강)
- 두 소스 간 중복 문제 없음 (RSS 기사의 URL에서 전문만 채우는 구조)

**영향 범위**:
- `src/lib/scraper.ts` — 범용 추출기 호출 + 네이버 폴백 로직으로 재작성
- `src/state/ArticlesContext.tsx` — proxyStatus 로직 단순화 (추출 성공/실패만 표시)
- `src/components/ClusterPicker.tsx` — 전문 수집 상태 UI 변경 ("전문 N건 수집됨")
- `proxy-server.ts` — CORS 차단 사이트 전용 경량 프록시로 전환 (네이버 폴백 등)

---

### 2. 프롬프트 설정 시스템

**목표**: LLM 프롬프트를 구성하는 모든 요소를 설정에서 관리한다. 기본값을 제공하되 사용자가 매체에 맞게 수정 가능.

**설계 원칙**: 기본값 프리셋 + 사용자 수정 + 기본값 복원 버튼

#### 2-A. 프롬프트 구성요소별 설정 필드

```typescript
// src/types.ts — Settings에 추가
type PromptConfig = {
  editorRole: string;        // 에디터 역할 정의
  publishingGuide: string;   // 발행 가이드 (문체, 구조, 분량 등)
  taskInstructions: string;  // 작업 지침 (교차검증, 팩트 처리 방식)
  bannedExpressions: string; // 금지 표현 리스트 (쉼표 구분)
};

type ReferenceArticle = {
  id: string;
  url: string;
  title: string;
  body: string;      // 전문 수집 후 저장
  fetchedAt: number;
};

type Settings = {
  // ... 기존 필드
  promptConfig: PromptConfig;
  referenceArticles: ReferenceArticle[];  // 최대 5개
};
```

#### 2-B. 각 필드 기본값 (`src/lib/defaultSettings.ts`)

```typescript
export const DEFAULT_PROMPT_CONFIG: PromptConfig = {
  editorRole: '한국 연예 매체의 시니어 에디터',

  publishingGuide: `- 경어체(~했다, ~밝혔다) 사용
- 리드문(2문장 이내) → 핵심 내용 → 부가 정보 → 마무리 구조
- 800~1200자 내외
- 미확인 정보는 "~로 알려졌다", "~는 확인되지 않았다"로 표기
- 소속사 공식 입장은 "소속사는 ~라고 밝혔다" 형식
- 자극적 수식어 지양, 팩트 중심 서술`,

  taskInstructions: `1. 모든 매체가 공통으로 다루는 핵심 팩트를 본문의 중심으로 삼는다.
2. 특정 매체만 다룬 추가 정보(배경, 수치, 후속 전망 등)가 있으면:
   - 다른 매체의 내용과 모순되지 않는지 교차검증한다.
   - 모순 없으면 본문에 자연스럽게 병합한다.
   - 모순 있거나 단독 보도라 검증 불가하면 summary에 "[매체명] 단독: ..."으로 명시한다.
3. 카테고리 기준(criteria)에 따라 중요도를 판단하되, 톤은 발행 가이드를 따른다.
4. 발행 가이드가 있으면 그 문체·구조·분량을 우선 적용한다.`,

  bannedExpressions: 'delve, in conclusion, furthermore, testament, moreover, "it is important to note", "not only ... but also", "as an AI", "I think/believe/feel"',
};
```

사용자가 수정하면 localStorage에 저장. 각 필드 옆에 "기본값 복원" 버튼.

#### 2-C. 레퍼런스 기사 학습

우리 매체가 실제로 발행한 기사를 등록하면, LLM이 참고해서 문체/구조를 맞춘다.

동작:
- Settings에서 "레퍼런스 기사" 섹션 → URL 입력 → 전문 추출 → 저장
- 저장된 레퍼런스 기사를 LLM 시스템 프롬프트에 "우리 매체 기사 예시"로 포함
- 최대 5개 (프롬프트 토큰 제한 고려)
- localStorage에 영구 저장 (한 번 추출하면 다시 안 함)

#### 2-D. Settings 모달 UI — "프롬프트 설정" 탭

```
⚙️ 설정 > 프롬프트 설정
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 에디터 역할                    [기본값 복원]
┌─────────────────────────────────┐
│ 한국 연예 매체의 시니어 에디터    │
└─────────────────────────────────┘
  LLM이 맡는 역할. 매체 성격에 맞게 변경.
  예: "글로벌 테크 미디어의 수석 기자"

📌 발행 가이드                    [기본값 복원]
┌─────────────────────────────────┐
│ - 경어체(~했다, ~밝혔다) 사용     │
│ - 리드문 → 핵심 → 부가 → 마무리  │
│ - 800~1200자 내외               │
│ - ...                           │
└─────────────────────────────────┘
  기사 작성 규칙. 문체, 구조, 분량, 인용 방식 등.

📌 작업 지침                      [기본값 복원]
┌─────────────────────────────────┐
│ 1. 모든 매체 공통 핵심 팩트를     │
│    본문 중심으로.                │
│ 2. 특정 매체만 다룬 추가 정보 →   │
│    교차검증 후 모순 없으면 병합.   │
│ 3. ...                          │
└─────────────────────────────────┘
  LLM이 기사를 종합하는 방식. 교차검증, 팩트 처리 규칙.

📌 금지 표현                      [기본값 복원]
┌─────────────────────────────────┐
│ delve, furthermore, testament,  │
│ "as an AI", ...                 │
└─────────────────────────────────┘
  쉼표로 구분. LLM이 이 표현을 쓰지 않도록 지시.

📌 레퍼런스 기사 (최대 5개)
┌─────────────────────────────────┐
│ + URL 추가                      │
│                                 │
│ 1. 에스파, 미니 5집 선주문...  🗑 │
│    ✅ 전문 수집 완료 (2,340자)   │
│ 2. BTS 정국 솔로 앨범...      🗑 │
│    ✅ 전문 수집 완료 (1,890자)   │
└─────────────────────────────────┘
  우리 매체 실제 기사 URL. LLM이 문체·구조를 참고.
```

#### 2-E. 프롬프트 조립 구조 (`src/lib/promptChain.ts`)

`buildStorySystem()`이 설정값을 조합해서 시스템 프롬프트를 생성:

```
[고정 — 코드에서 관리, 사용자 수정 불가]
  출력 포맷 (JSON 6개 키: summary, headline, body, tags, imagePrompt, sourceFacts)

[설정 — promptConfig에서 로드]
  당신은 {editorRole}입니다.

  [발행 가이드]
  {publishingGuide}

  [작업 지침]
  {taskInstructions}

  [금지 표현]
  {bannedExpressions}

[설정 — referenceArticles에서 로드, 있을 때만]
  [우리 매체 기사 예시]
  --- 예시 1 ---
  제목: ...
  본문: ...
  위 예시의 문체·구조·톤을 참고하라.

[설정 — categories에서 로드 (기존)]
  [카테고리: {category.label}]
  [선별·정리 기준] {category.criteria}
  [말투] {category.tone}

[자동 — 수집된 기사 원문]
  (유저 프롬프트로 전달)
```

카테고리 `tone` 필드는 유지하되, `publishingGuide`가 있으면 가이드가 우선하도록 프롬프트 내 순서로 우선순위를 명시.

---

### 4. 이미지 소싱

**목표**: AI 이미지 프롬프트 대신, 원문 기사의 실제 이미지를 수집하고 사용 가능 여부를 판별한다.

**현재 상태**:
- `Article.thumbnail` — RSS에서 가져온 썸네일 URL (있으면)
- Workbench에서 썸네일 URL 복사만 가능
- `imagePrompt` 필드로 AI 이미지 생성 프롬프트 제공

**변경 방향**:

**4-A. 원문 이미지 수집 강화**

전문 수집 시 본문 내 이미지도 함께 추출:

```typescript
// src/types.ts — Article에 추가
type ArticleImage = {
  url: string;
  alt?: string;
  caption?: string;       // 이미지 캡션 (출처 정보 포함 가능)
  isOfficialSource: boolean;  // 공식 배포 이미지 여부 (휴리스틱 판별)
};

type Article = {
  // ... 기존 필드
  images: ArticleImage[];  // 본문 내 모든 이미지
};
```

**4-B. UI — 이미지 후보 패널**

Workbench의 기존 "원문 이미지 후보" 영역을 확장:

- 클러스터 내 모든 기사의 이미지를 모아서 표시
- 각 이미지에 출처 매체명 + 캡션(있으면) 표시
- 이미지 클릭 → URL 복사 (기존과 동일)
- 출처 판별(공식 배포 vs 타 매체 촬영)은 편집자가 직접 판단
- `imagePrompt` 필드는 유지 (AI 이미지가 필요한 경우 대비)

---

## 구현 순서

```
Phase 1: 전문 수집 안정화 (범용 추출기 + 네이버 폴백)
├── 범용 추출기 연동 (Jina Reader 등, 개발자 판단)
├── 네이버 뉴스 폴백 (#dic_area 추출)
├── proxy-server.ts → CORS 차단 사이트 전용 경량 프록시로 전환
├── 전문 수집 시 이미지도 함께 추출 (Phase 3 연계)
├── 기존 scraper/proxyStatus 로직 정리
└── 전문 수집 동작 검증

Phase 2: 프롬프트 설정 시스템
├── types.ts에 PromptConfig, ReferenceArticle 타입 추가
├── defaultSettings.ts에 DEFAULT_PROMPT_CONFIG 기본값 정의
├── SettingsContext에 promptConfig 저장/로드
├── Settings 모달에 "프롬프트 설정" 탭 추가
│   ├── 에디터 역할 (textarea + 기본값 복원)
│   ├── 발행 가이드 (textarea + 기본값 복원)
│   ├── 작업 지침 (textarea + 기본값 복원)
│   ├── 금지 표현 (textarea + 기본값 복원)
│   └── 레퍼런스 기사 관리 (URL 추가 → 전문 추출 → 저장/삭제)
└── promptChain.ts — buildStorySystem()이 promptConfig에서 조립

Phase 3: 이미지 소싱
├── 전문 수집 시 이미지 배열 추출
├── 이미지 출처 판별 휴리스틱
└── Workbench 이미지 후보 패널 확장
```

## 영향받는 주요 파일

| 파일 | 변경 내용 |
|---|---|
| `src/types.ts` | PromptConfig 타입 추가. Settings에 promptConfig, referenceArticles 추가. Article에 images 추가 |
| `src/lib/defaultSettings.ts` | DEFAULT_PROMPT_CONFIG 기본값 (역할, 가이드, 지침, 금지표현) |
| `src/lib/scraper.ts` | 범용 추출기 + 네이버 폴백으로 재작성, 이미지 추출 추가 |
| `src/lib/promptChain.ts` | buildStorySystem()을 promptConfig 기반 조립으로 재작성. 하드코딩 제거 |
| `src/state/ArticlesContext.tsx` | proxyStatus 로직 단순화 |
| `src/state/SettingsContext.tsx` | promptConfig 저장/로드, 기본값 복원 함수 |
| `src/components/SettingsModal.tsx` | "프롬프트 설정" 탭 (4개 textarea + 기본값 복원 + 레퍼런스 기사 관리) |
| `src/components/Workbench.tsx` | 이미지 후보 패널 확장 |
| `src/components/ClusterPicker.tsx` | 프록시 상태 UI 변경 |
| `proxy-server.ts` | 제거 또는 fallback으로 유지 |
