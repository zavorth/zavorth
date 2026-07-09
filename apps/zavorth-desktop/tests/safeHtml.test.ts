import { describe, expect, it } from 'vitest';
import {
  isSafeStaticSvg,
  sanitizeHighlightedHtml,
  sanitizeMarkdownHtml,
  sanitizeSvgMarkup,
} from '../src/lib/safeHtml';

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
    expect(isSafeStaticSvg('<svg><foreignObject><div/></foreignObject></svg>')).toBe(false);
    expect(isSafeStaticSvg('<svg><a href="javascript:alert(1)">x</a></svg>')).toBe(false);
  });

  it('strips script tags and handlers from highlighted html', () => {
    const dirty = '<span class="hljs-string">x</span><script>evil()</script><span onclick="x()">y</span>';
    const clean = sanitizeHighlightedHtml(dirty);
    expect(clean).not.toMatch(/script/i);
    expect(clean).not.toMatch(/onclick/i);
    expect(clean).toMatch(/hljs-string/);
  });

  describe('sanitizeMarkdownHtml', () => {
    it('strips script, event handlers, and style attributes', () => {
      const dirty =
        '<p style="color:red" onclick="alert(1)">Hi<script>evil()</script></p><img src=x onerror=alert(1)>';
      const clean = sanitizeMarkdownHtml(dirty);
      expect(clean).not.toMatch(/script/i);
      expect(clean).not.toMatch(/onclick/i);
      expect(clean).not.toMatch(/onerror/i);
      expect(clean).not.toMatch(/style=/i);
      expect(clean).toMatch(/Hi/);
    });

    it('blocks javascript: and unsafe data: URLs', () => {
      const dirty =
        '<a href="javascript:alert(1)">x</a><a href="https://ok.example">y</a><img src="data:text/html,xss">';
      const clean = sanitizeMarkdownHtml(dirty);
      expect(clean).not.toMatch(/javascript:/i);
      expect(clean).toMatch(/https:\/\/ok\.example/);
      expect(clean).not.toMatch(/data:text\/html/i);
    });

    it('unwraps non-allowlisted tags but keeps text', () => {
      const dirty = '<custom-widget>hello</custom-widget><p>world</p>';
      const clean = sanitizeMarkdownHtml(dirty);
      expect(clean).not.toMatch(/custom-widget/i);
      expect(clean).toMatch(/hello/);
      expect(clean).toMatch(/<p>/);
      expect(clean).toMatch(/world/);
    });

    it('preserves code-block chrome used by markdown renderer', () => {
      const html = `<div class="zvd-code-block">
        <button class="zvd-code-block__copy" data-copy-code type="button">Copiar</button>
        <pre><code class="hljs language-js"><span class="hljs-keyword">const</span></code></pre>
      </div>`;
      const clean = sanitizeMarkdownHtml(html);
      expect(clean).toMatch(/zvd-code-block/);
      expect(clean).toMatch(/data-copy-code/);
      expect(clean).toMatch(/hljs-keyword/);
    });

    it('strips iframe and object embeds', () => {
      const dirty = '<p>a</p><iframe src="https://evil"></iframe><object data="x"></object>';
      const clean = sanitizeMarkdownHtml(dirty);
      expect(clean).not.toMatch(/iframe/i);
      expect(clean).not.toMatch(/object/i);
      expect(clean).toMatch(/>a</);
    });
  });

  describe('sanitizeSvgMarkup', () => {
    it('returns safe static svg', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="2" cx="1" cy="1"/></svg>';
      expect(sanitizeSvgMarkup(svg)).toBe(svg.trim());
    });

    it('strips script and handlers then rejects residual risk or returns cleaned', () => {
      const dirty =
        '<svg xmlns="http://www.w3.org/2000/svg" onclick="alert(1)"><script>evil()</script><circle r="1"/></svg>';
      const cleaned = sanitizeSvgMarkup(dirty);
      // After strip, should either be null (gate fails) or free of script/handlers
      if (cleaned) {
        expect(cleaned).not.toMatch(/script/i);
        expect(cleaned).not.toMatch(/onclick/i);
        expect(isSafeStaticSvg(cleaned)).toBe(true);
      } else {
        expect(cleaned).toBeNull();
      }
    });

    it('strips javascript href and foreignObject so residual svg is safe or null', () => {
      const withJs = sanitizeSvgMarkup(
        '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><text>x</text></a></svg>',
      );
      if (withJs) {
        expect(withJs).not.toMatch(/javascript:/i);
        expect(isSafeStaticSvg(withJs)).toBe(true);
      }

      const withFo = sanitizeSvgMarkup(
        '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject width="100" height="100"><body xmlns="http://www.w3.org/1999/xhtml"><script>x</script></body></foreignObject><circle r="1"/></svg>',
      );
      if (withFo) {
        expect(withFo).not.toMatch(/foreignObject/i);
        expect(withFo).not.toMatch(/script/i);
        expect(isSafeStaticSvg(withFo)).toBe(true);
      } else {
        // Gate may reject residual risk entirely — also acceptable
        expect(withFo).toBeNull();
      }
    });

    it('rejects non-svg roots', () => {
      expect(sanitizeSvgMarkup('<div>nope</div>')).toBeNull();
      expect(sanitizeSvgMarkup('')).toBeNull();
      expect(sanitizeSvgMarkup(null)).toBeNull();
    });

    it('strips unquoted event handlers', () => {
      const dirty = '<svg xmlns="http://www.w3.org/2000/svg" onload=alert(1)><circle r="1"/></svg>';
      const cleaned = sanitizeSvgMarkup(dirty);
      if (cleaned) {
        expect(cleaned).not.toMatch(/onload/i);
        expect(isSafeStaticSvg(cleaned)).toBe(true);
      }
    });
  });
});
