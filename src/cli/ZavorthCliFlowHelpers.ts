import { stdout as output } from 'process';
import type {
  ZavorthCliFlags,
  ZavorthCliIo,
  ZavorthCliRuntime,
  ZavorthCliServiceOverrides,
  CliExecutionResult,
  CliReadlineFactory,
  CliRuntimeProfile,
  CliWriter,
} from './ZavorthCliContract.js';
import type { LegacyUnifiedGatewayAdapter } from '../context-engine/LegacyUnifiedGatewayAdapter.js';
import type { SurfaceTaskDispatcherLike } from '../services/SurfaceRuntime.js';
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
export { buildCliReplCompleter, createDefaultSessionId, loadCliReplHistory, persistCliReplHistory } from './ZavorthCliReplHistoryHelpers.js';
import {
  formatCliChatAssistantMessage,
  formatCliChatCommandHint,
} from './ZavorthCliChatRenderers.js';
import {
  formatCliApprovalRequiredEventCard,
  formatCliChatReplyEventCard,
  formatCliRecoverableErrorEventCard,
  formatCliSuccessEventCard,
} from './ZavorthCliEventCards.js';

export function defaultWriter(): CliWriter {
  return {
    line: (text: string) => {
      output.write(`${String(text || '')}\n`);
    },
    error: (text: string) => {
      process.stderr.write(`${String(text || '')}\n`);
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
    title: 'Nova conversa pronta',
    body: 'Voce continua no mesmo terminal. Escreva seu pedido quando quiser.',
    hints: [
      formatCliChatCommandHint('Para revisar depois', historyHint),
    ].filter(Boolean) as string[],
  });
}

export function formatCliSwitchedConversationMessage(flags: ZavorthCliFlags): string {
  const historyHint = formatCliHistoryHint(flags.sessionId);
  return formatCliChatAssistantMessage({
    title: 'Conversa retomada',
    body: 'Voce continua no mesmo terminal. Escreva continue ou mande um novo pedido.',
    hints: [
      formatCliChatCommandHint('Para revisar depois', historyHint),
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
    return '(vazio)';
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
  void flags;
  return '> ';
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
      ? 'Vou retomar isso agora.'
      : 'Recebi seu pedido e ja comecei a trabalhar.';
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
      title: 'Pronto',
      body: bodyLines,
      hints: [
        formatCliChatCommandHint('Para revisar depois', historyHint),
      ].filter(Boolean) as string[],
    });
  }

  const lines = [
    echoInput ? `Pedido: ${conversationLabel}` : null,
    `Zavorth: ${isContinue ? 'Vou retomar isso agora.' : 'Recebi esse pedido e ja comecei a trabalhar.'}`,
    `- task: ${taskId}`,
    `- comando: ${commandType}`,
    `- operador: ${result.runtimeUserId}`,
    trimmedSessionId ? `- sessao: ${trimmedSessionId}` : null,
  ];
  const baseLines = lines.filter(Boolean) as string[];

  if (meaningfulReplies.length === 0) {
    baseLines.push(
      isContinue
        ? '- status: Zavorth ja comecou a retomar esse trabalho.'
        : '- status: Zavorth ja comecou a trabalhar nesse pedido.',
    );
    baseLines.push(
      trimmedSessionId
        ? `- proximo passo: acompanhe por \`history ${trimmedSessionId}\` ou siga conversando no terminal.`
        : '- proximo passo: acompanhe por `history` ou siga conversando no terminal.',
    );
    if (continueHint) {
      baseLines.push(`- continue daqui: ${continueHint}`);
    }
    return baseLines.join('\n');
  }

  return [
    ...baseLines,
    '',
    'Resposta imediata do runtime:',
    ...meaningfulReplies.map((reply) => `- ${reply}`),
    ...(continueHint ? [`- continue daqui: ${continueHint}`] : []),
  ].join('\n');
}

