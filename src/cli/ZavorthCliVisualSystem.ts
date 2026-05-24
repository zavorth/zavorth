import {
  isCliColorEnabled,
  padCliVisualText,
  paintCliDivider,
  paintCliTone,
  stripCliAnsi,
  type CliVisualTone,
} from './ZavorthCliVisualTheme.js';

export type CliVisualPanel = {
  title: string;
  lines: string[];
  tone?: CliVisualTone;
};

export type CliVisualScreen = {
  eyebrow?: string | null;
  eyebrowTone?: CliVisualTone;
  title: string;
  summary?: string | null;
  panels: CliVisualPanel[];
  mode?: 'hero' | 'compact';
  showWordmark?: boolean;
};

const HELP_PANEL_WIDTH = 92;

function renderCliPanel(panel: CliVisualPanel, mode: 'hero' | 'compact'): string {
  const title = String(panel.title || '').trim() || 'Block';
  const lines = panel.lines.map((line) => String(line || '')).filter(Boolean);
  const tone = panel.tone || 'neutral';
  if (mode === 'compact') {
    return [
      paintCliTone(title, tone),
      ...lines,
    ].join('\n');
  }

  return renderBox(title, lines, tone);
}

export function renderCliScreen(screen: CliVisualScreen): string {
  const mode = screen.mode || 'hero';
  const decorated = isCliColorEnabled();
  const parts: string[] = [];

  if (screen.eyebrow && mode !== 'hero') {
    const eyebrow = decorated ? paintCliTone(screen.eyebrow, 'muted') : screen.eyebrow;
    if (eyebrow) {
      parts.push(eyebrow);
    }
  }

  if (mode === 'hero') {
    parts.push(renderHeroHeader(screen));
  } else {
    parts.push(screen.title);
    parts.push(paintCliDivider(Math.max(stripCliAnsi(screen.title).length, 12)));
    if (screen.summary) {
      parts.push(screen.summary);
    }
  }

  const panelBlocks = screen.panels
    .filter((panel) => panel.lines.length > 0)
    .map((panel) => renderCliPanel(panel, mode));

  if (panelBlocks.length > 0) {
    parts.push(...panelBlocks);
  }

  return parts.filter(Boolean).join('\n\n');
}

function renderHeroHeader(screen: CliVisualScreen): string {
  const title = stripCliAnsi(screen.title || 'ZAVORTH').toUpperCase();
  const subtitle = String(screen.summary || '').trim();
  const commandLine = 'zavorth <ask|setup|approve|open>';
  const lines = [
    paintCliTone(title, 'brand'),
    subtitle,
    paintCliTone(commandLine, 'muted'),
  ].filter(Boolean);
  return renderBox('Zavorth CLI', lines, 'brand');
}

function renderBox(title: string, lines: string[], tone: CliVisualTone): string {
  const width = HELP_PANEL_WIDTH;
  const innerWidth = width - 4;
  const titleText = ` ${stripCliAnsi(title)} `;
  const titleVisible = titleText.length;
  const horizontal = '─';
  const top = `╭─${paintCliTone(titleText, tone)}${horizontal.repeat(Math.max(0, width - titleVisible - 3))}╮`;
  const bottom = `╰${horizontal.repeat(width - 2)}╯`;
  const body = lines.flatMap((line) => wrapVisualLine(line, innerWidth))
    .map((line) => `│ ${padCliVisualText(line, innerWidth)} │`);
  return [top, ...body, bottom].join('\n');
}

function wrapVisualLine(line: string, width: number): string[] {
  const raw = String(line || '');
  if (stripCliAnsi(raw).length <= width) {
    return [raw];
  }
  const words = raw.split(/\s+/u);
  const output: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (stripCliAnsi(candidate).length > width && current) {
      output.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) {
    output.push(current);
  }
  return output.length ? output : [''];
}
