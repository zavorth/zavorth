import {
  filterTerminalComposerOutput,
  formatTerminalComposerInlineCard,
  normalizeTerminalComposerInput,
  type TerminalComposerInlineCardKind,
} from './ZavorthCliTerminalComposer.js';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';

import { homedir } from 'os';
import { dirname, join } from 'path';
import { logger } from '../logger.js';export type TerminalShellMode = 'daily' | 'ops';

export type TerminalShellFocusTarget =
  | 'composer'
  | 'timeline'
  | 'cards'
  | 'queue'
  | 'palette';

export type TerminalShellSectionId =
  | 'chat'
  | 'approvals'
  | 'diffs'
  | 'tasks'
  | 'memory'
  | 'providers'
  | 'channels'
  | 'voice'
  | 'sandbox'
  | 'logs';

export type TerminalShellSection = {
  id: TerminalShellSectionId;
  title: string;
  shortcut: string;
  command: string;
};

export type TerminalShellMessage = {
  role: 'user' | 'assistant' | 'system' | 'tool';
  text: string;
};

export type TerminalShellCard = {
  kind: TerminalComposerInlineCardKind;
  title: string;
  status?: string | null;
  body?: string | string[] | null;
  command?: string | null;
};

export type TerminalShellCardAction = 'approve' | 'reject' | 'defer';

export type TerminalShellCardSelectionState = {
  selectedIndex: number | null;
};

export type TerminalShellCardSelectionEvent =
  | { type: 'next'; cards: TerminalShellCard[] }
  | { type: 'previous'; cards: TerminalShellCard[] }
  | { type: 'select'; cards: TerminalShellCard[]; selectedIndex: number | null };

export type TerminalShellCardActionResult = {
  applied: boolean;
  action: TerminalShellCardAction;
  card: TerminalShellCard | null;
  command: string | null;
  notice: string;
};

export type TerminalShellReceipt = {
  id: string;
  title: string;
  detail: string;
};

export type TerminalShellQueuedItem = {
  id: string;
  text: string;
  kind: 'message' | 'command' | 'steer';
  status: 'queued' | 'ready';
};

export type TerminalShellStreamRenderBuffer = {
  start(): void;
  push(input: { delta?: string | null; accumulated?: string | null }): void;
  complete(input?: { accumulated?: string | null }): void;
  abort(): void;
};

export type TerminalShellComposer = {
  position: 'bottom';
  value: string;
  placeholder: string;
  multilineHint: string;
  slashPalette: TerminalShellCommand[];
  queue: TerminalShellQueuedItem[];
  voiceArmed: boolean;
};

export type TerminalShellSnapshot = {
  contractVersion: 'zavorth-terminal-shell/1';
  mode: TerminalShellMode;
  sessionId: string;
  profileId: string;
  providerLabel: string;
  modelLabel: string;
  activeRun: boolean;
  sections: TerminalShellSection[];
  composer: TerminalShellComposer;
  messages: TerminalShellMessage[];
  cards: TerminalShellCard[];
  receipts: {
    collapsedByDefault: true;
    items: TerminalShellReceipt[];
    openCommand: string;
  };
  footer: {
    dailyHint: string;
    opsHint: string;
  };
};

export type BuildTerminalShellSnapshotInput = {
  mode?: TerminalShellMode;
  sessionId?: string | null;
  profileId?: string | null;
  providerLabel?: string | null;
  modelLabel?: string | null;
  activeRun?: boolean;
  input?: string | null;
  messages?: TerminalShellMessage[];
  cards?: TerminalShellCard[];
  receipts?: TerminalShellReceipt[];
  queue?: TerminalShellQueuedItem[];
  voiceArmed?: boolean;
};

export type TerminalShellCommand = {
  id: string;
  title: string;
  command: string;
  aliases: string[];
  section: TerminalShellSectionId;
  surface: 'terminal';
  risk: 'read' | 'preview' | 'approval';
};

export type TerminalShellCommandRegistry = {
  contractVersion: 'zavorth-terminal-shell-command-registry/1';
  commands: TerminalShellCommand[];
};

