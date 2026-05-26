# News Intelligence Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Bolt.new-compatible browser-only dashboard that auto-collects Korean RSS news, converts selected articles into English using OpenAI with a 2-call chain, enforces banned-word and fact-check rules, and outputs three channel-specific formats (Site / X thread / Medium) with one-click copy.

**Architecture:** Single Vite + React + TypeScript + Tailwind SPA. No backend. RSS ingested via rss2json (CORS proxy + JSON converter). OpenAI called directly from client with user-provided key stored in localStorage. State managed via React Context. Pure-function libs (`lib/`) are unit-tested with Vitest; UI components and hooks tested with React Testing Library. All persistence (settings, history) is localStorage.

**Tech Stack:** React 18, TypeScript 5, Vite 5, Tailwind 3, lucide-react, react-markdown, Vitest, @testing-library/react

**Spec:** `docs/superpowers/specs/2026-05-25-news-intelligence-editor-design.md`

---

## Task 1: Scaffold Vite + React + TypeScript project

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `.gitignore`

- [ ] **Step 1: Initialize project files**

Run from `/Users/cclss/Desktop/news-intelligence-editor`:
```bash
npm create vite@latest . -- --template react-ts
```
When prompted, choose "Ignore files and continue" since the folder is empty.

- [ ] **Step 2: Install base dependencies**

```bash
npm install
```
Expected: installs react, react-dom, vite, typescript, etc.

- [ ] **Step 3: Verify dev server boots**

```bash
npm run dev
```
Expected: server runs at `http://localhost:5173`, default Vite page loads. Stop with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git init
git add .
git commit -m "chore: scaffold Vite + React + TS project"
```

---

## Task 2: Add Tailwind CSS

**Files:**
- Create: `tailwind.config.js`, `postcss.config.js`
- Modify: `src/index.css`

- [ ] **Step 1: Install Tailwind and PostCSS**

```bash
npm install -D tailwindcss@3 postcss autoprefixer
npx tailwindcss init -p
```

- [ ] **Step 2: Configure tailwind.config.js**

Replace `tailwind.config.js` content with:
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        'pulse-fast': 'pulse 1s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 3: Replace src/index.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root { height: 100%; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans KR", sans-serif; }
```

- [ ] **Step 4: Smoke test Tailwind**

Replace `src/App.tsx`:
```tsx
function App() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <h1 className="text-3xl font-bold text-slate-900">News Intelligence Editor</h1>
    </div>
  );
}
export default App;
```

Run `npm run dev` and confirm the heading renders with Tailwind classes applied (centered, large, slate background). Stop with Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: add Tailwind CSS"
```

---

## Task 3: Install runtime and test dependencies

**Files:**
- Modify: `package.json`, `vite.config.ts`

- [ ] **Step 1: Install runtime libs**

```bash
npm install lucide-react react-markdown
```

- [ ] **Step 2: Install test libs**

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @testing-library/user-event
```

- [ ] **Step 3: Configure Vitest in vite.config.ts**

