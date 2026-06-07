import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from './sanitizeHtml';

describe('sanitizeHtml', () => {
  it('허용 서식 태그 유지', () => {
    const out = sanitizeHtml('<p>안녕 <strong>굵게</strong> <em>기울임</em></p>');
    expect(out).toContain('<p>');
    expect(out).toContain('<strong>굵게</strong>');
    expect(out).toContain('<em>기울임</em>');
  });

  it('script 태그·내용 제거', () => {
    const out = sanitizeHtml('<p>본문</p><script>alert(1)</script>');
    expect(out).not.toContain('<script');
    expect(out).not.toContain('alert(1)');
    expect(out).toContain('<p>본문</p>');
  });

  it('on* 이벤트 핸들러 제거', () => {
    const out = sanitizeHtml('<img src="x.jpg" alt="t" onerror="alert(1)">');
    expect(out).not.toContain('onerror');
    expect(out).toContain('src="x.jpg"');
    expect(out).toContain('alt="t"');
  });

  it('javascript: 스킴 제거', () => {
    const out = sanitizeHtml('<img src="javascript:alert(1)" alt="x">');
    expect(out).not.toContain('javascript:');
  });

  it('a 태그 제거하되 텍스트 보존', () => {
    const out = sanitizeHtml('<p>클릭 <a href="http://evil">여기</a></p>');
    expect(out).not.toContain('<a');
    expect(out).not.toContain('href');
    expect(out).toContain('여기');
  });

  it('iframe 제거', () => {
    const out = sanitizeHtml('<p>x</p><iframe src="http://evil"></iframe>');
    expect(out).not.toContain('<iframe');
  });

  it('허용 이미지 src/alt만 유지, style 제거', () => {
    const out = sanitizeHtml('<img src="https://a.com/i.jpg" alt="설명" style="x" width="9">');
    expect(out).toContain('src="https://a.com/i.jpg"');
    expect(out).toContain('alt="설명"');
    expect(out).not.toContain('style');
    expect(out).not.toContain('width');
  });

  it('figure/figcaption/리스트 유지', () => {
    const out = sanitizeHtml('<figure><img src="a.jpg" alt="x"><figcaption>캡션</figcaption></figure><ul><li>항목</li></ul>');
    expect(out).toContain('<figure>');
    expect(out).toContain('<figcaption>캡션</figcaption>');
    expect(out).toContain('<li>항목</li>');
  });

  it('빈/falsy 입력 안전', () => {
    expect(sanitizeHtml('')).toBe('');
    expect(sanitizeHtml(undefined as unknown as string)).toBe('');
  });

  it('기존 draft의 src 없는/빈 <img> 렌더 정화로 제거', () => {
    const out = sanitizeHtml('<p>본문</p><img src=""><img alt="x"><img src="https://a/i.jpg">');
    expect(out).toContain('<p>본문</p>');
    expect(out).toContain('src="https://a/i.jpg"');
    // src 없는/빈 img는 제거 — 남은 img는 1개(유효 src)
    expect((out.match(/<img/g) || []).length).toBe(1);
  });

  it('빈 <p> 제거', () => {
    expect(sanitizeHtml('<p>x</p><p></p><p>  </p>')).toBe('<p>x</p>');
  });
});
