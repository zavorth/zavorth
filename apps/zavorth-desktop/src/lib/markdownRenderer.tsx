import { marked, type MarkedOptions } from 'marked';
import hljs from './highlight';
import katex from 'katex';
import { useEffect, useRef, memo } from 'react';
import { sanitizeHighlightedHtml, sanitizeMarkdownHtml } from './safeHtml';
import './markdownStyles.css';

interface MarkdownContentProps {
  content: string;
  className?: string;
}

/**
 * Pre-process raw markdown to convert LaTeX math delimiters into
 * safe placeholders that marked won't mangle, then post-process the
 * rendered HTML to replace those placeholders with KaTeX output.
 */

const BLOCK_MATH_RE = /\$\$([\s\S]+...)\$\$/g;
const INLINE_MATH_RE = /(...<!\$)\$(...!\$)(.+...)(...<!\$)\$(...!\$)/g;

interface MathPlaceholder {
  id: string;
  tex: string;
  displayMode: boolean;
}

function extractMath(raw: string): { cleaned: string; placeholders: MathPlaceholder[] } {
  const placeholders: MathPlaceholder[] = [];
  let idx = 0;

  // Block math first
  let cleaned = raw.replace(BLOCK_MATH_RE, (_match, tex: string) => {
    const id = `__ZVDMATH_BLOCK_${idx++}__`;
    placeholders.push({ id, tex: tex.trim(), displayMode: true });
    return `<div class="zvd-math-placeholder" data-math-id="${id}"></div>`;
  });

  // Inline math — skip anything inside backtick spans
  cleaned = cleaned.replace(INLINE_MATH_RE, (_match, tex: string) => {
    const id = `__ZVDMATH_INLINE_${idx++}__`;
    placeholders.push({ id, tex: tex.trim(), displayMode: false });
    return `<span class="zvd-math-placeholder" data-math-id="${id}"></span>`;
  });

  return { cleaned, placeholders };
}

function renderMathPlaceholders(container: HTMLElement, placeholders: MathPlaceholder[]) {
  for (const ph of placeholders) {
    const el = container.querySelector(`[data-math-id="${ph.id}"]`);
    if (!el) continue;
    try {
      // trust:false prevents KaTeX from emitting \href/\includegraphics with raw URLs
      el.innerHTML = katex.renderToString(ph.tex, {
        displayMode: ph.displayMode,
        throwOnError: false,
        trust: false,
      });
      if (ph.displayMode) {
        el.classList.add('katex-display');
      }
    } catch {
      el.textContent = ph.tex;
    }
  }
}

/**
 * Configure marked with highlight.js integration.
 */
function configureMarked(): MarkedOptions {
  return {
    gfm: true,
    breaks: false,
    async: false,
  };
}

/**
 * Custom renderer to add highlight.js to code blocks and
 * open links in external browser.
 */
function createRenderer() {
  const renderer = new marked.Renderer();

  renderer.code = function ({ text, lang }: { text: string; lang?: string; escaped?: boolean }) {
    const language = lang && hljs.getLanguage(lang) ? lang : undefined;
    let highlighted: string;
    try {
      highlighted = sanitizeHighlightedHtml(
        language
          ? hljs.highlight(text, { language }).value
          : hljs.highlightAuto(text).value,
      );
    } catch {
      highlighted = escapeHtml(text);
    }
    const langLabel = language || 'text';
    return `<div class="zvd-code-block">
      <div class="zvd-code-block__header">
        <span class="zvd-code-block__lang">${langLabel}</span>
        <button class="zvd-code-block__copy" data-copy-code type="button">Copiar</button>
      </div>
      <div class="zvd-code-block__content">
        <pre><code class="hljs${language ? ` language-${language}` : ''}">${highlighted}</code></pre>
      </div>
    </div>`;
  };

  renderer.link = function ({ href, title, text }: { href: string; title?: string | null; text: string }) {
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
    return `<a href="${escapeHtml(href)}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
  };

  renderer.image = function ({ href, title, text }: { href: string; title?: string | null; text: string }) {
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
    return `<img src="${escapeHtml(href)}" alt="${escapeHtml(text)}"${titleAttr} loading="lazy" />`;
  };

  return renderer;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Wire up copy buttons inside the rendered container.
 */
function attachCopyHandlers(container: HTMLElement) {
  const buttons = container.querySelectorAll<HTMLButtonElement>('[data-copy-code]');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const block = btn.closest('.zvd-code-block');
      const code = block?.querySelector('code')?.textContent || '';
      navigator.clipboard.writeText(code).then(() => {
        btn.textContent = '✓ Copied';
        btn.classList.add('zvd-code-block__copy--copied');
        setTimeout(() => {
          btn.textContent = 'Copy';
          btn.classList.remove('zvd-code-block__copy--copied');
        }, 2000);
      });
    });
  });
}

/**
 * Make links open in the external browser (Electron).
 */
function attachLinkHandlers(container: HTMLElement) {
  const links = container.querySelectorAll<HTMLAnchorElement>('a[target="_blank"]');
  links.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const href = link.getAttribute('href');
      if (!href) return;
      const desktop = typeof window !== 'undefined' ? window.zavorthDesktop : undefined;
      if (desktop && typeof (desktop as { openExternal?: (url: string) => void }).openExternal === 'function') {
        (desktop as { openExternal: (url: string) => void }).openExternal(href);
        return;
      }
      window.open(href, '_blank', 'noopener,noreferrer');
    });
  });
}

/**
 * MarkdownContent — renders rich markdown with syntax highlighting,
 * KaTeX math, and interactive code blocks.
 */
export const MarkdownContent = memo(function MarkdownContent({ content, className }: MarkdownContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !content) return;

    const renderer = createRenderer();
    const options = configureMarked();

    // Extract math before marked processes the content
    const { cleaned, placeholders } = extractMath(content);

    // Parse markdown to HTML, then sanitize before any innerHTML assignment
    const rawHtml = marked.parse(cleaned, { ...options, renderer }) as string;
    const html = sanitizeMarkdownHtml(rawHtml);

    containerRef.current.innerHTML = html;

    // Post-process: render KaTeX placeholders
    if (placeholders.length > 0) {
      renderMathPlaceholders(containerRef.current, placeholders);
    }

    // Attach interactive handlers
    attachCopyHandlers(containerRef.current);
    attachLinkHandlers(containerRef.current);
  }, [content]);

  return (
    <div
      ref={containerRef}
      className={`zvd-markdown ${className || ''}`}
    />
  );
});
