import { describe, expect, it } from 'vitest';
import { isSafeStaticSvg, sanitizeHighlightedHtml } from '../src/lib/safeHtml';

describe('safeHtml', () => {
  it('accepts plain svg markup', () => {
    expect(isSafeStaticSvg('<svg xmlns="http://www.w3.org/2000/svg"><circle r="2"/></svg>')).toBe(true);
  });

  it('rejects scripted or oversized markup', () => {
    expect(isSafeStaticSvg('<svg><script>alert(1)</script></svg>')).toBe(false);
    expect(isSafeStaticSvg('<svg onclick="x()"></svg>')).toBe(false);
    expect(isSafeStaticSvg('<div>not svg</div>')).toBe(false);
    expect(isSafeStaticSvg('')).toBe(false);
    expect(isSafeStaticSvg(`<svg>${'a'.repeat(60_000)}</svg>`)).toBe(false);
  });

  it('strips script tags and handlers from highlighted html', () => {
    const dirty = '<span class="hljs-string">x</span><script>evil()</script><span onclick="x()">y</span>';
    const clean = sanitizeHighlightedHtml(dirty);
    expect(clean).not.toMatch(/script/i);
    expect(clean).not.toMatch(/onclick/i);
    expect(clean).toMatch(/hljs-string/);
  });
});
