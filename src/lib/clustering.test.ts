import { describe, it, expect } from 'vitest';
import {
  extractEntities,
  tokenize,
  jaccard,
  similarity,
  groupIntoClusters,
} from './clustering';
import type { Article } from '../types';

function art(over: Partial<Article>): Article {
  return {
    id: Math.random().toString(36).slice(2),
    title: '',
    description: '',
    link: 'https://e.com/' + Math.random(),
    pubDate: '',
    source: 's',
    inputType: 'rss',
    fetchedAt: Date.now(),
    ...over,
  };
}

describe('extractEntities', () => {
  it('extracts capitalized English entities', () => {
    const e = extractEntities('BLACKPINK announces comeback in Seoul');
    expect(e).toContain('BLACKPINK');
    expect(e).toContain('Seoul');
  });

  it('extracts Korean 2-4 char name-like tokens', () => {
    const e = extractEntities('가수 아이유, 새 앨범 발매');
    expect(e).toContain('아이유');
  });

  it('returns empty array on empty input', () => {
    expect(extractEntities('')).toEqual([]);
  });
});

describe('tokenize', () => {
  it('strips punctuation and Korean particles', () => {
    const t = tokenize('BLACKPINK이 컴백을 발표했다.');
    expect(t).toContain('BLACKPINK');
    expect(t).toContain('컴백');
    expect(t).toContain('발표');
    expect(t).not.toContain('이');
    expect(t).not.toContain('을');
  });

  it('lowercases english tokens for matching but keeps original entities', () => {
    const t = tokenize('Seoul concert announced');
    expect(t).toContain('seoul');
  });
});

describe('jaccard', () => {
  it('returns 1 for identical sets', () => {
    expect(jaccard(new Set(['a', 'b']), new Set(['a', 'b']))).toBe(1);
  });
  it('returns 0 for disjoint sets', () => {
    expect(jaccard(new Set(['a']), new Set(['b']))).toBe(0);
  });
  it('computes intersection / union', () => {
    expect(jaccard(new Set(['a', 'b', 'c']), new Set(['b', 'c', 'd']))).toBeCloseTo(2 / 4);
  });
  it('returns 0 when both empty', () => {
    expect(jaccard(new Set(), new Set())).toBe(0);
  });
});

describe('similarity', () => {
  it('high when entities + title tokens overlap', () => {
    const a = art({ title: 'BLACKPINK announces Seoul comeback' });
    const b = art({ title: 'BLACKPINK comeback set for Seoul' });
    expect(similarity(a, b)).toBeGreaterThan(0.5);
  });

  it('low when entities differ', () => {
    const a = art({ title: 'BLACKPINK announces comeback' });
    const b = art({ title: 'BTS member discharged from military' });
    expect(similarity(a, b)).toBeLessThan(0.3);
  });
});

describe('groupIntoClusters', () => {
  const now = Date.now();

  it('groups two similar articles together', () => {
    const a = art({ id: '1', title: 'BLACKPINK 컴백 발표', fetchedAt: now });
    const b = art({ id: '2', title: 'BLACKPINK 새 앨범 컴백', fetchedAt: now });
    const clusters = groupIntoClusters([a, b], { threshold: 0.3 });
    expect(clusters).toHaveLength(1);
    expect(clusters[0].articleIds).toEqual(expect.arrayContaining(['1', '2']));
  });

  it('separates unrelated articles', () => {
    const a = art({ id: '1', title: 'BLACKPINK 컴백', fetchedAt: now });
    const b = art({ id: '2', title: 'BTS 멤버 입대', fetchedAt: now });
    const clusters = groupIntoClusters([a, b], { threshold: 0.5 });
    expect(clusters).toHaveLength(2);
  });

  it('drops articles older than windowMs', () => {
    const a = art({ id: 'old', title: '오래된 기사', fetchedAt: now - 48 * 3600_000 });
    const b = art({ id: 'new', title: '최신 기사', fetchedAt: now });
    const clusters = groupIntoClusters([a, b], { windowMs: 24 * 3600_000, now });
    expect(clusters.flatMap(c => c.articleIds)).not.toContain('old');
    expect(clusters.flatMap(c => c.articleIds)).toContain('new');
  });

  it('cluster id is stable for same article set (sorted)', () => {
    const a = art({ id: 'a', title: '에스파 컴백', fetchedAt: now });
    const b = art({ id: 'b', title: '에스파 컴백', fetchedAt: now });
    const c1 = groupIntoClusters([a, b], { threshold: 0.1 });
    const c2 = groupIntoClusters([b, a], { threshold: 0.1 });
    expect(c1).toHaveLength(1); // 공유 엔티티(에스파) → 1클러스터
    expect(c1[0].id).toBe(c2[0].id);
  });

  it('representativeTitle is from the most recent article', () => {
    const older = art({ id: '1', title: '에스파 옛 소식', fetchedAt: now - 1000 });
    const newer = art({ id: '2', title: '에스파 새 소식', fetchedAt: now });
    const clusters = groupIntoClusters([older, newer], { threshold: 0.05 });
    expect(clusters[0].representativeTitle).toBe('에스파 새 소식');
  });
});

