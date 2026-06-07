import { describe, it, expect } from 'vitest';
import { searchFailureMessage, type SearchFetchStats } from './searchStats';

const stats = (o: Partial<SearchFetchStats>): SearchFetchStats =>
  ({ httpStatus: 200, rawCount: 0, droppedNonNews: 0, finalCount: 0, ...o });

describe('searchFailureMessage', () => {
  it('401 → 인증 실패(키 확인)', () => {
    expect(searchFailureMessage('다음 검색', stats({ httpStatus: 401 })))
      .toBe('다음 검색: 인증 실패 (키 확인)');
  });

  it('403 → 인증 실패', () => {
    expect(searchFailureMessage('네이버 검색', stats({ httpStatus: 403 })))
      .toContain('인증 실패');
  });

  it('정상 수집(finalCount>0) → null', () => {
    expect(searchFailureMessage('다음 검색', stats({ rawCount: 10, finalCount: 5 })))
      .toBeNull();
  });

  it('allowlist 전량 drop → 커뮤니티만(정상), 키 문구 없음', () => {
    const msg = searchFailureMessage('다음 검색', stats({ rawCount: 10, droppedNonNews: 10, finalCount: 0 }));
    expect(msg).toBe('다음 검색: 뉴스 매체 결과 없음 (커뮤니티만 검색됨 — 정상)');
    expect(msg).not.toMatch(/키|인증/);
  });

  it('빈 응답(rawCount 0) → 결과 없음', () => {
    expect(searchFailureMessage('다음 검색', stats({ rawCount: 0, finalCount: 0 })))
      .toBe('다음 검색: 결과 없음');
  });

  it('기타 비정상 상태(500) → API 오류', () => {
    expect(searchFailureMessage('네이버 검색', stats({ httpStatus: 500 })))
      .toBe('네이버 검색: 검색 API 오류 (500)');
  });

  it('404(배포 dev전용) → API 오류 표기', () => {
    expect(searchFailureMessage('다음 검색', stats({ httpStatus: 404 })))
      .toContain('404');
  });
});
