# NIE Phase 1 — 카테고리 기반 단일 소스 드래프트 엔진 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 발행 판정(Pass/Fail)을 제거하고, 카테고리(렌즈)별 기준/말투 템플릿에 따라 단일 LLM 호출로 구조화된 발행용 드래프트(`summary/headline/body/tags/imagePrompt`)를 생성한다.

**Architecture:** 기존 단일 호출 엔진(`generateStory`)을 유지하되, system 프롬프트를 선택된 `Category`의 `criteria+tone`으로 구성한다. 출력은 라벨 없는 구조화 필드. 카테고리는 워크벤치 드롭다운으로 선택, 설정 2탭(AI·연결 / 카테고리)에서 편집. 이력은 schemaVersion 3 가드로 구버전 폐기.

**Tech Stack:** React 18 + TypeScript + Vite + Vitest + Testing Library. LLM은 OpenAI 호환 `chatJson`(fetch).

**Commit 정책:** 이 저장소는 사용자 명시 요청 시에만 커밋한다(CLAUDE.md). 각 Task는 커밋 대신 `npm run build` / `npx vitest run` 검증으로 마무리하고, 전체 완료 후 사용자가 직접 커밋한다.

**Spec:** [docs/superpowers/specs/2026-05-27-nie-category-value-engine-design.md](../specs/2026-05-27-nie-category-value-engine-design.md)

---

## File Structure

- `src/types.ts` — `Category`, 새 `StoryOutput`, `ConvertedResult`(v3, categoryId), `Settings`(categories/activeCategoryId, customStyleInstruction 제거)
- `src/lib/defaultCategories.ts` *(신규)* — 기본 5 카테고리
- `src/lib/promptChain.ts` — `generateStory(articles, settings, category)`, `sanitizeBody`, `buildInitialResult`
- `src/lib/defaultSettings.ts` — categories/activeCategoryId 기본값
- `src/state/SettingsContext.tsx` — 카테고리 CRUD + activeCategoryId 세터
- `src/state/ConversionContext.tsx` — analyze가 활성 카테고리로 호출, `setText`/`setTags`
- `src/components/Workbench.tsx` — 카테고리 드롭다운 + 필드별 박스(개별 복사)
- `src/components/StoryPreview.tsx` — headline+body 마크다운 미리보기
- `src/components/SettingsModal.tsx` — 2탭(AI·연결 / 카테고리)
- `src/components/HistoryPanel.tsx` — 카테고리 라벨 + summary 표시
- `src/data/guideContent.ts` — 문구 갱신
- 제거: `src/lib/styles.ts`(+`styles.test.ts`)
- 테스트: `promptChain.test.ts`(재작성), `SettingsContext.test.tsx`(신규), `HistoryContext.test.tsx`(갱신)

---

## Task 1: 타입 계약 (types.ts)

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: `Category` 타입 추가** (파일 내 `ValueDecision` 정의 위치를 찾아 그 블록을 교체)

기존:
```ts
export type ValueDecision = 'Pass' | 'Fail';

// LLM이 반환하는 정확히 3개 키 (단일 드래프트 엔진 산출물)
export type StoryOutput = {
  valueDecision: ValueDecision;
  holdReason: string;   // 한국어
  storyDraft: string;   // 5섹션 마크다운 (§5만 영문)
};

export const CONVERTED_RESULT_SCHEMA_VERSION = 2;

export type ConvertedResult = {
  schemaVersion: typeof CONVERTED_RESULT_SCHEMA_VERSION;
  id: string;
  sourceArticleIds: string[];
  sourceTitle: string;
  createdAt: number;
  valueDecision: ValueDecision;
  holdReason: string;
  storyDraft: string;
  model: ModelId;
};
```

교체:
```ts
export type Category = {
  id: string;
  label: string;
  criteria: string;  // 선별/평가 기준 템플릿
  tone: string;      // 말투/문체 템플릿
};

// LLM이 반환하는 정확히 5개 키 (구조화 발행 드래프트)
export type StoryOutput = {
  summary: string;     // 중립 요약 1~2줄 (판단 X)
  headline: string;
  body: string;        // 발행용 깨끗한 본문 (섹션 라벨 없음)
  tags: string[];
  imagePrompt: string; // 순수 영문(Midjourney)
};

export const CONVERTED_RESULT_SCHEMA_VERSION = 3;

export type ConvertedResult = StoryOutput & {
  schemaVersion: typeof CONVERTED_RESULT_SCHEMA_VERSION;
  id: string;
  sourceArticleIds: string[];
  sourceTitle: string;
  createdAt: number;
  model: ModelId;
  categoryId: string;
};
```

- [ ] **Step 2: `Settings`에서 customStyleInstruction 제거, categories/activeCategoryId 추가**

기존 `Settings` 타입에서 다음 줄을 제거:
```ts
  customStyleInstruction: string;
```
그리고 `model: ModelId;` 바로 다음에 추가:
```ts
  categories: Category[];
  activeCategoryId: string;
```

- [ ] **Step 3: 빌드로 타입 참조 깨짐 확인**

Run: `npm run build`
Expected: FAIL — `customStyleInstruction`, `valueDecision`, `holdReason`, `storyDraft`를 참조하는 파일들(styles.ts, promptChain.ts, ConversionContext.tsx, Workbench.tsx, StoryPreview.tsx, HistoryPanel.tsx, SettingsContext.tsx, SettingsModal.tsx, defaultSettings.ts, 테스트들)에서 컴파일 에러. 이는 정상이며 이후 Task에서 해소.

---

## Task 2: 기본 카테고리 (defaultCategories.ts)

**Files:**
- Create: `src/lib/defaultCategories.ts`
- Test: `src/lib/defaultCategories.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

Create `src/lib/defaultCategories.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { DEFAULT_CATEGORIES } from './defaultCategories';