export type TerminalShellCommandRegistryOptions = {
  locale?: string | null;
};

export type TerminalShellInputState = {
  value: string;
  cursor: number;
  paletteOpen: boolean;
  voiceArmed: boolean;
  history?: string[];
  historyIndex?: number | null;
};

export type TerminalShellInputEvent =
  | { type: 'insertText'; text: string }
  | { type: 'key'; key: string };

export type TerminalShellFocusState = {
  mode: TerminalShellMode;
  sectionId: TerminalShellSectionId;
  target: TerminalShellFocusTarget;
};

export type TerminalShellFocusEvent =
  | { type: 'tab' }
  | { type: 'shiftTab' }
  | { type: 'toggleMode' }
  | { type: 'escape' }
  | { type: 'section'; sectionId: TerminalShellSectionId }
  | { type: 'target'; target: TerminalShellFocusTarget };

export type TerminalShellHistoryStore = {
  filePath: string;
  load: () => string[];
  append: (value: string) => void;
  clear: () => void;
};

export type TerminalShellHistoryStoreOptions = {
  filePath?: string | null;
  limit?: number;
};

export type QueueTerminalShellInputResult = {
  accepted: boolean;
  queue: TerminalShellQueuedItem[];
  operatorNotice: string;
};

const TERMINAL_SECTIONS: TerminalShellSection[] = [
  { id: 'chat', title: 'Chat', shortcut: '1', command: 'zavorth chat' },
  { id: 'approvals', title: 'Approvals', shortcut: '2', command: 'zavorth approve' },
  { id: 'diffs', title: 'Diffs', shortcut: '3', command: 'zavorth diff' },
  { id: 'tasks', title: 'Tasks', shortcut: '4', command: 'zavorth tasks list' },
  { id: 'memory', title: 'Memory', shortcut: '5', command: 'zavorth mnemos recall' },
  { id: 'providers', title: 'Providers', shortcut: '6', command: 'zavorth providers doctor' },
  { id: 'channels', title: 'Channels', shortcut: '7', command: 'zavorth channels status' },
  { id: 'voice', title: 'Voice', shortcut: 'v', command: 'zavorth echo wake status' },
  { id: 'sandbox', title: 'Sandbox', shortcut: 's', command: 'zavorth sandbox doctor' },
  { id: 'logs', title: 'Logs', shortcut: 'l', command: 'zavorth logs' },
];

const TERMINAL_COMMANDS: TerminalShellCommand[] = [
  command('zavorth.action.lookup', 'Find action', '/actions lookup', ['/', '/action'], 'chat', 'read'),
  command('zavorth.action.preview', 'Preview action', '/preview', ['/apply-preview'], 'approvals', 'preview'),
  command('zavorth.approvals.open', 'Review approvals', '/approvals', ['/approve', '/decisions'], 'approvals', 'approval'),
  command('zavorth.diff.open', 'Open diffs', '/diffs', ['/diff'], 'diffs', 'read'),
  command('zavorth.tasks.list', 'Show tasks', '/tasks', ['/task'], 'tasks', 'read'),
  command('zavorth.memory.recall', 'Recall memory', '/memory', ['/mnemos', '/recall'], 'memory', 'read'),
  command('zavorth.providers.pick', 'Pick model', '/model', ['/models', '/provider'], 'providers', 'preview'),
  command('zavorth.channels.status', 'Check channels', '/channels', ['/channel'], 'channels', 'read'),
  command('zavorth.voice.toggle', 'Toggle voice wake', '/voice', ['/echo', 'v'], 'voice', 'preview'),
  command('zavorth.sandbox.status', 'Sandbox status', '/sandbox', ['/safe-run'], 'sandbox', 'read'),
  command('zavorth.swarm.plan', 'Plan parallel work', '/swarm', ['/parallel'], 'tasks', 'preview'),
  command('zavorth.swarm.configure', 'Configure swarm run', '/swarm-config', ['/swarm configure', '/scale'], 'tasks', 'preview'),
  command('zavorth.swarm.cloud-pool', 'Check swarm cloud pool', '/swarm-cloud', ['/cloud-pool'], 'sandbox', 'read'),
  command('zavorth.satellite.foundation', 'Check device foundation', '/device-foundation', ['/satellite-foundation'], 'channels', 'read'),
  command('zavorth.ide.open', 'Open in editor', '/ide', ['/editor'], 'diffs', 'preview'),
];

