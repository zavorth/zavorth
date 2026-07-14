import { stdout as output } from 'process';
import { globalSpinner } from './presentation/TerminalSpinner.js';
import { TerminalPanel } from './presentation/TerminalPanel.js';
import type {
  ZavorthCliFlags,
  ZavorthCliIo,
  ZavorthCliRuntime,
  ZavorthCliServiceOverrides,
  CliExecutionResult,
  CliTerminalStreamEvent,
  CliReadlineFactory,
  CliRuntimeProfile,
  CliWriter,
} from './ZavorthCliContract.js';
import type { LegacyUnifiedGatewayAdapter } from '../context-engine/LegacyUnifiedGatewayAdapter.js';
import type { SurfaceTaskDispatcherLike, SurfaceControllerContext } from '../services/SurfaceRuntime.js';
import type { MessageChannel, TaskSource } from '../contracts/PlatformContract.js';
import { config } from '../config/index.js';
import {
  type UniversalAgentChannel,
  type UniversalAgentExecutor,
  type UniversalAgentRunResult,
  type UniversalAgentWorkflowJob,
} from '../runtime/agent/index.js';
import type { ZavorthResponseDecision } from '../contracts/ZavorthResponseDecisionContract.js';
import { SurfaceOperationalIntentService } from '../services/SurfaceOperationalIntentService.js';
import { resolveCliUniversalModelProfile } from './ZavorthCliModelPickerHelpers.js';
import { createDefaultSessionId } from './ZavorthCliReplHistoryHelpers.js';
import { ZavorthUserResponseRendererService } from '../services/ZavorthUserResponseRendererService.js';
import {
  formatCliChatAssistantMessage,
  formatCliChatCommandHint,
} from './ZavorthCliChatRenderers.js';
import {
  formatCliApprovalRequiredEventCard,
  formatCliChatReplyEventCard,
  formatCliRecoverableErrorEventCard,
  formatCliSuccessEventCard,
  formatCliCuratorNotificationCard,
} from './ZavorthCliEventCards.js';
import { formatTerminalComposerPrompt } from './ZavorthCliTerminalComposer.js';

export { buildCliReplCompleter, createDefaultSessionId, loadCliReplHistory, persistCliReplHistory } from './ZavorthCliReplHistoryHelpers.js';

import { safeParseInt } from '../ai-gateway/shared/utils/safeParseInt.js';
import { Database } from '../storage/Database.js';
import { asErrorLike } from '../utils/errorLike.js';
import { resolveCliLegacyUnifiedGateway } from './ZavorthCliRuntimeFlowHelpers.js';

export function defaultWriter(): CliWriter {
  return {
    line: (text: string) => {
      output.write(`${String(text || '')}\n`);
    },
    error: (text: string) => {
      if (process.stderr.isTTY && !process.argv.includes('--json')) {
        TerminalPanel.error(text, 'Zavorth Error');
      } else {
        process.stderr.write(`${String(text || '')}\n`);
      }
    },
  };
}

export function isCliIo(value: unknown): value is ZavorthCliIo {
  return Boolean(
    value &&
    typeof value === 'object' &&
    ('write' in (value as Record<string, unknown>) || 'error' in (value as Record<string, unknown>)),
  );
}

type CliSuppressedConsoleMethod = 'log' | 'info' | 'warn' | 'debug';

function suppressConsoleMethods(
  methods: CliSuppressedConsoleMethod[] = ['log', 'info', 'warn', 'debug'],
): Map<CliSuppressedConsoleMethod, typeof console.log> {
  const originals = new Map<CliSuppressedConsoleMethod, typeof console.log>();
  for (const method of methods) {
    originals.set(method, console[method]);
    console[method] = () => undefined;
  }

  return originals;
}

function restoreConsoleMethods(originals: Map<CliSuppressedConsoleMethod, typeof console.log>): void {
  originals.forEach((original, method) => {
    console[method] = original;
  });
}

