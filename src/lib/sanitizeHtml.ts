import DOMPurify from 'dompurify';

/**
 * 드래프트 본문(StoryOutput.body) HTML을 미리보기에 렌더하기 전 정화.
 *
 * 본문은 allkpop 프리셋이 <p>/<strong>/<img> 등 HTML을 강제하지만,
 * LLM 생성물 + 소스 인용문에 악성 태그가 섞일 수 있으므로 fail-safe로 sanitize.
 *
 * allowlist 외 태그는 제거(텍스트 내용은 보존). 이벤트핸들러(on*)·script·style·
 * iframe·a(href)는 제거. 이미지에는 src/alt만 허용.
 * dangerouslySetInnerHTML에 넣기 전 반드시 통과.
 */

const ALLOWED_TAGS = [
  'p', 'strong', 'em', 'b', 'i', 'br',
  'img', 'figure', 'figcaption',
  'h2', 'h3',
  'ul', 'ol', 'li',
  'blockquote',
];

// 전역 허용 속성(태그 무관). img의 src/alt + figure 등 식별용 최소.
const ALLOWED_ATTR = ['src', 'alt'];

export function sanitizeHtml(html: string): string {
  if (!html) return '';
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // 위험 태그는 콘텐츠째 제거(script/style 내부 텍스트 노출 방지)
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'a'],
    FORBID_ATTR: ['style', 'srcset'],
    // a/script 등 제거 시 텍스트 자식은 보존
    KEEP_CONTENT: true,
    // data-* / aria-* 차단(불필요)
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    // http(s)·data 이미지만 — javascript: 등 스킴 차단
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|data:image\/(?:png|jpe?g|gif|webp);|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  }) as unknown as string;
}