Replace `vite.config.ts`:
```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

- [ ] **Step 4: Create test setup file**

Create `src/test/setup.ts`:
```ts
import '@testing-library/jest-dom';
```

- [ ] **Step 5: Add test scripts to package.json**

In `package.json`, replace the `"scripts"` block with:
```json
"scripts": {
  "dev": "vite",
  "build": "tsc && vite build",
  "lint": "eslint .",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 6: Verify Vitest runs**

```bash
npm test
```
Expected: "No test files found, exiting with code 0" (or similar — passes with no tests).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: add Vitest, RTL, lucide-react, react-markdown"
```

---

## Task 4: Define core types

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Create types.ts**

```ts
export type RssSource = {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
};

export type Article = {
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

export type BreakingAlert = {
  article: Article;
  matchedKeywords: string[];
  severity: 'medium' | 'high' | 'critical';
  firedAt: number;
  dismissedAt?: number;
};

export type Facts = {
  people: string[];
  numbers: string[];
  places: string[];
  dates: string[];
};

export type FactReport = {
  ok: boolean;
  missing: Array<{ category: keyof Facts; value: string }>;
};

export type ConvertedResult = {
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
  stylePreset: StylePresetKey;
  model: ModelId;
};

export type StylePresetKey = 'kpop' | 'ap' | 'bloomberg' | 'techcrunch' | 'custom';
export type ModelId = 'gpt-4o-mini' | 'gpt-4o';

export type Settings = {
  apiKey: string;
  model: ModelId;
  stylePreset: StylePresetKey;
  customStyleInstruction: string;
  rssSources: RssSource[];
  simulatorEnabled: boolean;
  simulatorIntervalSec: number;
  alertSoundEnabled: boolean;
  browserNotificationsEnabled: boolean;
};

export type AnalyzeAndTranslateOutput = {
  valueScore: number;
  valueReason: string;
  facts: Facts;
  englishDraft: string;
};

export type ChannelOutput = {
  site: string;
  x: string;
  medium: string;
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: define core types"
```

---

## Task 5: bannedWords library (pure)

**Files:**
- Create: `src/lib/bannedWords.ts`, `src/lib/bannedWords.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/bannedWords.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { scan, BANNED_PATTERNS } from './bannedWords';

describe('bannedWords.scan', () => {
  it('returns ok=true and empty hits for clean text', () => {
    const r = scan('A well-written news article about K-pop.');
    expect(r.ok).toBe(true);
    expect(r.hits).toEqual([]);
  });

  it('detects "delve" as case-insensitive whole word', () => {
    const r = scan('Let us delve into the details.');
    expect(r.ok).toBe(false);
    expect(r.hits.some(h => /delve/i.test(h))).toBe(true);
  });

  it('does not flag substrings ("delver" should not match "delve")', () => {
    const r = scan('She is a delver in the cave.');
    expect(r.ok).toBe(true);
  });

  it('detects "in conclusion"', () => {
    const r = scan('In conclusion, the team won.');
    expect(r.ok).toBe(false);
  });

  it('detects "furthermore"', () => {
    expect(scan('Furthermore, this matters.').ok).toBe(false);
  });

  it('detects "moreover"', () => {
    expect(scan('Moreover, fans reacted.').ok).toBe(false);
  });

  it('detects "testament"', () => {
    expect(scan('It is a testament to talent.').ok).toBe(false);
  });

  it('detects "it is important to note"', () => {
    expect(scan('It is important to note the date.').ok).toBe(false);
  });

  it('detects "not only ... but also" pattern', () => {
    expect(scan('Not only sang but also danced.').ok).toBe(false);
  });

  it('detects "as an AI"', () => {
    expect(scan('As an AI, I think this.').ok).toBe(false);
  });

  it('detects first-person AI references "I think/believe/feel"', () => {
    expect(scan('I think this is true.').ok).toBe(false);
    expect(scan('I believe the data.').ok).toBe(false);
    expect(scan('I feel this matters.').ok).toBe(false);
  });

  it('exports BANNED_PATTERNS as non-empty array', () => {
    expect(BANNED_PATTERNS.length).toBeGreaterThan(5);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
npm test -- bannedWords
```
Expected: FAIL with "Cannot find module './bannedWords'".

- [ ] **Step 3: Implement bannedWords.ts**

Create `src/lib/bannedWords.ts`:
```ts
export const BANNED_PATTERNS: RegExp[] = [
  /\bdelve\b/i,
  /\bin conclusion\b/i,
  /\bfurthermore\b/i,
  /\btestament\b/i,
  /\bmoreover\b/i,
  /\bit is important to note\b/i,
  /\bnot only [^,.]+ but also\b/i,
  /\bas an AI\b/i,
  /\bI (think|believe|feel)\b/i,
];

export type ScanResult = { ok: boolean; hits: string[] };

export function scan(text: string): ScanResult {
  const hits: string[] = [];
  for (const pattern of BANNED_PATTERNS) {
    const m = text.match(pattern);
    if (m) hits.push(m[0]);
  }
  return { ok: hits.length === 0, hits };
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npm test -- bannedWords
```
Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/bannedWords.ts src/lib/bannedWords.test.ts
git commit -m "feat(lib): banned-words scanner with regex patterns"
```

---

## Task 6: factCheck library (pure)

**Files:**
- Create: `src/lib/factCheck.ts`, `src/lib/factCheck.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/factCheck.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { verify } from './factCheck';
import type { Facts, ChannelOutput } from '../types';

const baseFacts: Facts = {
  people: ['BLACKPINK Lisa', 'YG Entertainment'],
  numbers: ['10 million', '2026'],
  places: ['Seoul'],
  dates: ['May 25, 2026'],
};

function outputs(text: string): ChannelOutput {
  return { site: text, x: text, medium: text };
}

describe('factCheck.verify', () => {
  it('returns ok=true when all facts appear in outputs', () => {
    const text = 'BLACKPINK Lisa from YG Entertainment sold 10 million in 2026 in Seoul on May 25, 2026.';
    const r = verify(baseFacts, outputs(text));
    expect(r.ok).toBe(true);
    expect(r.missing).toEqual([]);
  });

  it('flags missing person', () => {
    const text = 'YG Entertainment sold 10 million in 2026 in Seoul on May 25, 2026.';
    const r = verify(baseFacts, outputs(text));
    expect(r.ok).toBe(false);
    expect(r.missing.some(m => m.category === 'people' && m.value === 'BLACKPINK Lisa')).toBe(true);
  });

  it('flags missing exact number (no loose matching)', () => {
    const text = 'BLACKPINK Lisa from YG Entertainment sold 11 million in 2026 in Seoul on May 25, 2026.';
    const r = verify(baseFacts, outputs(text));
    expect(r.ok).toBe(false);
    expect(r.missing.some(m => m.category === 'numbers' && m.value === '10 million')).toBe(true);
  });

  it('considers a fact present if it appears in at least one channel', () => {
    const text = 'BLACKPINK Lisa from YG Entertainment sold 10 million in 2026 in Seoul on May 25, 2026.';
    const r = verify(baseFacts, { site: text, x: 'short', medium: 'short' });
    expect(r.ok).toBe(true);
  });

  it('loose-matches people regardless of case', () => {
    const text = 'blackpink lisa from yg entertainment sold 10 million in 2026 in seoul on May 25, 2026.';
    const r = verify(baseFacts, outputs(text));
    expect(r.missing.filter(m => m.category === 'people')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
npm test -- factCheck
```
Expected: FAIL ("Cannot find module './factCheck'").

- [ ] **Step 3: Implement factCheck.ts**

Create `src/lib/factCheck.ts`:
```ts
import type { Facts, FactReport, ChannelOutput } from '../types';

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

function containsLoose(haystack: string, needle: string): boolean {
  return normalize(haystack).includes(normalize(needle));
}

function containsExact(haystack: string, needle: string): boolean {
  return haystack.includes(needle);
}

export function verify(facts: Facts, outputs: ChannelOutput): FactReport {
  const allText = `${outputs.site}\n${outputs.x}\n${outputs.medium}`;
  const missing: FactReport['missing'] = [];

  for (const p of facts.people) {
    if (!containsLoose(allText, p)) missing.push({ category: 'people', value: p });
  }
  for (const n of facts.numbers) {
    if (!containsExact(allText, n)) missing.push({ category: 'numbers', value: n });
  }
  for (const p of facts.places) {
    if (!containsLoose(allText, p)) missing.push({ category: 'places', value: p });
  }
  for (const d of facts.dates) {
    if (!containsLoose(allText, d)) missing.push({ category: 'dates', value: d });
  }

  return { ok: missing.length === 0, missing };
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npm test -- factCheck
```
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/factCheck.ts src/lib/factCheck.test.ts
git commit -m "feat(lib): rule-based fact verification"
```

---

## Task 7: styles library (presets)

**Files:**
- Create: `src/lib/styles.ts`, `src/lib/styles.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/styles.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { STYLE_PRESETS, getStyleInstruction } from './styles';

describe('styles.STYLE_PRESETS', () => {
  it('contains all five preset keys', () => {
    expect(Object.keys(STYLE_PRESETS).sort()).toEqual(
      ['ap', 'bloomberg', 'custom', 'kpop', 'techcrunch']
    );
  });

  it('each non-custom preset has non-empty instruction and label', () => {
    for (const key of ['kpop', 'ap', 'bloomberg', 'techcrunch'] as const) {
      expect(STYLE_PRESETS[key].label.length).toBeGreaterThan(0);
      expect(STYLE_PRESETS[key].instruction.length).toBeGreaterThan(20);
    }
  });

  it('custom preset has empty default instruction', () => {
    expect(STYLE_PRESETS.custom.instruction).toBe('');
  });
});

describe('styles.getStyleInstruction', () => {
  it('returns built-in instruction for non-custom preset', () => {
    expect(getStyleInstruction('kpop', '')).toBe(STYLE_PRESETS.kpop.instruction);
  });

  it('returns user override for custom preset', () => {
    expect(getStyleInstruction('custom', 'My tone is X')).toBe('My tone is X');
  });

  it('falls back to kpop instruction if custom is empty', () => {
    expect(getStyleInstruction('custom', '')).toBe(STYLE_PRESETS.kpop.instruction);
  });
});
```

- [ ] **Step 2: Verify failure**

```bash
npm test -- styles
```
Expected: FAIL.

- [ ] **Step 3: Implement styles.ts**

Create `src/lib/styles.ts`:
```ts
import type { StylePresetKey } from '../types';

type Preset = { label: string; instruction: string; examples: string[] };

export const STYLE_PRESETS: Record<StylePresetKey, Preset> = {
  kpop: {
    label: 'K-pop / 연예 / 가십',
    instruction:
      'Casual, fan-friendly tone. Use industry terms (idol, comeback, bias, agency, fandom name). ' +
      'Direct quotes from sources when available. Conversational sentence rhythm. ' +
      'Reference fan reactions when appropriate. Avoid academic vocabulary. ' +
      'Keep paragraphs short (2-3 sentences). Punchy headlines.',
    examples: ['Soompi', 'Allkpop', 'JustJared'],
  },
  ap: {
    label: 'AP / Reuters 통신사',
    instruction:
      'Inverted pyramid structure. Lead sentence answers 5W1H. Neutral, third-person voice. ' +
      'Short declarative sentences. Attribution for every claim ("according to ...", "officials said"). ' +
      'No emojis. No editorializing.',
    examples: ['AP', 'Reuters'],
  },
  bloomberg: {
    label: 'Bloomberg / FT 경제지',
    instruction:
      'Data-forward. Lead with the number, trend, or market impact. Cite specific figures, dates, ' +
      'and percentage changes. Quote named analysts or executives. Formal register. ' +
      'Explain business implications.',
    examples: ['Bloomberg', 'Financial Times'],
  },
  techcrunch: {
    label: 'TechCrunch / Verge 테크',
    instruction:
      'Reader-friendly, slightly informal. Explain context for non-experts. Use active voice. ' +
      'Mention competitors and ecosystem. Avoid jargon without definition. Light editorial framing OK.',
    examples: ['TechCrunch', 'The Verge'],
  },
  custom: {
    label: '커스텀',
    instruction: '',
    examples: [],
  },
};

export function getStyleInstruction(key: StylePresetKey, customInstruction: string): string {
  if (key === 'custom') {
    return customInstruction.trim() || STYLE_PRESETS.kpop.instruction;
  }
  return STYLE_PRESETS[key].instruction;
}
```

- [ ] **Step 4: Verify pass**

```bash
npm test -- styles
```
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/styles.ts src/lib/styles.test.ts
git commit -m "feat(lib): style presets for output channels"
```

---

## Task 8: storage library (localStorage wrapper)

**Files:**
- Create: `src/lib/storage.ts`, `src/lib/storage.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/storage.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { loadJson, saveJson, removeKey } from './storage';

beforeEach(() => {
  localStorage.clear();
});

describe('storage', () => {
  it('saveJson + loadJson round trip', () => {
    saveJson('nie:test', { a: 1, b: 'two' });
    expect(loadJson('nie:test', null)).toEqual({ a: 1, b: 'two' });
  });

  it('loadJson returns default when key missing', () => {
    expect(loadJson('nie:missing', { fallback: true })).toEqual({ fallback: true });
  });

  it('loadJson returns default when value is invalid JSON', () => {
    localStorage.setItem('nie:bad', '{not json');
    expect(loadJson('nie:bad', { fallback: true })).toEqual({ fallback: true });
  });

  it('removeKey clears the value', () => {
    saveJson('nie:gone', { x: 1 });
    removeKey('nie:gone');
    expect(loadJson('nie:gone', null)).toBe(null);
  });

  it('saveJson swallows quota errors gracefully', () => {
    // Mock setItem to throw
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new DOMException('quota', 'QuotaExceededError'); };
    expect(() => saveJson('nie:big', { x: 1 })).not.toThrow();
    Storage.prototype.setItem = orig;
  });
});
```

- [ ] **Step 2: Verify failure**

```bash
npm test -- storage
```
Expected: FAIL.

- [ ] **Step 3: Implement storage.ts**

Create `src/lib/storage.ts`:
```ts
export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn('[storage] save failed', key, err);
  }
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export const STORAGE_KEYS = {
  settings: 'nie:settings',
  history: 'nie:history',
} as const;
```

- [ ] **Step 4: Verify pass**

```bash
npm test -- storage
```
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage.ts src/lib/storage.test.ts
git commit -m "feat(lib): localStorage wrapper with quota-safe writes"
```

---

## Task 9: RSS dedupe and merge (pure)

**Files:**
- Create: `src/lib/rss.ts`, `src/lib/rss.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/rss.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { dedupeAndMerge, normalizeLink, makeArticleId } from './rss';
import type { Article } from '../types';

function fakeArticle(over: Partial<Article>): Article {
  return {
    id: 'x',
    title: 't',
    description: 'd',
    link: 'https://e.com/a',
    pubDate: '2026-01-01',
    source: 's',
    inputType: 'rss',
    fetchedAt: 0,
    ...over,
  };
}

describe('rss.normalizeLink', () => {
  it('strips utm_* params', () => {
    expect(normalizeLink('https://e.com/a?utm_source=x&id=1')).toBe('https://e.com/a?id=1');
  });
  it('handles links with no params', () => {
    expect(normalizeLink('https://e.com/a')).toBe('https://e.com/a');
  });
  it('preserves non-utm params', () => {
    expect(normalizeLink('https://e.com/a?id=1&page=2')).toBe('https://e.com/a?id=1&page=2');
  });
});

describe('rss.makeArticleId', () => {
  it('returns the same id for the same normalized link', () => {
    const a = makeArticleId('https://e.com/a?utm_source=x');
    const b = makeArticleId('https://e.com/a');
    expect(a).toBe(b);
  });
});

describe('rss.dedupeAndMerge', () => {
  it('merges new items into existing, removing duplicates by id', () => {
    const existing: Article[] = [fakeArticle({ id: '1', title: 'old' })];
    const incoming: Article[] = [
      fakeArticle({ id: '1', title: 'updated' }),
      fakeArticle({ id: '2', title: 'new' }),
    ];
    const merged = dedupeAndMerge(existing, incoming, 200);
    expect(merged).toHaveLength(2);
    expect(merged.find(a => a.id === '1')!.title).toBe('old');
  });

  it('caps the merged list at maxSize (FIFO)', () => {
    const existing: Article[] = Array.from({ length: 200 }, (_, i) =>
      fakeArticle({ id: `e${i}`, fetchedAt: i })
    );
    const incoming: Article[] = [fakeArticle({ id: 'new', fetchedAt: 999 })];
    const merged = dedupeAndMerge(existing, incoming, 200);
    expect(merged).toHaveLength(200);
    expect(merged.find(a => a.id === 'new')).toBeTruthy();
    expect(merged.find(a => a.id === 'e0')).toBeFalsy();
  });

  it('sorts by fetchedAt desc (newest first)', () => {
    const merged = dedupeAndMerge(
      [],
      [
        fakeArticle({ id: '1', fetchedAt: 1 }),
        fakeArticle({ id: '2', fetchedAt: 3 }),
        fakeArticle({ id: '3', fetchedAt: 2 }),
      ],
      10
    );
    expect(merged.map(a => a.id)).toEqual(['2', '3', '1']);
  });
});
```

- [ ] **Step 2: Verify failure**

```bash
npm test -- rss
```
Expected: FAIL.

- [ ] **Step 3: Implement pure helpers in rss.ts**

Create `src/lib/rss.ts`:
```ts
import type { Article, RssSource } from '../types';

export function normalizeLink(link: string): string {
  try {
    const u = new URL(link);
    const toRemove: string[] = [];
    u.searchParams.forEach((_, k) => {
      if (k.toLowerCase().startsWith('utm_')) toRemove.push(k);
    });
    toRemove.forEach(k => u.searchParams.delete(k));
    return u.toString();
  } catch {
    return link;
  }
}

// Simple non-crypto hash (FNV-1a style) — collisions acceptable for dedup
export function makeArticleId(link: string): string {
  const normalized = normalizeLink(link);
  let h = 2166136261;
  for (let i = 0; i < normalized.length; i++) {
    h ^= normalized.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

export function dedupeAndMerge(existing: Article[], incoming: Article[], maxSize: number): Article[] {
  const seen = new Set<string>();
  const out: Article[] = [];
  // Existing first wins (preserves earlier-stored state like isBreaking flags)
  for (const a of existing) {
    if (!seen.has(a.id)) {
      seen.add(a.id);
      out.push(a);
    }
  }
  for (const a of incoming) {
    if (!seen.has(a.id)) {
      seen.add(a.id);
      out.push(a);
    }
  }
  out.sort((a, b) => b.fetchedAt - a.fetchedAt);
  return out.slice(0, maxSize);
}

// fetchRss is implemented in Task 10 below.
export async function fetchRss(_source: RssSource): Promise<Article[]> {
  throw new Error('not implemented yet');
}
```

- [ ] **Step 4: Verify pass**

```bash
npm test -- rss
```
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/rss.ts src/lib/rss.test.ts
git commit -m "feat(lib): RSS dedupe and merge with link normalization"
```

---

## Task 10: RSS fetcher (rss2json integration)

**Files:**
- Modify: `src/lib/rss.ts`
- Create: `src/lib/rss.fetch.test.ts`

- [ ] **Step 1: Write failing test with fetch mock**

Create `src/lib/rss.fetch.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchRss } from './rss';
import type { RssSource } from '../types';

const fakeResponse = {
  status: 'ok',
  feed: { title: 'Test Feed' },
  items: [
    {
      title: '[속보] 테스트 기사',
      link: 'https://example.com/article/1?utm_source=rss',
      description: '<p>요약 본문</p>',
      pubDate: 'Sun, 24 May 2026 12:00:00 GMT',
      thumbnail: 'https://example.com/thumb.jpg',
      categories: ['연예'],
    },
  ],
};

describe('rss.fetchRss', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls rss2json with the encoded RSS URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => fakeResponse,
    });
    vi.stubGlobal('fetch', fetchMock);

    const source: RssSource = { id: 's1', name: '연합', url: 'https://www.yna.co.kr/rss/news.xml', enabled: true };
    await fetchRss(source);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain('api.rss2json.com');
    expect(calledUrl).toContain(encodeURIComponent(source.url));
  });

  it('returns mapped Article objects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => fakeResponse,
    }));
    const source: RssSource = { id: 's1', name: '연합', url: 'https://x', enabled: true };
    const arts = await fetchRss(source);
    expect(arts).toHaveLength(1);
    expect(arts[0].title).toBe('[속보] 테스트 기사');
    expect(arts[0].source).toBe('연합');
    expect(arts[0].description).toBe('요약 본문');  // HTML stripped
    expect(arts[0].thumbnail).toBe('https://example.com/thumb.jpg');
    expect(arts[0].inputType).toBe('rss');
  });

  it('returns empty array on HTTP failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429 }));
    const source: RssSource = { id: 's1', name: 'x', url: 'https://x', enabled: true };
    const arts = await fetchRss(source);
    expect(arts).toEqual([]);
  });

  it('returns empty array on rss2json status != ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'error', message: 'bad feed' }),
    }));
    const source: RssSource = { id: 's1', name: 'x', url: 'https://x', enabled: true };
    expect(await fetchRss(source)).toEqual([]);
  });
});
```

- [ ] **Step 2: Verify failure**

```bash
npm test -- rss.fetch
```
Expected: FAIL ("not implemented yet").

- [ ] **Step 3: Replace fetchRss in src/lib/rss.ts**

Replace the existing `fetchRss` stub with a real implementation. The complete updated `rss.ts`:

```ts
import type { Article, RssSource } from '../types';

const RSS2JSON_ENDPOINT = 'https://api.rss2json.com/v1/api.json';

export function normalizeLink(link: string): string {
  try {
    const u = new URL(link);
    const toRemove: string[] = [];
    u.searchParams.forEach((_, k) => {
      if (k.toLowerCase().startsWith('utm_')) toRemove.push(k);
    });
    toRemove.forEach(k => u.searchParams.delete(k));
    return u.toString();
  } catch {
    return link;
  }
}

export function makeArticleId(link: string): string {
  const normalized = normalizeLink(link);
  let h = 2166136261;
  for (let i = 0; i < normalized.length; i++) {
    h ^= normalized.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

export function dedupeAndMerge(existing: Article[], incoming: Article[], maxSize: number): Article[] {
  const seen = new Set<string>();
  const out: Article[] = [];
  for (const a of existing) {
    if (!seen.has(a.id)) { seen.add(a.id); out.push(a); }
  }
  for (const a of incoming) {
    if (!seen.has(a.id)) { seen.add(a.id); out.push(a); }
  }
  out.sort((a, b) => b.fetchedAt - a.fetchedAt);
  return out.slice(0, maxSize);
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

type Rss2JsonItem = {
  title: string;
  link: string;
  description?: string;
  content?: string;
  pubDate?: string;
  thumbnail?: string;
  categories?: string[];
};

type Rss2JsonResponse = {
  status: string;
  feed?: { title?: string };
  items?: Rss2JsonItem[];
  message?: string;
};

export async function fetchRss(source: RssSource): Promise<Article[]> {
  const url = `${RSS2JSON_ENDPOINT}?rss_url=${encodeURIComponent(source.url)}&count=20`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as Rss2JsonResponse;
    if (data.status !== 'ok' || !data.items) return [];
    const now = Date.now();
    return data.items.map((it): Article => ({
      id: makeArticleId(it.link),
      title: stripHtml(it.title || ''),
      description: stripHtml(it.description || it.content || ''),
      link: it.link,
      pubDate: it.pubDate || '',
      source: source.name,
      inputType: 'rss',
      category: it.categories?.[0],
      thumbnail: it.thumbnail || undefined,
      fetchedAt: now,
    }));
  } catch (err) {
    console.warn('[rss] fetch failed', source.name, err);
    return [];
  }
}
```

- [ ] **Step 4: Verify pass**

```bash
npm test -- rss
```
Expected: PASS, all rss tests (10+).

- [ ] **Step 5: Commit**

```bash
git add src/lib/rss.ts src/lib/rss.fetch.test.ts
git commit -m "feat(lib): rss2json fetcher with HTML stripping"
```

---

## Task 11: Breaking detector + simulator

**Files:**
- Create: `src/lib/breakingDetector.ts`, `src/lib/breakingDetector.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/breakingDetector.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { detect, BREAKING_KEYWORDS, generateMockBreaking } from './breakingDetector';
import type { Article } from '../types';

function art(over: Partial<Article>): Article {
  return {
    id: 'x', title: '', description: '', link: 'https://e.com',
    pubDate: '', source: 's', inputType: 'rss', fetchedAt: 0,
    ...over,
  };
}

describe('breakingDetector.detect', () => {
  it('returns null for non-breaking article', () => {
    expect(detect(art({ title: '신곡 발매', description: '새 앨범' }))).toBeNull();
  });

  it('marks [속보] prefix as critical', () => {
    const r = detect(art({ title: '[속보] 무언가 발생' }));
    expect(r?.severity).toBe('critical');
  });

  it('marks [단독] prefix as critical', () => {
    expect(detect(art({ title: '[단독] 폭로' }))?.severity).toBe('critical');
  });

  it('marks 2+ keyword matches as high', () => {
    const r = detect(art({ title: '아이돌 컴백', description: '동시에 입대 발표' }));
    expect(r?.severity).toBe('high');
    expect(r?.matchedKeywords.length).toBeGreaterThanOrEqual(2);
  });

  it('marks 1 keyword match as medium', () => {
    const r = detect(art({ title: '결혼 발표' }));
    expect(r?.severity).toBe('medium');
  });
});

describe('breakingDetector.generateMockBreaking', () => {
  it('returns a simulator-flagged Article with [속보] prefix', () => {
    const a = generateMockBreaking();
    expect(a.inputType).toBe('simulator');
    expect(a.title.startsWith('[속보]') || a.title.startsWith('[단독]') || a.title.startsWith('[긴급]')).toBe(true);
  });

  it('exposes a non-empty keyword list', () => {
    expect(BREAKING_KEYWORDS.length).toBeGreaterThan(10);
  });
});
```

- [ ] **Step 2: Verify failure**

```bash
npm test -- breakingDetector
```
Expected: FAIL.

- [ ] **Step 3: Implement breakingDetector.ts**

Create `src/lib/breakingDetector.ts`:
```ts
import type { Article, BreakingAlert } from '../types';
import { makeArticleId } from './rss';

export const BREAKING_KEYWORDS = [
  '속보', '긴급', '단독', '사망', '사고', '폭발', '비상', '체포', '해킹', '습격',
  '결혼', '이혼', '열애', '컴백', '해체', '탈퇴', '입대', '폭로', '논란', '복귀',
];

const CRITICAL_PREFIX = /^\[(속보|단독|긴급)\]/;

export function detect(article: Article): BreakingAlert | null {
  const text = `${article.title} ${article.description}`;
  const matched = BREAKING_KEYWORDS.filter(kw => text.includes(kw));
  const titleCritical = CRITICAL_PREFIX.test(article.title);
  if (!titleCritical && matched.length === 0) return null;

  const severity: BreakingAlert['severity'] =
    titleCritical ? 'critical' : matched.length >= 2 ? 'high' : 'medium';

  return {
    article: { ...article, isBreaking: true },
    matchedKeywords: matched,
    severity,
    firedAt: Date.now(),
  };
}

const MOCK_HEADLINES = [
  '[속보] 유명 K-pop 그룹 멤버 ○○ 군 입대 발표',
  '[단독] △△ 엔터테인먼트, 새 보이그룹 데뷔 일정 공개',
  '[속보] 톱스타 □□ 열애 인정',
  '[긴급] 인기 아이돌 그룹 일부 멤버 탈퇴 논란',
  '[속보] 베테랑 배우 ●● 별세, 향년 75세',
  '[단독] 글로벌 OTT, 한국 오리지널 신작 라인업 공개',
  '[속보] 인기 그룹 X 해체 공식 발표',
  '[긴급] 유명 작곡가 ★★ 표절 의혹 제기',
  '[단독] K-pop 톱그룹, 美 빌보드 1위 등극',
  '[속보] 인기 배우 △△ 결혼 발표',
];

const MOCK_DESCRIPTIONS = [
  '소속사가 공식 입장문을 통해 사실을 인정했다.',
  '관계자는 익명을 전제로 일정을 확인했다.',
  '팬들 사이에서는 이미 추측이 무성했다.',
  '연예가에 큰 파장이 예상된다.',
];

let mockIdx = 0;
export function generateMockBreaking(): Article {
  const title = MOCK_HEADLINES[mockIdx % MOCK_HEADLINES.length];
  const description = MOCK_DESCRIPTIONS[mockIdx % MOCK_DESCRIPTIONS.length];
  mockIdx++;
  const link = `simulator://mock/${Date.now()}/${mockIdx}`;
  return {
    id: makeArticleId(link),
    title,
    description,
    link,
    pubDate: new Date().toUTCString(),
    source: '🧪 시뮬레이터',
    inputType: 'simulator',
    isBreaking: true,
    fetchedAt: Date.now(),
  };
}
```

- [ ] **Step 4: Verify pass**

```bash
npm test -- breakingDetector
```
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/breakingDetector.ts src/lib/breakingDetector.test.ts
git commit -m "feat(lib): breaking-alert detector and mock simulator"
```

---

## Task 12: OpenAI client wrapper

**Files:**
- Create: `src/lib/openai.ts`, `src/lib/openai.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/openai.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { chatJson, OpenAIError } from './openai';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('openai.chatJson', () => {
  it('sends Authorization header and parses JSON content', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ hello: 'world' }) } }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await chatJson({
      apiKey: 'sk-test',
      model: 'gpt-4o-mini',
      system: 'sys',
      user: 'usr',
    });

    expect(result).toEqual({ hello: 'world' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer sk-test');
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('gpt-4o-mini');
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.messages[0]).toEqual({ role: 'system', content: 'sys' });
    expect(body.messages[1]).toEqual({ role: 'user', content: 'usr' });
  });

  it('throws OpenAIError with status on 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'invalid key' } }),
    }));
    await expect(chatJson({ apiKey: 'x', model: 'gpt-4o-mini', system: 's', user: 'u' }))
      .rejects.toMatchObject({ status: 401 });
  });

  it('throws OpenAIError on rate limit', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: { message: 'rate' } }),
    }));
    await expect(chatJson({ apiKey: 'x', model: 'gpt-4o-mini', system: 's', user: 'u' }))
      .rejects.toMatchObject({ status: 429 });
  });

  it('throws when content is not valid JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'not json' } }] }),
    }));
    await expect(chatJson({ apiKey: 'x', model: 'gpt-4o-mini', system: 's', user: 'u' }))
      .rejects.toThrow(/JSON/);
  });
});
```

- [ ] **Step 2: Verify failure**

```bash
npm test -- openai
```
Expected: FAIL.

- [ ] **Step 3: Implement openai.ts**

Create `src/lib/openai.ts`:
```ts
import type { ModelId } from '../types';

const ENDPOINT = 'https://api.openai.com/v1/chat/completions';

export class OpenAIError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'OpenAIError';
    this.status = status;
  }
}

export type ChatJsonArgs = {
  apiKey: string;
  model: ModelId;
  system: string;
  user: string;
  temperature?: number;
};

export async function chatJson<T = unknown>(args: ChatJsonArgs): Promise<T> {
  if (!args.apiKey) throw new OpenAIError('API key is empty', 0);

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${args.apiKey}`,
    },
    body: JSON.stringify({
      model: args.model,
      temperature: args.temperature ?? 0.5,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: args.system },
        { role: 'user', content: args.user },
      ],
    }),
  });

  if (!res.ok) {
    let body: { error?: { message?: string } } = {};
    try { body = await res.json(); } catch { /* ignore */ }
    throw new OpenAIError(body.error?.message || `HTTP ${res.status}`, res.status);
  }

  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content ?? '';
  try {
    return JSON.parse(content) as T;
  } catch {
    throw new OpenAIError('Response was not valid JSON: ' + content.slice(0, 200), 0);
  }
}
```

- [ ] **Step 4: Verify pass**

```bash
npm test -- openai
```
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/openai.ts src/lib/openai.test.ts
git commit -m "feat(lib): OpenAI chat completions JSON-mode wrapper"
```

---

## Task 13: Prompt chain (Call 1 + Call 2)

**Files:**
- Create: `src/lib/promptChain.ts`, `src/lib/promptChain.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/promptChain.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runChain } from './promptChain';
import * as openai from './openai';
import type { Settings, Article } from '../types';

const SETTINGS: Settings = {
  apiKey: 'sk-test',
  model: 'gpt-4o-mini',
  stylePreset: 'kpop',
  customStyleInstruction: '',
  rssSources: [],
  simulatorEnabled: false,
  simulatorIntervalSec: 30,
  alertSoundEnabled: true,
  browserNotificationsEnabled: false,
};

const ARTICLE: Article = {
  id: 'a1',
  title: 'BLACKPINK 컴백',
  description: 'BLACKPINK이 2026년 5월 25일 서울에서 컴백 발표.',
  link: 'https://e.com/1',
  pubDate: '',
  source: '연합',
  inputType: 'rss',
  fetchedAt: 0,
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('promptChain.runChain', () => {
  it('makes exactly 2 OpenAI calls in the happy path', async () => {
    const spy = vi.spyOn(openai, 'chatJson')
      .mockResolvedValueOnce({
        valueScore: 8,
        valueReason: 'high interest',
        facts: { people: ['BLACKPINK'], numbers: ['2026'], places: ['Seoul'], dates: ['May 25, 2026'] },
        englishDraft: 'BLACKPINK announced their comeback in Seoul on May 25, 2026.',
      })
      .mockResolvedValueOnce({
        site: 'BLACKPINK comeback story in Seoul on May 25, 2026.',
        x: '1/ BLACKPINK is back 🔥\n2/ Comeback set for May 25, 2026 in Seoul.',
        medium: '# BLACKPINK Returns\n\n*A new chapter*\n\n## Intro\nBLACKPINK announced their comeback in Seoul on May 25, 2026.',
      });

    const result = await runChain(ARTICLE, SETTINGS);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(result.channels.site).toContain('Seoul');
    expect(result.facts.people).toEqual(['BLACKPINK']);
    expect(result.factReport.ok).toBe(true);
  });

  it('retries Call 1 once if banned word is in englishDraft', async () => {
    const spy = vi.spyOn(openai, 'chatJson')
      .mockResolvedValueOnce({
        valueScore: 7,
        valueReason: 'ok',
        facts: { people: [], numbers: [], places: [], dates: [] },
        englishDraft: 'In conclusion, fans rejoiced.',  // banned
      })
      .mockResolvedValueOnce({
        valueScore: 7,
        valueReason: 'ok',
        facts: { people: [], numbers: [], places: [], dates: [] },
        englishDraft: 'Fans rejoiced after the announcement.',
      })
      .mockResolvedValueOnce({
        site: 'Fans rejoiced after the announcement.',
        x: '1/ Fans rejoiced.',
        medium: '# Title\n## Intro\nFans rejoiced.',
      });

    const result = await runChain(ARTICLE, SETTINGS);
    expect(spy).toHaveBeenCalledTimes(3);  // Call 1 retried + Call 2
    expect(result.englishDraft.toLowerCase()).not.toContain('in conclusion');
  });

  it('flags banned hits in channel outputs when Call 2 produces them', async () => {
    vi.spyOn(openai, 'chatJson')
      .mockResolvedValueOnce({
        valueScore: 5,
        valueReason: 'meh',
        facts: { people: [], numbers: [], places: [], dates: [] },
        englishDraft: 'A clean draft about the comeback.',
      })
      .mockResolvedValueOnce({
        site: 'Furthermore, the band returns.',
        x: '1/ A clean tweet.',
        medium: '# Title\n## Intro\nA clean section.',
      });

    const result = await runChain(ARTICLE, SETTINGS);
    expect(result.bannedHits.site.length).toBeGreaterThan(0);
    expect(result.bannedHits.x).toEqual([]);
  });

  it('reports fact mismatch when output omits a required number', async () => {
    vi.spyOn(openai, 'chatJson')
      .mockResolvedValueOnce({
        valueScore: 9,
        valueReason: 'huge',
        facts: { people: [], numbers: ['10 million'], places: [], dates: [] },
        englishDraft: 'They sold 10 million copies.',
      })
      .mockResolvedValueOnce({
        site: 'They sold some copies.',
        x: '1/ A success.',
        medium: '# Title\n## Intro\nA success.',
      });

    const result = await runChain(ARTICLE, SETTINGS);
    expect(result.factReport.ok).toBe(false);
    expect(result.factReport.missing.some(m => m.value === '10 million')).toBe(true);
  });
});
```

- [ ] **Step 2: Verify failure**

```bash
npm test -- promptChain
```
Expected: FAIL.

- [ ] **Step 3: Implement promptChain.ts**

Create `src/lib/promptChain.ts`:
```ts
import type {
  Article, Settings, ConvertedResult, AnalyzeAndTranslateOutput, ChannelOutput,
} from '../types';
import { chatJson } from './openai';
import { scan } from './bannedWords';
import { verify } from './factCheck';
import { getStyleInstruction, STYLE_PRESETS } from './styles';

const BANNED_LIST_FOR_PROMPT =
  'delve, in conclusion, furthermore, testament, moreover, "it is important to note", ' +
  '"not only ... but also", "as an AI", "I think/believe/feel".';

function buildCall1System(settings: Settings, stricter: boolean): string {
  const styleInstruction = getStyleInstruction(settings.stylePreset, settings.customStyleInstruction);
  const styleLabel = STYLE_PRESETS[settings.stylePreset].label;
  const stricterNote = stricter
    ? '\n\nIMPORTANT: The previous attempt contained banned phrases. You MUST rewrite without ANY of the banned words. Use only plain, professional vocabulary.'
    : '';
  return [
    'You are a senior English news editor specializing in Korean entertainment and K-pop journalism.',
    `You MUST translate the Korean source article into professional English in the "${styleLabel}" style.`,
    `Style guidance: ${styleInstruction}`,
    `You MUST NEVER use these banned words/phrases: ${BANNED_LIST_FOR_PROMPT}`,
    'You MUST extract concrete facts (people, numbers, places, dates) exactly as they appear in the source.',
    'Respond ONLY with valid JSON matching this schema:',
    '{',
    '  "valueScore": number 1-10,',
    '  "valueReason": string (short reason),',
    '  "facts": { "people": string[], "numbers": string[], "places": string[], "dates": string[] },',
    '  "englishDraft": string (300-500 words, professional tone)',
    '}' + stricterNote,
  ].join('\n');
}

function buildCall1User(article: Article): string {
  return [
    `[Korean source article]`,
    `Title: ${article.title}`,
    `Body: ${article.fullText || article.description}`,
    `[Source]: ${article.source}`,
    `[Published]: ${article.pubDate}`,
  ].join('\n');
}

function buildCall2System(settings: Settings, facts: AnalyzeAndTranslateOutput['facts']): string {
  const styleInstruction = getStyleInstruction(settings.stylePreset, settings.customStyleInstruction);
  const factSummary = JSON.stringify(facts);
  return [
    'You are a multi-channel news formatter. Convert the given English draft into three channel-ready outputs.',
    `You MUST preserve ALL of these extracted facts (people/numbers/places/dates): ${factSummary}`,
    `You MUST NEVER use banned words: ${BANNED_LIST_FOR_PROMPT}`,
    `Style: ${styleInstruction}`,
    '',
    'Channel rules:',
    '1. site: Standalone English article. 400-600 words. Headline + lead + body + closing. NO markdown.',
    '2. x: Twitter thread, 5-8 tweets, each <= 280 chars. First tweet = hook. Number tweets "1/", "2/", etc. 1-2 emojis per tweet max.',
    '3. medium: Long-form blog. Markdown. H1 title, italic subtitle, H2 section headers (Intro / Body / Conclusion sections). 800-1200 words.',
    '',
    'Respond ONLY with valid JSON: { "site": string, "x": string, "medium": string }',
  ].join('\n');
}

function buildCall2User(draft: string): string {
  return `[English draft]\n${draft}`;
}

export async function runChain(article: Article, settings: Settings): Promise<ConvertedResult> {
  // ---- Call 1 + 1-shot retry if banned word in draft ----
  let call1 = await chatJson<AnalyzeAndTranslateOutput>({
    apiKey: settings.apiKey,
    model: settings.model,
    system: buildCall1System(settings, false),
    user: buildCall1User(article),
    temperature: 0.5,
  });

  if (!scan(call1.englishDraft).ok) {
    call1 = await chatJson<AnalyzeAndTranslateOutput>({
      apiKey: settings.apiKey,
      model: settings.model,
      system: buildCall1System(settings, true),
      user: buildCall1User(article),
      temperature: 0.3,
    });
  }

  // ---- Call 2 ----
  const call2 = await chatJson<ChannelOutput>({
    apiKey: settings.apiKey,
    model: settings.model,
    system: buildCall2System(settings, call1.facts),
    user: buildCall2User(call1.englishDraft),
    temperature: 0.6,
  });

  // ---- Post-processing ----
  const bannedHits = {
    site: scan(call2.site).hits,
    x: scan(call2.x).hits,
    medium: scan(call2.medium).hits,
  };
  const factReport = verify(call1.facts, call2);

  return {
    id: `${article.id}-${Date.now()}`,
    sourceArticleId: article.id,
    sourceTitle: article.title,
    createdAt: Date.now(),
    valueScore: call1.valueScore,
    valueReason: call1.valueReason,
    facts: call1.facts,
    englishDraft: call1.englishDraft,
    channels: call2,
    factReport,
    bannedHits,
    stylePreset: settings.stylePreset,
    model: settings.model,
  };
}
```

- [ ] **Step 4: Verify pass**

```bash
npm test -- promptChain
```
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/promptChain.ts src/lib/promptChain.test.ts
git commit -m "feat(lib): 2-call prompt chain with banned-word retry"
```

---

## Task 14: Default settings + Settings context

**Files:**
- Create: `src/lib/defaultSettings.ts`, `src/state/SettingsContext.tsx`, `src/state/SettingsContext.test.tsx`

- [ ] **Step 1: Create defaultSettings.ts**

Create `src/lib/defaultSettings.ts`:
```ts
import type { Settings, RssSource } from '../types';

export const DEFAULT_RSS_SOURCES: RssSource[] = [
  { id: 'yna-news', name: '연합뉴스 속보', url: 'https://www.yna.co.kr/rss/news.xml', enabled: true },
  { id: 'yna-ent', name: '연합뉴스 연예', url: 'https://www.yna.co.kr/rss/entertainment.xml', enabled: true },
  { id: 'soompi', name: 'Soompi', url: 'https://www.soompi.com/feed', enabled: true },
  { id: 'allkpop', name: 'Allkpop', url: 'https://www.allkpop.com/feed', enabled: false },
  { id: 'chosun-ent', name: '조선일보 연예', url: 'https://www.chosun.com/arc/outboundfeeds/rss/category/entertainments/?outputType=xml', enabled: false },
  { id: 'hani-culture', name: '한겨레 문화', url: 'https://www.hani.co.kr/rss/culture/', enabled: false },
  { id: 'sportsseoul', name: '스포츠서울', url: 'https://www.sportsseoul.com/rss/news.xml', enabled: false },
];

export const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  model: 'gpt-4o-mini',
  stylePreset: 'kpop',
  customStyleInstruction: '',
  rssSources: DEFAULT_RSS_SOURCES,
  simulatorEnabled: true,
  simulatorIntervalSec: 30,
  alertSoundEnabled: true,
  browserNotificationsEnabled: false,
};
```

- [ ] **Step 2: Write failing tests for SettingsContext**

Create `src/state/SettingsContext.test.tsx`:
```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { SettingsProvider, useSettings } from './SettingsContext';

function Probe() {
  const { settings, setApiKey } = useSettings();
  return (
    <div>
      <span data-testid="key">{settings.apiKey || 'empty'}</span>
      <button onClick={() => setApiKey('sk-x')}>set</button>
    </div>
  );
}

beforeEach(() => localStorage.clear());

describe('SettingsContext', () => {
  it('provides default settings when localStorage is empty', () => {
    render(<SettingsProvider><Probe /></SettingsProvider>);
    expect(screen.getByTestId('key')).toHaveTextContent('empty');
  });

  it('persists changes to localStorage', () => {
    render(<SettingsProvider><Probe /></SettingsProvider>);
    act(() => { screen.getByText('set').click(); });
    expect(screen.getByTestId('key')).toHaveTextContent('sk-x');
    expect(localStorage.getItem('nie:settings')).toContain('sk-x');
  });

  it('loads settings from localStorage on mount', () => {
    localStorage.setItem('nie:settings', JSON.stringify({ apiKey: 'sk-stored' }));
    render(<SettingsProvider><Probe /></SettingsProvider>);
    expect(screen.getByTestId('key')).toHaveTextContent('sk-stored');
  });
});
```

- [ ] **Step 3: Verify failure**

```bash
npm test -- SettingsContext
```
Expected: FAIL.

- [ ] **Step 4: Implement SettingsContext.tsx**

Create `src/state/SettingsContext.tsx`:
```tsx
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import type { Settings, StylePresetKey, ModelId, RssSource } from '../types';
import { DEFAULT_SETTINGS } from '../lib/defaultSettings';
import { loadJson, saveJson, STORAGE_KEYS } from '../lib/storage';

type Ctx = {
  settings: Settings;
  setApiKey: (k: string) => void;
  setModel: (m: ModelId) => void;
  setStylePreset: (s: StylePresetKey) => void;
  setCustomStyleInstruction: (s: string) => void;
  setRssSources: (s: RssSource[]) => void;
  toggleRssSource: (id: string) => void;
  setSimulatorEnabled: (b: boolean) => void;
  setSimulatorIntervalSec: (n: number) => void;
  setAlertSoundEnabled: (b: boolean) => void;
  setBrowserNotificationsEnabled: (b: boolean) => void;
  resetSettings: () => void;
};

const SettingsCtx = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => {
    const stored = loadJson<Partial<Settings>>(STORAGE_KEYS.settings, {});
    return { ...DEFAULT_SETTINGS, ...stored, rssSources: stored.rssSources || DEFAULT_SETTINGS.rssSources };
  });

  useEffect(() => {
    saveJson(STORAGE_KEYS.settings, settings);
  }, [settings]);

  const setApiKey = useCallback((k: string) => setSettings(s => ({ ...s, apiKey: k })), []);
  const setModel = useCallback((m: ModelId) => setSettings(s => ({ ...s, model: m })), []);
  const setStylePreset = useCallback((p: StylePresetKey) => setSettings(s => ({ ...s, stylePreset: p })), []);
  const setCustomStyleInstruction = useCallback((v: string) => setSettings(s => ({ ...s, customStyleInstruction: v })), []);
  const setRssSources = useCallback((rs: RssSource[]) => setSettings(s => ({ ...s, rssSources: rs })), []);
  const toggleRssSource = useCallback((id: string) =>
    setSettings(s => ({ ...s, rssSources: s.rssSources.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r) })), []);
  const setSimulatorEnabled = useCallback((b: boolean) => setSettings(s => ({ ...s, simulatorEnabled: b })), []);
  const setSimulatorIntervalSec = useCallback((n: number) => setSettings(s => ({ ...s, simulatorIntervalSec: n })), []);
  const setAlertSoundEnabled = useCallback((b: boolean) => setSettings(s => ({ ...s, alertSoundEnabled: b })), []);
  const setBrowserNotificationsEnabled = useCallback((b: boolean) => setSettings(s => ({ ...s, browserNotificationsEnabled: b })), []);
  const resetSettings = useCallback(() => setSettings(DEFAULT_SETTINGS), []);

  const value: Ctx = {
    settings, setApiKey, setModel, setStylePreset, setCustomStyleInstruction,
    setRssSources, toggleRssSource, setSimulatorEnabled, setSimulatorIntervalSec,
    setAlertSoundEnabled, setBrowserNotificationsEnabled, resetSettings,
  };
  return <SettingsCtx.Provider value={value}>{children}</SettingsCtx.Provider>;
}