function withSuppressedConsoleMethods<T>(
  fn: () => T,
  methods: CliSuppressedConsoleMethod[] = ['log', 'info', 'warn', 'debug'],
): T {
  const originals = suppressConsoleMethods(methods);

  try {
    return fn();
  } finally {
    restoreConsoleMethods(originals);
  }
}
export async function withCliConsoleSuppressedAsync<T>(fn: () => Promise<T>): Promise<T> {
  const originals = suppressConsoleMethods();
  try {
    return await fn();
  } finally {
    restoreConsoleMethods(originals);
  }
}

export function withFilteredCliStartupLogs<T>(fn: () => T): T {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const shouldIgnore = (args: unknown[]): boolean => {
    const message = args.map((entry) => String(entry ?? '')).join(' ');
    return /Tool registrada|Tool ".*" ja registrada/i.test(message);
  };

  console.log = (...args: unknown[]) => {
    if (shouldIgnore(args)) {
      return;
    }
    originalLog(...args);
  };
  console.warn = (...args: unknown[]) => {
    if (shouldIgnore(args)) {
      return;
    }
    originalWarn(...args);
  };

  try {
    return fn();
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
  }
}

export function isCliNativeReadCommand(commandName: string | null): boolean {
  return new Set([
    'help',
    'context',
    'status',
    'doctor',
    'gateway',
    'domains',
    'brief',
    'cockpit',
    'actions',
    'action',
    'sessions',
    'sessionhistory',
    'nodes',
    'nodepair',
    'nodeinvoke',
    'tools',
    'hooks',
    'aigateway',
    'capabilities',
    'tasks',
    'artifacts',
    'supervisor',
    'graph',
    'heal',
    'release',
    'workflows',
    'learning',
    'memory',
    'platform',
    'plugins',
  ]).has(String(commandName || '').trim().toLowerCase());
}

export function requiresCliTaskRuntime(commandName: string | null, normalized: string): boolean {
  if (!normalized) {
    return false;
  }

  if (normalized === 'quit' || normalized === 'exit') {
    return false;
  }

  const explicitTaskCommands = new Set([
    'sessionsend',
    'sessionspawn',
    'task',
    'auto',
    'plan',
    'continue',
    'run',
  ]);

  if (explicitTaskCommands.has(String(commandName || '').trim().toLowerCase())) {
    return true;
  }

  return false;
}

export function resolveCliRuntimeProfile(commandName: string | null, normalized: string): CliRuntimeProfile {
  if (requiresCliTaskRuntime(commandName, normalized)) {
    return 'task';
  }

  const lower = String(commandName || '').trim().toLowerCase();
  if (lower === 'ops' || lower === 'status' || lower === 'doctor' || lower === 'brief' || lower === 'cockpit') {
    return 'ops';
  }

  if (
    lower === 'gateway'
    || lower === 'domains'
    || lower === 'nodes'
    || lower === 'sessions'
    || lower === 'tools'
    || lower === 'hooks'
    || lower === 'aigateway'
    || lower === 'capabilities'
    || lower === 'tasks'
    || lower === 'artifacts'
    || lower === 'supervisor'
    || lower === 'graph'
    || lower === 'heal'
    || lower === 'release'
    || lower === 'workflows'
    || lower === 'learning'
    || lower === 'memory'
    || lower === 'platform'
    || lower === 'plugins'
    || lower === 'context'
  ) {
    return 'summary';
  }

  return 'surface';
}

export function requiresNodeDoctorRuntime(commandName: string | null, normalized: string): boolean {
  return String(commandName || '').trim().toLowerCase() === 'nodes' && /\bdoctor\b/i.test(normalized);
}

export function normalizeCliInput(raw: string): string {
  return String(raw || '').trim().replace(/\s+/g, ' ');
}

export function canonicalizeCliCommandInput(raw: string): string {
  const normalized = normalizeCliInput(raw);
  if (!normalized) {
    return '';
  }

  return normalized.replace(/^\/+/, '').trim();
}