export function describeCliSharedSurfaceProductCommand(normalized: string): {
  title: string;
  status: string;
} | null {
  const trimmed = String(normalized || '').trim().toLowerCase();
  if (trimmed.startsWith('/approve ')) {
    return {
      title: 'Aprovacao enviada ao Zavorth',
      status: 'o runtime recebeu a aprovacao desta tarefa.',
    };
  }
  if (trimmed.startsWith('/reject ')) {
    return {
      title: 'Rejeicao enviada ao Zavorth',
      status: 'o runtime recebeu a rejeicao desta tarefa.',
    };
  }
  if (trimmed.startsWith('/workflow resume ')) {
    return {
      title: 'Retomada de workflow enviada',
      status: 'o runtime recebeu a retomada do workflow.',
    };
  }
  if (trimmed.startsWith('/workflow restart-stage ')) {
    return {
      title: 'Reinicio de etapa enviado',
      status: 'o runtime recebeu o pedido para reexecutar a etapa.',
    };
  }
  if (trimmed.startsWith('/workflow close ')) {
    return {
      title: 'Encerramento de workflow enviado',
      status: 'o runtime recebeu o pedido para encerrar esse workflow.',
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
      title: 'Pronto',
      body: meaningfulReplies.length > 0
        ? [descriptor.title, ...meaningfulReplies]
        : descriptor.title,
      hints: meaningfulReplies.length > 0
        ? []
        : [descriptor.status],
    });
  }

  const lines = [
    echoInput ? `Pedido: ${conversationLabel}` : null,
    `Zavorth: ${descriptor.title}`,
    `- comando: ${normalized}`,
  ].filter(Boolean) as string[];

  if (meaningfulReplies.length === 0) {
    lines.push(`- status: ${descriptor.status}`);
    lines.push('- proximo passo: acompanhe a resposta no terminal ou pelo historico da sessao.');
    return lines.join('\n');
  }

  return [
    ...lines,
    '',
    'Resposta imediata do runtime:',
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
      'Historico da conversa',
      trimmedArgs ? `- sessao: ${trimmedArgs}` : null,
      continueHint ? `- proximo passo: ${continueHint}` : '- proximo passo: use continue ou run para retomar a partir daqui.',
      trimmedArgs ? `- replay: history ${trimmedArgs}` : null,
      '',
      String(rawBody || '').trim(),
    ].filter(Boolean).join('\n');
  }

  return [
    'Conversas do Zavorth',
    '- proximo passo: use history <sessionId> para abrir uma conversa especifica.',
    currentSessionId ? `- conversa atual: ${currentSessionId}` : null,
    currentSessionId ? `- abrir replay: history ${currentSessionId}` : null,
    currentSessionId ? `- trocar no chat: use ${currentSessionId} ou switch ${currentSessionId}` : null,
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
  const numericUserId = Number.parseInt(String(flags.userId || '').trim(), 10) || 1;
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
      replies.push(String(text || '').trim() || '(mensagem vazia)');
      return {};
    },
    editMessage: async () => undefined,
  } as any;

  const trimmed = String(normalized || '').trim();
  const dispatchText = trimmed === 'task'
    ? '/task'
    : trimmed.startsWith('task ')
      ? `/task ${trimmed.slice('task '.length).trim()}`
      : trimmed;

  try {
    const result = await dispatcher.dispatchTaskMessage({
      ctx,
      platform: flags.platform as any,
      chatId: target.chatId,
      text: dispatchText,
      sourceUserId: target.sourceUserId || flags.userId || 'cli-operator',
      fallbackRuntimeUserId: target.sourceUserId || flags.userId || 'cli-operator',
      source: flags.platform as any,
      sessionId: target.sessionId,
      chatHint: target.chatId,
      surfacePolicy: {
        publicServerMode: false,
        forceApprovalForExecution: false,
        transport: dispatchText.startsWith('/') ? 'slash_command' : 'text',
      },
    });

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
  } catch (error: any) {
    const message = `Nao consegui despachar essa tarefa pela CLI: ${error.message}`;
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
        replies.push(String(text || '').trim() || '(mensagem vazia)');
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
    const replyText = outputReplies.join('\n\n') || 'Pedido processado pelo runtime universal.';
    return {
      replyText,
      summary: 'Pedido encaminhado pelo runtime universal para o gateway conversacional.',
      metadata: {
        delegatedTo: 'legacy_unified_gateway_adapter',
        surface: result.surface,
        intentCategory: result.intentCategory,
      },
    };
  }

  if (runtime.surfaceTaskDispatcher) {
    const target = buildCliDispatchTarget(flags);
    const numericUserId = Number.parseInt(String(flags.userId || '').trim(), 10) || 1;
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
        replies.push(String(text || '').trim() || '(mensagem vazia)');
        return {};
      },
      editMessage: async () => undefined,
    } as any;

    const result = await runtime.surfaceTaskDispatcher.dispatchTaskMessage({
      ctx,
      platform: flags.platform as any,
      chatId: target.chatId,
      text: dispatchText,
      sourceUserId: target.sourceUserId || flags.userId || 'cli-operator',
      fallbackRuntimeUserId: target.sourceUserId || flags.userId || 'cli-operator',
      source: flags.platform as any,
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
        ? 'Recebi esse pedido e ja comecei a trabalhar.'
        : 'Pedido encaminhado pelo runtime universal.');
    return {
      replyText,
      summary: taskId
        ? 'Pedido encaminhado pelo runtime universal para execucao supervisionada.'
        : 'Pedido processado pelo runtime universal.',
      metadata: {
        delegatedTo: 'surface_task_dispatcher',
        taskId: taskId || null,
        commandType: String(result.parsed?.command_type || '').trim() || null,
      },
    };
  }

  return {
    replyText: 'Recebi o pedido. O runtime universal registrou a conversa, mas nenhum executor real esta conectado nesta superficie.',
    summary: 'Pedido registrado no runtime universal sem executor conectado.',
    metadata: {
      delegatedTo: 'none',
    },
  };
}

