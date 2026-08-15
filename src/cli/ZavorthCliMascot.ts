import { paintCliTone } from './ZavorthCliVisualTheme.js';

export const ZAVORTH_CLI_BRAND_NAME = 'Zavorth';

export const ZAVORTH_CLI_FOX_MASCOT = [
  '\u2584\u2584   \u2584\u2584  \u2584\u2584\u2584\u2584  \u2584\u2584   \u2584\u2584 \u2584\u2584\u2584\u2584  \u2584\u2584\u2584\u2584',
  '\u2588\u2580\u2588  \u2588\u2580\u2588 \u2588  \u2588\u2580\u2588 \u2588\u2580\u2588  \u2588\u2580\u2588 \u2588  \u2588\u2580\u2588',
  '     ',
  'Local-first governed agent OS',
] as const;

export const ZAVORTH_CLI_MASCOT_WIDTH = 38;

export function formatZavorthMascotLine(
  _mascotLine: string,
  content: string,
): string {
  return content;
}

export function formatZavorthMascotBlock(contentLines: string[]): string[] {
  return contentLines.map((line, index) =>
    index === 0 ? paintCliTone(line || ZAVORTH_CLI_BRAND_NAME, 'brand') : line);
}
