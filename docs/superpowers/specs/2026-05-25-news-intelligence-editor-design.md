# News Intelligence Editor — Design Spec

- **Date**: 2026-05-25
- **Owner**: 1인 인간 에디터 (비개발자)
- **Target environment**: Bolt.new (브라우저 단일 SPA), 백엔드 없음

## 1. Goal

국내 뉴스(RSS 자동 수집 + URL/텍스트 보조 입력)를 가치 평가하고, AI 말투와 할루시네이션이 제거된 영문 콘텐츠로 변환하여 3개 채널(본 사이트 / X 스레드 / Medium)에 맞는 형식으로 원클릭 복사할 수 있는 무설치형 웹 대시보드.

## 2. Locked Decisions

| 항목 | 결정 |
|---|---|
| 스택 | Vite + React 18 + TypeScript + Tailwind CSS |
| 백엔드 | 없음 (rss2json + OpenAI 직접 호출) |
| 뉴스 수집 | rss2json 경유 한국 RSS 다소스 폴링 (30s) + URL/텍스트 보조 입력 |
| LLM 체인 | 2콜 (분석+변환 / 채널 포맷팅) + 규칙기반 팩트체크 + 금지어 정규식 |
| 기본 모델 | gpt-4o-mini (설정에서 gpt-4o 토글) |
| 스타일 프리셋 | K-pop/연예/가십 기본 + AP / Bloomberg / TechCrunch / 커스텀 |
| API 키 저장 | localStorage |
| 결과 이력 | localStorage 최근 20건 |
| 속보 알림 | 키워드 매칭 + 시뮬레이터(60~90s) 병행, 붉은 배너 + 알림음 |

## 3. Non-Goals

- 자체 DB / 백엔드 서버 / n8n / 외부 서비스 가입
- 사용자 다중 계정 / 권한 관리
- 자동 게시 (publishing)
- 다국어 인터페이스 (UI는 한국어 고정)

## 4. Architecture

### 4.0 Dependencies

**Runtime:**
- `react`, `react-dom` (18.x)
- `lucide-react` (아이콘)
- `react-markdown` (Medium 탭 미리보기)

**Dev:**
- `vite`, `@vitejs/plugin-react`
- `typescript`
- `tailwindcss`, `postcss`, `autoprefixer`
- `vitest`, `@testing-library/react` (단위 테스트)

**외부 서비스 (런타임 fetch):**
- OpenAI API (`https://api.openai.com/v1/chat/completions`) — 사용자 키 사용
- rss2json API (`https://api.rss2json.com/v1/api.json`) — 무료 티어

**Bolt.new 호환 정적 자원:**
- `public/ping.mp3` — 속보 알림음 (CC0 또는 free sample, ~4KB)

### 4.1 File Structure

```
src/
├── main.tsx
├── App.tsx
├── components/
│   ├── Header.tsx
│   ├── SettingsModal.tsx
│   ├── AlertBanner.tsx
│   ├── ArticlePicker.tsx
│   ├── Workbench.tsx
│   ├── OutputTabs.tsx
│   ├── HistoryPanel.tsx
│   └── FactCheckLog.tsx
├── lib/
│   ├── rss.ts
│   ├── breakingDetector.ts
│   ├── openai.ts
│   ├── promptChain.ts
│   ├── styles.ts
│   ├── factCheck.ts
│   ├── bannedWords.ts
│   └── storage.ts
├── hooks/
│   ├── useSettings.ts
│   ├── useArticles.ts
│   ├── useBreaking.ts
│   └── useHistory.ts
├── types.ts
└── index.css
```

### 4.2 Global State (Context)

```typescript
type AppState = {
  settings: {
    apiKey: string;
    model: 'gpt-4o-mini' | 'gpt-4o';
    stylePreset: 'kpop' | 'ap' | 'bloomberg' | 'techcrunch' | 'custom';
    customStyleInstruction?: string;
    rssSources: RssSource[];
    simulatorEnabled: boolean;
    alertSoundEnabled: boolean;
  };
  articles: Article[];
  selectedArticle: Article | null;
  breaking: BreakingAlert[];
  currentResult: ConvertedResult | null;
  history: ConvertedResult[];
  status: 'idle' | 'converting' | 'error';
  error: string | null;
};
```

### 4.3 Data Flow