export function useSettings(): Ctx {
  const ctx = useContext(SettingsCtx);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
```

- [ ] **Step 5: Verify pass**

```bash
npm test -- SettingsContext
```
Expected: PASS, 3 tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/defaultSettings.ts src/state/SettingsContext.tsx src/state/SettingsContext.test.tsx
git commit -m "feat(state): Settings context with localStorage sync"
```

---

## Task 15: History context

**Files:**
- Create: `src/state/HistoryContext.tsx`, `src/state/HistoryContext.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/state/HistoryContext.test.tsx`:
```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { HistoryProvider, useHistory } from './HistoryContext';
import type { ConvertedResult } from '../types';

function make(id: string): ConvertedResult {
  return {
    id, sourceArticleId: 'a', sourceTitle: 't', createdAt: parseInt(id), valueScore: 5,
    valueReason: '', facts: { people: [], numbers: [], places: [], dates: [] },
    englishDraft: '', channels: { site: '', x: '', medium: '' },
    factReport: { ok: true, missing: [] },
    bannedHits: { site: [], x: [], medium: [] },
    stylePreset: 'kpop', model: 'gpt-4o-mini',
  };
}

function Probe() {
  const { history, addEntry, clear } = useHistory();
  return (
    <div>
      <span data-testid="count">{history.length}</span>
      <button onClick={() => addEntry(make(String(Date.now())))}>add</button>
      <button onClick={clear}>clear</button>
    </div>
  );
}

beforeEach(() => localStorage.clear());

describe('HistoryContext', () => {
  it('starts empty', () => {
    render(<HistoryProvider><Probe /></HistoryProvider>);
    expect(screen.getByTestId('count')).toHaveTextContent('0');
  });

  it('adds entries and persists', () => {
    render(<HistoryProvider><Probe /></HistoryProvider>);
    act(() => screen.getByText('add').click());
    expect(screen.getByTestId('count')).toHaveTextContent('1');
    expect(localStorage.getItem('nie:history')).toBeTruthy();
  });

  it('caps history at 20 entries (FIFO)', () => {
    render(<HistoryProvider><Probe /></HistoryProvider>);
    act(() => {
      for (let i = 0; i < 25; i++) screen.getByText('add').click();
    });
    expect(parseInt(screen.getByTestId('count').textContent || '0')).toBe(20);
  });

  it('clear empties history', () => {
    render(<HistoryProvider><Probe /></HistoryProvider>);
    act(() => screen.getByText('add').click());
    act(() => screen.getByText('clear').click());
    expect(screen.getByTestId('count')).toHaveTextContent('0');
  });
});
```

- [ ] **Step 2: Verify failure**

```bash
npm test -- HistoryContext
```
Expected: FAIL.

- [ ] **Step 3: Implement HistoryContext.tsx**

Create `src/state/HistoryContext.tsx`:
```tsx
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import type { ConvertedResult } from '../types';
import { loadJson, saveJson, STORAGE_KEYS } from '../lib/storage';

const MAX_HISTORY = 20;

type Ctx = {
  history: ConvertedResult[];
  addEntry: (entry: ConvertedResult) => void;
  removeEntry: (id: string) => void;
  clear: () => void;
};

const HistoryCtx = createContext<Ctx | null>(null);

export function HistoryProvider({ children }: { children: ReactNode }) {
  const [history, setHistory] = useState<ConvertedResult[]>(() =>
    loadJson<ConvertedResult[]>(STORAGE_KEYS.history, [])
  );

  useEffect(() => { saveJson(STORAGE_KEYS.history, history); }, [history]);

  const addEntry = useCallback((entry: ConvertedResult) => {
    setHistory(prev => [entry, ...prev].slice(0, MAX_HISTORY));
  }, []);
  const removeEntry = useCallback((id: string) => {
    setHistory(prev => prev.filter(e => e.id !== id));
  }, []);
  const clear = useCallback(() => setHistory([]), []);

  return <HistoryCtx.Provider value={{ history, addEntry, removeEntry, clear }}>{children}</HistoryCtx.Provider>;
}

export function useHistory(): Ctx {
  const ctx = useContext(HistoryCtx);
  if (!ctx) throw new Error('useHistory must be used within HistoryProvider');
  return ctx;
}
```

- [ ] **Step 4: Verify pass**

```bash
npm test -- HistoryContext
```
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/state/HistoryContext.tsx src/state/HistoryContext.test.tsx
git commit -m "feat(state): History context with FIFO cap of 20"
```

---

## Task 16: Articles hook (RSS polling + manual input)

**Files:**
- Create: `src/state/ArticlesContext.tsx`

- [ ] **Step 1: Implement ArticlesContext.tsx**

Create `src/state/ArticlesContext.tsx`:
```tsx
import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import type { Article } from '../types';
import { fetchRss, dedupeAndMerge, makeArticleId } from '../lib/rss';
import { useSettings } from './SettingsContext';

const POLL_INTERVAL_MS = 30_000;
const HIDDEN_POLL_INTERVAL_MS = 5 * 60_000;
const MAX_ARTICLES = 200;

type Ctx = {
  articles: Article[];
  selectedArticle: Article | null;
  selectArticle: (a: Article | null) => void;
  addManualArticle: (input: { title: string; text: string; sourceUrl?: string }) => Article;
  refreshNow: () => Promise<void>;
};

const ArticlesCtx = createContext<Ctx | null>(null);

export function ArticlesProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedArticle, setSelected] = useState<Article | null>(null);
  const inFlightRef = useRef(false);

  const pollOnce = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const enabled = settings.rssSources.filter(s => s.enabled);
      const results = await Promise.all(enabled.map(s => fetchRss(s)));
      const incoming = results.flat();
      setArticles(prev => dedupeAndMerge(prev, incoming, MAX_ARTICLES));
    } finally {
      inFlightRef.current = false;
    }
  }, [settings.rssSources]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    const start = () => {
      pollOnce();
      timer = setInterval(pollOnce, document.hidden ? HIDDEN_POLL_INTERVAL_MS : POLL_INTERVAL_MS);
    };
    const stop = () => clearInterval(timer);
    const onVisibility = () => { stop(); start(); };

    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility); };
  }, [pollOnce]);

  const selectArticle = useCallback((a: Article | null) => setSelected(a), []);

  const addManualArticle = useCallback((input: { title: string; text: string; sourceUrl?: string }) => {
    const link = input.sourceUrl || `manual://${Date.now()}`;
    const art: Article = {
      id: makeArticleId(link),
      title: input.title || '(직접 입력)',
      description: input.text.slice(0, 500),
      fullText: input.text,
      link,
      pubDate: new Date().toUTCString(),
      source: input.sourceUrl ? 'URL 입력' : '직접 입력',
      inputType: input.sourceUrl ? 'url' : 'paste',
      fetchedAt: Date.now(),
    };
    setArticles(prev => dedupeAndMerge(prev, [art], MAX_ARTICLES));
    setSelected(art);
    return art;
  }, []);

  return (
    <ArticlesCtx.Provider value={{ articles, selectedArticle, selectArticle, addManualArticle, refreshNow: pollOnce }}>
      {children}
    </ArticlesCtx.Provider>
  );
}

