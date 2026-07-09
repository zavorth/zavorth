/**
 * Lightweight HTML/SVG guards for desktop renderer content.
 * No DOM dependency — safe to unit-test under vitest node environment.
 */

const SCRIPTISH =
  /<script\b|javascript:|vbscript:|on\w+\s*=|data:text\/html|data:image\/svg\+xml|<iframe\b|<object\b|<embed\b|<foreignObject\b|<link\b|<meta\b|<base\b|<form\b/i;

/** Tags removed entirely (including nested content where possible). */
const DANGEROUS_BLOCK_TAGS =
  /<\s*(script|style|iframe|object|embed|foreignObject|link|meta|base|form|frame|frameset|applet|textarea|input|select)\b[\s\S]*?(?:<\/\1\s*>|\/\s*>)/gi;

/** Residual opening tags for dangerous elements (self-closing / unclosed). */
const DANGEROUS_OPEN_TAGS =
  /<\s*(?:script|style|iframe|object|embed|foreignObject|link|meta|base|form|frame|frameset|applet)\b[^>]*>/gi;

/** Event-handler attributes: quoted, single-quoted, or unquoted. */
const EVENT_HANDLER_ATTR = /\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;

/** style= attributes (expression / url(javascript:) vectors). */
const STYLE_ATTR = /\s+style\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;

/** URL-bearing attributes we inspect. */
const URL_ATTR_RE =
  /\s(href|src|xlink:href|action|formaction|poster|background|cite|form)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;

/**
 * Allowed tags for marked-produced HTML (including desktop chrome: code blocks, math placeholders).
 * Unknown tags are stripped while preserving their text children.
 */
const MARKDOWN_ALLOWED_TAGS = new Set([
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
]);

const MARKDOWN_VOID_TAGS = new Set(['br', 'hr', 'img', 'col']);

function isSafeHref(raw: string): boolean {
  const value = String(raw || '').trim();
  if (!value) return true;
  if (value.startsWith('#')) return true;
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  if (value.startsWith('./') || value.startsWith('../')) return true;
  // Protocol-relative URLs are treated as external http(s)-class; allow only if no scheme abuse.
  if (value.startsWith('//')) return true;
  const lower = value.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('vbscript:') || lower.startsWith('data:')) {
    return false;
  }
  // http(s) and mailto only for absolute schemes
  if (/^[a-z][a-z\d+.-]*:/i.test(value)) {
    return /^(https?:|mailto:)/i.test(value);
  }
  return true;
}

function isSafeSrc(raw: string, { allowDataImage = false } = {}): boolean {
  const value = String(raw || '').trim();
  if (!value) return true;
  const lower = value.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('vbscript:')) return false;
  if (lower.startsWith('data:')) {
    if (!allowDataImage) return false;
    return /^data:image\/(png|jpe?g|gif|webp|avif|bmp|x-icon)[;,]/i.test(value);
  }
  if (value.startsWith('#') || (value.startsWith('/') && !value.startsWith('//')) || value.startsWith('./') || value.startsWith('../')) {
    return true;
  }
  if (value.startsWith('//')) return true;
  if (/^[a-z][a-z\d+.-]*:/i.test(value)) {
    return /^https?:/i.test(value);
  }
  return true;
}

function sanitizeUrlAttribute(attrName: string, rawValue: string): string | null {
  const attr = attrName.toLowerCase();
  if (attr === 'href' || attr === 'cite') {
    return isSafeHref(rawValue) ? rawValue : null;
  }
  if (attr === 'src' || attr === 'poster' || attr === 'background') {
    return isSafeSrc(rawValue, { allowDataImage: attr === 'src' }) ? rawValue : null;
  }
  // xlink:href, action, formaction, form — only safe absolute/relative non-script URLs
  if (attr === 'xlink:href' || attr === 'action' || attr === 'formaction' || attr === 'form') {
    if (isSafeHref(rawValue) && isSafeSrc(rawValue, { allowDataImage: false })) {
      return rawValue;
    }
    return null;
  }
  return null;
}