const FOCUS_TARGETS: TerminalShellFocusTarget[] = [
  'composer',
  'timeline',
  'cards',
  'queue',
  'palette',
];

const DEFAULT_HISTORY_LIMIT = 200;

function command(
  id: string,
  title: string,
  commandText: string,
  aliases: string[],
  section: TerminalShellSectionId,
  risk: TerminalShellCommand['risk'],
): TerminalShellCommand {
  return {
    id,
    title,
    command: commandText,
    aliases,
    section,
    surface: 'terminal',
    risk,
  };
}

export function buildTerminalShellCommandRegistry(
  options: TerminalShellCommandRegistryOptions = {},
): TerminalShellCommandRegistry {
  const locale = String(options.locale || '').toLowerCase();
  return {
    contractVersion: 'zavorth-terminal-shell-command-registry/1',
    commands: TERMINAL_COMMANDS.map((entry) => ({
      ...entry,
      aliases: [...entry.aliases, ...localizedAliasesForCommand(entry.id, locale)],
    })),
  };
}

export function buildTerminalShellSnapshot(input: BuildTerminalShellSnapshotInput = {}): TerminalShellSnapshot {
  return {
    contractVersion: 'zavorth-terminal-shell/1',
    mode: input.mode || 'daily',
    sessionId: input.sessionId || 'main',
    profileId: input.profileId || 'personal',
    providerLabel: normalizeShellLabel(input.providerLabel, 'auto'),
    modelLabel: normalizeShellLabel(input.modelLabel, 'auto'),
    activeRun: Boolean(input.activeRun),
    sections: TERMINAL_SECTIONS.map((section) => ({ ...section })),
    composer: {
      position: 'bottom',
      value: String(input.input || ''),
      placeholder: 'Ask Zavorth',
      multilineHint: 'Shift+Enter for newline',
      slashPalette: buildTerminalShellCommandRegistry().commands,
      queue: [...(input.queue || [])],
      voiceArmed: Boolean(input.voiceArmed),
    },
    messages: (input.messages || []).map((message) => ({
      ...message,
      text: filterTerminalComposerOutput(message.text),
    })),
    cards: [...(input.cards || [])],
    receipts: {
      collapsedByDefault: true,
      items: [...(input.receipts || [])],
      openCommand: 'zavorth receipts',
    },
    footer: {
      dailyHint: 'Enter sends. Shift+Enter adds a line. / opens commands. v toggles voice.',
      opsHint: 'Tab sections. a approve. r reject. d defer. Ctrl+C interrupts safely.',
    },
  };
}

export function resolveTerminalShellHistoryPath(): string {
  const explicit = String(process.env.ZAVORTH_TERMINAL_HISTORY_PATH || '').trim();
  if (explicit) {
    return explicit;
  }
  const root = String(process.env.ZAVORTH_HOME || '').trim() || join(homedir(), '.zavorth');
  return join(root, 'terminal-shell-history.jsonl');
}