function createCliUniversalExecutor(
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

function createCliWorkflowQueueExecutor(
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
          title: 'Workflow duravel processado',
          detail: `Execucao delegada para ${String(delegated.metadata?.delegatedTo || 'executor')}.`,
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

function parseWorkflowQueueLimit(args: string): number | undefined {
  const tokens = String(args || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index] || '';
    const inline = token.match(/^--limit=(\d+)$/i);
    if (inline) {
      return Math.max(1, Number.parseInt(inline[1], 10) || 1);
    }
    if (token === '--limit' && tokens[index + 1]) {
      return Math.max(1, Number.parseInt(tokens[index + 1], 10) || 1);
    }
    if (/^\d+$/.test(token)) {
      return Math.max(1, Number.parseInt(token, 10) || 1);
    }
  }

  return undefined;
}

function resolveWorkflowQueueAction(args: string): 'status' | 'process' | 'unknown' {
  const first = String(args || '').trim().split(/\s+/)[0]?.toLowerCase() || '';
  if (!first || first === 'status' || first === 'list' || first === 'ls' || first === 'queue') {
    return 'status';
  }
  if (first === 'process' || first === 'run' || first === 'drain' || first === 'worker') {
    return 'process';
  }
  return 'unknown';
}

function buildWorkflowJobCounts(jobs: UniversalAgentWorkflowJob[]): Record<string, number> {
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

function formatWorkflowJobCounts(counts: Record<string, number>): string {
  return [
    `aguardando aprovacao ${counts.waiting_approval || 0}`,
    `na fila ${counts.queued || 0}`,
    `rodando ${counts.running || 0}`,
    `concluidos ${counts.completed || 0}`,
    `falharam ${counts.failed || 0}`,
  ].join('  -  ');
}

function summarizeWorkflowQueueJobs(jobs: UniversalAgentWorkflowJob[], limit = 5): string[] {
  return jobs.slice(0, limit).map((job) => [
    `${job.status}`,
    job.id,
    `run ${job.runId}`,
    job.lastError ? `erro: ${job.lastError}` : '',
  ].filter(Boolean).join('  -  '));
}

export async function executeCliWorkflowQueueCommand(
  runtime: ZavorthCliRuntime,
  args: string,
  flags: ZavorthCliFlags,
  writer: CliWriter,
): Promise<CliExecutionResult | null> {
  const agentGateway = runtime.agentGateway || null;
  if (!agentGateway) {
    const error = 'Workflow queue indisponivel nesta instancia da CLI.';
    if (flags.json) {
      const body = JSON.stringify({
        ok: false,
        mode: 'workflow_queue',
        error,
      }, null, 2);
      writer.line(body);
      return { ok: false, handled: true, output: [body], error };
    }
    const body = formatCliRecoverableErrorEventCard({
      body: error,
      command: 'doctor',
    });
    writer.line(body);
    return { ok: false, handled: true, output: [body], error };
  }

  const action = resolveWorkflowQueueAction(args);
  if (action === 'unknown') {
    const error = 'Use workflows status ou workflows process.';
    if (flags.json) {
      const body = JSON.stringify({
        ok: false,
        mode: 'workflow_queue',
        error,
      }, null, 2);
      writer.line(body);
      return { ok: false, handled: true, output: [body], error };
    }
    const body = formatCliRecoverableErrorEventCard({
      body: error,
      command: 'workflows status',
      hints: ['Para rodar a fila local: workflows process'],
    });
    writer.line(body);
    return { ok: false, handled: true, output: [body], error };
  }

  if (action === 'status') {
    const snapshot = agentGateway.buildSnapshot();
    const jobs = snapshot.workflowJobs || agentGateway.listWorkflowJobs(50);
    const counts = buildWorkflowJobCounts(jobs);
    if (flags.json) {
      const body = JSON.stringify({
        ok: true,
        mode: 'workflow_queue_status',
        generatedAt: snapshot.generatedAt,
        queue: snapshot.workflowQueue,
        counts,
        jobs,
      }, null, 2);
      writer.line(body);
      return { ok: true, handled: true, output: [body], error: null };
    }

    const body = formatCliChatAssistantMessage({
      title: 'Workflow Queue',
      body: [
        `Fila: ${snapshot.workflowQueue.label}`,
        `Adapter: ${snapshot.workflowQueue.kind}  -  ${snapshot.workflowQueue.capabilities.durable ? 'duravel' : 'memoria'}  -  ${snapshot.workflowQueue.capabilities.multiHostSafe ? 'multi-host' : 'local'}`,
        `Jobs: ${counts.total}`,
        formatWorkflowJobCounts(counts),
        ...summarizeWorkflowQueueJobs(jobs),
      ],
      hints: [
        counts.queued > 0 ? 'workflows process' : 'Nada pronto para processar agora.',
        'workflows status --json',
      ],
    });
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  const limit = parseWorkflowQueueLimit(args);
  const executor = createCliWorkflowQueueExecutor(runtime, flags);
  const results = await agentGateway.processQueuedWorkflows({
    executor,
    ...(limit ? { limit } : {}),
  });
  const snapshot = agentGateway.buildSnapshot();
  const counts = buildWorkflowJobCounts(snapshot.workflowJobs || agentGateway.listWorkflowJobs(50));
  const failed = results.filter((result: UniversalAgentRunResult) => !result.ok || result.run.status === 'failed').length;

  if (flags.json) {
    const body = JSON.stringify({
      ok: failed === 0,
      mode: 'workflow_queue_process',
      processed: results.length,
      failed,
      limit: limit || null,
      queue: snapshot.workflowQueue,
      counts,
      results: results.map((result) => ({
        ok: result.ok,
        runId: result.run.id,
        status: result.run.status,
        summary: result.run.summary,
        replies: result.replies,
      })),
      remaining: snapshot.workflowJobs.filter((job) => job.status === 'queued').length,
    }, null, 2);
    writer.line(body);
    return { ok: failed === 0, handled: true, output: [body], error: failed > 0 ? 'Um ou mais workflows falharam.' : null };
  }

  const primaryReply = results
    .map((result) => String(result.replies[0]?.text || result.run.summary || '').trim())
    .filter(Boolean)
    .slice(0, 3);
  const body = formatCliSuccessEventCard({
    title: results.length > 0 ? 'Fila processada' : 'Workflow Queue',
    body: results.length > 0
      ? [
        `${results.length} workflow(s) processado(s).`,
        failed > 0 ? `${failed} workflow(s) falharam e seguem registrados na fila.` : 'Nenhuma falha reportada pelo worker.',
        ...primaryReply,
      ]
      : 'Nenhum workflow pronto para processar agora.',
    hints: [
      'workflows status',
      'workflows process --json',
    ],
  });
  writer.line(body);
  return {
    ok: failed === 0,
    handled: true,
    output: [body],
    error: failed > 0 ? 'Um ou mais workflows falharam.' : null,
  };
}

export async function executeCliUniversalAgentRuntime(
  runtime: ZavorthCliRuntime,
  normalized: string,
  flags: ZavorthCliFlags,
  writer: CliWriter,
): Promise<CliExecutionResult> {
  const agentGateway = runtime.agentGateway || null;
  const trimmed = String(normalized || '').trim();
  if (!agentGateway || !trimmed) {
    return {
      ok: false,
      handled: false,
      output: [],
      error: 'Runtime universal indisponivel para a CLI.',
    };
  }

  const requestText = formatCliConversationLabel(trimmed);
  const explicitExecution = String(flags.command || '').trim() === 'task';
  const surfaceOperationalIntentService = runtime.surfaceOperationalIntentService || new SurfaceOperationalIntentService();
  const responseDecision = await surfaceOperationalIntentService.decideResponse({
    surface: 'cli',
    text: requestText,
    explicitExecution,
  });
  const requestedTools = responseDecision.requestedTools;
  const executorOptions = responseDecision.responsePath === 'fast-chat'
    ? {}
    : { executor: createCliUniversalExecutor(runtime, trimmed, flags) };
  const legacyUnifiedGatewayAvailable = Boolean(runtime.legacyUnifiedGateway);
  const modelProfile = resolveCliUniversalModelProfile({
    routingPolicy: resolveCliLegacyUnifiedGateway(runtime) ? 'gateway' : 'fallback',
  });

  try {
    const result = await agentGateway.handle({
      userId: flags.userId || 'cli-operator',
      channel: 'cli',
      sessionId: flags.sessionId,
      text: requestText,
      workspace: flags.workspaceHint || process.cwd(),
      requestedTools,
      modelProfile,
      metadata: {
        transport: trimmed.startsWith('/') ? 'slash_command' : 'text',
        source: 'cli',
        originalInput: trimmed,
        responseDecision,
        artifactPolicy: responseDecision.artifactPolicy,
        legacyUnifiedGatewayAvailable,
        legacyUnifiedGatewayBypassed: legacyUnifiedGatewayAvailable,
      },
    }, executorOptions);

    const primaryReply = String(result.replies[0]?.text || '').trim()
      || result.run.summary
      || 'Pedido processado pelo runtime universal.';

    if (flags.json) {
      const body = JSON.stringify(
        {
          ok: result.ok,
          mode: 'universal_agent_runtime',
          runId: result.run.id,
          requestId: result.run.requestId,
          sessionId: result.run.sessionId,
          status: result.run.status,
          summary: result.run.summary,
          replies: result.replies,
          approvals: result.run.approvals,
          toolExposure: result.run.toolExposure,
          metadata: result.run.metadata,
        },
        null,
        2,
      );
      writer.line(body);
      return { ok: result.ok, handled: true, output: [body], error: result.ok ? null : result.run.summary };
    }

    const approval = result.run.approvals.find((entry) => entry.status === 'pending');
    const body = approval
      ? formatCliApprovalRequiredEventCard({
        body: [
          primaryReply,
          `Run: ${result.run.id}`,
          `Aprovacao: ${approval.id}`,
          `Motivo: ${approval.reason}`,
        ],
        command: `approve ${approval.id}`,
        hints: [
          'Nada foi executado ainda.',
          `Para cancelar: reject ${approval.id}`,
        ],
      })
      : formatCliChatReplyEventCard(primaryReply)
        || formatCliChatAssistantMessage({
          title: 'Zavorth',
          body: primaryReply,
          hints: [
            `run ${result.run.id}`,
            result.run.metadata?.taskId ? `task ${result.run.metadata.taskId}` : '',
          ].filter(Boolean) as string[],
        });

    writer.line(body);
    return {
      ok: result.ok,
      handled: true,
      output: [body],
      error: result.ok ? null : result.run.summary,
    };
  } catch (error: any) {
    const message = `Nao consegui processar essa conversa pelo runtime universal: ${error.message}`;
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

export async function executeCliUniversalApprovalDecision(
  runtime: ZavorthCliRuntime,
  args: string,
  decision: 'approve' | 'reject',
  flags: ZavorthCliFlags,
  writer: CliWriter,
): Promise<CliExecutionResult | null> {
  const agentGateway = runtime.agentGateway || null;
  const approvalRef = String(args || '').trim().split(/\s+/)[0] || '';
  const pendingApproval = agentGateway?.findPendingApproval(approvalRef) || null;
  if (!agentGateway || !approvalRef || !pendingApproval) {
    return null;
  }

  const originalInput = String(
    pendingApproval.run.metadata?.originalInput
      || pendingApproval.run.input
      || '',
  ).trim();
  const approvalOptions = pendingApproval.run.channel === 'cli' && originalInput
    ? { executor: createCliUniversalExecutor(runtime, originalInput, flags) }
    : {};
  const result = decision === 'approve'
    ? await agentGateway.approve(approvalRef, approvalOptions)
    : await agentGateway.reject(approvalRef);
  if (!result) {
    return null;
  }

  if (flags.json) {
    const body = JSON.stringify(
      {
        ok: result.ok,
        mode: 'universal_agent_runtime_approval',
        decision: result.decision,
        resumed: result.resumed,
        queued: Boolean(result.queued),
        runId: result.run.id,
        status: result.run.status,
        summary: result.run.summary,
        approval: result.approval,
        workflowJob: result.workflowJob || null,
        replies: result.replies,
        error: result.error || null,
      },
      null,
      2,
    );
    writer.line(body);
    return { ok: result.ok, handled: true, output: [body], error: result.error || null };
  }

  if (!result.ok) {
    const body = formatCliRecoverableErrorEventCard({
      body: result.error || result.run.summary,
      command: 'doctor',
    });
    writer.line(body);
    return { ok: false, handled: true, output: [body], error: result.error || result.run.summary };
  }

  const replyText = String(result.replies[0]?.text || '').trim() || result.run.summary;
  const body = decision === 'reject'
    ? formatCliSuccessEventCard({
      title: 'Cancelado',
      body: replyText,
    })
    : formatCliChatReplyEventCard(replyText)
      || formatCliChatAssistantMessage({
        title: 'Zavorth',
        body: replyText,
        hints: [`run ${result.run.id}`],
      });

  writer.line(body);
  return {
    ok: true,
    handled: true,
    output: [body],
    error: null,
  };
}

export async function executeCliLegacyUnifiedConversation(
  legacyUnifiedGateway: Pick<LegacyUnifiedGatewayAdapter, 'handleEvent'>,
  normalized: string,
  flags: ZavorthCliFlags,
  writer: CliWriter,
  responseDecision?: ZavorthResponseDecision | null,
): Promise<CliExecutionResult> {
  const replies: string[] = [];
  const trimmed = String(normalized || '').trim();

  try {
    const result = await legacyUnifiedGateway.handleEvent({
      surface: flags.platform,
      chatId: flags.chatId,
      userId: flags.userId,
      text: trimmed,
      isGroup: false,
      reply: async (text: string) => {
        replies.push(String(text || '').trim() || '(mensagem vazia)');
      },
      metadata: {
        channel: 'cli',
        stage: 'legacy-unified-cli-v1',
        sessionId: flags.sessionId,
        workspaceContext: flags.workspaceHint || null,
        transport: trimmed.startsWith('/') ? 'slash_command' : 'text',
        cli: true,
        responseDecision: responseDecision || null,
      },
    });

    const outputReplies = Array.from(
      new Set(
        [...replies, String(result.responseText || '').trim()]
          .map((entry) => String(entry || '').trim())
          .filter(Boolean),
      ),
    );

    if (flags.json) {
      const body = JSON.stringify(
        {
          ok: true,
          mode: 'legacy_unified_gateway_adapter',
          responseText: String(result.responseText || '').trim() || null,
          replies: outputReplies,
          surface: result.surface,
          intentCategory: result.intentCategory,
        },
        null,
        2,
      );
      writer.line(body);
      return { ok: true, handled: true, output: [body], error: null };
    }

    const conversationLabel = formatCliConversationLabel(trimmed);
    const responseText = outputReplies.join('\n\n') || 'Comando tratado sem resposta textual.';
    const eventReply = outputReplies
      .map((reply) => formatCliChatReplyEventCard(reply))
      .find(Boolean);
    const body = flags.repl
      ? eventReply || formatCliChatAssistantMessage({
        title: 'Zavorth',
        body: responseText,
      })
      : [
        `Pedido: ${conversationLabel}`,
        `Zavorth: ${responseText}`,
      ].join('\n');

    writer.line(body);
    return {
      ok: true,
      handled: true,
      output: [body],
      error: null,
    };
  } catch (error: any) {
    const message = `Nao consegui processar essa conversa pela CLI unificada: ${error.message}`;
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

function resolveCliLegacyUnifiedGateway(
  runtime: Pick<ZavorthCliRuntime, 'legacyUnifiedGateway'> & { agentGateway?: unknown },
): Pick<LegacyUnifiedGatewayAdapter, 'handleEvent'> | null {
  if (runtime.agentGateway) {
    return null;
  }
  return runtime.legacyUnifiedGateway || null;
}
