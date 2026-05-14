import {
  isCliColorEnabled,
  paintCliBadge,
  paintCliDivider,
  paintCliTone,
  renderCliWordmark,
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

function renderCliPanel(panel: CliVisualPanel, mode: 'hero' | 'compact'): string {
  const title = String(panel.title || '').trim() || 'Bloco';
  const lines = panel.lines.map((line) => String(line || '')).filter(Boolean);
  const tone = panel.tone || 'neutral';
  if (mode === 'compact') {
    return [
      paintCliTone(title, tone),
      ...lines,
    ].join('\n');
  }

  const dividerWidth = Math.max(stripCliAnsi(title).length, 12);
  return [paintCliTone(title, tone), paintCliDivider(dividerWidth, tone), ...lines].join('\n');
}

export function renderCliScreen(screen: CliVisualScreen): string {
  const mode = screen.mode || 'hero';
  const eyebrowTone = screen.eyebrowTone || 'brand';
  const decorated = isCliColorEnabled();
  const parts: string[] = [];

  if (screen.eyebrow) {
    const eyebrow = mode === 'hero'
      ? paintCliBadge(screen.eyebrow, eyebrowTone)
      : (decorated ? paintCliTone(screen.eyebrow, 'muted') : '');
    if (eyebrow) {
      parts.push(eyebrow);
    }
  }

  if (mode === 'hero' && screen.showWordmark !== false) {
    parts.push(renderCliWordmark());
  }

  parts.push(screen.title);

  if (mode === 'compact') {
    parts.push(paintCliDivider(Math.max(stripCliAnsi(screen.title).length, 12)));
  }

  if (screen.summary) {
    parts.push(screen.summary);
  }

  const panelBlocks = screen.panels
    .filter((panel) => panel.lines.length > 0)
    .map((panel) => renderCliPanel(panel, mode));

  if (panelBlocks.length > 0) {
    parts.push(...panelBlocks);
  }

  return parts.filter(Boolean).join('\n\n');
}