export function createTerminalShellHistoryStore(
  options: TerminalShellHistoryStoreOptions = {},
): TerminalShellHistoryStore {
  const filePath = String(options.filePath || '').trim() || resolveTerminalShellHistoryPath();
  const limit = Math.max(1, Math.floor(options.limit || DEFAULT_HISTORY_LIMIT));
  const load = (): string[] => {
    try {
      if (!existsSync(filePath)) {
        return [];
      }
    } catch (error: unknown) {logger.warn('[Zavorth Cli Terminal Shell] filesystem operation failed', error); return []; }
    let lines: string[];
    try {
      lines = readFileSync(filePath, 'utf8').split(/\r?\n/);
    } catch (error: unknown) {logger.warn('[Zavorth Cli Terminal Shell] filesystem operation failed', error); return []; }
    const entries: string[] = [];
    for (const line of lines) {
      const parsed = parseTerminalHistoryLine(line);
      if (!parsed) {
        continue;
      }
      if (entries[entries.length - 1] !== parsed) {
        entries.push(parsed);
      }
    }
    return entries.slice(-limit);
  };
  const writeAll = (entries: string[]) => {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(
      filePath,
      entries.slice(-limit).map((entry) => JSON.stringify({ text: entry })).join('\n') + (entries.length ? '\n' : ''),
      'utf8',
    );
  };
  return {
    filePath,
    load,
    append: (value: string) => {
      const entry = normalizeTerminalHistoryEntry(value);
      if (!entry) {
        return;
      }
      const entries = load();
      if (entries[entries.length - 1] === entry) {
        return;
      }
      entries.push(entry);
      writeAll(entries);
    },
    clear: () => {
      if (existsSync(filePath)) {
        rmSync(filePath, { force: true });
      }
    },
  };
}

function parseTerminalHistoryLine(line: string): string | null {
  const trimmed = String(line || '').trim();
  if (!trimmed) {
    return null;
  }
  try {
    const parsed = JSON.parse(trimmed) as { text?: unknown };
    return normalizeTerminalHistoryEntry(parsed.text);
  } catch (error: unknown) {logger.warn('[Zavorth Cli Terminal Shell] JSON parse failed', error);
    return normalizeTerminalHistoryEntry(trimmed);
  }
}

function normalizeTerminalHistoryEntry(value: unknown): string {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .trim()
    .slice(0, 4000);
}

function localizedAliasesForCommand(id: string, locale: string): string[] {
  if (!locale.startsWith('pt')) {
    return [];
  }
  switch (id) {
    case 'zavorth.memory.recall':
      return ['/memoria', '/lembrar'];
    case 'zavorth.approvals.open':
      return ['/aprovacoes', '/decisoes'];
    case 'zavorth.channels.status':
      return ['/canais'];
    case 'zavorth.providers.pick':
      return ['/modelo', '/provedor'];
    case 'zavorth.tasks.list':
      return ['/tarefas'];
    case 'zavorth.voice.toggle':
      return ['/voz'];
    default:
      return [];
  }
}

function normalizeShellLabel(value: string | null | undefined, fallback: string): string {
  const normalized = String(value || '').trim();
  if (!normalized || /^not\s+(selected|configured)$/iu.test(normalized)) {
    return fallback;
  }
  return normalized;
}

export function queueTerminalShellInput(input: {
  activeRun: boolean;
  text: string;
  existingQueue?: TerminalShellQueuedItem[];
}): QueueTerminalShellInputResult {
  const text = String(input.text || '').trim();
  const queue = [...(input.existingQueue || [])];
  if (!text) {
    return {
      accepted: false,
      queue,
      operatorNotice: 'Nothing queued.',
    };
  }
  const normalized = normalizeTerminalComposerInput(text);
  const item: TerminalShellQueuedItem = {
    id: `queued-${queue.length + 1}`,
    text,
    kind: text.toLowerCase().startsWith('/steer')
      ? 'steer'
      : normalized.startsWith('/') || normalized !== text
        ? 'command'
        : 'message',
    status: input.activeRun ? 'queued' : 'ready',
  };
  queue.push(item);
  return {
    accepted: true,
    queue,
    operatorNotice: input.activeRun
      ? 'Input queued for this run.'
      : 'Input ready to send.',
  };
}