export function normalizeCliCommandName(raw: string | null | undefined): string | null {
  const normalized = String(raw || '').trim();
  if (!normalized) {
    return null;
  }
  const first = normalized.replace(/^\/+/, '').split(/\s+/)[0] || null;
  if (!first) {
    return null;
  }
  const lower = first.toLowerCase();
  const aliases: Record<string, string> = {
    ctx: 'context',
    ops: 'cockpit',
    memoryplane: 'memory',
    sessionplane: 'sessions',
    hookplane: 'hooks',
    aigateway: 'aigateway',
  };
  return aliases[lower] || lower;
}

export function extractCommandArgs(raw: string): string {
  const normalized = String(raw || '').trim();
  const index = normalized.indexOf(' ');
  return index >= 0 ? normalized.slice(index + 1).trim() : '';
}

export function applyInlineCliFlags(
  rawInput: string,
  flags: ZavorthCliFlags,
): {
  input: string;
  flags: ZavorthCliFlags;
} {
  const normalized = String(rawInput || '').trim();
  let input = normalized;
  const nextFlags = { ...flags };
  if (/\s--json\b/i.test(input)) {
    nextFlags.json = true;
    input = input.replace(/\s--json\b/gi, '');
  }
  if (/\s--live\b/i.test(input)) {
    nextFlags.live = true;
    input = input.replace(/\s--live\b/gi, '');
  }
  return { input: input.trim(), flags: nextFlags };
}

export function buildCliDispatchTarget(flags: ZavorthCliFlags): {
  platform: string;
  chatId: string;
  sessionId: string | null;
  sourceUserId: string | null;
} {
  return {
    platform: flags.platform,
    chatId: flags.chatId,
    sessionId: flags.sessionId || null,
    sourceUserId: flags.userId || null,
  };
}

export function isCliReplNewConversationCommand(raw: string): boolean {
  const normalized = String(raw || '').trim().toLowerCase().replace(/^\/+/, '');
  return normalized === 'new' || normalized === 'reset' || normalized === 'nova conversa' || normalized === 'nova';
}

export function createCliReplConversationFlags(flags: ZavorthCliFlags): ZavorthCliFlags {
  const sessionId = createDefaultSessionId();
  return {
    ...flags,
    sessionId,
    chatId: `web:${sessionId}`,
  };
}

export function parseCliReplSwitchConversationTarget(raw: string): string | null {
  const normalized = String(raw || '').trim();
  const lower = normalized.toLowerCase();
  if (!lower.startsWith('switch ') && !lower.startsWith('open ')) {
    return null;
  }
  const keyword = lower.startsWith('open ') ? 'open ' : 'switch ';
  return normalized.slice(keyword.length).trim() || null;
}

export function createCliReplSwitchConversationFlags(flags: ZavorthCliFlags, targetRef: string): ZavorthCliFlags {
  const normalizedTarget = String(targetRef || '').trim() || flags.sessionId;
  const chatId = normalizedTarget.includes(':')
    ? normalizedTarget
    : `web:${normalizedTarget}`;
  return {
    ...flags,
    sessionId: normalizedTarget,
    chatId,
  };
}

export function formatCliNewConversationMessage(flags: ZavorthCliFlags): string {
  const historyHint = formatCliHistoryHint(flags.sessionId);
  return formatCliChatAssistantMessage({
    title: 'New conversation ready',
    body: 'You are still in the same terminal. Send a request whenever you are ready.',
    hints: [
      formatCliChatCommandHint('Review later', historyHint),
    ].filter(Boolean) as string[],
  });
}

export function formatCliSwitchedConversationMessage(flags: ZavorthCliFlags): string {
  const historyHint = formatCliHistoryHint(flags.sessionId);
  return formatCliChatAssistantMessage({
    title: 'Conversation resumed',
    body: 'You are still in the same terminal. Send "continue" or start a new request.',
    hints: [
      formatCliChatCommandHint('Review later', historyHint),
    ].filter(Boolean) as string[],
  });
}

export function extractCliMeaningfulReplies(replies: string[], placeholderPattern: RegExp): string[] {
  return replies
    .map((reply) => String(reply || '').trim())
    .filter(Boolean)
    .filter((reply) => !placeholderPattern.test(reply));
}