describe('DEFAULT_CATEGORIES', () => {
  it('has five categories with unique ids', () => {
    expect(DEFAULT_CATEGORIES).toHaveLength(5);
    const ids = DEFAULT_CATEGORIES.map(c => c.id);
    expect(new Set(ids).size).toBe(5);
    expect(ids).toContain('screen');
  });

  it('every category has non-empty label, criteria, tone', () => {
    for (const c of DEFAULT_CATEGORIES) {
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.criteria.length).toBeGreaterThan(20);
      expect(c.tone.length).toBeGreaterThan(10);
    }
  });

  it('screen category treats pre-release promo as valid content', () => {
    const screen = DEFAULT_CATEGORIES.find(c => c.id === 'screen')!;
    expect(screen.criteria).toContain('홍보');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/lib/defaultCategories.test.ts`
Expected: FAIL — `Cannot find module './defaultCategories'`

- [ ] **Step 3: 구현**

Create `src/lib/defaultCategories.ts`:
```ts
import type { Category } from '../types';

export const DEFAULT_CATEGORIES: Category[] = [
  {
    id: 'music',
    label: '🎵 음악·K-pop',
    criteria: '컴백/신곡/음원·앨범 발매, 차트 성과·판매량, 콘서트·투어, 멤버 활동을 핵심으로 다룬다. 음원 성적·차트 순위·판매량 등 구체 수치가 있으면 우선 반영한다.',
    tone: 'K-pop 전문 매체 톤. 팬 친화적이되 과장 자제. 컴백/타이틀곡/팬덤명 등 업계 용어를 자연스럽게. 짧고 리듬감 있는 문장.',
  },
  {
    id: 'screen',
    label: '🎬 드라마·영화·예능',
    criteria: '방영·개봉·공개 일정, 캐스팅, 줄거리·설정 공개, 예고편·포스터, 시청률·흥행을 다룬다. 방영 전 홍보·티저성 내용도 정상 콘텐츠로 취급하며 가치가 낮다고 보지 않는다. 출연진·감독·핵심 줄거리를 정확히 정리한다.',
    tone: '콘텐츠 소개 톤. 줄거리·관전 포인트를 흥미롭게 전달하되 스포일러·과장 자제. 작품명·배우명을 정확히 쓴다.',
  },
  {
    id: 'people',
    label: '🧑‍🎤 배우·아이돌 인물',
    criteria: '특정 인물의 활동·근황·인터뷰·화보·SNS·수상을 다룬다. 누가 무엇을 했는지 사실 중심으로 정리한다. 인물명·소속사를 정확히 쓴다.',
    tone: '인물 중심의 친근한 톤. 활동 맥락을 간결하게 전달한다.',
  },
  {
    id: 'gossip',
    label: '💕 연애·결혼·가십',
    criteria: '열애·결별·결혼·이혼·임신 등 사생활 이슈를 다룬다. 출처와 확인 여부를 명확히 구분한다(소속사 공식 입장 vs 보도/추측). 미확인 정보는 미확인으로 표기한다.',
    tone: '신중한 톤. 단정 대신 출처를 명시한다("소속사는 ~라고 밝혔다", "~로 알려졌다"). 자극적 표현을 자제한다.',
  },
  {
    id: 'events',
    label: '🏆 시상식·행사·차트',
    criteria: '시상식 수상·후보, 라인업, 차트 순위·기록, 페스티벌·행사를 다룬다. 수상명·순위·날짜 등 구체 사실을 우선한다.',
    tone: '정리·요약 중심 톤. 수상/순위를 명확한 리스트성 문장으로 전달한다.',
  },
];
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/lib/defaultCategories.test.ts`
Expected: PASS (3 tests)

---

## Task 3: 엔진 (promptChain.ts)

**Files:**
- Modify: `src/lib/promptChain.ts` (전체 재작성)
- Test: `src/lib/promptChain.test.ts` (전체 재작성)

- [ ] **Step 1: 실패 테스트 작성** — `src/lib/promptChain.test.ts` 전체를 아래로 교체

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateStory, sanitizeBody, buildInitialResult } from './promptChain';
import * as openai from './openai';
import type { Settings, Article, Category, StoryOutput } from '../types';
import { DEFAULT_CATEGORIES } from './defaultCategories';

const CATEGORY: Category = DEFAULT_CATEGORIES.find(c => c.id === 'screen')!;

const SETTINGS: Settings = {
  provider: 'openai',
  apiKey: 'sk-test',
  apiBaseUrl: 'https://api.openai.com/v1',
  rss2jsonApiKey: '',
  model: 'gpt-4o-mini',
  categories: DEFAULT_CATEGORIES,
  activeCategoryId: 'screen',
  rssSources: [],
  rssPollMinutes: 5,
  clusterThreshold: 0.35,
  simulatorEnabled: false,
  simulatorIntervalSec: 30,
  alertSoundEnabled: true,
  browserNotificationsEnabled: false,
};

const ARTICLE_A: Article = {
  id: 'a1', title: "JTBC '리본 루키' 출연진 공개",
  description: "JTBC 새 드라마 '리본 루키'가 출연진과 줄거리를 공개했다.",
  link: 'https://e.com/1', pubDate: '', source: '연합', inputType: 'rss', fetchedAt: 100,
};
const ARTICLE_B: Article = {
  id: 'a2', title: "'리본 루키' 티저 공개",
  description: '영혼 교체 설정의 예고편이 공개됐다.',
  link: 'https://e.com/2', pubDate: '', source: 'Soompi', inputType: 'rss', fetchedAt: 200,
};

const STORY: StoryOutput = {
  summary: "JTBC 새 드라마 '리본 루키'가 줄거리와 출연진을 공개했습니다.",
  headline: "JTBC '리본 루키', 영혼 교체 줄거리 공개",
  body: '드라마가 첫 방송을 앞두고 주요 줄거리를 공개했다. 출연진은 호흡을 자랑했다.',
  tags: ['리본루키', 'JTBC'],
  imagePrompt: 'A dramatic K-drama scene, soul swap, cinematic lighting.',
};

beforeEach(() => vi.restoreAllMocks());

describe('sanitizeBody', () => {
  it('strips internal section-label lines but keeps prose', () => {
    const dirty = '# 1. 헤드라인\n## 2. 스토리텔링형 본문\n진짜 본문 한 줄.\n## 3. 태그\n#a #b';
    const clean = sanitizeBody(dirty);
    expect(clean).toBe('진짜 본문 한 줄.\n#a #b');
    expect(clean).not.toContain('## 2.');
    expect(clean).not.toContain('# 1.');
  });
});

describe('generateStory', () => {
  it('returns the 5-key story object and injects category criteria+tone', async () => {
    const spy = vi.spyOn(openai, 'chatJson').mockResolvedValueOnce(STORY);

    const out = await generateStory([ARTICLE_A, ARTICLE_B], SETTINGS, CATEGORY);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(out.headline).toContain('리본 루키');
    expect(out.tags).toEqual(['리본루키', 'JTBC']);

    const call = spy.mock.calls[0][0] as { user: string; system: string };
    expect(call.user).toContain('연합');
    expect(call.user).toContain('Soompi');
    expect(call.system).toContain(CATEGORY.criteria);
    expect(call.system).toContain(CATEGORY.tone);
    expect(call.system).toContain('발행 여부를 판단하지');
  });

  it('sanitizes leftover section labels in body and coerces tags to array', async () => {
    vi.spyOn(openai, 'chatJson').mockResolvedValueOnce({
      ...STORY,
      body: '## 2. 스토리텔링형 본문\n깨끗해야 하는 본문.',
      tags: undefined as unknown as string[],
    });
    const out = await generateStory([ARTICLE_A], SETTINGS, CATEGORY);
    expect(out.body).toBe('깨끗해야 하는 본문.');
    expect(out.tags).toEqual([]);
  });

  it('throws on empty input', async () => {
    await expect(generateStory([], SETTINGS, CATEGORY)).rejects.toThrow(/at least one/i);
  });
});

describe('buildInitialResult', () => {
  it('wraps a StoryOutput into a versioned ConvertedResult with categoryId', () => {
    const r = buildInitialResult([ARTICLE_A, ARTICLE_B], STORY, SETTINGS, CATEGORY);
    expect(r.schemaVersion).toBe(3);
    expect(r.categoryId).toBe('screen');
    expect(r.summary).toBe(STORY.summary);
    expect(r.headline).toBe(STORY.headline);
    expect(r.body).toBe(STORY.body);
    expect(r.tags).toEqual(STORY.tags);
    expect(r.imagePrompt).toBe(STORY.imagePrompt);
    expect(r.sourceArticleIds).toEqual(['a1', 'a2']);
    expect(r.sourceTitle).toBe(ARTICLE_B.title); // newest by fetchedAt
    expect(r.model).toBe('gpt-4o-mini');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/lib/promptChain.test.ts`
Expected: FAIL — `sanitizeBody` 미존재 / `generateStory` 시그니처 불일치

- [ ] **Step 3: 구현** — `src/lib/promptChain.ts` 전체를 아래로 교체

```ts
import type { Article, Settings, Category, ConvertedResult, StoryOutput } from '../types';
import { CONVERTED_RESULT_SCHEMA_VERSION } from '../types';
import { chatJson } from './openai';

const BANNED_LIST_FOR_PROMPT =
  'delve, in conclusion, furthermore, testament, moreover, "it is important to note", ' +
  '"not only ... but also", "as an AI", "I think/believe/feel".';

// body에 남은 내부 섹션 라벨 줄("# 1. ...", "## 2. ...")을 제거하는 안전망
export function sanitizeBody(body: string): string {
  return body
    .split('\n')
    .filter(line => !/^\s*#{1,6}\s*\d+\.\s/.test(line))
    .join('\n')
    .trim();
}

function buildStorySystem(category: Category): string {
  return [
    '당신은 한국 연예 매체의 시니어 에디터입니다.',
    '여러 매체가 동일 사건을 다룬 한국어 기사 N건을 입력으로 받습니다.',
    '',
    `[카테고리: ${category.label}]`,
    '[선별·정리 기준]',
    category.criteria,
    '[말투]',
    category.tone,
    '',
    '[작업] 발행 여부를 판단하지 마라. 위 기준과 말투로 기사들을 교차검증해 정리·종합만 한다.',
    '',
    '[MUST]',
    '- summary: 무엇에 관한 기사인지 중립적으로 1~2줄(누가/무엇/핵심). 가치 평가나 발행 권고 금지.',
    '- headline: 기사 제목.',
    '- body: 머리표·섹션 라벨(#, "## 2." 등) 없이 깨끗한 발행용 본문. 매체 간 충돌 시 가장 일관된 값 채택, 충돌 사실은 summary에 명시.',
    '- 원문에 없는 사실 추측·창작 금지. 핵심 엔티티(인물/장소/소속사) 누락 금지.',
    '- tags: 해시태그 문자열 배열(# 없이 키워드만). imagePrompt: 순수 영문(Midjourney 호환, 한국어 금지).',
    `- 영어 LLM 상투구 회피: ${BANNED_LIST_FOR_PROMPT}`,
    '',
    '오직 valid JSON, 정확히 5개 키:',
    '{ "summary": string, "headline": string, "body": string, "tags": string[], "imagePrompt": string }',
  ].join('\n');
}

function buildStoryUser(articles: Article[]): string {
  const parts: string[] = [`[같은 사건을 다룬 ${articles.length}개 소스 기사]`, ''];
  articles.forEach((a, i) => {
    parts.push(`--- 소스 ${i + 1}: ${a.source} ---`);
    parts.push(`제목: ${a.title}`);
    parts.push(`본문: ${a.fullText || a.description}`);
    if (a.pubDate) parts.push(`발행: ${a.pubDate}`);
    parts.push('');
  });
  return parts.join('\n');
}

export async function generateStory(
  articles: Article[],
  settings: Settings,
  category: Category,
): Promise<StoryOutput> {
  if (articles.length === 0) throw new Error('generateStory requires at least one article');

  const out = await chatJson<StoryOutput>({
    apiKey: settings.apiKey,
    baseUrl: settings.apiBaseUrl,
    model: settings.model,
    system: buildStorySystem(category),
    user: buildStoryUser(articles),
    temperature: 0.5,
  });

  return {
    summary: out.summary ?? '',
    headline: out.headline ?? '',
    body: sanitizeBody(out.body ?? ''),
    tags: Array.isArray(out.tags) ? out.tags : [],
    imagePrompt: out.imagePrompt ?? '',
  };
}

export function buildInitialResult(
  articles: Article[],
  story: StoryOutput,
  settings: Settings,
  category: Category,
): ConvertedResult {
  const newest = articles.reduce((p, c) => (c.fetchedAt > p.fetchedAt ? c : p), articles[0]);
  return {
    schemaVersion: CONVERTED_RESULT_SCHEMA_VERSION,
    id: `${newest.id}-${Date.now()}`,
    sourceArticleIds: articles.map(a => a.id),
    sourceTitle: newest.title,
    createdAt: Date.now(),
    model: settings.model,
    categoryId: category.id,
    summary: story.summary,
    headline: story.headline,
    body: story.body,
    tags: story.tags,
    imagePrompt: story.imagePrompt,
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/lib/promptChain.test.ts`
Expected: PASS (5 tests)

---

## Task 4: styles.ts 제거

**Files:**
- Delete: `src/lib/styles.ts`, `src/lib/styles.test.ts`

- [ ] **Step 1: 잔여 import 확인**

Run: `grep -rn "lib/styles\|getStyleInstruction\|DEFAULT_STYLE_INSTRUCTION\|STYLE_PRESETS" src --include="*.ts" --include="*.tsx"`
Expected: 이 시점에 남은 참조는 `styles.test.ts` 자신뿐(promptChain은 Task 3에서 import 제거됨). 만약 다른 참조가 있으면 해당 파일을 먼저 정리.

- [ ] **Step 2: 삭제**

Run: `rm -f src/lib/styles.ts src/lib/styles.test.ts`

- [ ] **Step 3: 확인**

Run: `npx vitest run src/lib/`
Expected: promptChain/defaultCategories 테스트 PASS, styles 관련 테스트 없음.

---

## Task 5: 설정 기본값 + 컨텍스트 (defaultSettings.ts, SettingsContext.tsx)

**Files:**
- Modify: `src/lib/defaultSettings.ts`
- Modify: `src/state/SettingsContext.tsx`
- Test: `src/state/SettingsContext.test.tsx` (신규)

- [ ] **Step 1: defaultSettings.ts 수정**

import 추가(파일 상단):
```ts
import { DEFAULT_CATEGORIES } from './defaultCategories';
```
`DEFAULT_SETTINGS` 객체에서 `customStyleInstruction: '',` 줄을 제거하고, `model: 'gpt-4o-mini',` 다음에 추가:
```ts
  categories: DEFAULT_CATEGORIES,
  activeCategoryId: 'music',
```

- [ ] **Step 2: SettingsContext 실패 테스트 작성** — Create `src/state/SettingsContext.test.tsx`

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { SettingsProvider, useSettings } from './SettingsContext';

function Probe() {
  const { settings, setActiveCategoryId, addCategory, updateCategory, removeCategory } = useSettings();
  return (
    <div>
      <span data-testid="count">{settings.categories.length}</span>
      <span data-testid="active">{settings.activeCategoryId}</span>
      <span data-testid="screen-label">
        {settings.categories.find(c => c.id === 'screen')?.label}
      </span>
      <button onClick={() => setActiveCategoryId('screen')}>activate</button>
      <button onClick={() => addCategory()}>add</button>
      <button onClick={() => updateCategory('music', { label: 'EDITED' })}>edit</button>
      <button onClick={() => removeCategory('events')}>remove</button>
    </div>
  );
}

beforeEach(() => localStorage.clear());

describe('SettingsContext categories', () => {
  it('starts with 5 default categories and music active', () => {
    render(<SettingsProvider><Probe /></SettingsProvider>);
    expect(screen.getByTestId('count')).toHaveTextContent('5');
    expect(screen.getByTestId('active')).toHaveTextContent('music');
  });

  it('setActiveCategoryId switches the active lens', () => {
    render(<SettingsProvider><Probe /></SettingsProvider>);
    act(() => screen.getByText('activate').click());
    expect(screen.getByTestId('active')).toHaveTextContent('screen');
  });

  it('addCategory / updateCategory / removeCategory mutate the list', () => {
    render(<SettingsProvider><Probe /></SettingsProvider>);
    act(() => screen.getByText('add').click());
    expect(screen.getByTestId('count')).toHaveTextContent('6');
    act(() => screen.getByText('edit').click());
    // music label edited via updateCategory; screen label untouched
    expect(screen.getByTestId('screen-label')).toHaveTextContent('🎬');
    act(() => screen.getByText('remove').click());
    expect(screen.getByTestId('count')).toHaveTextContent('5');
  });
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `npx vitest run src/state/SettingsContext.test.tsx`
Expected: FAIL — `setActiveCategoryId`/`addCategory`/`updateCategory`/`removeCategory` 미존재

- [ ] **Step 4: SettingsContext 구현 수정**

import 변경(파일 상단) — `Category` 타입 추가, `customStyleInstruction` 관련 제거:
```ts
import type { Settings, ModelId, RssSource, ProviderId, Category } from '../types';
```

`Ctx` 타입에서 `setCustomStyleInstruction: (s: string) => void;` 줄을 제거하고, `setModel` 줄 다음에 추가:
```ts
  setActiveCategoryId: (id: string) => void;
  addCategory: () => void;
  updateCategory: (id: string, patch: Partial<Category>) => void;
  removeCategory: (id: string) => void;
```

`setCustomStyleInstruction` useCallback 정의를 제거하고, `setModel` 정의 다음에 추가:
```ts
  const setActiveCategoryId = useCallback((id: string) => setSettings(s => ({ ...s, activeCategoryId: id })), []);
  const addCategory = useCallback(() => setSettings(s => {
    const id = `cat-${Date.now()}`;
    const next: Category = { id, label: '새 카테고리', criteria: '', tone: '' };
    return { ...s, categories: [...s.categories, next], activeCategoryId: id };
  }), []);
  const updateCategory = useCallback((id: string, patch: Partial<Category>) => setSettings(s => ({
    ...s,
    categories: s.categories.map(c => (c.id === id ? { ...c, ...patch } : c)),
  })), []);
  const removeCategory = useCallback((id: string) => setSettings(s => {
    const categories = s.categories.filter(c => c.id !== id);
    const activeCategoryId = s.activeCategoryId === id
      ? (categories[0]?.id ?? '')
      : s.activeCategoryId;
    return { ...s, categories, activeCategoryId };
  }), []);
```

`value: Ctx` 객체 리터럴에서 `setCustomStyleInstruction`를 제거하고 `setModel,` 뒤에 추가:
```ts
    setActiveCategoryId, addCategory, updateCategory, removeCategory,
```

또한 provider 초기화에서 구 설정에 categories가 없을 때를 대비해 머지 보강 — `useState` 초기화의 return을 아래로 교체:
```ts
    return {
      ...DEFAULT_SETTINGS,
      ...stored,
      rssSources: stored.rssSources || DEFAULT_SETTINGS.rssSources,
      categories: stored.categories && stored.categories.length > 0 ? stored.categories : DEFAULT_SETTINGS.categories,
      activeCategoryId: stored.activeCategoryId || DEFAULT_SETTINGS.activeCategoryId,
    };
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run src/state/SettingsContext.test.tsx`
Expected: PASS (3 tests)

---

## Task 6: 변환 상태 + 이력 가드 (ConversionContext.tsx, HistoryContext.test.tsx)

**Files:**
- Modify: `src/state/ConversionContext.tsx` (전체 재작성)
- Modify: `src/state/HistoryContext.test.tsx`

> `src/state/HistoryContext.tsx`는 변경 불필요 — 로드 가드가 이미 `CONVERTED_RESULT_SCHEMA_VERSION`(=Task 1에서 3으로 변경됨)으로 필터링하므로 v2 항목이 자동 폐기된다.

- [ ] **Step 1: HistoryContext 테스트 갱신** — `src/state/HistoryContext.test.tsx`의 `make()`와 버전가드 테스트를 새 스키마로 교체

`make()` 함수를 아래로 교체:
```ts
function make(id: string): ConvertedResult {
  return {
    schemaVersion: 3,
    id,
    sourceArticleIds: ['a'],
    sourceTitle: 't',
    createdAt: parseInt(id) || Date.now(),
    model: 'gpt-4o-mini',
    categoryId: 'music',
    summary: '요약',
    headline: '헤드라인',
    body: '본문',
    tags: ['a'],
    imagePrompt: 'prompt',
  };
}
```

버전 가드 테스트(있는 `version guard ...` it 블록)의 localStorage 세팅을 아래로 교체:
```ts
    localStorage.setItem('nie:history.v2', JSON.stringify([
      { id: 'old1', sourceTitle: 'legacy', channels: {} },  // no schemaVersion
      { ...make('111'), schemaVersion: 2 },                  // wrong version
      make('222'),                                           // valid v3
    ]));
```
(스토리지 키 `nie:history.v2`는 그대로 유지되며, 가드가 `schemaVersion === 3`만 통과시켜 위 3건 중 1건만 로드됨.)

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/state/HistoryContext.test.tsx`
Expected: 컴파일/런타임 FAIL (이전 ConversionContext가 아직 구 스키마 참조) 또는 가드 테스트 실패 — 다음 단계 후 통과.

- [ ] **Step 3: ConversionContext 전체 재작성** — `src/state/ConversionContext.tsx`

```tsx
import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { Article, ConvertedResult, StoryOutput } from '../types';
import { generateStory, buildInitialResult } from '../lib/promptChain';
import { OpenAIError } from '../lib/openai';
import { useSettings } from './SettingsContext';
import { useHistory } from './HistoryContext';

type Status = 'idle' | 'analyzing' | 'error';
type TextField = 'summary' | 'headline' | 'body' | 'imagePrompt';

type Ctx = {
  status: Status;
  error: string | null;
  currentResult: ConvertedResult | null;
  analyze: (articles: Article[]) => Promise<void>;
  setText: (field: TextField, value: string) => void;
  setTags: (tags: string[]) => void;
  loadResult: (result: ConvertedResult) => void;
  clearError: () => void;
};

const ConversionCtx = createContext<Ctx | null>(null);

function toErrorMessage(err: unknown): string {
  if (err instanceof OpenAIError) {
    if (err.status === 429) {
      return `API 한도/잔액 초과 (429): ${err.message}\n→ ⚙ 설정에서 Provider/모델 전환 또는 결제/한도 확인.`;
    }
    if (err.status === 401) {
      return `인증 실패 (401): API 키가 잘못되었거나 만료. ⚙ 설정에서 다시 입력하세요.`;
    }
    if (err.status === 404) {
      return `API 404: 모델 ID가 해당 provider에서 지원되지 않거나 base URL이 잘못됨. ⚙ 설정 확인.`;
    }
    return `API 오류 (${err.status}): ${err.message}`;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

export function ConversionProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const { addEntry } = useHistory();
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [currentResult, setCurrentResult] = useState<ConvertedResult | null>(null);

  const analyze = useCallback(async (articles: Article[]) => {
    if (!settings.apiKey) { setError('NO_API_KEY'); return; }
    if (articles.length === 0) { setError('변환할 기사가 없습니다.'); return; }
    const category = settings.categories.find(c => c.id === settings.activeCategoryId)
      ?? settings.categories[0];
    if (!category) { setError('카테고리가 없습니다. ⚙ 설정에서 추가하세요.'); return; }
    setStatus('analyzing');
    setError(null);
    try {
      const story = await generateStory(articles, settings, category);
      const result = buildInitialResult(articles, story, settings, category);
      setCurrentResult(result);
      addEntry(result);
      setStatus('idle');
    } catch (err) {
      setError(toErrorMessage(err));
      setStatus('error');
    }
  }, [settings, addEntry]);

  const setText = useCallback((field: TextField, value: string) => {
    setCurrentResult(prev => (prev ? { ...prev, [field]: value } : prev));
  }, []);

  const setTags = useCallback((tags: string[]) => {
    setCurrentResult(prev => (prev ? { ...prev, tags } : prev));
  }, []);

  const loadResult = useCallback((r: ConvertedResult) => setCurrentResult(r), []);
  const clearError = useCallback(() => setError(null), []);

  return (
    <ConversionCtx.Provider value={{
      status, error, currentResult,
      analyze, setText, setTags, loadResult, clearError,
    }}>
      {children}
    </ConversionCtx.Provider>
  );
}

export function useConversion(): Ctx {
  const ctx = useContext(ConversionCtx);
  if (!ctx) throw new Error('useConversion must be used within ConversionProvider');
  return ctx;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/state/`
Expected: HistoryContext + SettingsContext 테스트 PASS

---

## Task 7: 워크벤치 UI (Workbench.tsx)

**Files:**
- Modify: `src/components/Workbench.tsx` (전체 재작성)

> 컴포넌트 테스트 하네스가 없으므로 TDD 대신 `npm run build` + 수동 검증으로 확인한다.

- [ ] **Step 1: 전체 재작성** — `src/components/Workbench.tsx`

```tsx
import { useEffect, useState } from 'react';
import { Loader2, Sparkles, AlertOctagon, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Copy, Check } from 'lucide-react';
import { useClusters } from '../state/ClustersContext';
import { useConversion } from '../state/ConversionContext';
import { useSettings } from '../state/SettingsContext';
import { copyToClipboard } from '../lib/clipboard';
import { PROVIDERS } from '../types';

type Props = {
  onMissingKey: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
};

type FieldKey = 'summary' | 'headline' | 'body' | 'tags' | 'imagePrompt';

const FIELD_META: Array<{ key: FieldKey; label: string; placeholder: string; rows: number }> = [
  { key: 'summary', label: '요약', placeholder: '생성 후 무엇에 관한 기사인지 중립 요약이 표시됩니다.', rows: 2 },
  { key: 'headline', label: '헤드라인', placeholder: '제목', rows: 1 },
  { key: 'body', label: '본문 (발행용)', placeholder: '라벨 없는 깨끗한 발행 본문', rows: 8 },
  { key: 'tags', label: '태그', placeholder: '공백/쉼표로 구분 (예: 리본루키 JTBC)', rows: 1 },
  { key: 'imagePrompt', label: 'AI 이미지 프롬프트 (영문)', placeholder: 'English Midjourney prompt', rows: 3 },
];

export function Workbench({ onMissingKey, collapsed = false, onToggleCollapsed }: Props) {
  const { selectedCluster, selectedArticles } = useClusters();
  const { settings, setModel, setActiveCategoryId } = useSettings();
  const { status, error, currentResult, analyze, setText, setTags, clearError } = useConversion();

  const [sourceIdx, setSourceIdx] = useState(0);
  const [copiedField, setCopiedField] = useState<FieldKey | null>(null);

  useEffect(() => { setSourceIdx(0); }, [selectedCluster?.id]);

  const triggerAnalyze = () => {
    if (selectedArticles.length === 0) return;
    if (!settings.apiKey) { onMissingKey(); return; }
    analyze(selectedArticles);
  };

  const totalSources = selectedArticles.length;
  const currentSource = selectedArticles[sourceIdx];
  const isBusy = status === 'analyzing';

  const fieldText = (key: FieldKey): string => {
    if (!currentResult) return '';
    if (key === 'tags') return currentResult.tags.join(' ');
    return currentResult[key];
  };

  const onFieldChange = (key: FieldKey, value: string) => {
    if (key === 'tags') {
      setTags(value.split(/[\s,]+/).map(t => t.replace(/^#/, '').trim()).filter(Boolean));
    } else {
      setText(key, value);
    }
  };

  const doCopy = async (key: FieldKey) => {
    const value = key === 'tags' && currentResult
      ? currentResult.tags.map(t => `#${t}`).join(' ')
      : fieldText(key);
    if (await copyToClipboard(value)) {
      setCopiedField(key);
      setTimeout(() => setCopiedField(null), 1500);
    }
  };

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div data-tutorial="workbench-header" className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-2">
        <div className="flex min-w-0 items-center gap-1">
          {onToggleCollapsed && (
            <button
              onClick={onToggleCollapsed}
              className="rounded p-1 text-slate-500 hover:bg-slate-100"
              title={collapsed ? '원문/드래프트 펼치기' : '원문/드래프트 접기'}
              aria-label={collapsed ? '펼치기' : '접기'}
            >
              {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </button>
          )}
          <h2 className="min-w-0 truncate text-sm font-semibold">
            {selectedCluster
              ? `📝 ${selectedCluster.representativeTitle} · ${totalSources}개 소스`
              : '👈 왼쪽에서 사건을 선택하세요'}
          </h2>
        </div>
        <div className="flex items-center gap-2 flex-none">
          <select
            value={settings.activeCategoryId}
            onChange={e => setActiveCategoryId(e.target.value)}
            className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs"
            title="카테고리(렌즈) 선택"
          >
            {settings.categories.map(c => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
          <label className="flex items-center gap-1 text-xs text-slate-500">
            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold">{PROVIDERS[settings.provider].name}</span>
            <select
              value={settings.model}
              onChange={e => setModel(e.target.value)}
              className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs"
              title="모델 선택"
            >
              {PROVIDERS[settings.provider].models.map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
              {!PROVIDERS[settings.provider].models.some(m => m.id === settings.model) && (
                <option value={settings.model}>{settings.model} (custom)</option>
              )}
            </select>
          </label>
          <button
            disabled={!selectedCluster || isBusy}
            onClick={triggerAnalyze}
            className="flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {isBusy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {isBusy ? '평가 & 종합 중…' : '✨ 가치 평가 & 종합'}
          </button>
        </div>
      </div>

      {error && error !== 'NO_API_KEY' && (
        <div className="flex items-start gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 whitespace-pre-wrap">
          <AlertOctagon size={16} className="mt-0.5 flex-none" />
          <span className="flex-1">{error}</span>
          <button onClick={clearError} className="text-xs underline">닫기</button>
        </div>
      )}

      {collapsed && (
        <div className="bg-slate-50 px-4 py-2 text-xs text-slate-500">
          원문/드래프트 영역이 접혀있습니다. 위 ⌄ 버튼을 눌러 펼치세요.
        </div>
      )}

      <div className={(collapsed ? 'hidden ' : '') + 'grid flex-1 min-h-0 grid-cols-2 gap-2 overflow-hidden p-3'}>
        <div className="flex min-h-0 flex-col rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-1.5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              원문 (한국어) {totalSources > 0 && `${sourceIdx + 1}/${totalSources}`}
            </h3>
            {totalSources > 1 && (
              <div className="flex items-center gap-1">
                <button onClick={() => setSourceIdx(i => (i - 1 + totalSources) % totalSources)} className="rounded p-1 hover:bg-slate-100" aria-label="이전 소스"><ChevronLeft size={14} /></button>
                <button onClick={() => setSourceIdx(i => (i + 1) % totalSources)} className="rounded p-1 hover:bg-slate-100" aria-label="다음 소스"><ChevronRight size={14} /></button>
              </div>
            )}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-3">
            {currentSource ? (
              <>
                <div className="mb-2 text-xs text-slate-500">
                  <span className="rounded bg-slate-100 px-1.5">{currentSource.source}</span>
                  {currentSource.pubDate && <span className="ml-2">{currentSource.pubDate}</span>}
                </div>
                <div className="mb-2 text-sm font-medium text-slate-900">{currentSource.title}</div>
                <div className="whitespace-pre-wrap text-sm text-slate-800">
                  {currentSource.fullText || currentSource.description || '—'}
                </div>
                {currentSource.link && !currentSource.link.startsWith('manual://') && !currentSource.link.startsWith('simulator://') && (
                  <a href={currentSource.link} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-indigo-600 hover:underline">원문 보기 ↗</a>
                )}
              </>
            ) : <span className="text-sm text-slate-400">—</span>}
          </div>
        </div>

        <div data-tutorial="draft-panel" className="flex min-h-0 flex-col gap-2 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3">
          {!currentResult && !isBusy && (
            <p className="text-sm text-slate-400">
              사건을 선택하고 카테고리를 고른 뒤 [✨ 가치 평가 & 종합]을 누르면 아래 필드가 채워집니다.
            </p>
          )}
          {FIELD_META.map(({ key, label, placeholder, rows }) => (
            <div key={key} className="flex flex-col">
              <div className="mb-0.5 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
                <button
                  onClick={() => doCopy(key)}
                  disabled={!currentResult}
                  className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-40"
                  title={`${label} 복사`}
                >
                  {copiedField === key ? <Check size={12} /> : <Copy size={12} />}
                  {copiedField === key ? '복사됨' : '복사'}
                </button>
              </div>
              <textarea
                value={fieldText(key)}
                onChange={e => onFieldChange(key, e.target.value)}
                rows={rows}
                placeholder={placeholder}
                className="resize-y rounded border border-slate-200 p-2 text-sm text-slate-800 outline-none focus:border-indigo-400"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: 빌드 확인**

Run: `npm run build`
Expected: Workbench 관련 에러 없음 (StoryPreview/SettingsModal/HistoryPanel/guideContent는 아직 미수정이라 그쪽 에러는 남아있을 수 있음)

---

## Task 8: 발행용 미리보기 (StoryPreview.tsx)

**Files:**
- Modify: `src/components/StoryPreview.tsx` (전체 재작성)

- [ ] **Step 1: 전체 재작성** — `src/components/StoryPreview.tsx`

```tsx
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Copy, Check } from 'lucide-react';
import { useConversion } from '../state/ConversionContext';
import { copyToClipboard } from '../lib/clipboard';
import { scan } from '../lib/bannedWords';

export function StoryPreview() {
  const { currentResult } = useConversion();
  const [copied, setCopied] = useState(false);

  if (!currentResult) {
    return (
      <div data-tutorial="output-tabs" className="flex h-40 items-center justify-center text-sm text-slate-400">
        가치 평가 & 종합 결과(헤드라인 + 본문)가 여기에 표시됩니다.
      </div>
    );
  }

  const { headline, body } = currentResult;
  const markdown = `# ${headline}\n\n${body}`;
  const bannedHits = scan(body).hits;

  const doCopy = async () => {
    if (await copyToClipboard(markdown)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div data-tutorial="output-tabs" className="flex h-full min-h-0 flex-col border-t border-slate-200 bg-white">
      <div className="flex flex-wrap items-center border-b border-slate-200 px-4 py-1">
        <span className="text-sm font-medium text-slate-700">📄 발행용 미리보기 (헤드라인 + 본문)</span>
        <div className="ml-auto flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span>글자 {body.length}</span>
          {bannedHits.length > 0 && (
            <span className="font-semibold text-red-600">금지어 {bannedHits.length}건</span>
          )}
          <button
            onClick={doCopy}
            className="flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? '복사됨' : '복사'}
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-2">
        <div className="prose prose-sm max-w-none flex-1 overflow-y-auto rounded border border-slate-200 bg-slate-50 p-3">
          <ReactMarkdown>{markdown}</ReactMarkdown>
        </div>
        {bannedHits.length > 0 && (
          <p className="mt-1 px-1 text-xs text-red-600">
            ⚠ 금지어 발견: {bannedHits.join(', ')} — 본문에서 수정 후 복사 권장
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 빌드 확인**

Run: `npm run build`
Expected: StoryPreview 에러 없음

---

## Task 9: 설정 2탭 + 카테고리 편집 (SettingsModal.tsx)

**Files:**
- Modify: `src/components/SettingsModal.tsx`

- [ ] **Step 1: import 및 훅에 카테고리 세터 추가**

`useSettings()` 디스트럭처에서 `setCustomStyleInstruction`를 제거하고 카테고리 세터를 추가:
```ts
    settings, setApiKey, setRss2jsonApiKey, setProvider, setApiBaseUrl,
    setModel,
    addCategory, updateCategory, removeCategory,
    setRssSources, toggleRssSource, setRssPollMinutes, setClusterThreshold,
    setSimulatorEnabled, setSimulatorIntervalSec,
    setAlertSoundEnabled, setBrowserNotificationsEnabled,
```

`useState` 그룹에 탭 상태 추가:
```ts
  const [tab, setTab] = useState<'ai' | 'category'>('ai');
```

- [ ] **Step 2: 탭 바 추가** — 헤더(`⚙ 설정` div) 바로 다음, `<div className="space-y-6 p-5">` 시작 직전에 삽입

```tsx
        <div className="flex border-b border-slate-200 px-5">
          <button
            onClick={() => setTab('ai')}
            className={'px-3 py-2 text-sm font-medium border-b-2 ' + (tab === 'ai' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700')}
          >⚙ AI·연결</button>
          <button
            onClick={() => setTab('category')}
            className={'px-3 py-2 text-sm font-medium border-b-2 ' + (tab === 'category' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700')}
          >🎯 카테고리</button>
        </div>
```

- [ ] **Step 3: 기존 AI 섹션을 'ai' 탭으로 감싸고, 글 스타일 섹션 제거**

`<div className="space-y-6 p-5">`의 여는 태그를 아래로 교체:
```tsx
        <div className={'space-y-6 p-5 ' + (tab === 'ai' ? '' : 'hidden')}>
```
그리고 그 안에 있던 **"가치 기준 + 말투 통합 지침" `<section>` 전체를 삭제**한다(STEP 6에서 추가됐던 `customStyleInstruction` textarea 섹션). 나머지 섹션(Provider/키/rss2json/모델/RSS/클러스터링/알림/이력관리)은 그대로 둔다.

- [ ] **Step 4: 카테고리 탭 추가** — 위 `space-y-6 p-5` div(닫는 `</div>`) 바로 다음에 삽입

```tsx
        <div className={'space-y-4 p-5 ' + (tab === 'category' ? '' : 'hidden')}>
          <p className="text-xs text-slate-500">
            카테고리(렌즈)별로 <b>선별·정리 기준</b>과 <b>말투</b>를 정해둡니다. 워크벤치 상단 드롭다운에서 선택한 카테고리가 변환에 사용됩니다.
          </p>
          {settings.categories.map(c => (
            <div key={c.id} className="rounded border border-slate-200 p-3">
              <div className="mb-2 flex items-center gap-2">
                <input
                  value={c.label}
                  onChange={e => updateCategory(c.id, { label: e.target.value })}
                  className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm font-semibold"
                  placeholder="카테고리 이름"
                />
                <button
                  onClick={() => { if (confirm(`'${c.label}' 카테고리를 삭제할까요?`)) removeCategory(c.id); }}
                  className="rounded p-1 text-red-600 hover:bg-red-50"
                  aria-label="카테고리 삭제"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">선별·정리 기준</label>
              <textarea
                value={c.criteria}
                onChange={e => updateCategory(c.id, { criteria: e.target.value })}
                className="mb-2 w-full rounded border border-slate-300 px-2 py-1 text-sm h-20"
                placeholder="이 카테고리에서 무엇을 어떻게 다룰지"
              />
              <label className="mb-1 block text-xs font-semibold text-slate-500">말투</label>
              <textarea
                value={c.tone}
                onChange={e => updateCategory(c.id, { tone: e.target.value })}
                className="w-full rounded border border-slate-300 px-2 py-1 text-sm h-16"
                placeholder="문체·어조"
              />
            </div>
          ))}
          <button
            onClick={addCategory}
            className="flex items-center gap-1 rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            <Plus size={14} /> 카테고리 추가
          </button>
        </div>
```

(`Trash2`, `Plus`는 이미 이 파일에서 import 되어 있음 — 추가 import 불필요.)

- [ ] **Step 5: 빌드 확인**

Run: `npm run build`
Expected: SettingsModal 에러 없음

---

## Task 10: 이력 패널 (HistoryPanel.tsx)

**Files:**
- Modify: `src/components/HistoryPanel.tsx`

- [ ] **Step 1: 카테고리 라벨 + 요약 표시로 교체**

import에 `useSettings` 추가:
```ts
import { useSettings } from '../state/SettingsContext';
```
컴포넌트 본문 상단(`const { history, removeEntry } = useHistory();` 다음)에 추가:
```ts
  const { settings } = useSettings();
  const labelOf = (id: string) => settings.categories.find(c => c.id === id)?.label ?? id;
```
기존 항목 메타 div(생성시각 + Pass/Fail 배지 블록)를 아래로 교체:
```tsx
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span>{new Date(h.createdAt).toLocaleString('ko-KR')}</span>
                    <span className="rounded bg-slate-100 px-1.5 text-slate-700">{labelOf(h.categoryId)}</span>
                  </div>
                  <div className="mt-0.5 text-sm font-medium truncate">{h.sourceTitle}</div>
                  {h.summary && <div className="mt-0.5 text-xs text-slate-500 truncate">{h.summary}</div>}
```

- [ ] **Step 2: 빌드 확인**

Run: `npm run build`
Expected: HistoryPanel 에러 없음 + tsc 전체 통과(guideContent만 남았을 수 있음)

---

## Task 11: 인앱 가이드 문구 (guideContent.ts)

**Files:**
- Modify: `src/data/guideContent.ts`

> 문자열 데이터라 빌드는 깨지지 않지만, 사용자 노출 텍스트가 구 동작(Pass/Fail·storyDraft·단일 필드)을 설명하므로 갱신한다.

- [ ] **Step 1: 워크벤치 튜토리얼 스텝 갱신**

`title: '🛠 워크벤치 — Provider · 모델 · 변환 트리거'` 스텝의 `body`에서 "출력에 Pass/Fail 판정과 보류 사유(holdReason)가 함께 옵니다." 문장을 아래로 교체:
```
'• 헤더의 카테고리(렌즈) 드롭다운으로 음악·K-pop / 드라마·영화·예능 등 평가 기준을 고름\n\nLLM 호출은 단 1번. 출력은 요약·헤드라인·본문·태그·영문 이미지 프롬프트 5개 필드로 옵니다(발행 여부는 판단하지 않음).'
```

`title: '📝 5섹션 종합 드래프트 편집'` 스텝을 아래로 교체:
```ts
  {
    title: '📝 필드별 드래프트 편집',
    body: '우측 패널에 요약 / 헤드라인 / 본문 / 태그 / 이미지 프롬프트가 각각 별도 박스로 표시됩니다.\n\n• 각 박스는 직접 편집 + 개별 [복사] 가능\n• 본문(body)은 내부 섹션 라벨 없이 바로 발행 가능한 깨끗한 텍스트\n• 요약은 판단이 아니라 "무엇에 관한 기사인지" 빠른 파악용\n• 이미지 프롬프트는 순수 영문(Midjourney 호환)',
    targetSelector: '[data-tutorial="draft-panel"]',
  },
```

- [ ] **Step 2: 설정 튜토리얼/가이드의 "글 스타일·단일 필드" 언급을 카테고리로 갱신**

`getting-started` 또는 설정 설명에서 "가치 기준 + 말투 통합 지침" 단일 필드 언급이 있으면, 아래 문장으로 대체:
```
⚙ 설정은 [AI·연결] 탭과 [🎯 카테고리] 탭으로 나뉩니다. 카테고리 탭에서 렌즈별 선별 기준과 말투를 미리 정해두고, 워크벤치 드롭다운에서 골라 씁니다.
```
(해당 언급이 없으면 이 스텝은 건너뛴다.)

- [ ] **Step 3: 빌드 + 잔여 용어 확인**

Run: `grep -rn "Pass/Fail\|valueDecision\|storyDraft\|holdReason\|customStyleInstruction" src/data/guideContent.ts`
Expected: 발행 동작을 잘못 설명하는 잔여 표현 0건(혹은 의도된 맥락만)

---

## Task 12: 최종 검증

**Files:** (없음 — 검증만)

- [ ] **Step 1: 잔여 식별자 스캔**

Run: `grep -rnE "\b(valueDecision|holdReason|storyDraft|customStyleInstruction|getStyleInstruction|STYLE_PRESETS|setChannelText|formatChannels)\b" src --include="*.ts" --include="*.tsx"`
Expected: 0건

- [ ] **Step 2: 전체 빌드**

Run: `npm run build`
Expected: tsc + vite PASS

- [ ] **Step 3: 전체 테스트**

Run: `npx vitest run`
Expected: 전부 PASS (promptChain / defaultCategories / SettingsContext / HistoryContext 포함)

- [ ] **Step 4: 수동 검증 (`npm run dev`)**

1. ⚙ 설정 → 🎯 카테고리 탭에 5개 카테고리, criteria/tone 편집 가능.
2. 워크벤치 헤더 카테고리 드롭다운에서 🎬 드라마·영화·예능 선택.
3. 드라마 홍보 클러스터 선택 → ✨ 가치 평가 & 종합 → 우측에 5개 필드 채워짐, **Fail/보류 문구 없음**, 요약은 중립.
4. 본문 박스에 `##`/`# N.` 섹션 라벨 없음.
5. 각 필드 [복사] 동작, 태그는 `#리본루키 #JTBC` 형태로 복사.
6. 하단 미리보기는 헤드라인+본문만 렌더.
7. 새로고침 시 구 v2 이력 미로드(콘솔 에러 0).

- [ ] **Step 5: 사용자에게 커밋 여부 확인**

빌드/테스트 결과와 변경 파일 목록(post-change 리포트)을 보고하고, 사용자가 커밋을 명시 요청하면 커밋한다.

---

## Self-Review (작성자 체크 결과)

- **스펙 커버리지**: 카테고리 모델/기본5종(T2,T5) · 엔진 판정 제거+구조화 출력+sanitize(T1,T3) · styles 제거(T4) · 활성 카테고리 선택(T5,T7) · 필드별 박스+개별 복사(T7) · 미리보기 headline+body(T8) · 설정 2탭(T9) · 이력 v3 가드+표시(T1,T6,T10) · 가이드(T11). 모든 스펙 항목에 대응 Task 존재.
- **Placeholder 스캔**: TBD/TODO 없음. 모든 코드 단계에 실제 코드 포함.
- **타입 일관성**: `StoryOutput`(summary/headline/body/tags/imagePrompt)·`ConvertedResult`(+schemaVersion3/categoryId)·`generateStory(articles,settings,category)`·`setText`/`setTags`·`setActiveCategoryId`/`addCategory`/`updateCategory`/`removeCategory`가 T1·T3·T5·T6·T7 전반에서 동일 시그니처로 사용됨.