describe('멀티소스 클러스터링 (근본 P0)', () => {
  const now = Date.now();
  const distinctMedia = (ids: string[], arts: Article[]) =>
    new Set(ids.map(id => arts.find(a => a.id === id)!.source)).size;

  it('같은 사건 3매체(제목 제각각, 인물 공유) → 1클러스터 distinctMedia≥2', () => {
    const arts = [
      art({ id: 'y', source: '연합뉴스', title: '뉴진스, 새 미니앨범으로 컴백', description: '뉴진스가 신곡을 발표했다', fetchedAt: now }),
      art({ id: 's', source: 'Soompi', title: 'NewJeans Returns With New Single', description: '뉴진스 컴백 소식', fetchedAt: now }),
      art({ id: 'n', source: '뉴시스', title: '하이브 걸그룹 뉴진스 활동 재개', description: '뉴진스 음반 발매', fetchedAt: now }),
    ];
    const clusters = groupIntoClusters(arts, { now });
    expect(clusters).toHaveLength(1);
    expect(distinctMedia(clusters[0].articleIds, arts)).toBeGreaterThanOrEqual(2);
  });

  it('과병합 방지: 공유 엔티티 없으면 제목 토큰 겹쳐도 병합 안 함', () => {
    // 둘 다 "컴백 발표"라는 흔한 토큰을 쓰지만 인물(아이브 vs 르세라핌)이 다름
    const arts = [
      art({ id: 'a', source: 'A', title: '아이브 컴백 발표', fetchedAt: now }),
      art({ id: 'b', source: 'B', title: '르세라핌 컴백 발표', fetchedAt: now }),
    ];
    const clusters = groupIntoClusters(arts, { now, threshold: 0.2 });
    expect(clusters).toHaveLength(2);
  });

  it('entityAllowlist로 그룹명 매칭 정밀화', () => {
    const arts = [
      art({ id: 'a', source: 'A', title: '에스파 신보 발매', fetchedAt: now }),
      art({ id: 'b', source: 'B', title: 'aespa 컴백 무대', description: '에스파 활동', fetchedAt: now }),
    ];
    const clusters = groupIntoClusters(arts, { now, entityAllowlist: ['에스파'], threshold: 0.2 });
    expect(clusters).toHaveLength(1);
  });
});

describe('extractEntities 정밀화 (stoplist)', () => {
  it('흔한 일반명사/부사는 엔티티에서 제외', () => {
    const e = extractEntities('오늘 기자 회견에서 사진 공개 발표 활동 모습');
    expect(e).not.toContain('오늘');
    expect(e).not.toContain('기자');
    expect(e).not.toContain('사진');
    expect(e).not.toContain('발표');
  });
  it('영문 문장 첫 단어(The 등)는 제외', () => {
    expect(extractEntities('The group BLACKPINK')).not.toContain('The');
    expect(extractEntities('The group BLACKPINK')).toContain('BLACKPINK');
  });
  it('allowlist 항목은 stoplist 무관하게 포함', () => {
    // '발표'는 stoplist지만 allowlist에 있으면 포함
    expect(extractEntities('컴백 발표', ['발표'])).toContain('발표');
  });
});