export function createTerminalShellStreamRenderBuffer(input: {
  intervalMs?: number;
  onFlush: (text: string) => void;
  setIntervalImpl?: typeof setInterval;
  clearIntervalImpl?: typeof clearInterval;
}): TerminalShellStreamRenderBuffer {
  const intervalMs = Math.max(16, Math.floor(input.intervalMs || 120));
  const setIntervalImpl = input.setIntervalImpl || setInterval;
  const clearIntervalImpl = input.clearIntervalImpl || clearInterval;
  let timer: ReturnType<typeof setInterval> | null = null;
  let liveText = '';
  let lastFlushedText = '';

  const flush = (force = false) => {
    if (!liveText) {
      return;
    }
    if (!force && liveText === lastFlushedText) {
      return;
    }
    lastFlushedText = liveText;
    input.onFlush(liveText);
  };

  const stopTimer = () => {
    if (!timer) {
      return;
    }
    clearIntervalImpl(timer);
    timer = null;
  };

  return {
    start() {
      if (timer) {
        return;
      }
      timer = setIntervalImpl(() => flush(), intervalMs);
    },
    push(event) {
      const accumulated = String(event.accumulated || '');
      liveText = accumulated || `${liveText}${String(event.delta || '')}`;
      this.start();
    },
    complete(event = {}) {
      const accumulated = String(event.accumulated || '');
      if (accumulated) {
        liveText = accumulated;
      }
      flush(true);
      stopTimer();
      liveText = '';
      lastFlushedText = '';
    },
    abort() {
      stopTimer();
      liveText = '';
      lastFlushedText = '';
    },
  };
}

export function reduceTerminalShellInput(
  state: TerminalShellInputState | undefined,
  event: TerminalShellInputEvent,
): TerminalShellInputState {
  const current: TerminalShellInputState = state || {
    value: '',
    cursor: 0,
    paletteOpen: false,
    voiceArmed: false,
    history: [],
    historyIndex: null,
  };
  if (event.type === 'insertText') {
    const before = current.value.slice(0, current.cursor);
    const after = current.value.slice(current.cursor);
    const value = `${before}${event.text}${after}`;
    return {
      ...current,
      value,
      cursor: before.length + event.text.length,
      historyIndex: null,
    };
  }
  const key = event.key.toLowerCase();
  if (key === 'shift+enter') {
    return reduceTerminalShellInput(current, { type: 'insertText', text: '\n' });
  }
  if (key === '/') {
    const next = reduceTerminalShellInput(current, { type: 'insertText', text: '/' });
    return {
      ...next,
      paletteOpen: true,
    };
  }
  if (key === 'escape') {
    return {
      ...current,
      paletteOpen: false,
    };
  }
  if (key === 'v') {
    return {
      ...current,
      voiceArmed: !current.voiceArmed,
    };
  }
  if (key === 'backspace' && current.cursor > 0) {
    const before = current.value.slice(0, current.cursor - 1);
    const after = current.value.slice(current.cursor);
    return {
      ...current,
      value: `${before}${after}`,
      cursor: current.cursor - 1,
      historyIndex: null,
    };
  }
  if (key === 'arrowup') {
    const history = current.history || [];
    if (!history.length) {
      return current;
    }
    const index = current.historyIndex === null || current.historyIndex === undefined
      ? history.length - 1
      : Math.max(0, current.historyIndex - 1);
    const value = history[index] || '';
    return {
      ...current,
      value,
      cursor: value.length,
      historyIndex: index,
    };
  }
  if (key === 'arrowdown') {
    const history = current.history || [];
    if (!history.length || current.historyIndex === null || current.historyIndex === undefined) {
      return current;
    }
    const index = current.historyIndex + 1;
    if (index >= history.length) {
      return {
        ...current,
        value: '',
        cursor: 0,
        historyIndex: null,
      };
    }
    const value = history[index] || '';
    return {
      ...current,
      value,
      cursor: value.length,
      historyIndex: index,
    };
  }
  return current;
}

export function reduceTerminalShellFocus(
  state: TerminalShellFocusState | undefined,
  event: TerminalShellFocusEvent,
): TerminalShellFocusState {
  const current: TerminalShellFocusState = state || {
    mode: 'daily',
    sectionId: 'chat',
    target: 'composer',
  };
  if (event.type === 'toggleMode') {
    return {
      ...current,
      mode: current.mode === 'daily' ? 'ops' : 'daily',
    };
  }
  if (event.type === 'escape') {
    return {
      ...current,
      target: 'composer',
    };
  }
  if (event.type === 'section') {
    return {
      ...current,
      sectionId: event.sectionId,
      target: 'composer',
    };
  }
  if (event.type === 'target') {
    return {
      ...current,
      target: event.target,
    };
  }
  const currentIndex = Math.max(0, FOCUS_TARGETS.indexOf(current.target));
  const delta = event.type === 'shiftTab' ? -1 : 1;
  const nextIndex = (currentIndex + delta + FOCUS_TARGETS.length) % FOCUS_TARGETS.length;
  return {
    ...current,
    target: FOCUS_TARGETS[nextIndex],
  };
}

