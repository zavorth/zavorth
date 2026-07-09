import {
  ZAVORTH_MNEMOS_IDLE_MICROCOMPACT_MS,
  ZAVORTH_MNEMOS_RECENT_VERBATIM_TURNS,
  ZAVORTH_MNEMOS_RESERVED_TOKEN_BUFFER,
  type ZavorthMnemosCompactionMode,
} from '../contracts/ZavorthMnemosMemoryOsContract.js';
import { countTokens, countMessagesTokens } from '../utils/tokenCounter.js';
import type { ILlmProvider } from '../providers/ILlmProvider.js';export type ContextCompactionMessageRole = 'system' | 'user' | 'assistant' | 'tool';

export type ContextCompactionMessage = {
  id?: string;
  role: ContextCompactionMessageRole;
  content: string;
  createdAt?: string | Date | null;
  toolName?: string | null;
  status?: 'ok' | 'error' | 'blocked' | 'pending' | null;
  metadata?: Record<string, unknown>;
  toolCalls?: any[] | null;
  toolCallId?: string | null;
};

export type ContextCompactionInput = {
  messages: ContextCompactionMessage[];
  now?: Date;
  lastActivityAt?: string | Date | null;
  usableContextTokens?: number;
  reservedTokenBuffer?: number;
  idleMicrocompactMs?: number;
  recentVerbatimTurns?: number;
  existingAnchorSummary?: string | null;
};

export type ContextCompactionAnchorSummary = {
  primaryIntent: string;
  discardedPaths: string[];
  stateMap: string[];
  pendingChecklist: string[];
  modifiedPaths: string[];
  toolFailureLog: string[];
  securityApprovals: string[];
  verbatimUserDirectives: string[];
  nextPrescribedAction: string;
};

export type ContextCompactionDecision = {
  mode: ZavorthMnemosCompactionMode;
  triggered: boolean;
  reason: string;
  estimatedBeforeTokens: number;
  estimatedAfterTokens: number;
  reductionTokens: number;
  preservedRecentTurns: number;
  clearedToolOutputs: number;
  compactedOlderMessages: number;
  anchorSummary: ContextCompactionAnchorSummary | null;
  compactedMessages: ContextCompactionMessage[];
  receipt: {
    id: string;
    generatedAt: string;
    durableMutation: false;
    providerCall: false;
    secretsRedacted: true;
    gatesToolAuthority: false;
  };
};

const SECRET_PATTERNS: RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{16,}\b/g,
  /\bhf_[A-Za-z0-9]{16,}\b/g,
  /\bAIza[0-9A-Za-z_-]{20,}\b/g,
  /\b(?:api[_-]?key|token|secret|password)\s*[:=]\s*["']?[^"'\s]+/gi,
];

