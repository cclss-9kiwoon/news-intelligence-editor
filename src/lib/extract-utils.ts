/**
 * Shared Naver article extraction utility.
 *
 * Extracted from naver.ts to break the circular dependency
 * between scraper.ts and naver.ts. Both modules import from
 * this file instead of from each other.
 */

const ARTICLE_TIMEOUT_MS = 12_000;
const MIN_USEFUL_LENGTH = 100;

export type NaverExtractResult = {
  ok: boolean;
  text?: string;
  title?: string;
  images?: { url: string; alt?: string; caption?: string }[];
  error?: string;
};

/**
 * Extract full text and images from a Naver news article page.
 * Uses #dic_area selector which contains the article body on n.news.naver.com.
 */
export async function extractNaverArticle(naverUrl: string): Promise<NaverExtractResult> {

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ARTICLE_TIMEOUT_MS);

    const res = await fetch(`/api/naver-article?url=${encodeURIComponent(naverUrl)}`, {
      signal: ctrl.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }

    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');

    // Extract article body — try multiple selectors for different Naver page layouts
    const dicArea = doc.querySelector('#dic_area')
      || doc.querySelector('#newsct_article')
      || doc.querySelector('#articeBody')
      || doc.querySelector('.newsct_body')
      || doc.querySelector('.article_body')
      || doc.querySelector('article');
    if (!dicArea) {
      return { ok: false, error: '#dic_area not found' };
    }

    // Extract images before stripping to text
    const images: { url: string; alt?: string; caption?: string }[] = [];
    const imgElements = dicArea.querySelectorAll('img');
    imgElements.forEach(img => {
      const src = img.getAttribute('data-src') || img.getAttribute('src') || '';
      if (src && !src.includes('blank.gif') && !src.includes('transparent')) {
        // Find caption — typically in a <em> or <span> sibling/parent
        const figCaption = img.closest('figure')?.querySelector('figcaption, em, .img_desc');
        images.push({
          url: src,
          alt: img.getAttribute('alt') || undefined,
          caption: figCaption?.textContent?.trim() || undefined,
        });
      }
    });

    // Extract clean text
    // Remove script/style elements
    dicArea.querySelectorAll('script, style, .vod_area, .nbd_im_w').forEach(el => el.remove());
    const text = (dicArea.textContent || '')
      .replace(/\s+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (text.length < MIN_USEFUL_LENGTH) {
      return { ok: false, error: 'Text too short' };
    }

    // Extract title
    const titleEl = doc.querySelector('.media_end_head_headline, #title_area span, .article_info h3');
    const title = titleEl?.textContent?.trim() || '';

    return {
      ok: true,
      text,
      title,
      images: images.length > 0 ? images : undefined,
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { ok: false, error: 'Timeout' };
    }
    return { ok: false, error: err.message || 'Unknown error' };
  }
}
