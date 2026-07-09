/**
 * Parser-based HTML/SVG sanitization for desktop renderer content.
 * Uses isomorphic-dompurify (DOMPurify + jsdom under Node) so unit tests and
 * the Electron renderer share the same security model.
 */
import DOMPurify from 'isomorphic-dompurify';

/** Pre-gate regex for isSafeStaticSvg (cheap reject before parse). */
const SCRIPTISH =
  /<script\b|javascript:|vbscript:|on\w+\s*=|data:text\/html|data:image\/svg\+xml|<iframe\b|<object\b|<embed\b|<foreignObject\b|<link\b|<meta\b|<base\b|<form\b/i;

/**
 * http(s)/mailto absolute schemes, plus relative URLs (#anchors, /paths, ./ ../).
 * Blocks javascript:, data:, vbscript:, and other schemes.
 */
const SAFE_URI_REGEXP =
  /^(?:(?:https?|mailto):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i;

const MARKDOWN_ALLOWED_TAGS = [
  'a',
  'abbr',
  'b',
  'blockquote',
  'br',
  'button',
  'code',
  'col',
  'colgroup',
  'del',
  'div',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'i',
  'img',
  'li',
  'ol',
  'p',
  'pre',
  's',
  'span',
  'strong',
  'sub',
  'sup',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'ul',
] as const;

const MARKDOWN_ALLOWED_ATTR = [
  'href',
  'src',
  'alt',
  'title',
  'class',
  'id',
  'colspan',
  'rowspan',
  'scope',
  'target',
  'rel',
  'type',
  'disabled',
  'loading',
  'role',
] as const;

const FORBID_TAGS = [
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'form',
  'input',
  'textarea',
  'select',
  'option',
  'button', // re-allowed only via ALLOWED_TAGS for markdown; forbid in highlight/svg paths
  'link',
  'meta',
  'base',
  'frame',
  'frameset',
  'applet',
  'template',
  'noscript',
] as const;

const HIGHLIGHT_ALLOWED_TAGS = ['span', 'code', 'pre', 'b', 'i', 'em', 'strong', 'br'] as const;
const HIGHLIGHT_ALLOWED_ATTR = ['class'] as const;

const URI_ATTRS = ['href', 'src', 'xlink:href', 'cite', 'poster', 'action', 'formaction', 'background'] as const;

/** True when a URI uses only http(s)/mailto or is path/hash-relative. */
function isAllowedUri(raw: string): boolean {
  const value = String(raw || '').trim();
  if (!value) return true;
  // DOMPurify allows any data: on <img> by default; we reject data:/script schemes entirely.
  if (/^(?:data|javascript|vbscript|mhtml)\s*:/i.test(value)) return false;
  return SAFE_URI_REGEXP.test(value);
}

let hooksInstalled = false;

function ensureHooks(): void {
  if (hooksInstalled) return;
  hooksInstalled = true;

  // Duck-type Element (jsdom Element may not match the global Element constructor under Node).
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    const el = node as {
      tagName?: string;
      hasAttribute?: (name: string) => boolean;
      getAttribute?: (name: string) => string | null;
      setAttribute?: (name: string, value: string) => void;
      removeAttribute?: (name: string) => void;
    };
    if (
      typeof el.tagName !== 'string' ||
      typeof el.hasAttribute !== 'function' ||
      typeof el.getAttribute !== 'function' ||
      typeof el.setAttribute !== 'function' ||
      typeof el.removeAttribute !== 'function'
    ) {
      return;
    }

    for (const attr of URI_ATTRS) {
      if (!el.hasAttribute(attr)) continue;
      const val = el.getAttribute(attr) ?? '';
      if (!isAllowedUri(val)) {
        el.removeAttribute(attr);
      }
    }

    // Harden external links: force target=_blank + rel=noopener noreferrer when target is present.
    if (el.tagName === 'A' && el.hasAttribute('target')) {
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
    }
  });
}

