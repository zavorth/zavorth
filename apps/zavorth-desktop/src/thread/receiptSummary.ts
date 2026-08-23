/**
 * Split renderer-produced execution receipts into a plain-language summary and
 * collapsible technical lines. Conservative by design: only content matching
 * the ZavorthUserResponseRendererService footer contract is treated as a
 * receipt, so ordinary assistant prose is never mangled.
 */

export type ReceiptSummary = {
  summary: string;
  technicalLines: string[];
};

const TECHNICAL_LINE_PREFIX = /^- (approval|run|replay):/;

/** True when the line list matches the receipt footer contract. */
export function isReceiptFooter(lines: string[]): boolean {
  return lines.some((line) => TECHNICAL_LINE_PREFIX.test(line.trim()));
}

/**
 * Parse message content into summary + technical lines. Returns null when the
 * content does not carry a receipt footer (summary-only replies stay null so
 * callers render them unchanged).
 */
export function parseReceiptSummary(content: string | null | undefined): ReceiptSummary | null {
  if (typeof content !== 'string' || !content.trim()) return null;
  const normalized = content.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');

  let footerStart = -1;
  for (let i = lines.length - 1; i >= 1; i -= 1) {
    const candidate = lines[i];
    if (!TECHNICAL_LINE_PREFIX.test(candidate.trim())) continue;
    // Walk back over contiguous technical lines to find the block start.
    let start = i;
    while (start - 1 >= 0 && TECHNICAL_LINE_PREFIX.test(lines[start - 1].trim())) {
      start -= 1;
    }
    footerStart = start;
    break;
  }
  if (footerStart === -1) return null;

  const technicalLines = lines
    .slice(footerStart)
    .filter((line) => TECHNICAL_LINE_PREFIX.test(line.trim()))
    .map((line) => line.trim());

  // Drop the renderer signature line directly above the technical block.
  let summaryEnd = footerStart;
  while (summaryEnd > 0 && lines[summaryEnd - 1].trim() === '') summaryEnd -= 1;
  if (summaryEnd > 0 && lines[summaryEnd - 1].trim() === 'Zavorth') summaryEnd -= 1;

  const summary = lines
    .slice(0, summaryEnd)
    .join('\n')
    .replace(/\n+$/, '');
  if (!summary.trim()) return null;

  return { summary, technicalLines };
}