export function reduceTerminalShellCardSelection(
  state: TerminalShellCardSelectionState | undefined,
  event: TerminalShellCardSelectionEvent,
): TerminalShellCardSelectionState {
  const cards = event.cards || [];
  if (!cards.length) {
    return { selectedIndex: null };
  }
  if (event.type === 'select') {
    if (event.selectedIndex === null || event.selectedIndex === undefined) {
      return { selectedIndex: null };
    }
    return {
      selectedIndex: clampTerminalCardIndex(event.selectedIndex, cards.length),
    };
  }
  const currentIndex = state?.selectedIndex === null || state?.selectedIndex === undefined
    ? (event.type === 'previous' ? cards.length : -1)
    : clampTerminalCardIndex(state.selectedIndex, cards.length);
  const delta = event.type === 'previous' ? -1 : 1;
  return {
    selectedIndex: (currentIndex + delta + cards.length) % cards.length,
  };
}

export function resolveTerminalShellCardAction(input: {
  action: TerminalShellCardAction;
  cards: TerminalShellCard[];
  selection?: TerminalShellCardSelectionState | null;
}): TerminalShellCardActionResult {
  const selectedIndex = input.selection?.selectedIndex;
  const card = selectedIndex === null || selectedIndex === undefined
    ? null
    : input.cards[clampTerminalCardIndex(selectedIndex, input.cards.length)] || null;
  if (!card) {
    return {
      applied: false,
      action: input.action,
      card: null,
      command: null,
      notice: 'Select an approval card first.',
    };
  }
  if (card.kind !== 'approval') {
    return {
      applied: false,
      action: input.action,
      card,
      command: null,
      notice: 'Selected card is not an approval.',
    };
  }
  const planId = extractTerminalApprovalPlanId(card);
  if (!planId) {
    return {
      applied: false,
      action: input.action,
      card,
      command: null,
      notice: 'Selected approval card has no plan id.',
    };
  }
  const commandText = `hud --action ${input.action} --plan ${planId} --yes`;
  return {
    applied: true,
    action: input.action,
    card,
    command: commandText,
    notice: `${input.action[0].toUpperCase()}${input.action.slice(1)} sent for ${planId}.`,
  };
}

export function formatTerminalShellCardLine(card: TerminalShellCard, mode: TerminalShellMode = 'daily'): string {
  const title = cleanTerminalCardPart(card.title) || 'Activity';
  const status = cleanTerminalCardPart(card.status || '');
  const dailyStatus = status ? status.toLowerCase() : '';
  if (mode === 'daily') {
    if (card.kind === 'approval') {
      return status ? `${title} needs ${dailyStatus}` : `${title} needs review`;
    }
    if (card.kind === 'diff') {
      return status ? `${title} changed ${status}` : `${title} has a diff`;
    }
    return status ? `${title} is ${dailyStatus}` : title;
  }
  const body = Array.isArray(card.body) ? card.body : String(card.body || '').split(/\r?\n/);
  const detail = body.map(cleanTerminalCardPart).filter(Boolean).slice(0, 2).join(' | ');
  const commandText = cleanTerminalCardPart(card.command || '');
  return [
    status ? `${title} is ${dailyStatus}` : title,
    detail,
    commandText ? `run: ${commandText}` : '',
  ].filter(Boolean).join(' - ');
}

export function formatTerminalShellSelectableCardLine(input: {
  card: TerminalShellCard;
  mode?: TerminalShellMode;
  selected?: boolean;
}): string {
  const marker = input.selected ? '> ' : '  ';
  return `${marker}${formatTerminalShellProductCardLine(input.card, input.mode || 'daily')}`;
}

