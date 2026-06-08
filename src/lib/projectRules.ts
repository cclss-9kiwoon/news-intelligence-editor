import type { ProjectProfile, FormatRules, QuoteStyle } from '../types';

/**
 * ProjectProfile → 규칙 텍스트 변환 (SSOT).
 *
 * 생성 프롬프트(promptChain)와 검수 엔진(review)이 동일하게 이 함수를 호출해
 * 같은 규칙을 적용한다. 규칙이 한 곳에서만 정의되므로 드리프트가 없다.
 */

function quoteLabel(q: QuoteStyle): string {
  return q === 'double' ? '큰따옴표("")' : "작은따옴표('')";
}

const CASING_LABEL: Record<FormatRules['headlineCasing'], string> = {
  'none': '',
  'lower-minor': '전치사·접속사·관사는 소문자, 주요 단어는 첫 글자 대문자 (영문 헤드라인)',
  'title': '모든 주요 단어 첫 글자 대문자 (Title Case, 영문)',
  'sentence': '첫 단어와 고유명사만 대문자 (Sentence case)',
};

const ARTIST_LABEL: Record<FormatRules['artistMarkup'], string> = {
  'strong': '본문에서 아티스트/그룹명·멤버명·곡명·앨범명은 *첫 등장 시에만* <strong>이름</strong>으로 감싼다. 같은 대상의 재언급은 plain(마크업 없음). <a> 링크는 쓰지 않는다.',
  'link': '본문 아티스트/그룹명은 <a href> 링크로 처리한다.',
  'plain': '본문 아티스트/그룹명에 별도 마크업을 쓰지 않는다.',
};

const IMAGE_LABEL: Record<FormatRules['imageMarkup'], string> = {
  'img-direct': '이미지는 <img> 태그로 직접 배치한다. <figure> 태그는 쓰지 않는다.',
  'figure': '이미지는 <figure>/<figcaption> 구조를 허용한다.',
};

/**
 * 포맷·정책 규칙을 LLM 프롬프트용 텍스트 블록으로 변환.
 * 반환값이 비면(규칙 전무) 빈 문자열.
 */
export function buildProjectRulesText(profile: ProjectProfile): string {
  const f = profile.formatRules;
  const lines: string[] = [];

  if (profile.publicationName.trim()) {
    lines.push(`매체명: ${profile.publicationName}`);
  }

  // 인용부호
  lines.push(`곡명/트랙명은 ${quoteLabel(f.quoteSong)}로 감싼다.`);
  lines.push(`앨범/EP/쇼/드라마/투어명은 ${quoteLabel(f.quoteWork)}로 감싼다.`);
  lines.push(`인용구는 ${quoteLabel(f.quoteQuotation)}로 감싼다.`);

  // 헤드라인 케이싱
  if (CASING_LABEL[f.headlineCasing]) {
    lines.push(`헤드라인 케이싱: ${CASING_LABEL[f.headlineCasing]}`);
  }

  // 마크업
  lines.push(ARTIST_LABEL[f.artistMarkup]);
  lines.push(IMAGE_LABEL[f.imageMarkup]);

  // 클로징
  if (f.noEditorialClosing) {
    lines.push('클로징에 에디토리얼 첨언(축하·응원·질문·전망 권유)을 넣지 않는다. 마지막 문장도 팩트로 끝낸다.');
  }

  // 길이
  if (f.bodyMinChars > 0 || f.bodyMaxChars > 0) {
    if (f.bodyMinChars > 0 && f.bodyMaxChars > 0) {
      lines.push(`본문 길이는 ${f.bodyMinChars}~${f.bodyMaxChars}자 범위를 지킨다.`);
    } else if (f.bodyMaxChars > 0) {
      lines.push(`본문은 최대 ${f.bodyMaxChars}자 이내로 작성한다.`);
    } else {
      lines.push(`본문은 최소 ${f.bodyMinChars}자 이상으로 작성한다.`);
    }
  }

  // 매체 정책
  if (profile.allowedMedia.length > 0) {
    lines.push(`허용 출처 매체: ${profile.allowedMedia.join(', ')}만 사용한다.`);
  }
  if (profile.bannedMedia.length > 0) {
    lines.push(`금지 출처 매체: ${profile.bannedMedia.join(', ')}는 인용·참조하지 않는다.`);
  }

  // 자유 가이드라인
  if (profile.styleGuide.trim()) {
    lines.push(profile.styleGuide.trim());
  }

  return lines.join('\n');
}
