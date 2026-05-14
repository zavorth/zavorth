import { paintCliTone } from './ZavorthCliVisualTheme.js';

export const ZAVORTH_CLI_BRAND_NAME = 'Zavorth';

export const ZAVORTH_CLI_FOX_MASCOT = [
  'Zavorth',
  '--------',
  'local',
] as const;

export const ZAVORTH_CLI_MASCOT_WIDTH = 0;

export function formatZavorthMascotLine(
  mascotLine: string,
  content: string,
): string {
  void mascotLine;
  return content;
}

export function formatZavorthMascotBlock(contentLines: [string, string, string]): string[] {
  return contentLines.map((line, index) =>
    index === 0 ? paintCliTone(line || ZAVORTH_CLI_BRAND_NAME, 'brand') : line);
}