```
[RSS Poller (30s)] ──┐
                     ├──→ articles[] ──→ ArticlePicker
[URL/Text Input] ────┘                        ↓
                                  promptChain.run(article, settings)
                                        ↓
                          Call 1: ANALYZE & TRANSLATE
                                        ↓
                      bannedWords.scan(englishDraft) → (재시도)
                                        ↓
                          Call 2: CHANNEL FORMATTING
                                        ↓
                      factCheck.verify(facts, outputs)
                      bannedWords.scan(outputs)
                                        ↓
                              OutputTabs (3 tabs)
                                        ↓
                              navigator.clipboard.writeText
```

## 5. News Ingestion

### 5.1 rss2json Endpoint

```
https://api.rss2json.com/v1/api.json?rss_url={encoded}&count=20
```

### 5.2 Default RSS Sources

| 매체 | 카테고리 | URL |
|---|---|---|
| 연합뉴스 속보 | 종합 | `https://www.yna.co.kr/rss/news.xml` |
| 연합뉴스 연예 | 연예 | `https://www.yna.co.kr/rss/entertainment.xml` |
| Soompi | K-pop (영문) | `https://www.soompi.com/feed` |
| Allkpop | K-pop (영문) | `https://www.allkpop.com/feed` |
| 조선일보 연예 | 연예 | `https://www.chosun.com/arc/outboundfeeds/rss/category/entertainments/?outputType=xml` |
| 한겨레 문화 | 문화 | `https://www.hani.co.kr/rss/culture/` |
| 스포츠서울 | 연예/스포츠 | `https://www.sportsseoul.com/rss/news.xml` |

설정에서 추가/제거 가능.

### 5.3 Polling Rules

- 주기: 30초
- `document.hidden`일 때 5분으로 늘림
- 중복 제거: `link` 정규화(utm_* 제거) + sha1 hash
- 메모리 cap: `articles` 최대 200건 FIFO

### 5.4 Core Types

```typescript
type Article = {
  id: string;
  title: string;
  description: string;
  fullText?: string;
  link: string;
  pubDate: string;
  source: string;
  inputType: 'rss' | 'url' | 'paste' | 'simulator';
  category?: string;
  thumbnail?: string;
  isBreaking?: boolean;
  fetchedAt: number;
};

type RssSource = {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
};

type BreakingAlert = {
  article: Article;
  matchedKeywords: string[];
  severity: 'medium' | 'high' | 'critical';
  firedAt: number;
  dismissedAt?: number;
};

type Facts = {
  people: string[];
  numbers: string[];
  places: string[];
  dates: string[];
};

type ConvertedResult = {
  id: string;
  sourceArticleId: string;
  sourceTitle: string;
  createdAt: number;
  valueScore: number;
  valueReason: string;
  facts: Facts;
  englishDraft: string;
  channels: {
    site: string;
    x: string;
    medium: string;
  };
  factReport: FactReport;
  bannedHits: Record<'site' | 'x' | 'medium', string[]>;
  stylePreset: string;
  model: string;
};

type FactReport = {
  ok: boolean;
  missing: Array<{ category: 'people' | 'numbers' | 'places' | 'dates'; value: string }>;
};
```

## 6. Breaking Alert System

### 6.1 Keyword Matching

```typescript
const BREAKING_KEYWORDS = [
  '속보', '긴급', '단독', '사망', '사고', '폭발', '비상', '체포', '해킹', '습격',
  '결혼', '이혼', '열애', '컴백', '해체', '탈퇴', '입대', '폭로', '논란'
];
```

- 제목이 `[속보]/[단독]/[긴급]`로 시작 → `severity: critical`
- 키워드 2개 이상 매치 → `severity: high`
- 1개 매치 → `severity: medium`

### 6.2 Simulator

- 기본 30초 간격 (스펙 요구사항), 설정에서 60/90/120초로 변경 가능
- mock 속보 이벤트 풀(10개 시나리오)에서 순환 또는 랜덤 추출
- 시각 구분: `🧪` 아이콘으로 실제 RSS 알림과 구분
- 설정에서 시뮬레이터 자체 on/off

### 6.3 UI Behavior

- `AlertBanner` 상단 슬라이드인, 빨간 배경
- HTML5 audio "ping.mp3" 재생 (설정 토글)
- `[지금 변환하기]` 버튼 → `selectedArticle` 설정
- 30초 후 자동 dismiss
- `Notification API` 권한 (옵션)

## 7. LLM Chain

### 7.1 Call 1 — ANALYZE & TRANSLATE

**System prompt (요지):**
```
You are a senior English news editor specializing in Korean entertainment 
and K-pop journalism. You MUST:
- Translate Korean source articles into professional English.
- Match the style preset: {STYLE_NAME} — {STYLE_DESCRIPTION}.
- NEVER use these banned words/phrases: [BANNED_LIST].
- Extract concrete facts (people, numbers, places, dates) verbatim.

Respond ONLY with valid JSON:
{
  "valueScore": number 1-10,
  "valueReason": string,
  "facts": { "people": string[], "numbers": string[], "places": string[], "dates": string[] },
  "englishDraft": string (300-500 words)
}
```