function normalizeDate(value: string | Date | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function compactWhitespace(value: string): string {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function redactSecrets(value: string): string {
  return SECRET_PATTERNS.reduce((text, pattern) => text.replace(pattern, '[REDACTED_SECRET]'), String(value || ''));
}

function truncate(value: string, limit: number): string {
  const text = compactWhitespace(redactSecrets(value));
  if (text.length <= limit) {
    return text;
  }
  return `${text.slice(0, Math.max(0, limit - 3)).trim()}...`;
}

function stableId(input: string): string {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) - hash + input.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function extractPathMentions(text: string): string[] {
  const matches = text.match(/(?:[A-Za-z]:\\[^\s"'`]+|(?:src|tests|scripts|docs|data|skill-library|\.zavorth)\/[^\s"'`]+)/g) || [];
  return Array.from(new Set(matches.map((entry) => entry.replace(/[),.;]+$/g, '')))).slice(0, 12);
}

function looksPending(text: string): boolean {
  return /\b(todo|pending|next|proximo|pr[oó]ximo|falt|depois|continue|remaining)\b/i.test(text);
}

function looksDiscarded(text: string): boolean {
  return /\b(failed|falhou|erro|revert|descart|nao funcion|n[aã]o funcion|timeout|blocked)\b/i.test(text);
}

export class ContextCompactionService {
  public compact(input: ContextCompactionInput): ContextCompactionDecision {
    const now = input.now || new Date();
    const messages = input.messages.map((message, index) => this.normalizeMessage(message, index));
    const estimatedBeforeTokens = this.estimateTokensForMessages(messages);
    const usableContextTokens = Math.max(1, Number(input.usableContextTokens || 128000));
    const reservedTokenBuffer = Math.max(0, Number(input.reservedTokenBuffer ?? ZAVORTH_MNEMOS_RESERVED_TOKEN_BUFFER));
    const recentVerbatimTurns = Math.max(1, Math.min(Number(input.recentVerbatimTurns || ZAVORTH_MNEMOS_RECENT_VERBATIM_TURNS), 12));
    const idleThreshold = Math.max(1, Number(input.idleMicrocompactMs || ZAVORTH_MNEMOS_IDLE_MICROCOMPACT_MS));
    const lastActivity = normalizeDate(input.lastActivityAt);
    const idleMs = lastActivity ? Math.max(0, now.getTime() - lastActivity.getTime()) : 0;
    const shouldMicrocompact = idleMs >= idleThreshold;
    const shouldAnchor = estimatedBeforeTokens > Math.max(1, usableContextTokens - reservedTokenBuffer);

    let compactedMessages = messages;
    let mode: ZavorthMnemosCompactionMode = 'none';
    let reason = 'Context is inside budget and not idle enough for compaction.';
    let clearedToolOutputs = 0;
    let compactedOlderMessages = 0;
    let anchorSummary: ContextCompactionAnchorSummary | null = null;

    if (shouldMicrocompact) {
      mode = 'time-based-microcompact';
      reason = `Idle threshold reached (${Math.round(idleMs / 60000)}m). Old bulky tool output was replaced with semantic labels.`;
      const micro = this.microcompact(messages, recentVerbatimTurns);
      compactedMessages = micro.messages;
      clearedToolOutputs = micro.clearedToolOutputs;
    }

    if (shouldAnchor) {
      mode = 'incremental-anchored-compaction';
      reason = `Estimated context exceeds usable budget (${estimatedBeforeTokens} > ${usableContextTokens - reservedTokenBuffer}). Older turns were anchored.`;
      const anchor = this.anchorCompact(compactedMessages, recentVerbatimTurns, input.existingAnchorSummary || null);
      compactedMessages = anchor.messages;
      compactedOlderMessages = anchor.compactedOlderMessages;
      anchorSummary = anchor.anchorSummary;
    }

    compactedMessages = this.enforceToolCoherence(compactedMessages);

    const estimatedAfterTokens = this.estimateTokensForMessages(compactedMessages);
    const triggered = mode !== 'none';
    const generatedAt = now.toISOString();

    return {
      mode,
      triggered,
      reason,
      estimatedBeforeTokens,
      estimatedAfterTokens,
      reductionTokens: Math.max(0, estimatedBeforeTokens - estimatedAfterTokens),
      preservedRecentTurns: Math.min(recentVerbatimTurns, messages.length),
      clearedToolOutputs,
      compactedOlderMessages,
      anchorSummary,
      compactedMessages,
      receipt: {
        id: `ctx-compact-${stableId(`${generatedAt}:${mode}:${estimatedBeforeTokens}:${estimatedAfterTokens}`)}`,
        generatedAt,
        durableMutation: false,
        providerCall: false,
        secretsRedacted: true,
        gatesToolAuthority: false,
      },
    };
  }

  public estimateTokensForMessages(messages: ContextCompactionMessage[]): number {
    return countMessagesTokens(messages);
  }

  public estimateTokens(text: string): number {
    return countTokens(text);
  }

  private normalizeMessage(message: ContextCompactionMessage, index: number): ContextCompactionMessage {
    return {
      ...message,
      id: message.id || `msg-${index + 1}`,
      content: redactSecrets(String(message.content || '')),
      toolName: message.toolName || null,
      status: message.status || null,
      toolCalls: message.toolCalls || null,
      toolCallId: message.toolCallId || null,
    };
  }

  private microcompact(messages: ContextCompactionMessage[], recentVerbatimTurns: number): {
    messages: ContextCompactionMessage[];
    clearedToolOutputs: number;
  } {
    const protectedStart = Math.max(0, messages.length - recentVerbatimTurns);
    let clearedToolOutputs = 0;
    const compacted = messages.map((message, index) => {
      const isOldTool = index < protectedStart && message.role === 'tool';
      const isBulky = this.estimateTokens(message.content) > 80;
      if (!isOldTool || !isBulky) {
        return message;
      }
      clearedToolOutputs += 1;
      const tool = message.toolName || 'tool';
      const status = message.status || 'ok';
      return {
        ...message,
        content: `[Old tool result cleared (${tool}) - status=${status}; context preserved by receipt.]`,
      };
    });

    return { messages: compacted, clearedToolOutputs };
  }

  private anchorCompact(messages: ContextCompactionMessage[], recentVerbatimTurns: number, existingAnchorSummary: string | null): {
    messages: ContextCompactionMessage[];
    compactedOlderMessages: number;
    anchorSummary: ContextCompactionAnchorSummary;
  } {
    const splitIndex = Math.max(0, messages.length - recentVerbatimTurns);
    const older = messages.slice(0, splitIndex);
    const recent = messages.slice(splitIndex);
    const anchorSummary = this.buildAnchorSummary(older, existingAnchorSummary);
    const anchorMessage: ContextCompactionMessage = {
      id: 'zavorth-session-summary',
      role: 'system',
      content: this.renderAnchorSummary(anchorSummary),
      metadata: {
        generatedBy: 'ContextCompactionService',
        compactedOlderMessages: older.length,
      },
    };

    return {
      messages: older.length ? [anchorMessage, ...recent] : messages,
      compactedOlderMessages: older.length,
      anchorSummary,
    };
  }

  private buildAnchorSummary(messages: ContextCompactionMessage[], existingAnchorSummary: string | null): ContextCompactionAnchorSummary {
    const userMessages = messages.filter((message) => message.role === 'user').map((message) => truncate(message.content, 220));
    const assistantMessages = messages.filter((message) => message.role === 'assistant').map((message) => truncate(message.content, 180));
    const toolMessages = messages.filter((message) => message.role === 'tool');
    const allText = messages.map((message) => message.content).join('\n');
    const pathMentions = extractPathMentions(allText);
    const failures = messages
      .filter((message) => message.status === 'error' || looksDiscarded(message.content))
      .map((message) => `${message.toolName || message.role}: ${truncate(message.content, 180)}`)
      .slice(0, 8);
    const pending = messages
      .filter((message) => looksPending(message.content))
      .map((message) => truncate(message.content, 180))
      .slice(0, 8);
    const approvals = messages
      .filter((message) => /\b(approv|approval|autoriz|permit|break glass|persistent permission)\b/i.test(message.content))
      .map((message) => truncate(message.content, 180))
      .slice(0, 8);

    return {
      primaryIntent: userMessages[0] || assistantMessages[0] || 'No older user intent was available.',
      discardedPaths: failures.length ? failures : ['No discarded path recorded in compacted turns.'],
      stateMap: [
        existingAnchorSummary ? `Previous anchor existed: ${truncate(existingAnchorSummary, 180)}` : 'No previous anchor summary provided.',
        `${toolMessages.length} older tool result(s) represented by compacted context.`,
        `${messages.length} older message(s) compacted into this anchor.`,
      ],
      pendingChecklist: pending.length ? pending : ['Continue from the most recent verbatim turns.'],
      modifiedPaths: pathMentions.length ? pathMentions : ['No explicit modified path detected in compacted turns.'],
      toolFailureLog: failures.length ? failures : ['No tool failure detected in compacted turns.'],
      securityApprovals: approvals.length ? approvals : ['No security approval detected in compacted turns.'],
      verbatimUserDirectives: userMessages.slice(-12),
      nextPrescribedAction: pending[0] || 'Read the recent verbatim turns and continue the active task.',
    };
  }

  private renderAnchorSummary(summary: ContextCompactionAnchorSummary): string {
    const section = (title: string, lines: string[]) => [
      `## ${title}`,
      ...lines.map((line) => `- ${line}`),
    ].join('\n');

    return [
      '<zavorth-session-summary>',
      section('Primary Intent', [summary.primaryIntent]),
      section('Discarded Paths', summary.discardedPaths),
      section('State Map', summary.stateMap),
      section('Pending Checklist', summary.pendingChecklist),
      section('Modified Paths', summary.modifiedPaths),
      section('Tool Failure Log', summary.toolFailureLog),
      section('Security Approvals Granted', summary.securityApprovals),
      section('Verbatim User Directives', summary.verbatimUserDirectives.length ? summary.verbatimUserDirectives : ['No user directives in compacted turns.']),
      section('Next Prescribed Action', [summary.nextPrescribedAction]),
      '</zavorth-session-summary>',
    ].join('\n\n');
  }

  private enforceToolCoherence(messages: ContextCompactionMessage[]): ContextCompactionMessage[] {
    const result: ContextCompactionMessage[] = [];
    const existingToolResponses = new Set<string>();
    const existingToolResponsesByName = new Set<string>();

    for (const msg of messages) {
      if (msg.role === 'tool') {
        if (msg.toolCallId) {
          existingToolResponses.add(msg.toolCallId);
        }
        if (msg.toolName) {
          existingToolResponsesByName.add(msg.toolName);
        }
      }
    }

    const declaredToolCalls = new Set<string>();
    const declaredToolCallsByName = new Set<string>();

    for (const msg of messages) {
      if (msg.role === 'assistant' && Array.isArray(msg.toolCalls)) {
        for (const tc of msg.toolCalls) {
          if (tc.id) {
            declaredToolCalls.add(tc.id);
          }
          if (tc.name) {
            declaredToolCallsByName.add(tc.name);
          }
        }
      }
    }

    for (const msg of messages) {
      if (msg.role === 'tool') {
        const hasMatchingCall = (msg.toolCallId && declaredToolCalls.has(msg.toolCallId)) ||
                                (msg.toolName && declaredToolCallsByName.has(msg.toolName));
        if (!hasMatchingCall) {
          continue; // Filter out orphan tool outputs
        }
      }

      result.push(msg);

      if (msg.role === 'assistant' && Array.isArray(msg.toolCalls) && msg.toolCalls.length > 0) {
        for (const tc of msg.toolCalls) {
          const hasResponse = (tc.id && existingToolResponses.has(tc.id)) ||
                              (tc.name && existingToolResponsesByName.has(tc.name));
          if (!hasResponse) {
            const stub: ContextCompactionMessage = {
              id: `stub-tool-${tc.id || tc.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              role: 'tool',
              toolName: tc.name || 'unknown_tool',
              toolCallId: tc.id || null,
              content: '[Context compacted: The return of this tool execution was archived in episodic memory]',
              status: 'ok',
            };
            result.push(stub);

            if (tc.id) existingToolResponses.add(tc.id);
            if (tc.name) existingToolResponsesByName.add(tc.name);
          }
        }
      }
    }

    return result;
  }

  public async compactSemanticAsync(
    messages: ContextCompactionMessage[],
    provider: ILlmProvider,
    recentVerbatimTurns: number,
    modelName?: string
  ): Promise<{ messages: ContextCompactionMessage[]; clearedToolOutputs: number }> {
    const protectedStart = Math.max(0, messages.length - recentVerbatimTurns);
    let clearedToolOutputs = 0;

    const compacted: ContextCompactionMessage[] = [];

    for (let index = 0; index < messages.length; index += 1) {
      const message = messages[index];
      const isOldTool = index < protectedStart && message.role === 'tool';
      const isBulky = countTokens(message.content) > 80;

      if (isOldTool && isBulky) {
        clearedToolOutputs += 1;
        const tool = message.toolName || 'tool';

        try {
          const prompt = `Summarize this tool's execution result. Outline only the main output paths, actions taken, and errors. Limit the response to 120 words.\n\nTool Name: ${tool}\nResult:\n${message.content}`;
          const response = await provider.chat(
            [{ role: 'user', content: prompt }],
            undefined,
            modelName ? { modelName } : undefined
          );

          const summary = response.content?.trim() || '[Empty summary]';
          compacted.push({
            ...message,
            content: `[Old tool result summarized (${tool}) - ${summary}]`,
          });
        } catch (error: unknown) {// Fallback cleanly to static description in case of error
          const status = message.status || 'ok';
          compacted.push({
            ...message,
            content: `[Old tool result cleared (${tool}) - status=${status}; context preserved by receipt.]`,
          });
        }
      } else {
        compacted.push(message);
      }
    }

    const coherent = this.enforceToolCoherence(compacted);
    return { messages: coherent, clearedToolOutputs };
  }
}
