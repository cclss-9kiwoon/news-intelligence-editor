import type { Article } from '../types';

/**
 * 검색 소스(네이버/다음) 수집 결과 진단 — 인증실패 / 빈응답 / allowlist 전량 drop을 구분.
 * ArticlesContext가 이걸로 정직한 collectError 메시지를 분기(거짓 "키 확인" 방지).
 */
export type SearchFetchStats = {
  httpStatus: number;     // 200 OK / 401·403 인증실패 / 404 등 / 0=네트워크·타임아웃
  rawCount: number;       // API가 반환한 원시 결과 수(필터 전)
  droppedNonNews: number; // 뉴스 allowlist 외(커뮤니티/블로그)로 drop된 수
  finalCount: number;     // 최종 Article 수
};

export type SearchFetchResult = {
  articles: Article[];
  stats: SearchFetchStats;
};

/**
 * stats → 사용자용 collectError 문구. 정상(finalCount>0)이면 null.
 * 키 정상인데 거짓 키에러 내지 않도록: allowlist 전량 drop은 '정상'으로 안내.
 */
export function searchFailureMessage(label: string, stats: SearchFetchStats): string | null {
  if (stats.httpStatus === 401 || stats.httpStatus === 403) {
    return `${label}: 인증 실패 (키 확인)`;
  }
  if (stats.finalCount > 0) return null;            // 정상 수집
  if (stats.httpStatus !== 200 && stats.httpStatus !== 0) {
    return `${label}: 검색 API 오류 (${stats.httpStatus})`;
  }
  if (stats.rawCount > 0 && stats.finalCount === 0) {
    // allowlist 전량 drop — 키 문제 아님(카카오 웹검색이 커뮤니티만 반환)
    return `${label}: 뉴스 매체 결과 없음 (커뮤니티만 검색됨 — 정상)`;
  }
  return `${label}: 결과 없음`;
}