OpenAI 호출 옵션: `response_format: { type: 'json_object' }`, `temperature: 0.5`.

### 7.2 Call 2 — CHANNEL FORMATTING

**System prompt (요지):**
```
Convert the given English draft into three channel-ready formats.
- Preserve ALL extracted facts.
- NEVER use banned words.
- Style preset: {STYLE_NAME}.

Channel rules:
1. site: 400-600 words, no markdown, headline + lead + body + closing.
2. x: 5-8 tweets, ≤280 chars each, first = hook, "1/", "2/" numbering, 
   1-2 emojis per tweet max.
3. medium: 800-1200 words, markdown (H1 title, italic subtitle, H2 sections).

Respond ONLY with valid JSON: { "site": string, "x": string, "medium": string }
```

`temperature: 0.6`.

### 7.3 Retry Policy

- Call 1 응답에 금지어 매치 → 1회 자동 재시도 (스트릭터 프롬프트)
- JSON 파싱 실패 → 1회 자동 재시도
- 429 rate limit → exponential backoff 3회
- 그 외 네트워크 실패 → 사용자 수동 재시도 버튼

## 8. Style Presets

```typescript
export const STYLE_PRESETS = {
  kpop: {
    label: 'K-pop / 연예 / 가십',
    instruction: 'Casual, fan-friendly tone. Use industry terms (idol, comeback, ' +
      'bias, agency, fandom name). Direct quotes from sources. Conversational ' +
      'rhythm. Reference fan reactions. Avoid academic vocabulary.',
    examples: ['Soompi', 'Allkpop', 'JustJared'],
  },
  ap: {
    label: 'AP / Reuters 통신사',
    instruction: 'Inverted pyramid. 5W1H in first sentence. Neutral third-person. ' +
      'Short sentences. Attribution for every claim. No emojis.',
    examples: ['AP', 'Reuters'],
  },
  bloomberg: {
    label: 'Bloomberg / FT 경제지',
    instruction: 'Data-forward. Lead with the number or trend. Cite specific ' +
      'figures and market impact. Quote analysts. Formal register.',
    examples: ['Bloomberg', 'Financial Times'],
  },
  techcrunch: {
    label: 'TechCrunch / Verge 테크',
    instruction: 'Reader-friendly, slightly informal. Explain context for ' +
      'non-experts. Active voice. Mention competitors and ecosystem.',
    examples: ['TechCrunch', 'The Verge'],
  },
  custom: {
    label: '커스텀',
    instruction: '',
    examples: [],
  },
};
```

## 9. Banned Words

```typescript
const BANNED = [
  /\bdelve\b/i,
  /\bin conclusion\b/i,
  /\bfurthermore\b/i,
  /\btestament\b/i,
  /\bmoreover\b/i,
  /it is important to note/i,
  /not only [^,.]+ but also/i,
  /\bas an AI\b/i,
  /\bI (think|believe|feel)\b/i,
];

function scan(text: string): { ok: boolean; hits: string[] };
```

## 10. Fact Check

규칙기반, LLM 추가 호출 없음.

```typescript
function verify(
  facts: Facts,
  outputs: { site: string; x: string; medium: string }
): FactReport;

// people/places: loose match (대소문자/공백 관용)
// numbers: exact match (할루시네이션 방지)
// dates: loose match (포맷 변환 허용)
```

`FactReport.missing`이 비어있지 않으면 🚨 빨간 배너 + 누락 항목 리스트 표시. 사용자 수동 수정 유도.

## 11. Output & Copy

### 11.1 OutputTabs

- 3개 탭: `[본 사이트] [X 스레드] [Medium]`
- 각 탭 내부에 개별 `[📋 복사]` 버튼
- Medium 탭은 `react-markdown` 미리보기, 복사는 원본 마크다운
- X 탭은 트윗 단위 시각적 구분선
- 메타 표시: 단어수 / 글자수 / 금지어 카운트 / 팩트 OK 마크
- 복사 성공 토스트

### 11.2 copyToClipboard

```typescript
async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // fallback: textarea + execCommand
  }
}
```

## 12. History