export function formatCliConversationLabel(normalized: string): string {
  const trimmed = String(normalized || '').trim();
  if (!trimmed) {
    return '(empty)';
  }
  if (trimmed.startsWith('/task ')) {
    return trimmed.slice('/task '.length).trim() || '/task';
  }
  if (trimmed.startsWith('task ')) {
    return trimmed.slice('task '.length).trim() || 'task';
  }
  return trimmed;
}

export function formatCliContinueHint(sessionId: string | null | undefined): string | null {
  const trimmedSessionId = String(sessionId || '').trim();
  if (!trimmedSessionId) {
    return null;
  }

  return `zavorth --session ${trimmedSessionId} continue`;
}

export function formatCliHistoryHint(sessionId: string | null | undefined): string | null {
  const trimmedSessionId = String(sessionId || '').trim();
  if (!trimmedSessionId) {
    return null;
  }

  return `history ${trimmedSessionId}`;
}

export function formatCliReplPrompt(flags: Pick<ZavorthCliFlags, 'sessionId' | 'chatId'>): string {
  return formatTerminalComposerPrompt(flags);
}

export function formatCliTaskDispatchOutput(
  normalized: string,
  result: Awaited<ReturnType<SurfaceTaskDispatcherLike['dispatchTaskMessage']>>,
  replies: string[],
  sessionId: string | null = null,
  echoInput = true,
  compactMode = false,
): string {
  const taskId = String(result.task?.task_id || '').trim() || 'n/d';
  const commandType = String(result.parsed?.command_type || '').trim() || '/task';
  const trimmed = String(normalized || '').trim().toLowerCase();
  const isContinue =
    trimmed === '/task continue'
    || trimmed.startsWith('/task continue ')
    || trimmed === '/task continuar'
    || trimmed.startsWith('/task continuar ')
    || trimmed === 'task continue'
    || trimmed.startsWith('task continue ')
    || trimmed === 'task continuar'
    || trimmed.startsWith('task continuar ');
  const conversationLabel = formatCliConversationLabel(normalized);
  const meaningfulReplies = extractCliMeaningfulReplies(replies, /^task dispatched\b/i);
  const trimmedSessionId = String(sessionId || '').trim() || null;
  const continueHint = formatCliContinueHint(trimmedSessionId);
  const historyHint = formatCliHistoryHint(trimmedSessionId);

  if (compactMode) {
    const openingLine = isContinue
      ? 'I am resuming that now.'
      : 'I have the request and started working.';
    const eventReply = meaningfulReplies
      .map((reply) => formatCliChatReplyEventCard(reply))
      .find(Boolean);
    if (eventReply) {
      return eventReply;
    }
    const bodyLines = meaningfulReplies.length > 0
      ? [openingLine, '', ...meaningfulReplies]
      : [openingLine];
    return formatCliSuccessEventCard({
      title: 'Started',
      body: bodyLines,
      hints: [
        formatCliChatCommandHint('Review later', historyHint),
      ].filter(Boolean) as string[],
    });
  }

  const lines = [
    echoInput ? `Request: ${conversationLabel}` : null,
    `Zavorth: ${isContinue ? 'I am resuming that now.' : 'I have the request and started working.'}`,
    `- task: ${taskId}`,
    `- command: ${commandType}`,
    `- operator: ${result.runtimeUserId}`,
    trimmedSessionId ? `- session: ${trimmedSessionId}` : null,
  ];
  const baseLines = lines.filter(Boolean) as string[];

  if (meaningfulReplies.length === 0) {
    baseLines.push(
      isContinue
        ? '- status: Zavorth started resuming this work.'
        : '- status: Zavorth started working on this request.',
    );
    baseLines.push(
      trimmedSessionId
        ? `- next: review with \`history ${trimmedSessionId}\` or keep talking here.`
        : '- next: review with `history` or keep talking here.',
    );
    if (continueHint) {
      baseLines.push(`- continue: ${continueHint}`);
    }
    return baseLines.join('\n');
  }

  return [
    ...baseLines,
    '',
    'Runtime reply:',
    ...meaningfulReplies.map((reply) => `- ${reply}`),
    ...(continueHint ? [`- continue: ${continueHint}`] : []),
  ].join('\n');
}

