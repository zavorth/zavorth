import {
  createZavorthPremiumCliTheme,
  padPremiumText,
  paintPremiumAccent,
  statusSymbol,
  truncatePremiumText,
  visiblePremiumWidth,
  type ZavorthPremiumCliAccent,
  type ZavorthPremiumCliStatus,
  type ZavorthPremiumCliTheme,
} from './ZavorthPremiumCliTheme.js';

export type ZavorthPremiumCliPanel = {
  title: string;
  lines?: string[];
  accent?: ZavorthPremiumCliAccent;
  width?: number;
  dense?: boolean;
};

export type ZavorthPremiumCliStatusRow = {
  label: string;
  value: string;
  status?: ZavorthPremiumCliStatus;
  detail?: string | null;
};

export type ZavorthPremiumCliAction = {
  label: string;
  command?: string | null;
  detail?: string | null;
  accent?: ZavorthPremiumCliAccent;
};

export function renderPremiumPanel(
  panel: ZavorthPremiumCliPanel,
  theme: ZavorthPremiumCliTheme = createZavorthPremiumCliTheme(),
): string {
  const width = Math.max(theme.minWidth, Math.min(panel.width || theme.maxWidth, theme.maxWidth));
  const innerWidth = width - 4;
  const title = ` ${String(panel.title || 'Zavorth').trim()} `;
  const accent = panel.accent || 'neural';
  const top = `${paintPremiumAccent('+', accent, theme)}${paintPremiumAccent('=', accent, theme).repeat(Math.max(2, width - 2))}${paintPremiumAccent('+', accent, theme)}`;
  const titleLine = `${paintPremiumAccent('|', accent, theme)} ${padPremiumText(paintPremiumAccent(title, accent, theme), innerWidth)} ${paintPremiumAccent('|', accent, theme)}`;
  const separator = `${paintPremiumAccent('|', accent, theme)} ${paintPremiumAccent('-'.repeat(innerWidth), 'muted', theme)} ${paintPremiumAccent('|', accent, theme)}`;
  const body = normalizePanelLines(panel.lines || [''])
    .flatMap((line) => wrapPremiumLine(line, innerWidth))
    .map((line) => `${paintPremiumAccent('|', accent, theme)} ${padPremiumText(line, innerWidth)} ${paintPremiumAccent('|', accent, theme)}`);
  const bottom = top;
  const blank = `${paintPremiumAccent('|', accent, theme)} ${padPremiumText('', innerWidth)} ${paintPremiumAccent('|', accent, theme)}`;
  return panel.dense
    ? [top, titleLine, separator, ...body, bottom].join('\n')
    : [top, titleLine, separator, blank, ...body, blank, bottom].join('\n');
}

export function renderPremiumStatusRows(
  rows: ZavorthPremiumCliStatusRow[],
  theme: ZavorthPremiumCliTheme = createZavorthPremiumCliTheme(),
): string {
  const labelWidth = Math.min(
    22,
    Math.max(10, ...rows.map((row) => visiblePremiumWidth(row.label))),
  );
  return rows.map((row) => {
    const status = row.status || 'unknown';
    const detail = row.detail ? paintPremiumAccent(` - ${row.detail}`, 'muted', theme) : '';
    const valueAccent = status === 'ready'
      ? 'emerald'
      : status === 'blocked'
        ? 'rose'
        : status === 'warning' || status === 'waiting'
          ? 'amber'
          : 'plain';
    return [
      statusSymbol(status, theme),
      padPremiumText(row.label, labelWidth),
      paintPremiumAccent(row.value, valueAccent, theme),
      detail,
    ].join(' ');
  }).join('\n');
}

export function renderPremiumActions(
  actions: ZavorthPremiumCliAction[],
  theme: ZavorthPremiumCliTheme = createZavorthPremiumCliTheme(),
): string {
  return actions.map((action) => {
    const accent = action.accent || 'cyan';
    const label = paintPremiumAccent(action.label, accent, theme);
    if (!action.command) {
      const detail = action.detail ? paintPremiumAccent(` - ${action.detail}`, 'muted', theme) : '';
      return `${paintPremiumAccent(theme.symbols.arrow, accent, theme)} ${label}${detail}`;
    }
    const command = paintPremiumAccent(action.command, accent, theme);
    const detail = action.detail ? `\n  ${paintPremiumAccent(action.detail, 'muted', theme)}` : '';
    return `${paintPremiumAccent(theme.symbols.arrow, accent, theme)} ${label}\n  ${command}${detail}`;
  }).join('\n');
}

export function renderPremiumKeyValueTable(
  rows: Array<{ key: string; value: string; accent?: ZavorthPremiumCliAccent }>,
  theme: ZavorthPremiumCliTheme = createZavorthPremiumCliTheme(),
): string {
  const keyWidth = Math.min(24, Math.max(8, ...rows.map((row) => visiblePremiumWidth(row.key))));
  return rows.map((row) => [
    paintPremiumAccent(padPremiumText(row.key, keyWidth), 'muted', theme),
    paintPremiumAccent(row.value, row.accent || 'plain', theme),
  ].join('  ')).join('\n');
}

export function renderPremiumInlineNotice(
  title: string,
  body: string,
  accent: ZavorthPremiumCliAccent = 'amber',
  theme: ZavorthPremiumCliTheme = createZavorthPremiumCliTheme(),
): string {
  return [
    `${paintPremiumAccent(theme.symbols.warn, accent, theme)} ${paintPremiumAccent(title, accent, theme)}`,
    ...wrapPremiumLine(body, theme.maxWidth - 2).map((line) => `  ${line}`),
  ].join('\n');
}

function normalizePanelLines(lines: string[]): string[] {
  if (lines.length === 0) {
    return [''];
  }
  return lines.map((line) => String(line ?? ''));
}

function wrapPremiumLine(value: string, width: number): string[] {
  const text = String(value || '');
  if (text.trim() === '') {
    return [''];
  }
  if (visiblePremiumWidth(text) <= width) {
    return [text];
  }
  const indent = text.match(/^\s*/)?.[0] || '';
  const content = text.trimStart();
  const continuationIndent = indent || (text.startsWith('  ') ? '  ' : '');
  const availableWidth = Math.max(8, width - visiblePremiumWidth(continuationIndent));
  const words = content.split(/\s+/);
  const lines: string[] = [];
  let current = indent;
  for (const word of words) {
    const base = current.trim() ? `${current} ${word}` : `${current}${word}`;
    const next = base;
    if (visiblePremiumWidth(next) <= width) {
      current = next;
      continue;
    }
    if (current.trim()) {
      lines.push(current);
    }
    current = `${continuationIndent}${visiblePremiumWidth(word) > availableWidth ? truncatePremiumText(word, availableWidth) : word}`;
  }
  if (current.trim()) {
    lines.push(current);
  }
  return lines.length > 0 ? lines : [''];
}