function markdownConfig(): Parameters<typeof DOMPurify.sanitize>[1] {
  return {
    ALLOWED_TAGS: [...MARKDOWN_ALLOWED_TAGS],
    ALLOWED_ATTR: [...MARKDOWN_ALLOWED_ATTR],
    ALLOW_DATA_ATTR: true,
    ALLOW_ARIA_ATTR: true,
    ALLOWED_URI_REGEXP: SAFE_URI_REGEXP,
    FORBID_TAGS: [
      'script',
      'style',
      'iframe',
      'object',
      'embed',
      'form',
      'input',
      'textarea',
      'select',
      'option',
      'link',
      'meta',
      'base',
      'frame',
      'frameset',
      'applet',
      'template',
      'noscript',
    ],
    FORBID_ATTR: ['style', 'srcdoc'],
    KEEP_CONTENT: true,
    // Prefer removing whole dangerous nodes over leaking attributes.
    FORCE_BODY: false,
  };
}

function highlightConfig(): Parameters<typeof DOMPurify.sanitize>[1] {
  return {
    ALLOWED_TAGS: [...HIGHLIGHT_ALLOWED_TAGS],
    ALLOWED_ATTR: [...HIGHLIGHT_ALLOWED_ATTR],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    FORBID_TAGS: [...FORBID_TAGS, 'a', 'img', 'svg'],
    FORBID_ATTR: ['style', 'href', 'src', 'srcdoc'],
    KEEP_CONTENT: true,
  };
}

function svgConfig(): Parameters<typeof DOMPurify.sanitize>[1] {
  return {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: [
      'script',
      'style',
      'foreignObject',
      'foreignobject',
      'iframe',
      'object',
      'embed',
      'form',
      'input',
      'textarea',
      'a', // anchors in SVG can carry javascript:; strip for static diagrams
    ],
    FORBID_ATTR: ['style'],
    ALLOWED_URI_REGEXP: SAFE_URI_REGEXP,
    KEEP_CONTENT: false,
  };
}

/**
 * Returns true when markup looks like a static SVG without script handlers.
 * Used as a gate before any SVG innerHTML assignment.
 */
export function isSafeStaticSvg(markup: string | null | undefined): boolean {
  if (!markup || typeof markup !== 'string') return false;
  const trimmed = markup.trim();
  if (!trimmed.startsWith('<svg') && !trimmed.startsWith('<?xml')) return false;
  if (SCRIPTISH.test(trimmed)) return false;
  if (trimmed.length > 50_000) return false;
  return true;
}

/**
 * Harden SVG markup with DOMPurify SVG profile.
 * Returns null when the result is not a safe static SVG (caller must not inject HTML).
 */
export function sanitizeSvgMarkup(markup: string | null | undefined): string | null {
  if (!markup || typeof markup !== 'string') return null;
  ensureHooks();

  // Cheap pre-reject for obvious non-SVG roots (avoids DOMPurify wrapping surprises).
  const pre = markup.trim();
  if (!pre.startsWith('<svg') && !pre.startsWith('<?xml')) return null;

  let cleaned = String(DOMPurify.sanitize(markup, svgConfig()));
  cleaned = cleaned.trim();

  // DOMPurify may normalize casing / attributes; re-check static gate.
  if (!isSafeStaticSvg(cleaned)) return null;
  return cleaned;
}

/** Strip script-like patterns from highlight.js output (defense in depth). */
export function sanitizeHighlightedHtml(html: string): string {
  if (!html) return '';
  ensureHooks();
  return String(DOMPurify.sanitize(html, highlightConfig()));
}

/**
 * Sanitize HTML produced by marked (and similar) before innerHTML assignment.
 * Parser-based: dangerous tags/attrs removed, javascript:/unsafe URIs blocked.
 * Non-allowlisted tags are unwrapped (KEEP_CONTENT) so text is not lost.
 */
export function sanitizeMarkdownHtml(html: string): string {
  if (!html) return '';
  ensureHooks();
  return String(DOMPurify.sanitize(html, markdownConfig()));
}