export function describeCliSharedSurfaceProductCommand(normalized: string): {
  title: string;
  status: string;
} | null {
  const trimmed = String(normalized || '').trim().toLowerCase();
  if (trimmed.startsWith('/approve ')) {
    return {
      title: 'Approval sent to Zavorth',
      status: 'the runtime received the approval for this task.',
    };
  }
  if (trimmed.startsWith('/reject ')) {
    return {
      title: 'Rejection sent to Zavorth',
      status: 'the runtime received the rejection for this task.',
    };
  }
  if (trimmed.startsWith('/workflow resume ')) {
    return {
      title: 'Workflow resume sent',
      status: 'the runtime received the workflow resume request.',
    };
  }
  if (trimmed.startsWith('/workflow restart-stage ')) {
    return {
      title: 'Stage restart sent',
      status: 'the runtime received the stage restart request.',
    };
  }
  if (trimmed.startsWith('/workflow close ')) {
    return {
      title: 'Workflow close sent',
      status: 'the runtime received the request to close this workflow.',
    };
  }
  return null;
}

export function formatCliSharedSurfaceProductOutput(
  normalized: string,
  replies: string[],
  echoInput = true,
  compactMode = false,
): string | null {
  const descriptor = describeCliSharedSurfaceProductCommand(normalized);
  if (!descriptor) {
    return null;
  }

  const meaningfulReplies = extractCliMeaningfulReplies(replies, /^handled \//i);
  const conversationLabel = formatCliConversationLabel(normalized.replace(/^\//, ''));
  if (compactMode) {
    const eventReply = meaningfulReplies
      .map((reply) => formatCliChatReplyEventCard(reply))
      .find(Boolean);
    if (eventReply) {
      return eventReply;
    }

    return formatCliSuccessEventCard({
      title: 'Done',
      body: meaningfulReplies.length > 0
        ? [descriptor.title, ...meaningfulReplies]
        : descriptor.title,
      hints: meaningfulReplies.length > 0
        ? []
        : [descriptor.status],
    });
  }

  const lines = [
    echoInput ? `Request: ${conversationLabel}` : null,
    `Zavorth: ${descriptor.title}`,
    `- command: ${normalized}`,
  ].filter(Boolean) as string[];

  if (meaningfulReplies.length === 0) {
    lines.push(`- status: ${descriptor.status}`);
    lines.push('- next: keep watching this terminal or review the session history.');
    return lines.join('\n');
  }

  return [
    ...lines,
    '',
    'Runtime reply:',
    ...meaningfulReplies.map((reply) => `- ${reply}`),
  ].join('\n');
}

export function formatCliSessionPlaneOutput(
  mode: 'overview' | 'history',
  rawBody: string,
  args: string,
  currentSessionId: string | null = null,
): string {
  const trimmedArgs = String(args || '').trim();
  const continueHint = formatCliContinueHint(trimmedArgs);
  if (mode === 'history') {
    return [
      'Conversation history',
      trimmedArgs ? `- session: ${trimmedArgs}` : null,
      continueHint ? `- next: ${continueHint}` : '- next: use continue or run to resume from here.',
      trimmedArgs ? `- replay: history ${trimmedArgs}` : null,
      '',
      String(rawBody || '').trim(),
    ].filter(Boolean).join('\n');
  }

  return [
    'Zavorth conversations',
    '- next: use history <sessionId> to open a specific conversation.',
    currentSessionId ? `- current session: ${currentSessionId}` : null,
    currentSessionId ? `- open replay: history ${currentSessionId}` : null,
    currentSessionId ? `- switch in chat: use ${currentSessionId} or switch ${currentSessionId}` : null,
    '',
    String(rawBody || '').trim(),
  ].filter(Boolean).join('\n');
}

export async function executeCliTaskDispatch(
  dispatcher: SurfaceTaskDispatcherLike,
  normalized: string,
  flags: ZavorthCliFlags,
  writer: CliWriter,
): Promise<CliExecutionResult> {
  const replies: string[] = [];
  const target = buildCliDispatchTarget(flags);
    const numericUserId = safeParseInt(String(flags.userId || '').trim(), 1);
  const ctx = {
    platform: flags.platform,
    userId: flags.userId,
    chatId: target.chatId,
    isGroup: false,
    rawText: normalized,
    transport: normalized.startsWith('/') ? 'slash_command' : 'text',
    composerPayload: null,
    from: {
      id: numericUserId,
      username: 'cli',
    },
    api: {
      sendChatAction: async () => undefined,
    },
    reply: async (text: string) => {
      replies.push(String(text || '').trim() || '(empty message)');
      return {};
    },
    editMessage: async () => undefined,
  } as SurfaceControllerContext;

  const trimmed = String(normalized || '').trim();
  const dispatchText = trimmed === 'task'
    ? '/task'
    : trimmed.startsWith('task ')
      ? `/task ${trimmed.slice('task '.length).trim()}`
      : trimmed;

  const showSpinner = !flags.json && process.stdout.isTTY;
  if (showSpinner) {
    globalSpinner.start('Dispatching task...');
  }

  try {
    const result = await dispatcher.dispatchTaskMessage({
      ctx,
      platform: flags.platform as MessageChannel,
      chatId: target.chatId,
      text: dispatchText,
      sourceUserId: target.sourceUserId || flags.userId || 'cli-operator',
      fallbackRuntimeUserId: target.sourceUserId || flags.userId || 'cli-operator',
      source: flags.platform as TaskSource,
      sessionId: target.sessionId,
      chatHint: target.chatId,
      surfacePolicy: {
        publicServerMode: false,
        forceApprovalForExecution: false,
        transport: dispatchText.startsWith('/') ? 'slash_command' : 'text',
      },
    });

    if (showSpinner) {
      globalSpinner.succeed('Task dispatched');
    }

    if (flags.json) {
      const body = JSON.stringify(
        {
          ok: true,
          taskId: String(result.task?.task_id || '').trim() || null,
          commandType: String(result.parsed?.command_type || '').trim() || null,
          runtimeUserId: result.runtimeUserId,
          tenantId: result.tenantId,
          tenantContext: result.tenantContext || null,
          replies,
        },
        null,
        2,
      );
      writer.line(body);
      return { ok: true, handled: true, output: [body], error: null };
    }

    const body = formatCliTaskDispatchOutput(
      trimmed,
      result,
      replies,
      target.sessionId,
      !flags.repl,
      flags.repl,
    );
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  } catch (error: unknown) {
    const err = asErrorLike(error);
    if (showSpinner) {
      globalSpinner.fail('Failed to dispatch the task');
    }
    const message = `I could not dispatch this task through the CLI: ${err.message}`;
    if (flags.repl) {
      const body = formatCliRecoverableErrorEventCard({
        body: message,
        command: 'doctor',
      });
      writer.line(body);
      return {
        ok: false,
        handled: true,
        output: [body],
        error: message,
      };
    }
    writer.error(message);
    return {
      ok: false,
      handled: true,
      output: [],
      error: message,
    };
  }
}

async function executeCliUniversalFallback(input: {
  runtime: ZavorthCliRuntime;
  normalized: string;
  flags: ZavorthCliFlags;
  sourceChannel?: UniversalAgentChannel | null;
}): Promise<{
  replyText: string;
  summary: string;
  metadata?: Record<string, unknown>;
}> {
  const { runtime, normalized, flags, sourceChannel } = input;
  const trimmed = String(normalized || '').trim();
  const replies: string[] = [];

  const legacyUnifiedGateway = resolveCliLegacyUnifiedGateway(runtime);
  if (legacyUnifiedGateway) {
    const result = await legacyUnifiedGateway.handleEvent({
      surface: flags.platform,
      chatId: flags.chatId,
      userId: flags.userId,
      text: trimmed,
      isGroup: false,
      reply: async (text: string) => {
        replies.push(String(text || '').trim() || '(empty message)');
      },
      metadata: {
        channel: sourceChannel || 'cli',
        stage: 'universal-agent-cli-v1',
        sessionId: flags.sessionId,
        workspaceContext: flags.workspaceHint || null,
        transport: trimmed.startsWith('/') ? 'slash_command' : 'text',
        cli: true,
      },
    });
    const outputReplies = Array.from(new Set(
      [...replies, String(result.responseText || '').trim()]
        .map((entry) => String(entry || '').trim())
        .filter(Boolean),
    ));
    const replyText = outputReplies.join('\n\n') || 'Request processed by the universal runtime.';
    return {
      replyText,
      summary: 'Request routed through the universal runtime to the conversation gateway.',
      metadata: {
        delegatedTo: 'legacy_unified_gateway_adapter',
        surface: result.surface,
        intentCategory: result.intentCategory,
      },
    };
  }

  if (runtime.surfaceTaskDispatcher) {
    const target = buildCliDispatchTarget(flags);
  const numericUserId = safeParseInt(String(flags.userId || '').trim(), 1);
    const dispatchText = trimmed === 'task'
      ? '/task'
      : trimmed.startsWith('task ')
        ? `/task ${trimmed.slice('task '.length).trim()}`
        : trimmed;
    const ctx = {
      platform: flags.platform,
      userId: flags.userId,
      chatId: target.chatId,
      isGroup: false,
      rawText: trimmed,
      transport: dispatchText.startsWith('/') ? 'slash_command' : 'text',
      composerPayload: null,
      from: {
        id: numericUserId,
        username: 'cli',
      },
      api: {
        sendChatAction: async () => undefined,
      },
      reply: async (text: string) => {
        replies.push(String(text || '').trim() || '(empty message)');
        return {};
      },
      editMessage: async () => undefined,
    } as SurfaceControllerContext;

    const result = await runtime.surfaceTaskDispatcher.dispatchTaskMessage({
      ctx,
      platform: flags.platform as MessageChannel,
      chatId: target.chatId,
      text: dispatchText,
      sourceUserId: target.sourceUserId || flags.userId || 'cli-operator',
      fallbackRuntimeUserId: target.sourceUserId || flags.userId || 'cli-operator',
      source: flags.platform as TaskSource,
      sessionId: target.sessionId,
      chatHint: target.chatId,
      surfacePolicy: {
        publicServerMode: false,
        forceApprovalForExecution: false,
        transport: dispatchText.startsWith('/') ? 'slash_command' : 'text',
      },
    });
    const taskId = String(result.task?.task_id || '').trim();
    const replyText = extractCliMeaningfulReplies(replies, /^task dispatched\b/i).join('\n\n')
      || (taskId
        ? 'I have the request and started working.'
        : 'Request routed through the universal runtime.');
    return {
      replyText,
      summary: taskId
        ? 'Request routed through the universal runtime for supervised execution.'
        : 'Request processed by the universal runtime.',
      metadata: {
        delegatedTo: 'surface_task_dispatcher',
        taskId: taskId || null,
        commandType: String(result.parsed?.command_type || '').trim() || null,
      },
    };
  }

  return {
    replyText: 'I received the request. The universal runtime recorded the conversation, but no live executor is connected on this surface.',
    summary: 'Request recorded by the universal runtime without a connected executor.',
    metadata: {
      delegatedTo: 'none',
    },
  };
}

export function createCliUniversalExecutor(
  runtime: ZavorthCliRuntime,
  normalized: string,
  flags: ZavorthCliFlags,
): UniversalAgentExecutor {
  const trimmed = String(normalized || '').trim();
  return async () => {
    const delegated = await executeCliUniversalFallback({
      runtime,
      normalized: trimmed,
      flags,
    });
    return {
      status: 'completed',
      summary: delegated.summary,
      replyText: delegated.replyText,
      events: [
        {
          kind: 'tool',
          title: 'Superficie CLI roteada',
          detail: `Execucao delegada para ${String(delegated.metadata?.delegatedTo || 'executor')}.`,
          status: 'done',
          metadata: delegated.metadata,
        },
      ],
      metadata: delegated.metadata,
    };
  };
}

function resolveCliWorkflowExecutorPlatform(
  channel: UniversalAgentChannel | null | undefined,
  fallback: ZavorthCliFlags['platform'],
): ZavorthCliFlags['platform'] {
  if (channel === 'telegram' || channel === 'web') {
    return channel;
  }
  if (channel === 'cli') {
    return fallback || 'web';
  }
  return fallback || 'web';
}

export function createCliWorkflowQueueExecutor(
  runtime: ZavorthCliRuntime,
  flags: ZavorthCliFlags,
): UniversalAgentExecutor {
  return async ({ request }) => {
    const originalInput = String(
      request.metadata?.originalInput
        || request.text
        || '',
    ).trim();
    const delegated = await executeCliUniversalFallback({
      runtime,
      normalized: originalInput,
      sourceChannel: request.channel,
      flags: {
        ...flags,
        platform: resolveCliWorkflowExecutorPlatform(request.channel, flags.platform),
        sessionId: String(request.sessionId || flags.sessionId || '').trim() || flags.sessionId,
        workspaceHint: String(request.workspace || flags.workspaceHint || '').trim() || flags.workspaceHint,
      },
    });
    return {
      status: 'completed',
      summary: delegated.summary,
      replyText: delegated.replyText,
      events: [
        {
          kind: 'tool',
          title: 'Durable workflow processed',
          detail: `Execution delegated to ${String(delegated.metadata?.delegatedTo || 'executor')}.`,
          status: 'done',
          metadata: {
            ...(delegated.metadata || {}),
            sourceChannel: request.channel,
          },
        },
      ],
      metadata: {
        ...(delegated.metadata || {}),
        workflowQueueWorker: 'cli',
      },
    };
  };
}

export function parseWorkflowQueueLimit(args: string): number | undefined {
  const tokens = String(args || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index] || '';
    const inline = token.match(/^--limit=(\d+)$/i);
    if (inline) {
      return Math.max(1, safeParseInt(inline[1], 1));
    }
    if (token === '--limit' && tokens[index + 1]) {
      return Math.max(1, safeParseInt(tokens[index + 1], 1));
    }
    if (/^\d+$/.test(token)) {
      return Math.max(1, safeParseInt(token, 1));
    }
  }

  return undefined;
}

export function resolveWorkflowQueueAction(args: string): 'status' | 'process' | 'unknown' {
  const first = String(args || '').trim().split(/\s+/)[0]?.toLowerCase() || '';
  if (!first || first === 'status' || first === 'list' || first === 'ls' || first === 'queue') {
    return 'status';
  }
  if (first === 'process' || first === 'run' || first === 'drain' || first === 'worker') {
    return 'process';
  }
  return 'unknown';
}

export function buildWorkflowJobCounts(jobs: UniversalAgentWorkflowJob[]): Record<string, number> {
  const counts: Record<string, number> = {
    total: jobs.length,
    waiting_approval: 0,
    queued: 0,
    running: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
  };
  for (const job of jobs) {
    counts[job.status] = (counts[job.status] || 0) + 1;
  }
  return counts;
}

export function formatWorkflowJobCounts(counts: Record<string, number>): string {
  return [
    `waiting approval ${counts.waiting_approval || 0}`,
    `queued ${counts.queued || 0}`,
    `running ${counts.running || 0}`,
    `completed ${counts.completed || 0}`,
    `failed ${counts.failed || 0}`,
  ].join('  -  ');
}

export function summarizeWorkflowQueueJobs(jobs: UniversalAgentWorkflowJob[], limit = 5): string[] {
  return jobs.slice(0, limit).map((job) => [
    `${job.status}`,
    job.id,
    `run ${job.runId}`,
    job.lastError ? `error: ${job.lastError}` : '',
  ].filter(Boolean).join('  -  '));
}

export * from './ZavorthCliRuntimeFlowHelpers.js';
