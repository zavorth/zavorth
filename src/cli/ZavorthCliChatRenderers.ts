import { sanitizeHumanCliText } from './ZavorthCliText.js';
import { paintCliTone } from './ZavorthCliVisualTheme.js';
import { TerminalMarkdown } from './presentation/TerminalMarkdown.js';

export type CliChatAssistantMessageOptions = {
  title?: string;
  body?: string | string[] | null;
  hints?: string[];
};

function normalizeCliChatLine(value: string | null | undefined): string {
  return sanitizeHumanCliText(value || '').replace(/\s+$/g, '').trim();
}

function normalizeCliChatLines(value: string | string[] | null | undefined): string[] {
  const rawLines = Array.isArray(value)
    ? value
    : String(value || '').split(/\r?\n/);
  return rawLines
    .map((line) => normalizeCliChatLine(line))
    .filter(Boolean);
}

export function formatCliChatAssistantMessage(options: CliChatAssistantMessageOptions): string {
  const title = normalizeCliChatLine(options.title || 'Zavorth') || 'Zavorth';
  const rawBody = Array.isArray(options.body) ? options.body.join('\n') : (options.body || '');
  const isTTY = process.stdout.isTTY && !process.argv.includes('--json');

  const renderedBody = isTTY && rawBody.trim()
    ? TerminalMarkdown.render(rawBody)
    : normalizeCliChatLines(rawBody).join('\n');

  const hints = (options.hints || [])
    .map((hint) => normalizeCliChatLine(hint))
    .filter(Boolean);

  return [
    `${paintCliTone('*', 'brand')} ${paintCliTone(title, 'brand')}`,
    renderedBody || null,
    hints.length > 0 ? ['', ...hints.map((hint) => `${paintCliTone('->', 'muted')} ${hint}`)].join('\n') : null,
  ].filter(Boolean).join('\n');
}

export function formatCliChatCommandHint(label: string, command: string | null | undefined): string | null {
  const normalizedLabel = normalizeCliChatLine(label);
  const normalizedCommand = normalizeCliChatLine(command || '');
  if (!normalizedLabel || !normalizedCommand) {
    return null;
  }
  return `${normalizedLabel}:\n  ${normalizedCommand}`;
}
