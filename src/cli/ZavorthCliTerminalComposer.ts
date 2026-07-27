import { sanitizeHumanCliText } from './ZavorthCliText.js';
import { paintCliTone, type CliVisualTone } from './ZavorthCliVisualTheme.js';

export type TerminalComposerInlineCardKind =
  | 'tool'
  | 'diff'
  | 'approval'
  | 'status'
  | 'result';

export type TerminalComposerInlineCardOptions = {
  kind: TerminalComposerInlineCardKind;
  title: string;
  status?: string | null;
  body?: string | string[] | null;
  command?: string | null;
};

const REASONING_TAGS = [
  'think',
  'thinking',
  'thought',
  'reasoning',
  'chain_of_thought',
  'cot',
];

const RAW_TOOL_TAGS = [
  'tool_call',
  'function_call',
  'tool_result',
  'tool_output',
];

const SLASH_ALIASES: Record<string, (args: string) => string> = {
  model: (args) => ['gateway models', args].filter(Boolean).join(' '),
  models: (args) => ['gateway models', args].filter(Boolean).join(' '),
  provider: (args) => ['gateway providers', args].filter(Boolean).join(' '),
  providers: (args) => ['gateway providers', args].filter(Boolean).join(' '),
  skills: (args) => ['skills', args].filter(Boolean).join(' '),
  skill: (args) => ['skills', args].filter(Boolean).join(' '),
  usage: (args) => ['status', args].filter(Boolean).join(' '),
  approvals: (args) => ['approve', args].filter(Boolean).join(' '),
  decisions: (args) => ['approve', args].filter(Boolean).join(' '),
  channels: (args) => ['channels', args].filter(Boolean).join(' '),
  channel: (args) => ['channels', args].filter(Boolean).join(' '),
  tasks: (args) => ['tasks', args].filter(Boolean).join(' '),
  task: (args) => ['task', args].filter(Boolean).join(' '),
  memory: (args) => {
    if (!args) {
      return 'memory';
    }
    if (/^(search|status|metrics|forget|correct|procedures|review|resolve)\b/i.test(args)) {
      return `memory ${args}`;
    }
    return `memory search ${args}`;
  },
  mnemos: (args) => (args ? `memory search ${args}` : 'memory'),
};

function escapeRegExp(value: string): string {
  return String(value).replace(/[.*+...^${}()|[\]\\]/g, '\\$&');
}

function removeTaggedBlocks(value: string, tags: string[]): string {
  return tags.reduce((current, tag) => {
    const escaped = escapeRegExp(tag);
    const closedBlock = new RegExp(`<${escaped}\\b[^>]*>[\\s\\S]*...<\\/${escaped}>`, 'gi');
    const openBlock = new RegExp(`<${escaped}\\b[^>]*>[\\s\\S]*$`, 'gi');
    return current.replace(closedBlock, '').replace(openBlock, '');
  }, value);
}

function normalizeComposerLine(value: string | null | undefined): string {
  return sanitizeHumanCliText(filterTerminalComposerOutput(value || ''))
    .replace(/\s+$/g, '')
    .trim();
}

function normalizeComposerLines(value: string | string[] | null | undefined): string[] {
  const rawLines = Array.isArray(value)
    ? value
    : String(value || '').split(/\r...\n/);
  return rawLines
    .map((line) => normalizeComposerLine(line))
    .filter(Boolean);
}

function toneForInlineCard(kind: TerminalComposerInlineCardKind): CliVisualTone {
  switch (kind) {
    case 'approval':
      return 'warning';
    case 'diff':
      return 'info';
    case 'result':
      return 'success';
    case 'tool':
    case 'status':
    default:
      return 'brand';
  }
}

export function filterTerminalComposerOutput(raw: string | null | undefined): string {
  const text = String(raw || '');
  if (!text) {
    return '';
  }

  return removeTaggedBlocks(removeTaggedBlocks(text, REASONING_TAGS), RAW_TOOL_TAGS)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function normalizeTerminalComposerInput(raw: string | null | undefined): string {
  const normalized = String(raw || '').trim().replace(/\s+/g, ' ');
  if (!normalized.startsWith('/')) {
    return normalized;
  }

  const withoutSlash = normalized.replace(/^\/+/, '').trim();
  const command = withoutSlash.split(/\s+/)[0]?.toLowerCase() || '';
  const args = withoutSlash.slice(command.length).trim();
  const alias = SLASH_ALIASES[command];
  if (alias) {
    return alias(args).trim();
  }

  return normalized;
}

export function formatTerminalComposerPrompt(
  _flags: { sessionId?: string | null; chatId?: string | null } = {},
): string {
  return `${paintCliTone('Zavorth', 'muted')} ${paintCliTone('›', 'brand')} `;
}

export function formatTerminalComposerInlineCard(options: TerminalComposerInlineCardOptions): string {
  const title = normalizeComposerLine(options.title) || 'Zavorth';
  const status = normalizeComposerLine(options.status || '');
  const body = normalizeComposerLines(options.body);
  const command = normalizeComposerLine(options.command || '');
  const tone = toneForInlineCard(options.kind);
  const heading = [
    paintCliTone(options.kind.toUpperCase(), tone),
    paintCliTone(title, 'neutral'),
    status ? paintCliTone(status, tone) : null,
  ].filter(Boolean).join('  ');
  const lines = [
    heading,
    ...body.slice(0, 2),
    command ? `${paintCliTone('run', 'muted')}: ${command}` : null,
  ].filter(Boolean) as string[];
  return lines.join('\n');
}
