/**
 * Lightweight guards for trusted static markup (identity SVGs, highlighted code).
 */

const SCRIPTISH =
  /<script\b|javascript:|on\w+\s*=|data:text\/html|<iframe\b|<object\b|<embed\b|<foreignObject\b/i;

/** Returns true when markup looks like a static SVG without script handlers. */
export function isSafeStaticSvg(markup: string | null | undefined): boolean {
  if (!markup || typeof markup !== 'string') return false;
  const trimmed = markup.trim();
  if (!trimmed.startsWith('<svg') && !trimmed.startsWith('<?xml')) return false;
  if (SCRIPTISH.test(trimmed)) return false;
  if (trimmed.length > 50_000) return false;
  return true;
}

/** Strip script-like patterns from highlight.js output (defense in depth). */
export function sanitizeHighlightedHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
}