function stripDangerousConstructs(html: string): string {
  let out = String(html || '');
  // Multi-pass: nested/malformed script-like blocks
  for (let i = 0; i < 3; i += 1) {
    const next = out
      .replace(DANGEROUS_BLOCK_TAGS, '')
      .replace(DANGEROUS_OPEN_TAGS, '')
      .replace(/<\/\s*(?:script|style|iframe|object|embed|foreignObject|form)\s*>/gi, '');
    if (next === out) break;
    out = next;
  }
  out = out.replace(EVENT_HANDLER_ATTR, '');
  out = out.replace(STYLE_ATTR, '');
  out = out.replace(URL_ATTR_RE, (_match, name: string, dq?: string, sq?: string, uq?: string) => {
    const value = dq ?? sq ?? uq ?? '';
    const safe = sanitizeUrlAttribute(name, value);
    if (safe == null) {
      // Drop the attribute entirely rather than leaving a javascript: URL
      return '';
    }
    const quote = dq !== undefined ? '"' : sq !== undefined ? "'" : '"';
    return ` ${name}=${quote}${safe}${quote}`;
  });
  return out;
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
 * Harden SVG markup: strip scripts, handlers, foreignObject, and unsafe URLs.
 * Returns null when the result is not a safe static SVG (caller must not inject HTML).
 */
export function sanitizeSvgMarkup(markup: string | null | undefined): string | null {
  if (!markup || typeof markup !== 'string') return null;
  let cleaned = stripDangerousConstructs(markup);
  // Extra SVG-specific strips (including unquoted handlers that may remain after partial parse issues)
  cleaned = cleaned
    .replace(/<\s*script\b[\s\S]*?<\/\s*script\s*>/gi, '')
    .replace(/<\s*foreignObject\b[\s\S]*?<\/\s*foreignObject\s*>/gi, '')
    .replace(/<\s*foreignObject\b[^>]*>/gi, '')
    .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s+(?:xlink:)?href\s*=\s*(["'])\s*(?:javascript|vbscript|data)\s*:[\s\S]*?\1/gi, '')
    .replace(/\s+(?:xlink:)?href\s*=\s*(?:javascript|vbscript|data)\s*:[^\s>]*/gi, '');

  const trimmed = cleaned.trim();
  if (!isSafeStaticSvg(trimmed)) return null;
  return trimmed;
}

/** Strip script-like patterns from highlight.js output (defense in depth). */
export function sanitizeHighlightedHtml(html: string): string {
  if (!html) return '';
  return stripDangerousConstructs(html)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
}

/**
 * Sanitize HTML produced by marked (and similar) before innerHTML assignment.
 * Removes dangerous tags/attrs, blocks javascript:/unsafe data: URLs, strips style= and on*.
 * Non-allowlisted tags are unwrapped (children kept) so content is not lost silently.
 */
export function sanitizeMarkdownHtml(html: string): string {
  if (!html) return '';
  let out = stripDangerousConstructs(html);

  // Unwrap or drop tags outside the markdown allowlist
  out = out.replace(/<\/?([a-zA-Z][\w:-]*)\b[^>]*>/g, (match, rawName: string) => {
    const name = rawName.toLowerCase();
    const isClose = match.startsWith('</');
    if (!MARKDOWN_ALLOWED_TAGS.has(name)) {
      return '';
    }
    if (isClose) {
      if (MARKDOWN_VOID_TAGS.has(name)) return '';
      return `</${name}>`;
    }

    // Rebuild opening tag with only safe attributes
    const attrSource = match.slice(1 + rawName.length, match.endsWith('/>') ? -2 : -1);
    const safeAttrs: string[] = [];
    const attrRe =
      /([:@a-zA-Z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))|([:@a-zA-Z_:][\w:.-]*)/g;
    let m: RegExpExecArray | null;
    while ((m = attrRe.exec(attrSource)) !== null) {
      const attrName = (m[1] || m[5] || '').toLowerCase();
      if (!attrName) continue;
      if (attrName.startsWith('on')) continue;
      if (attrName === 'style') continue;
      if (attrName === 'srcdoc') continue;
      if (attrName.includes('href') || attrName === 'src' || attrName === 'action' || attrName === 'formaction' || attrName === 'poster' || attrName === 'background' || attrName === 'cite') {
        const value = m[2] ?? m[3] ?? m[4] ?? '';
        const safe = sanitizeUrlAttribute(attrName, value);
        if (safe == null) continue;
        safeAttrs.push(`${attrName}="${escapeAttr(safe)}"`);
        continue;
      }
      // Boolean / safe data-* / class / id / type / aria-* / role / target / rel / alt / title / loading / colspan / rowspan / data-copy-code / data-math-id
      if (
        attrName === 'class' ||
        attrName === 'id' ||
        attrName === 'type' ||
        attrName === 'target' ||
        attrName === 'rel' ||
        attrName === 'alt' ||
        attrName === 'title' ||
        attrName === 'loading' ||
        attrName === 'colspan' ||
        attrName === 'rowspan' ||
        attrName === 'scope' ||
        attrName === 'role' ||
        attrName === 'disabled' ||
        attrName.startsWith('aria-') ||
        attrName.startsWith('data-')
      ) {
        if (m[5] && !m[1]) {
          // bare attribute
          safeAttrs.push(attrName);
        } else {
          const value = m[2] ?? m[3] ?? m[4] ?? '';
          // Harden target/rel on anchors
          if (attrName === 'target') {
            safeAttrs.push('target="_blank"');
            continue;
          }
          if (attrName === 'rel') {
            safeAttrs.push('rel="noopener noreferrer"');
            continue;
          }
          safeAttrs.push(`${attrName}="${escapeAttr(value)}"`);
        }
      }
    }

    // Anchors always get safe link hardening when target present
    if (name === 'a' && !safeAttrs.some((a) => a.startsWith('rel='))) {
      // leave as-is; renderer already sets rel when target blank
    }

    const selfClose = MARKDOWN_VOID_TAGS.has(name) || match.endsWith('/>');
    const attrStr = safeAttrs.length ? ` ${safeAttrs.join(' ')}` : '';
    return selfClose ? `<${name}${attrStr} />` : `<${name}${attrStr}>`;
  });

  // Final pass: residual event handlers / scripts
  out = stripDangerousConstructs(out);
  return out;
}

function escapeAttr(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
