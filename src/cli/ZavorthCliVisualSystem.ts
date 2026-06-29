import {
  padCliVisualText,
  paintCliTone,
  stripCliAnsi,
  type CliVisualTone,
} from './ZavorthCliVisualTheme.js';
import { ZAVORTH_BLOCK_BANNER } from './premium/ZavorthPremiumCliSigil.js';

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

export function renderCliScreen(screen: CliVisualScreen): string {
  const mode = screen.mode || 'hero';
  const parts: string[] = [];

  if (screen.eyebrow && mode !== 'hero') {
    parts.push(paintCliTone(screen.eyebrow, screen.eyebrowTone || 'muted'));
  }

  if (mode === 'hero') {
    parts.push(renderHeroHeader(screen));
  } else {
    parts.push(paintCliTone(screen.title, 'brand'));
    if (screen.summary) {
      parts.push(paintCliTone(screen.summary, 'muted'));
    }
  }

  const panels = screen.panels
    .filter((panel) => panel.lines.length > 0)
    .map((panel) => renderCliPanel(panel, mode));

  return [...parts, ...panels].filter(Boolean).join('\n\n');
}

function renderCliPanel(panel: CliVisualPanel, mode: 'hero' | 'compact'): string {
  const title = String(panel.title || '').trim() || 'Block';
  const lines = panel.lines.map((line) => String(line || '')).filter(Boolean);
  return renderBox(title, lines, panel.tone || 'neutral', mode);
}

function renderHeroHeader(screen: CliVisualScreen): string {
  const subtitle = String(screen.summary || '').trim();
  const commandLine = 'zavorth <ask|setup|approve|open>';
  const banner = ZAVORTH_BLOCK_BANNER.join('\n');
  return [banner, '', paintCliTone(commandLine, 'muted')].join('\n');
}

function renderBox(title: string, lines: string[], tone: CliVisualTone, mode: 'hero' | 'compact'): string {
  const columns = Number(process.stdout?.columns || 0);
  const maxWidth = columns > 0 ? Math.max(48, Math.min(HELP_PANEL_WIDTH, columns - 4)) : HELP_PANEL_WIDTH;
  const naturalWidth = Math.max(44, stripCliAnsi(title).length + 8, ...lines.map((line) => stripCliAnsi(line).length + 4));
  const width = mode === 'compact' ? Math.min(maxWidth, naturalWidth) : maxWidth;
  const inner = width - 4;
  const titleText = ` ${stripCliAnsi(title)} `;
  const titleWidth = Math.min(stripCliAnsi(titleText).length, inner);
  const top = `── ${paintCliTone(titleText.slice(0, titleWidth), 'info')} ${'─'.repeat(Math.max(0, width - titleText.length - 5))}`;
  const body = lines.flatMap((line) => wrapVisualLine(line, inner))
    .map((line) => `  ${padCliVisualText(line, inner)}`);
  const bottom = `${'─'.repeat(width)}`;
  const paddedBody = mode === 'hero' ? ['', ...body, ''] : body;
  return [top, ...paddedBody, bottom].join('\n');
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