export function useArticles(): Ctx {
  const ctx = useContext(ArticlesCtx);
  if (!ctx) throw new Error('useArticles must be used within ArticlesProvider');
  return ctx;
}
```

- [ ] **Step 2: Smoke-test compile**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/state/ArticlesContext.tsx
git commit -m "feat(state): Articles context with RSS polling and manual input"
```

---

## Task 17: Breaking alerts hook + audio

**Files:**
- Create: `src/state/BreakingContext.tsx`, `public/ping.mp3` (placeholder note)

- [ ] **Step 1: Add a placeholder ping.mp3**

Bolt.new users can replace this with a real CC0 sound. For local dev, generate a minimal audio file:

```bash
# macOS includes 'say' which can generate audio; alternatively download any CC0 ping.
# Quick option: use a 1-second silent placeholder so the import doesn't 404.
mkdir -p public
printf 'ID3\x04\x00\x00\x00\x00\x00\x00' > public/ping.mp3
# (Recommended: replace with a real ping sound from freesound.org CC0 before shipping.)
```

- [ ] **Step 2: Implement BreakingContext.tsx**

Create `src/state/BreakingContext.tsx`:
```tsx
import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import type { Article, BreakingAlert } from '../types';
import { detect, generateMockBreaking } from '../lib/breakingDetector';
import { useSettings } from './SettingsContext';
import { useArticles } from './ArticlesContext';

type Ctx = {
  alerts: BreakingAlert[];
  dismissAlert: (articleId: string) => void;
  jumpToAlert: (alert: BreakingAlert) => void;
};

const BreakingCtx = createContext<Ctx | null>(null);

export function BreakingProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const { articles, selectArticle, addManualArticle: _manual } = useArticles();
  const [alerts, setAlerts] = useState<BreakingAlert[]>([]);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio('/ping.mp3');
    audioRef.current.volume = 0.5;
  }, []);

  const playSound = useCallback(() => {
    if (settings.alertSoundEnabled && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => { /* autoplay blocked */ });
    }
  }, [settings.alertSoundEnabled]);

  const pushAlert = useCallback((a: BreakingAlert) => {
    if (seenIdsRef.current.has(a.article.id)) return;
    seenIdsRef.current.add(a.article.id);
    setAlerts(prev => [a, ...prev].slice(0, 5));
    playSound();
    if (settings.browserNotificationsEnabled && Notification.permission === 'granted') {
      new Notification('🚨 ' + a.article.title);
    }
    // auto-dismiss after 30s
    setTimeout(() => dismissAlert(a.article.id), 30_000);
  }, [playSound, settings.browserNotificationsEnabled]);

  const dismissAlert = useCallback((articleId: string) => {
    setAlerts(prev => prev.filter(a => a.article.id !== articleId));
  }, []);

  const jumpToAlert = useCallback((alert: BreakingAlert) => {
    selectArticle(alert.article);
    dismissAlert(alert.article.id);
  }, [dismissAlert, selectArticle]);

  // Scan incoming RSS articles for breaking signals
  useEffect(() => {
    for (const article of articles) {
      const a = detect(article);
      if (a) pushAlert(a);
    }
  }, [articles, pushAlert]);

  // Simulator
  useEffect(() => {
    if (!settings.simulatorEnabled) return;
    const id = setInterval(() => {
      const mock = generateMockBreaking();
      const a = detect(mock);
      if (a) pushAlert(a);
    }, settings.simulatorIntervalSec * 1000);
    return () => clearInterval(id);
  }, [settings.simulatorEnabled, settings.simulatorIntervalSec, pushAlert]);

  return (
    <BreakingCtx.Provider value={{ alerts, dismissAlert, jumpToAlert }}>
      {children}
    </BreakingCtx.Provider>
  );
}

export function useBreaking(): Ctx {
  const ctx = useContext(BreakingCtx);
  if (!ctx) throw new Error('useBreaking must be used within BreakingProvider');
  return ctx;
}
```