- localStorage 키: `nie:history`
- FIFO 20건
- 엔트리: `{id, sourceArticleId, sourceTitle, createdAt, result, factReport, bannedHits}`
- 우측 슬라이드 패널
- 클릭 시 작업 영역 복원
- 전체 삭제 버튼 (확인 다이얼로그)
- quota 초과 → 가장 오래된 항목 자동 삭제

## 13. Settings Modal

1. API 키 (마스킹 토글 + 유효성 테스트 버튼)
2. 모델 라디오 (gpt-4o-mini / gpt-4o)
3. 스타일 프리셋 드롭다운 + 커스텀 instruction
4. RSS 소스 활성/비활성 + 추가/삭제
5. 알림 옵션 (시뮬레이터 / 알림음 / 브라우저 권한)
6. 이력 전체 삭제

## 14. Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  News Intelligence Editor       🔔3   ⚙ Settings   📜 History    │
├─────────────────────────────────────────────────────────────────┤
│  🚨 [속보] ...  [지금 변환]  ✕                                   │
├──────────────┬──────────────────────────────────────────────────┤
│  📰 기사 리스트│  ┌─ 원문 ─┐ ┌─ 영문 변환 ─┐                    │
│  (RSS+선택)  │  │         │ │              │                    │
│  [URL 입력]  │  └─────────┘ └──────────────┘                    │
│  [텍스트 붙임]│  🚨 Fact Mismatch: ...                          │
│  [평가/생성] │                                                   │
│              ├──────────────────────────────────────────────────┤
│              │  [본 사이트] [X 스레드] [Medium]      [📋 복사]   │
│              │  (선택 채널 출력 미리보기)                       │
└──────────────┴──────────────────────────────────────────────────┘
```

## 15. Error Handling Matrix

| 상황 | UI 반응 | 복구 |
|---|---|---|
| API 키 미입력 | 설정 모달 자동 오픈 + 안내 | 사용자 입력 |
| API 401/403 | 토스트 + 설정 모달 강조 | 키 재입력 |
| 429 rate limit | "재시도 중" 토스트 | exponential backoff 3회 |
| 네트워크 실패 | 토스트 + 수동 재시도 버튼 | 사용자 클릭 |
| JSON 파싱 실패 | 자동 재시도 1회 | 실패 시 raw 표시 |
| 금지어 (Call 1) | "재생성 중" | 스트릭터 재시도 1회 |
| 금지어 (Call 2) | 채널별 ⚠ + 하이라이트 | 수동 수정 |
| 팩트 누락 | 🚨 빨간 배너 + 리스트 | 수동 수정 |
| rss2json 한도 | 사이드바 ⚠ | 다음 사이클 |
| localStorage quota | 오래된 이력 자동 삭제 | 자동 |

## 16. Testing

### 16.1 Unit (Vitest)

- `bannedWords.scan()` 정규식 케이스
- `factCheck.verify()` 누락 감지
- `rss.dedupeAndMerge()` 중복 제거
- `breakingDetector.detect()` 키워드/타이틀
- `styles.ts` 프리셋 완전성

### 16.2 Manual Scenarios

1. 한국 기사 텍스트 → 변환 → 결과에 `delve`, `in conclusion` 미포함 검증
2. X 탭 복사 → 메모장 → 트윗 번호/이모지 확인
3. Medium 탭 복사 → 마크다운 헤딩 구조 확인
4. 속보 키워드 RSS 진입 → 붉은 배너 + 알림음
5. API 키 빈 상태에서 변환 시도 → 설정 모달 자동 오픈

## 17. Acceptance Criteria Mapping

| 스펙 요구 | 충족 |
|---|---|
| Bolt.new에 넣으면 에러 없이 렌더 | Vite + 외부 의존 최소화 |
| 3개 탭 형식 다르게 출력 | `promptChain` Call 2 + `OutputTabs` |
| 클릭 시 클립보드 복사 | `copyToClipboard` |
| 금지어 차단 | `bannedWords.scan` × 2 단계 |
| 팩트 불일치 경고 | `factCheck.verify` + `FactCheckLog` |
| 30초 속보 시뮬레이션 | `breakingDetector` 시뮬레이터 |
| API 키 가이드 | `SettingsModal` 자동 오픈 |
| MUST/SHOULD 규칙 | 프롬프트에 명시 |

## 18. Open Items / Future Work

- 다국어 출력 (일본어, 중국어 등) — MVP 이후
- 자체 백엔드 도입 시 Naver 검색 API 통합 (한국 뉴스 풀 확대)
- 실제 본문 전체 추출 (`@mozilla/readability` 클라이언트 사이드)
- A/B 비교 (같은 기사를 두 스타일로 동시 생성)
- 자동 게시 (X / Medium API 연동)
