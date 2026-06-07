import { loadJson, saveJson, STORAGE_KEYS } from './storage';
import { normalizeTitle, originalKey } from './searchFilter';

/**
 * 폐기/거부 원장 — 한 번 폐기·거부·삭제한 기사가 재수집(re-claim)되는 것을 영속 차단.
 *
 * 문제: task를 deleteTask하면 sources[].articleId가 사라져 shouldClaimCluster의
 * already_claimed가 무력 → 같은 기사 재유입. 같은 사건 다른 URL은 articleId(FNV해시)가
 * 달라 더 쉽게 재유입. 발행물 원장(history)은 claim에 안 쓰임.
 *
 * 해결: task와 독립된 원장에 url/articleId/title 시그니처를 누적, claim 시 대조.
 */

export type DiscardEntry = {
  articleIds: string[];
  urls: string[];
  titleSig: string;       // normalizeTitle(대표 제목) — 다른 URL 같은 사건 차단용
  entity?: string;
  ts: number;
};

export type DiscardIndex = {
  titleSigs: Set<string>;
  urls: Set<string>;       // originalKey 정규화된 URL
  articleIds: Set<string>;
};

const MAX_ENTRIES = 1000;
const MAX_AGE_MS = 30 * 86_400_000; // 30일

/** 만료(30일) 지난 항목 제외하고 로드. */
export function loadDiscarded(now: number = Date.now()): DiscardEntry[] {
  const all = loadJson<DiscardEntry[]>(STORAGE_KEYS.discarded, []);
  if (!Array.isArray(all)) return [];
  return all.filter(e => e && typeof e.ts === 'number' && now - e.ts <= MAX_AGE_MS);
}

/** 원장에 1건 적재. cap(1000) 초과 시 오래된 것부터 버림. */
export function recordDiscard(entry: Omit<DiscardEntry, 'ts'>, now: number = Date.now()): void {
  const prev = loadDiscarded(now);
  const next = [...prev, { ...entry, ts: now }];
  saveJson(STORAGE_KEYS.discarded, next.slice(-MAX_ENTRIES));
}

/** 원장 비우기(사용자 옵션). */
export function clearDiscarded(): void {
  saveJson(STORAGE_KEYS.discarded, []);
}

/** title 원문/url/articleId로 원장 엔트리 생성(titleSig 자동 정규화). */
export function makeDiscardEntry(opts: {
  title: string;
  urls?: string[];
  articleIds?: string[];
  entity?: string;
}): Omit<DiscardEntry, 'ts'> {
  return {
    titleSig: normalizeTitle(opts.title || ''),
    urls: (opts.urls ?? []).filter(Boolean),
    articleIds: (opts.articleIds ?? []).filter(Boolean),
    entity: opts.entity,
  };
}

/** 엔트리 목록 → 빠른 조회 인덱스(URL은 originalKey 정규화). */
export function buildDiscardIndex(entries: DiscardEntry[]): DiscardIndex {
  const idx: DiscardIndex = { titleSigs: new Set(), urls: new Set(), articleIds: new Set() };
  for (const e of entries) {
    if (e.titleSig) idx.titleSigs.add(e.titleSig);
    for (const u of e.urls ?? []) if (u) idx.urls.add(originalKey(u));
    for (const id of e.articleIds ?? []) if (id) idx.articleIds.add(id);
  }
  return idx;
}