function formatTerminalShellProductCardLine(card: TerminalShellCard, mode: TerminalShellMode): string {
  const label = terminalShellCardKindLabel(card);
  const title = cleanTerminalCardPart(card.title) || 'Activity';
  const status = cleanTerminalCardPart(card.status || '');
  const base = [label, title, status].filter(Boolean);
  if (mode === 'daily') {
    if (card.kind === 'approval') {
      base.push('a/r/d');
    }
    return base.join(' | ');
  }
  const body = Array.isArray(card.body) ? card.body : String(card.body || '').split(/\r?\n/);
  const detail = body.map(cleanTerminalCardPart).filter(Boolean).slice(0, 2).join(' | ');
  const commandText = cleanTerminalCardPart(card.command || '');
  return [
    base.join(' | '),
    detail,
    commandText ? `run: ${commandText}` : '',
  ].filter(Boolean).join(' - ');
}

function terminalShellCardKindLabel(card: TerminalShellCard): string {
  switch (card.kind) {
    case 'approval':
      return 'Approval';
    case 'diff':
      return 'Diff';
    case 'tool':
      return 'Tool';
    case 'result':
      return 'Result';
    case 'status':
      return 'Status';
    default:
      return 'Activity';
  }
}

function clampTerminalCardIndex(index: number, count: number): number {
  if (count <= 0) {
    return 0;
  }
  return Math.min(count - 1, Math.max(0, Math.floor(index)));
}

function extractTerminalApprovalPlanId(card: TerminalShellCard): string | null {
  const text = [
    card.command || '',
    card.title || '',
    Array.isArray(card.body) ? card.body.join('\n') : card.body || '',
  ].join('\n');
  const candidates = [
    /(?:^|\s)(?:zavorth\s+)?approve\s+([A-Za-z0-9._:-]+)/i,
    /--plan(?:=|\s+)([A-Za-z0-9._:-]+)/i,
    /\bplan[:#]\s*([A-Za-z0-9._:-]+)/i,
    /\b(plan-[A-Za-z0-9._:-]+)\b/i,
  ];
  for (const pattern of candidates) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }
  return null;
}

function cleanTerminalCardPart(value: unknown): string {
  return filterTerminalComposerOutput(String(value || ''))
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatTerminalShellScreen(shell: TerminalShellSnapshot): string {
  const status = shell.activeRun ? 'running' : 'ready';
  const sections = shell.sections
    .map((section) => `${section.shortcut}:${section.title}`)
    .join('  ');
  const messages = shell.messages.length
    ? shell.messages.slice(-4).map((message) => `${message.role}: ${message.text}`).filter(Boolean)
    : ['assistant: Ready.'];
  const cards = shell.cards.slice(0, 5).map((card) => formatTerminalComposerInlineCard(card));
  const queue = shell.composer.queue.length
    ? shell.composer.queue.map((item) => `${item.status} ${item.kind}: ${item.text}`)
    : ['queue empty'];
  const receiptLine = shell.receipts.items.length
    ? `Receipts hidden (${shell.receipts.items.length}). Open with ${shell.receipts.openCommand}.`
    : 'Receipts hidden until there is evidence to review.';
  const lines = [
    'Zavorth Terminal Shell',
    `${shell.sessionId} / ${shell.profileId} / ${shell.providerLabel}:${shell.modelLabel} / ${status}`,
    '',
    sections,
    '',
    'Conversation',
    ...messages,
    '',
    ...(cards.length ? ['Cards', ...cards] : ['Cards', 'none']),
    '',
    'Composer',
    `bottom-bar: ${shell.composer.value || shell.composer.placeholder}`,
    shell.composer.multilineHint,
    shell.composer.voiceArmed ? 'voice: armed' : 'voice: off',
    '',
    'Queue',
    ...queue,
    '',
    receiptLine,
    '',
    shell.mode === 'ops' ? shell.footer.opsHint : shell.footer.dailyHint,
  ];
  return lines.filter((line) => line !== null && line !== undefined).join('\n');
}
