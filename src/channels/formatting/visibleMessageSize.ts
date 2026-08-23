/**
 * Approximates the visible size of a rendered markdown message, used as a
 * secondary safety re-check while chunking: some transports enforce their
 * character budget against what the client RENDERS rather than the raw wire
 * format. The estimator is intentionally an upper bound of the rendered
 * length:
 *
 * - fenced code blocks contribute their body plus the two fence lines;
 * - inline links `[text](url)` and images contribute BOTH the label and the
 *   target URL (several clients surface the target alongside the label);
 * - bare/autolink URLs contribute the URL itself;
 * - emphasis, inline-code, heading, blockquote and list markers contribute
 *   only their payload characters (markers disappear when rendered);
 * - table rows contribute their cell payloads plus two spaces of padding
 *   per column boundary; column-separator rows count as padding only;
 * - residual HTML tags are stripped.
 */
export function estimateVisibleMessageSize(text: string): number {
  const normalized = String(text ?? '').replace(/\r\n/g, '\n');
  let visible = '';
  let inFence = false;

  for (const line of normalized.split('\n')) {
    const fenceMatch = /^\s{0,3}(```|~~~)/.exec(line);
    if (fenceMatch) {
      inFence = !inFence;
      visible += `${fenceMatch[1]}\n`;
      continue;
    }
    if (inFence) {
      visible += `${line}\n`;
      continue;
    }

    let renderedLine = line;
    // Images and links: label + target both count as visible payload.
    renderedLine = renderedLine.replace(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g, '$1$2');
    renderedLine = renderedLine.replace(/\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g, '$1$2');
    // Autolinks keep the URL.
    renderedLine = renderedLine.replace(/<((?:https?|ftp|mailto):[^>]+)>/g, '$1');
    // Emphasis / inline code / strikethrough markers vanish when rendered.
    renderedLine = renderedLine.replace(/(\*\*|__|\*|_|~~|`)/g, '');
    // Heading, blockquote and list markers vanish; payloads remain.
    renderedLine = renderedLine.replace(/^\s{0,3}(#{1,6}|>|[-*+])\s+/g, '');
    // Table pipes render as cell padding.
    if (renderedLine.includes('|')) {
      if (/^\s*\|?\s*:?-{2,}.*\|\s*$/.test(renderedLine)) {
        renderedLine = renderedLine.replace(/[^\s|]/g, '').replace(/\|/g, ' ');
      } else {
        renderedLine = renderedLine.replace(/\|/g, '  ');
      }
    }
    // Residual HTML tags do not render as text.
    renderedLine = renderedLine.replace(/<[^<>\s]+[^<>]*>/g, '');

    visible += `${renderedLine}\n`;
  }

  return visible.replace(/\n$/, '').length;
}
