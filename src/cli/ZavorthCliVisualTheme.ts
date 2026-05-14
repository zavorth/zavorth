import color from 'picocolors';

export type CliVisualTone =
  | 'brand'
  | 'neutral'
  | 'muted'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger';

const ANSI_PATTERN = /\u001B\[[0-9;]*m/g;

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
      return color.bold(color.green(value));
    case 'muted':
      return color.dim(value);
    case 'info':
      return color.cyan(value);
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
