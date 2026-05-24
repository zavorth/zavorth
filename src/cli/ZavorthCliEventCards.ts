import { sanitizeHumanCliText } from './ZavorthCliText.js';
import { paintCliTone, type CliVisualTone } from './ZavorthCliVisualTheme.js';
import { TerminalMarkdown } from './presentation/TerminalMarkdown.js';

export type CliEventCardTone = 'success' | 'warning' | 'danger' | 'info';

export type CliEventCardOptions = {
  tone: CliEventCardTone;
  title: string;
  body?: string | string[] | null;
  actions?: Array<{
    label: string;
    command: string;
  }>;
  hints?: string[];
};

const EVENT_TONE_META: Record<CliEventCardTone, { symbol: string; visualTone: CliVisualTone }> = {
  success: { symbol: '*', visualTone: 'success' },
  warning: { symbol: '!', visualTone: 'warning' },
  danger: { symbol: 'x', visualTone: 'danger' },
  info: { symbol: 'i', visualTone: 'info' },
};

function normalizeEventCardLine(value: string | null | undefined): string {
  return sanitizeHumanCliText(value || '').replace(/\s+$/g, '').trim();
}

function normalizeEventCardLines(value: string | string[] | null | undefined): string[] {
  const lines = Array.isArray(value)
    ? value
    : String(value || '').split(/\r?\n/);
  return lines
    .map((line) => normalizeEventCardLine(line))
    .filter(Boolean);
}

function normalizeEventCardCommand(value: string | null | undefined): string {
  return normalizeEventCardLine(value || '')
    .replace(/^zavorth\s+/i, '')
    .trim();
}

export function formatCliEventCard(options: CliEventCardOptions): string {
  const meta = EVENT_TONE_META[options.tone] || EVENT_TONE_META.info;
  const title = normalizeEventCardLine(options.title) || 'Zavorth';
  const rawBody = Array.isArray(options.body) ? options.body.join('\n') : (options.body || '');
  const isTTY = process.stdout.isTTY && !process.argv.includes('--json');

  const renderedBody = isTTY && rawBody.trim()
    ? TerminalMarkdown.render(rawBody)
    : normalizeEventCardLines(rawBody).join('\n');

  const actions = (options.actions || [])
    .map((action) => ({
      label: normalizeEventCardLine(action.label),
      command: normalizeEventCardCommand(action.command),
    }))
    .filter((action) => action.label && action.command);
  const hints = (options.hints || [])
    .map((hint) => normalizeEventCardLine(hint))
    .filter(Boolean);

  return [
    `${paintCliTone(meta.symbol, meta.visualTone)} ${paintCliTone(title, meta.visualTone)}`,
    renderedBody || null,
    actions.length > 0
      ? ['', ...actions.map((action) => `${action.label}:\n  ${action.command}`)].join('\n')
      : null,
    hints.length > 0
      ? ['', ...hints.map((hint) => `${paintCliTone('->', 'muted')} ${hint}`)].join('\n')
      : null,
  ].filter(Boolean).join('\n');
}

export function formatCliSuccessEventCard(options: Omit<CliEventCardOptions, 'tone'>): string {
  return formatCliEventCard({
    ...options,
    tone: 'success',
    title: options.title || 'Pronto',
  });
}

export function formatCliApprovalRequiredEventCard(options: {
  body?: string | string[] | null;
  command?: string | null;
  hints?: string[];
}): string {
  return formatCliEventCard({
    tone: 'warning',
    title: 'Preciso da sua aprovacao',
    body: options.body || 'O Zavorth precisa da sua autorizacao antes de continuar.',
    actions: options.command
      ? [{ label: 'Aprovar', command: options.command }]
      : [],
    hints: options.hints,
  });
}

export function formatCliRecoverableErrorEventCard(options: {
  body?: string | string[] | null;
  command?: string | null;
  hints?: string[];
}): string {
  return formatCliEventCard({
    tone: 'warning',
    title: 'Algo travou',
    body: options.body || 'Nao consegui concluir isso agora.',
    actions: options.command
      ? [{ label: 'Tente isto', command: options.command }]
      : [],
    hints: options.hints,
  });
}

export function extractCliApprovalCommand(text: string): string | null {
  const normalized = sanitizeHumanCliText(text || '').trim();
  const commandMatch = normalized.match(/\b(?:zavorth\s+)?approve\s+([a-z0-9:_-]+)(?:\s+pin=([a-z0-9:_-]+))?/i);
  if (!commandMatch) {
    return null;
  }
  const taskId = commandMatch[1];
  const pin = commandMatch[2];
  return `approve ${taskId}${pin ? ` pin=${pin}` : ''}`;
}

export function formatCliChatReplyEventCard(reply: string): string | null {
  const normalized = normalizeEventCardLine(reply);
  if (!normalized) {
    return null;
  }

  const approvalCommand = extractCliApprovalCommand(normalized);
  if (
    approvalCommand
    && /\b(aprov|approval|autoriza|permiss|permit|confirm)\w*/i.test(normalized)
  ) {
    return formatCliApprovalRequiredEventCard({
      body: normalized,
      command: approvalCommand,
    });
  }

  if (/^(aprovacao enviada|rejeicao enviada|retomada de workflow|reinicio de etapa|encerramento de workflow)/i.test(normalized)) {
    return formatCliSuccessEventCard({
      title: 'Pronto',
      body: normalized,
    });
  }

  if (/\b(erro|falha|failed|error|travou|indisponivel|unavailable|nao consegui)\b/i.test(normalized)) {
    return formatCliRecoverableErrorEventCard({
      body: normalized,
      command: 'doctor',
    });
  }

  return null;
}
