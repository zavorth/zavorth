import color from 'picocolors';

export type CliVisualTone =
  | 'brand'
  | 'accent'
  | 'neutral'
  | 'muted'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger';

  // eslint-disable-next-line no-control-regex
const ANSI_PATTERN = /\u001B\[[0-9;]*m/g;

/** Product brand green `#00e88f` (website / desktop). */
export const CLI_BRAND_RGB = { r: 0, g: 232, b: 143 } as const;
/** Brighter brand green for bold emphasis. */
export const CLI_BRAND_BRIGHT_RGB = { r: 52, g: 255, b: 180 } as const;
/** Info cyan `#06B6D4` for non-brand informational tone. */
export const CLI_INFO_RGB = { r: 6, g: 182, b: 212 } as const;

// Brand green (product)
const ZAVORTH_BRAND = `\u001b[38;2;${CLI_BRAND_RGB.r};${CLI_BRAND_RGB.g};${CLI_BRAND_RGB.b}m`;
const ZAVORTH_BRAND_BRIGHT = `\u001b[38;2;${CLI_BRAND_BRIGHT_RGB.r};${CLI_BRAND_BRIGHT_RGB.g};${CLI_BRAND_BRIGHT_RGB.b}m`;
// Optional info cyan for non-brand info tone
const ZAVORTH_INFO = `\u001b[38;2;${CLI_INFO_RGB.r};${CLI_INFO_RGB.g};${CLI_INFO_RGB.b}m`;
const ANSI_RESET = '\u001b[0m';

export function isCliColorEnabled(): boolean {
  if (String(process.env.NO_COLOR || '').trim()) {
    return false;
  }

  if (String(process.env.FORCE_COLOR || '').trim()) {
    return true;
  }

  return Boolean(process.stdout?.isTTY);
}

export function stripCliAnsi(value: string): string {
  return String(value || '').replace(ANSI_PATTERN, '');
}

export function padCliVisualText(value: string, width: number): string {
  const text = String(value || '');
  const visibleWidth = stripCliAnsi(text).length;
  return `${text}${' '.repeat(Math.max(0, width - visibleWidth))}`;
}

export function paintCliTone(value: string, tone: CliVisualTone = 'neutral'): string {
  if (!isCliColorEnabled()) {
    return value;
  }

  switch (tone) {
    case 'brand':
      return color.bold(`${ZAVORTH_BRAND_BRIGHT}${value}${ANSI_RESET}`);
    case 'accent':
      return color.bold(`${ZAVORTH_BRAND}${value}${ANSI_RESET}`);
    case 'muted':
      return color.dim(value);
    case 'info':
      return `${ZAVORTH_INFO}${value}${ANSI_RESET}`;
    case 'success':
      return color.green(value);
    case 'warning':
      return color.yellow(value);
    case 'danger':
      return color.red(value);
    default:
      return value;
  }
}

export function paintCliBadge(label: string, tone: CliVisualTone = 'brand'): string {
  const normalized = String(label || '').trim().toUpperCase();
  const badge = `[ ${normalized} ]`;
  return isCliColorEnabled() ? paintCliTone(badge, tone) : badge;
}

export function paintCliDivider(width = 20, tone: CliVisualTone = 'muted'): string {
  return paintCliTone('-'.repeat(Math.max(6, width)), tone);
}

export function renderCliWordmark(label = 'ZAVORTH'): string {
  const normalized = String(label || '').trim().toUpperCase() || 'ZAVORTH';
  const plain = [
    normalized,
    '-'.repeat(Math.max(normalized.length, 12)),
  ].join('\n');
  return isCliColorEnabled() ? [
    paintCliTone(normalized, 'brand'),
    paintCliDivider(Math.max(normalized.length, 12), 'brand'),
  ].join('\n') : plain;
}

/** Lightweight one-line status strip for bare Trust Loop / risk-budget commands. */
export function renderCliWordmarkStrip(label = 'ZAVORTH'): string {
  const normalized = String(label || '').trim().toUpperCase() || 'ZAVORTH';
  if (!isCliColorEnabled()) {
    return `◇ ${normalized} ◇`;
  }
  return `${paintCliTone('◇', 'brand')} ${paintCliTone(normalized, 'brand')} ${paintCliTone('◇', 'brand')}`;
}

export const ANSI_COLORS = {
  /** Product brand green `#00e88f`. */
  BRAND: ZAVORTH_BRAND,
  BRAND_BRIGHT: ZAVORTH_BRAND_BRIGHT,
  INFO: ZAVORTH_INFO,
  /** @deprecated Use BRAND — kept for callers that still import CYAN aliases. */
  CYAN: ZAVORTH_BRAND,
  /** @deprecated Orange brand retired; maps to product brand green. */
  ORANGE: ZAVORTH_BRAND,
  /** @deprecated Orange brand retired; maps to product brand bright green. */
  ORANGE_BRIGHT: ZAVORTH_BRAND_BRIGHT,
  /** @deprecated Use BRAND_BRIGHT. */
  CYAN_BRIGHT: ZAVORTH_BRAND_BRIGHT,
  RESET: ANSI_RESET,
} as const;
