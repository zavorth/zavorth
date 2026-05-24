import color from 'picocolors';
import {
  isCliColorEnabled,
  stripCliAnsi,
  type CliVisualTone,
} from '../ZavorthCliVisualTheme.js';

export type ZavorthPremiumCliAccent =
  | 'neural'
  | 'cyan'
  | 'violet'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'muted'
  | 'plain';

export type ZavorthPremiumCliStatus =
  | 'ready'
  | 'running'
  | 'waiting'
  | 'warning'
  | 'blocked'
  | 'offline'
  | 'unknown';

export type ZavorthPremiumCliTheme = {
  brand: string;
  tagline: string;
  subtagline: string;
  maxWidth: number;
  minWidth: number;
  colorEnabled: boolean;
  symbols: {
    pass: string;
    warn: string;
    fail: string;
    wait: string;
    arrow: string;
    bullet: string;
    rail: string;
  };
};

const DEFAULT_MAX_WIDTH = 82;
const DEFAULT_MIN_WIDTH = 44;
const ZAVORTH_ORANGE = '\u001b[38;2;255;111;31m';
const ZAVORTH_ORANGE_SOFT = '\u001b[38;2;255;149;79m';
const ANSI_RESET = '\u001b[0m';

export function createZavorthPremiumCliTheme(input: {
  colorEnabled?: boolean;
  columns?: number | null;
} = {}): ZavorthPremiumCliTheme {
  const columns = Math.max(
    DEFAULT_MIN_WIDTH,
    Math.min(input.columns || process.stdout?.columns || DEFAULT_MAX_WIDTH, 110),
  );
  return {
    brand: 'ZAVORTH',
    tagline: 'Natural language in. Governed action out.',
    subtagline: 'Local-first agent OS with receipts, approvals and native integrations.',
    maxWidth: Math.max(DEFAULT_MIN_WIDTH, Math.min(columns, DEFAULT_MAX_WIDTH)),
    minWidth: DEFAULT_MIN_WIDTH,
    colorEnabled: input.colorEnabled ?? isCliColorEnabled(),
    symbols: {
      pass: '●',
      warn: '▲',
      fail: '×',
      wait: '◆',
      arrow: '›',
      bullet: '–',
      rail: '│',
    },
  };
}

export function paintPremiumAccent(
  value: string,
  accent: ZavorthPremiumCliAccent = 'plain',
  theme = createZavorthPremiumCliTheme(),
): string {
  if (!theme.colorEnabled) {
    return value;
  }
  switch (accent) {
    case 'neural':
      return color.bold(`${ZAVORTH_ORANGE}${value}${ANSI_RESET}`);
    case 'cyan':
      return color.cyan(value);
    case 'violet':
      return color.magenta(value);
    case 'emerald':
      return color.green(value);
    case 'amber':
      return `${ZAVORTH_ORANGE_SOFT}${value}${ANSI_RESET}`;
    case 'rose':
      return color.red(value);
    case 'muted':
      return color.dim(value);
    default:
      return value;
  }
}

export function accentForStatus(status: ZavorthPremiumCliStatus): ZavorthPremiumCliAccent {
  switch (status) {
    case 'ready':
      return 'emerald';
    case 'running':
      return 'cyan';
    case 'waiting':
      return 'amber';
    case 'warning':
      return 'amber';
    case 'blocked':
      return 'rose';
    case 'offline':
      return 'muted';
    default:
      return 'muted';
  }
}

export function toneForPremiumAccent(accent: ZavorthPremiumCliAccent): CliVisualTone {
  switch (accent) {
    case 'neural':
    case 'cyan':
    case 'violet':
      return 'info';
    case 'emerald':
      return 'success';
    case 'amber':
      return 'warning';
    case 'rose':
      return 'danger';
    case 'muted':
      return 'muted';
    default:
      return 'neutral';
  }
}

export function visiblePremiumWidth(value: string): number {
  return stripCliAnsi(value).length;
}

export function padPremiumText(value: string, width: number): string {
  const text = String(value || '');
  return `${text}${' '.repeat(Math.max(0, width - visiblePremiumWidth(text)))}`;
}

export function truncatePremiumText(value: string, width: number): string {
  const text = String(value || '');
  if (visiblePremiumWidth(text) <= width) {
    return text;
  }
  const plain = stripCliAnsi(text);
  if (width <= 1) {
    return plain.slice(0, Math.max(0, width));
  }
  return `${plain.slice(0, Math.max(0, width - 1))}...`.slice(0, width);
}

export function statusSymbol(
  status: ZavorthPremiumCliStatus,
  theme = createZavorthPremiumCliTheme(),
): string {
  const symbol = status === 'ready'
    ? theme.symbols.pass
    : status === 'blocked' || status === 'offline'
      ? theme.symbols.fail
      : status === 'warning'
        ? theme.symbols.warn
        : theme.symbols.wait;
  return paintPremiumAccent(symbol, accentForStatus(status), theme);
}