- [ ] **Step 3: Smoke-test compile**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/state/BreakingContext.tsx public/ping.mp3
git commit -m "feat(state): breaking-alert context with audio and simulator"
```

---

## Task 18: Conversion hook (runs prompt chain + writes history)

**Files:**
- Create: `src/state/ConversionContext.tsx`

- [ ] **Step 1: Implement ConversionContext.tsx**

Create `src/state/ConversionContext.tsx`:
```tsx
import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { Article, ConvertedResult } from '../types';
import { runChain } from '../lib/promptChain';
import { OpenAIError } from '../lib/openai';
import { useSettings } from './SettingsContext';
import { useHistory } from './HistoryContext';

type Status = 'idle' | 'converting' | 'error';

type Ctx = {
  status: Status;
  error: string | null;
  currentResult: ConvertedResult | null;
  convert: (article: Article) => Promise<void>;
  loadResult: (result: ConvertedResult) => void;
  clearError: () => void;
};

const ConversionCtx = createContext<Ctx | null>(null);

export function ConversionProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const { addEntry } = useHistory();
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [currentResult, setCurrentResult] = useState<ConvertedResult | null>(null);

  const convert = useCallback(async (article: Article) => {
    if (!settings.apiKey) {
      setError('NO_API_KEY');
      return;
    }
    setStatus('converting');
    setError(null);
    try {
      const result = await runChain(article, settings);
      setCurrentResult(result);
      addEntry(result);
      setStatus('idle');
    } catch (err) {
      const msg = err instanceof OpenAIError
        ? `OpenAI error (${err.status}): ${err.message}`
        : (err as Error).message;
      setError(msg);
      setStatus('error');
    }
  }, [settings, addEntry]);

  const loadResult = useCallback((r: ConvertedResult) => setCurrentResult(r), []);
  const clearError = useCallback(() => setError(null), []);

  return (
    <ConversionCtx.Provider value={{ status, error, currentResult, convert, loadResult, clearError }}>
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

- [ ] **Step 2: Smoke-test compile**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/state/ConversionContext.tsx
git commit -m "feat(state): Conversion context wires prompt chain to history"
```

---

## Task 19: Clipboard helper

**Files:**
- Create: `src/lib/clipboard.ts`

- [ ] **Step 1: Implement clipboard.ts**

Create `src/lib/clipboard.ts`:
```ts
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through to legacy */ }

  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/clipboard.ts
git commit -m "feat(lib): clipboard helper with legacy fallback"
```

---

## Task 20: Header component

**Files:**
- Create: `src/components/Header.tsx`

- [ ] **Step 1: Implement Header.tsx**

Create `src/components/Header.tsx`:
```tsx
import { Settings, History, Bell } from 'lucide-react';
import { useBreaking } from '../state/BreakingContext';

type Props = {
  onOpenSettings: () => void;
  onOpenHistory: () => void;
};

export function Header({ onOpenSettings, onOpenHistory }: Props) {
  const { alerts } = useBreaking();
  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
      <div className="flex items-center gap-2">
        <span className="text-xl font-bold">📰 News Intelligence Editor</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">MVP</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenHistory}
          className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm hover:bg-slate-100"
        >
          <History size={16} />
          이력
        </button>
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm hover:bg-slate-100"
        >
          <Settings size={16} />
          설정
        </button>
        <div className="flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs">
          <Bell size={14} />
          {alerts.length}
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Header.tsx
git commit -m "feat(ui): Header with settings/history/alert-count"
```

---

## Task 21: AlertBanner component

**Files:**
- Create: `src/components/AlertBanner.tsx`

- [ ] **Step 1: Implement AlertBanner.tsx**

Create `src/components/AlertBanner.tsx`:
```tsx
import { AlertTriangle, X, ArrowRight } from 'lucide-react';
import { useBreaking } from '../state/BreakingContext';

export function AlertBanner() {
  const { alerts, dismissAlert, jumpToAlert } = useBreaking();
  if (alerts.length === 0) return null;
  const top = alerts[0];

  return (
    <div className="flex animate-pulse-fast items-center justify-between gap-4 bg-red-600 px-6 py-3 text-white">
      <div className="flex items-center gap-3 min-w-0">
        <AlertTriangle size={20} className="flex-none" />
        <div className="min-w-0">
          <span className="mr-2 rounded bg-red-800 px-2 py-0.5 text-xs uppercase tracking-wider">
            {top.severity}
          </span>
          <span className="truncate font-semibold">{top.article.title}</span>
          {top.article.inputType === 'simulator' && (
            <span className="ml-2 text-xs opacity-80">🧪 시뮬레이션</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-none">
        <button
          onClick={() => jumpToAlert(top)}
          className="flex items-center gap-1 rounded-md bg-white px-3 py-1 text-sm font-semibold text-red-700 hover:bg-red-50"
        >
          지금 변환 <ArrowRight size={14} />
        </button>
        <button
          onClick={() => dismissAlert(top.article.id)}
          className="rounded-md p-1 hover:bg-red-700"
          aria-label="닫기"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/AlertBanner.tsx
git commit -m "feat(ui): AlertBanner for breaking alerts"
```

---

## Task 22: ArticlePicker component

**Files:**
- Create: `src/components/ArticlePicker.tsx`

- [ ] **Step 1: Implement ArticlePicker.tsx**

Create `src/components/ArticlePicker.tsx`:
```tsx
import { useState } from 'react';
import { RefreshCw, Plus } from 'lucide-react';
import { useArticles } from '../state/ArticlesContext';

export function ArticlePicker() {
  const { articles, selectedArticle, selectArticle, addManualArticle, refreshNow } = useArticles();
  const [showManual, setShowManual] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualText, setManualText] = useState('');
  const [manualUrl, setManualUrl] = useState('');

  const submitManual = () => {
    if (!manualText.trim()) return;
    addManualArticle({
      title: manualTitle.trim() || '(직접 입력)',
      text: manualText.trim(),
      sourceUrl: manualUrl.trim() || undefined,
    });
    setManualText(''); setManualTitle(''); setManualUrl('');
    setShowManual(false);
  };

  return (
    <aside className="flex h-full flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
        <h2 className="text-sm font-semibold">📰 기사 ({articles.length})</h2>
        <div className="flex gap-1">
          <button
            onClick={refreshNow}
            className="rounded p-1 hover:bg-slate-100"
            aria-label="새로고침"
            title="새로고침"
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={() => setShowManual(v => !v)}
            className="rounded p-1 hover:bg-slate-100"
            aria-label="직접 입력"
            title="직접 입력"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {showManual && (
        <div className="border-b border-slate-100 bg-slate-50 p-3 space-y-2">
          <input
            value={manualTitle}
            onChange={e => setManualTitle(e.target.value)}
            placeholder="제목 (선택)"
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
          <input
            value={manualUrl}
            onChange={e => setManualUrl(e.target.value)}
            placeholder="원본 URL (선택)"
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
          <textarea
            value={manualText}
            onChange={e => setManualText(e.target.value)}
            placeholder="본문 텍스트를 붙여넣으세요"
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm h-24"
          />
          <button
            onClick={submitManual}
            disabled={!manualText.trim()}
            className="w-full rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            추가
          </button>
        </div>
      )}

      <ul className="flex-1 overflow-y-auto">
        {articles.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-slate-400">
            아직 수집된 기사가 없습니다. 30초 대기 또는 ＋ 버튼으로 직접 입력.
          </li>
        )}
        {articles.map(a => (
          <li
            key={a.id}
            onClick={() => selectArticle(a)}
            className={
              'cursor-pointer border-b border-slate-100 px-4 py-3 hover:bg-slate-50 ' +
              (selectedArticle?.id === a.id ? 'bg-slate-100' : '')
            }
          >
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>{a.source}</span>
              {a.isBreaking && <span className="rounded bg-red-100 px-1 text-red-700">🚨 속보</span>}
              {a.inputType === 'simulator' && <span>🧪</span>}
            </div>
            <div className="mt-0.5 text-sm font-medium text-slate-900 line-clamp-2">{a.title}</div>
            <div className="mt-0.5 text-xs text-slate-500 line-clamp-2">{a.description}</div>
          </li>
        ))}
      </ul>
    </aside>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ArticlePicker.tsx
git commit -m "feat(ui): ArticlePicker with RSS list and manual input"
```

---

## Task 23: Workbench component (원문 + 변환문 + 트리거)

**Files:**
- Create: `src/components/Workbench.tsx`

- [ ] **Step 1: Implement Workbench.tsx**

Create `src/components/Workbench.tsx`:
```tsx
import { Loader2, Sparkles, AlertOctagon } from 'lucide-react';
import { useArticles } from '../state/ArticlesContext';
import { useConversion } from '../state/ConversionContext';
import { useSettings } from '../state/SettingsContext';

type Props = {
  onMissingKey: () => void;
};

export function Workbench({ onMissingKey }: Props) {
  const { selectedArticle } = useArticles();
  const { settings } = useSettings();
  const { status, error, currentResult, convert, clearError } = useConversion();

  const trigger = () => {
    if (!selectedArticle) return;
    if (!settings.apiKey) { onMissingKey(); return; }
    convert(selectedArticle);
  };

  return (
    <section className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2">
        <h2 className="text-sm font-semibold">
          {selectedArticle ? `📝 ${selectedArticle.title}` : '👈 기사를 선택하세요'}
        </h2>
        <button
          disabled={!selectedArticle || status === 'converting'}
          onClick={trigger}
          className="flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {status === 'converting' ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {status === 'converting' ? '변환 중…' : '가치 평가 & 생성'}
        </button>
      </div>

      {error && error !== 'NO_API_KEY' && (
        <div className="flex items-start gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          <AlertOctagon size={16} className="mt-0.5 flex-none" />
          <span className="flex-1">{error}</span>
          <button onClick={clearError} className="text-xs underline">닫기</button>
        </div>
      )}

      <div className="grid flex-1 grid-cols-2 gap-2 overflow-y-auto p-3">
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">원문 (한국어)</h3>
          <div className="whitespace-pre-wrap text-sm text-slate-800">
            {selectedArticle?.fullText || selectedArticle?.description || '—'}
          </div>
          {selectedArticle?.link && !selectedArticle.link.startsWith('manual://') && !selectedArticle.link.startsWith('simulator://') && (
            <a href={selectedArticle.link} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-indigo-600 hover:underline">
              원문 보기 ↗
            </a>
          )}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            영문 변환 (가치 점수: {currentResult?.valueScore ?? '—'}/10)
          </h3>
          {currentResult && (
            <p className="mb-2 text-xs italic text-slate-500">{currentResult.valueReason}</p>
          )}
          <div className="whitespace-pre-wrap text-sm text-slate-800">
            {currentResult?.englishDraft || '—'}
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Workbench.tsx
git commit -m "feat(ui): Workbench with side-by-side source/translation and convert trigger"
```

---

## Task 24: FactCheckLog component

**Files:**
- Create: `src/components/FactCheckLog.tsx`

- [ ] **Step 1: Implement FactCheckLog.tsx**

Create `src/components/FactCheckLog.tsx`:
```tsx
import { ShieldAlert } from 'lucide-react';
import { useConversion } from '../state/ConversionContext';

const CATEGORY_LABELS: Record<string, string> = {
  people: '인물', numbers: '숫자', places: '장소', dates: '날짜',
};

export function FactCheckLog() {
  const { currentResult } = useConversion();
  if (!currentResult || currentResult.factReport.ok) return null;

  return (
    <div className="border-y border-red-300 bg-red-50 px-4 py-3">
      <div className="mb-2 flex items-center gap-2 font-semibold text-red-800">
        <ShieldAlert size={18} />
        🚨 Warning: Fact Mismatch Detected — 출력에 누락된 핵심 팩트가 있습니다.
      </div>
      <ul className="space-y-1 text-sm text-red-700">
        {currentResult.factReport.missing.map((m, i) => (
          <li key={i}>
            <span className="mr-2 rounded bg-red-200 px-1.5 py-0.5 text-xs font-semibold uppercase">
              {CATEGORY_LABELS[m.category] || m.category}
            </span>
            "{m.value}"
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-red-600">수동으로 누락된 정보를 확인하고 보정해주세요.</p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/FactCheckLog.tsx
git commit -m "feat(ui): FactCheckLog warning banner"
```

---

## Task 25: OutputTabs with copy

**Files:**
- Create: `src/components/OutputTabs.tsx`

- [ ] **Step 1: Implement OutputTabs.tsx**

Create `src/components/OutputTabs.tsx`:
```tsx
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Copy, Check } from 'lucide-react';
import { useConversion } from '../state/ConversionContext';
import { copyToClipboard } from '../lib/clipboard';

type Tab = 'site' | 'x' | 'medium';

const TAB_LABELS: Record<Tab, string> = {
  site: '본 사이트',
  x: 'X 스레드',
  medium: 'Medium',
};

export function OutputTabs() {
  const { currentResult } = useConversion();
  const [active, setActive] = useState<Tab>('site');
  const [copied, setCopied] = useState<Tab | null>(null);

  if (!currentResult) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-slate-400">
        변환 결과가 여기에 표시됩니다.
      </div>
    );
  }

  const text = currentResult.channels[active];
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const bannedCount = currentResult.bannedHits[active].length;

  const doCopy = async () => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(active);
      setTimeout(() => setCopied(null), 1500);
    }
  };

  return (
    <div className="border-t border-slate-200 bg-white">
      <div className="flex items-center border-b border-slate-200">
        {(Object.keys(TAB_LABELS) as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setActive(t)}
            className={
              'px-4 py-2 text-sm font-medium border-b-2 ' +
              (active === t ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700')
            }
          >
            {TAB_LABELS[t]}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-3 px-4 text-xs text-slate-500">
          <span>단어 {wordCount}</span>
          <span>글자 {text.length}</span>
          <span className={bannedCount > 0 ? 'text-red-600 font-semibold' : ''}>
            금지어 {bannedCount}건
          </span>
          <span className={currentResult.factReport.ok ? 'text-green-600' : 'text-red-600 font-semibold'}>
            팩트 {currentResult.factReport.ok ? '✓' : '✗'}
          </span>
          <button
            onClick={doCopy}
            className="flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            {copied === active ? <Check size={14} /> : <Copy size={14} />}
            {copied === active ? '복사됨' : '복사'}
          </button>
        </div>
      </div>

      <div className="max-h-72 overflow-y-auto p-4">
        {active === 'medium' ? (
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown>{text}</ReactMarkdown>
          </div>
        ) : active === 'x' ? (
          <div className="space-y-3">
            {text.split(/\n(?=\d+\/)/).map((tweet, i) => (
              <div key={i} className="rounded border border-slate-200 bg-slate-50 p-3 text-sm whitespace-pre-wrap">
                {tweet.trim()}
              </div>
            ))}
          </div>
        ) : (
          <pre className="whitespace-pre-wrap text-sm text-slate-800">{text}</pre>
        )}
        {bannedCount > 0 && (
          <p className="mt-3 text-xs text-red-600">
            ⚠ 금지어 발견: {currentResult.bannedHits[active].join(', ')}
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/OutputTabs.tsx
git commit -m "feat(ui): OutputTabs with 3 channel views and clipboard copy"
```

---

## Task 26: SettingsModal

**Files:**
- Create: `src/components/SettingsModal.tsx`

- [ ] **Step 1: Implement SettingsModal.tsx**

Create `src/components/SettingsModal.tsx`:
```tsx
import { useState } from 'react';
import { X, Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import { useSettings } from '../state/SettingsContext';
import { STYLE_PRESETS } from '../lib/styles';
import { useHistory } from '../state/HistoryContext';
import type { StylePresetKey, ModelId } from '../types';

type Props = { open: boolean; onClose: () => void };

export function SettingsModal({ open, onClose }: Props) {
  const {
    settings, setApiKey, setModel, setStylePreset, setCustomStyleInstruction,
    setRssSources, toggleRssSource, setSimulatorEnabled, setSimulatorIntervalSec,
    setAlertSoundEnabled, setBrowserNotificationsEnabled,
  } = useSettings();
  const { clear } = useHistory();
  const [showKey, setShowKey] = useState(false);
  const [newRssName, setNewRssName] = useState('');
  const [newRssUrl, setNewRssUrl] = useState('');

  if (!open) return null;

  const addRss = () => {
    if (!newRssName.trim() || !newRssUrl.trim()) return;
    setRssSources([
      ...settings.rssSources,
      { id: `custom-${Date.now()}`, name: newRssName.trim(), url: newRssUrl.trim(), enabled: true },
    ]);
    setNewRssName(''); setNewRssUrl('');
  };

  const removeRss = (id: string) => {
    setRssSources(settings.rssSources.filter(r => r.id !== id));
  };

  const requestNotifications = async () => {
    if (!('Notification' in window)) { alert('브라우저가 알림을 지원하지 않습니다.'); return; }
    const result = await Notification.requestPermission();
    setBrowserNotificationsEnabled(result === 'granted');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="text-lg font-semibold">⚙ 설정</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-slate-100" aria-label="닫기">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-6 p-5">
          {/* API Key */}
          <section>
            <h3 className="mb-2 font-semibold">OpenAI API 키</h3>
            <div className="flex gap-2">
              <input
                type={showKey ? 'text' : 'password'}
                value={settings.apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm font-mono"
              />
              <button
                onClick={() => setShowKey(v => !v)}
                className="rounded border border-slate-300 px-2 hover:bg-slate-50"
                aria-label="토글"
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500">키는 이 브라우저의 localStorage에만 저장됩니다.</p>
          </section>

          {/* Model */}
          <section>
            <h3 className="mb-2 font-semibold">모델</h3>
            <div className="flex gap-3 text-sm">
              {(['gpt-4o-mini', 'gpt-4o'] as ModelId[]).map(m => (
                <label key={m} className="flex items-center gap-1">
                  <input
                    type="radio"
                    checked={settings.model === m}
                    onChange={() => setModel(m)}
                  />
                  {m}
                </label>
              ))}
            </div>
          </section>

          {/* Style preset */}
          <section>
            <h3 className="mb-2 font-semibold">글 스타일</h3>
            <select
              value={settings.stylePreset}
              onChange={e => setStylePreset(e.target.value as StylePresetKey)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              {(Object.entries(STYLE_PRESETS) as Array<[StylePresetKey, typeof STYLE_PRESETS.kpop]>).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              {STYLE_PRESETS[settings.stylePreset].instruction || '아래에 사용자 지침을 입력하세요.'}
            </p>
            {settings.stylePreset === 'custom' && (
              <textarea
                value={settings.customStyleInstruction}
                onChange={e => setCustomStyleInstruction(e.target.value)}
                placeholder="원하는 스타일 지침을 영어로 입력 (예: 'Casual TIME magazine style with strong leads')"
                className="mt-2 w-full rounded border border-slate-300 px-3 py-2 text-sm h-20"
              />
            )}
          </section>

          {/* RSS sources */}
          <section>
            <h3 className="mb-2 font-semibold">RSS 소스</h3>
            <ul className="space-y-1 text-sm">
              {settings.rssSources.map(r => (
                <li key={r.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={r.enabled}
                    onChange={() => toggleRssSource(r.id)}
                  />
                  <span className="flex-1 truncate">{r.name}</span>
                  <span className="truncate text-xs text-slate-400 w-48">{r.url}</span>
                  <button
                    onClick={() => removeRss(r.id)}
                    className="rounded p-1 hover:bg-red-50 text-red-600"
                    aria-label="삭제"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex gap-2">
              <input
                value={newRssName}
                onChange={e => setNewRssName(e.target.value)}
                placeholder="이름"
                className="w-32 rounded border border-slate-300 px-2 py-1 text-sm"
              />
              <input
                value={newRssUrl}
                onChange={e => setNewRssUrl(e.target.value)}
                placeholder="RSS URL"
                className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
              />
              <button
                onClick={addRss}
                className="flex items-center gap-1 rounded bg-slate-900 px-3 py-1 text-sm text-white"
              >
                <Plus size={14} /> 추가
              </button>
            </div>
          </section>

          {/* Notifications */}
          <section>
            <h3 className="mb-2 font-semibold">알림</h3>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.simulatorEnabled}
                onChange={e => setSimulatorEnabled(e.target.checked)}
              />
              속보 시뮬레이터 사용 (데모용)
            </label>
            <label className="mt-1 flex items-center gap-2 text-sm">
              <span>시뮬레이터 주기:</span>
              <select
                value={settings.simulatorIntervalSec}
                onChange={e => setSimulatorIntervalSec(Number(e.target.value))}
                className="rounded border border-slate-300 px-2 py-0.5 text-sm"
              >
                <option value={30}>30초</option>
                <option value={60}>60초</option>
                <option value={90}>90초</option>
                <option value={120}>120초</option>
              </select>
            </label>
            <label className="mt-1 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.alertSoundEnabled}
                onChange={e => setAlertSoundEnabled(e.target.checked)}
              />
              알림음 재생
            </label>
            <button
              onClick={requestNotifications}
              className="mt-2 rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50"
            >
              브라우저 알림 권한 요청
              {settings.browserNotificationsEnabled && <span className="ml-1 text-green-600">✓</span>}
            </button>
          </section>

          {/* History */}
          <section>
            <h3 className="mb-2 font-semibold">이력 관리</h3>
            <button
              onClick={() => { if (confirm('변환 이력을 모두 삭제하시겠습니까?')) clear(); }}
              className="rounded border border-red-300 px-3 py-1 text-sm text-red-700 hover:bg-red-50"
            >
              변환 이력 전체 삭제
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/SettingsModal.tsx
git commit -m "feat(ui): SettingsModal with full configuration"
```

---

## Task 27: HistoryPanel

**Files:**
- Create: `src/components/HistoryPanel.tsx`

- [ ] **Step 1: Implement HistoryPanel.tsx**

Create `src/components/HistoryPanel.tsx`:
```tsx
import { X, Trash2 } from 'lucide-react';
import { useHistory } from '../state/HistoryContext';
import { useConversion } from '../state/ConversionContext';

type Props = { open: boolean; onClose: () => void };

export function HistoryPanel({ open, onClose }: Props) {
  const { history, removeEntry } = useHistory();
  const { loadResult } = useConversion();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex" onClick={onClose}>
      <div className="flex-1 bg-black/30" />
      <aside
        className="w-96 bg-white shadow-2xl overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sticky top-0 bg-white">
          <h2 className="font-semibold">📜 변환 이력 ({history.length}/20)</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        {history.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-slate-400">아직 이력이 없습니다.</p>
        )}

        <ul>
          {history.map(h => (
            <li
              key={h.id}
              className="border-b border-slate-100 px-4 py-3 hover:bg-slate-50 cursor-pointer"
              onClick={() => { loadResult(h); onClose(); }}
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-slate-500">
                    {new Date(h.createdAt).toLocaleString('ko-KR')} · {h.stylePreset} · 가치 {h.valueScore}/10
                  </div>
                  <div className="mt-0.5 text-sm font-medium truncate">{h.sourceTitle}</div>
                  <div className="mt-0.5 text-xs">
                    {!h.factReport.ok && <span className="mr-2 rounded bg-red-100 px-1.5 text-red-700">팩트 ✗</span>}
                    {(h.bannedHits.site.length + h.bannedHits.x.length + h.bannedHits.medium.length) > 0 && (
                      <span className="rounded bg-amber-100 px-1.5 text-amber-700">금지어</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); removeEntry(h.id); }}
                  className="rounded p-1 text-red-600 hover:bg-red-50"
                  aria-label="삭제"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/HistoryPanel.tsx
git commit -m "feat(ui): HistoryPanel slide-in with restore"
```

---

## Task 28: App composition (wire everything)

**Files:**
- Modify: `src/App.tsx`, `src/main.tsx`

- [ ] **Step 1: Replace src/App.tsx**

```tsx
import { useState } from 'react';
import { SettingsProvider, useSettings } from './state/SettingsContext';
import { HistoryProvider } from './state/HistoryContext';
import { ArticlesProvider } from './state/ArticlesContext';
import { BreakingProvider } from './state/BreakingContext';
import { ConversionProvider } from './state/ConversionContext';
import { Header } from './components/Header';
import { AlertBanner } from './components/AlertBanner';
import { ArticlePicker } from './components/ArticlePicker';
import { Workbench } from './components/Workbench';
import { FactCheckLog } from './components/FactCheckLog';
import { OutputTabs } from './components/OutputTabs';
import { SettingsModal } from './components/SettingsModal';
import { HistoryPanel } from './components/HistoryPanel';

function AppShell() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const { settings } = useSettings();

  // Auto-open settings if no API key
  const handleMissingKey = () => setSettingsOpen(true);

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <Header
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenHistory={() => setHistoryOpen(true)}
      />
      <AlertBanner />
      {!settings.apiKey && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          ⚠ OpenAI API 키가 설정되지 않았습니다.
          <button onClick={() => setSettingsOpen(true)} className="ml-2 underline">설정 열기</button>
        </div>
      )}
      <div className="grid flex-1 grid-cols-[320px_1fr] overflow-hidden">
        <ArticlePicker />
        <div className="flex flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <Workbench onMissingKey={handleMissingKey} />
          </div>
          <FactCheckLog />
          <OutputTabs />
        </div>
      </div>
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <HistoryPanel open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </div>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <HistoryProvider>
        <ArticlesProvider>
          <ConversionProvider>
            <BreakingProvider>
              <AppShell />
            </BreakingProvider>
          </ConversionProvider>
        </ArticlesProvider>
      </HistoryProvider>
    </SettingsProvider>
  );
}
```

- [ ] **Step 2: Verify main.tsx imports App**

`src/main.tsx` should already be:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

If not, replace it with the above.

- [ ] **Step 3: Run dev server and smoke test**

```bash
npm run dev
```

Expected at `http://localhost:5173`:
- Header shows "News Intelligence Editor"
- Amber bar warns about missing API key
- Sidebar empty initially, fills with RSS items within 30 seconds (assuming network reaches rss2json)
- Clicking "설정" opens modal
- Clicking ＋ in sidebar reveals manual input form

Stop with Ctrl+C.

- [ ] **Step 4: Verify production build compiles**

```bash
npm run build
```
Expected: no TypeScript errors. `dist/` directory is created.

- [ ] **Step 5: Run all tests once**

```bash
npm test
```
Expected: all suites pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(app): wire all contexts and components in App.tsx"
```

---

## Task 29: README and Bolt.new deployment notes

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create README.md**

Create `README.md`:
```markdown
# News Intelligence Editor

비개발자 에디터가 한국 뉴스를 자동 수집하고, AI 말투/할루시네이션이 제거된 영문 콘텐츠로 변환해 3개 채널(본 사이트 / X 스레드 / Medium)에 원클릭 복사할 수 있는 무설치형 브라우저 대시보드입니다.

## 빠른 시작 (로컬)

```bash
npm install
npm run dev
```

`http://localhost:5173` 접속 후 ⚙ 설정에서 OpenAI API 키 입력.

## Bolt.new에서 실행

1. 이 리포지토리 전체를 Bolt.new에 업로드 또는 붙여넣기
2. Bolt이 자동으로 `npm install` + `npm run dev` 실행
3. 미리보기에서 ⚙ 설정 → API 키 입력

## 주요 기능

- **자동 수집**: 한국 RSS 다소스 (연합/조선/한겨레/스포츠서울 등) 30초 폴링
- **속보 알림**: 키워드 기반 감지 + 시뮬레이터 (붉은 배너 + 알림음)
- **2콜 LLM 체인**: 가치 평가 & 영문 변환 → 채널별 포맷팅
- **금지어 자동 차단**: delve, in conclusion, furthermore 등 LLM 상투구
- **규칙 기반 팩트 체크**: 사람/숫자/장소/날짜 누락 시 🚨 경고
- **3채널 원클릭 복사**: 본 사이트 / X 스레드 / Medium
- **변환 이력**: localStorage 최근 20건

## 스타일 프리셋

⚙ 설정 → 글 스타일에서 선택:
- **K-pop / 연예 / 가십** (기본) — Soompi / Allkpop 스타일
- **AP / Reuters 통신사**
- **Bloomberg / FT 경제지**
- **TechCrunch / Verge 테크**
- **커스텀** (직접 지침 입력)

## 비용 안내

- 기본 모델 `gpt-4o-mini`: 기사 1건 처리 ≈ $0.001~0.002
- 상위 모델 `gpt-4o`: ≈ $0.01~0.02
- RSS는 rss2json 무료 티어 (10 req/h 한도)

## 테스트

```bash
npm test          # 1회 실행
npm run test:watch # 감시 모드
```

## 폴더 구조

```
src/
├── components/   # 화면 컴포넌트
├── state/        # Context 기반 전역 상태
├── lib/          # 순수 함수 라이브러리
├── types.ts
├── App.tsx
└── main.tsx
```

## 알려진 제한

- 일부 한국 매체는 rss2json 무료 한도/CORS로 실패할 수 있음 → 설정에서 비활성화
- RSS 본문은 요약만 포함되므로 긴 분석이 필요한 경우 URL/텍스트 수동 입력 권장
- 클립보드 API는 HTTPS 또는 localhost에서만 동작 (Bolt.new 미리보기 OK)
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README with quickstart and Bolt.new notes"
```

---

## Task 30: Final manual verification

**Files:** none

- [ ] **Step 1: Run full test suite**

```bash
npm test
```
Expected: all suites pass, ~50 tests total.

- [ ] **Step 2: Run production build**

```bash
npm run build
```
Expected: clean build, no TypeScript errors.

- [ ] **Step 3: Manual scenario walkthroughs**

Start `npm run dev`. With a valid OpenAI key set:

1. **Test Case 1 (banned words):** Paste a Korean entertainment article via ＋. Click "가치 평가 & 생성". Verify all three channel outputs do NOT contain `delve`, `in conclusion`, `furthermore`, `moreover`, `testament`. Check the "금지어" counter shows 0.

2. **Test Case 2 (X format):** Copy the X tab. Paste into a notepad. Verify it has numbered tweets (`1/`, `2/` ...) and emojis.

3. **Test Case 3 (Medium format):** Copy the Medium tab. Verify markdown structure (H1 title, H2 section headers).

4. **Test Case 4 (breaking alert):** Wait 30 seconds with simulator enabled. Verify a red banner appears with sound. Click "지금 변환" — selected article should switch to the alert.

5. **Test Case 5 (API key missing):** Clear API key in settings. Try to convert. Settings modal should auto-open.

6. **Test Case 6 (fact check):** Use a short Korean article with a specific number (e.g., "10만 명"). After conversion, manually edit the output by deleting the number from the result — then re-trigger via history. Verify 🚨 banner appears.

- [ ] **Step 4: Commit final state**

If everything passes:
```bash
git add -A
git commit -m "chore: manual verification complete" --allow-empty
```

If any failure: open a follow-up task, do not mark this complete.

---

## Done (v1: 단일 기사 변환)

All 30 tasks complete. Bolt.new-ready single-page React + TypeScript dashboard with RSS polling, LLM chain, banned-word filtering, rule-based fact check, breaking alerts, and 3-channel output with clipboard copy.

---

## v2 Addendum (2026-05-26): 클러스터링 + 편집

사용자 실제 워크플로우 확인 결과 단일 기사 입력은 부족, 다중 소스 종합 + 사람 편집이 필요해 추가됨.

### Task 31 — clustering.ts (TDD)
- `extractEntities`, `tokenize`, `jaccard`, `similarity`, `groupIntoClusters`
- 16 tests, 모두 passing

### Task 32 — ClustersContext
- `useArticles().articles` → `groupIntoClusters` → 자동 클러스터
- 수동 split override + selectedCluster + selectedArticles

### Task 33 — promptChain Article → Article[]
- Call 1 system: cross-verification 지시 추가
- Call 1 user: 모든 소스 enumerate
- `formatChannels({ editedDraft, facts, settings })` 신규 export

### Task 34 — ClusterPicker
- ArticlePicker 삭제, ClusterPicker로 대체
- chevron으로 펼침/접기, 멤버 기사 목록, "다른 사건으로 빼기" 버튼

### Task 35 — Workbench multi-source + editable draft
- 좌측: 원문 carousel (1/N 페이지네이션)
- 우측: editable textarea + 가치 점수 + "채널 재생성" 버튼

### Task 36 — ConversionContext.regenerateChannels(editedDraft)
- runChain은 전체 (Call 1 + Call 2)
- regenerateChannels는 Call 2만 (편집된 드래프트 기반)
- status: 'idle' | 'converting' | 'regenerating' | 'error'

### Task 37 — Type updates
- `Cluster` 신규
- `ConvertedResult.sourceArticleId` → `sourceArticleIds: string[]`
- `ConvertedResult.editedDraft?: string`

### v2 Non-features (이번에 안 한 것)
- 위법/명예훼손 자동 플래그 (후속 — 키워드 매칭으로 가능)
- 발행 API 자동화 (Bolt.new SPA 제약상 클립보드만 유지)
- LLM 기반 클러스터링 (현재는 클라이언트 로컬 키워드 매칭)

### 후속 검토 후보
- 명예훼손 위험 패턴 사전 (실명+의혹/혐의/사생활) → Workbench 위에 워닝 배너
- 클러스터 임계값 (threshold) 사용자 조절 가능하게 ⚙ 설정에 노출
- 같은 사건인데 클러스터링이 못 묶은 케이스 — 수동 "이 기사를 X 클러스터에 추가" 기능

