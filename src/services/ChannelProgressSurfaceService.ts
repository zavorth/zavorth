
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'node:crypto';

import type { CanonicalChannelPlatform } from '../channels/contracts/ChannelMessageContract.js';
import { logger } from '../logger.js';
import type {
ChannelProgressCapability,
  ChannelProgressEvent,
  ChannelProgressReceipt,
  ChannelProgressSession,
  ChannelProgressSnapshot,
  ChannelProgressStage,
  ChannelProgressTransport,
} from '../contracts/ChannelProgressContract.js';
import { asErrorLike } from '../utils/errorLike.js';

export type ChannelProgressSender = {
  sendMessage(input: {
    channel: CanonicalChannelPlatform;
    chatId: string;
    text: string;
    replyToMessageId?: string | number | null;
  }): Promise<{ messageId?: string | number | null } | void>;
  editMessage?(input: {
    channel: CanonicalChannelPlatform;
    chatId: string;
    messageId: string | number;
    text: string;
  }): Promise<{ messageId?: string | number | null } | void>;
};

type ChannelProgressState = {
  version: 1;
  updatedAt: string;
  sessions: Record<string, ChannelProgressSession>;
  receipts: ChannelProgressReceipt[];
};

type ChannelProgressSurfaceRuntime = {
  now?: () => Date;
  stateFile?: string | null;
  sender?: ChannelProgressSender | null;
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  minEditIntervalMs?: number;
};

const EDIT_CAPABLE_CHANNELS = new Set<CanonicalChannelPlatform>([
  'telegram',
  'discord',
  'slack',
  'teams',
]);

const DRAFT_CAPABLE_CHANNELS = new Set<CanonicalChannelPlatform>([
  'telegram',
  'discord',
  'slack',
]);

const CHANNEL_TEXT_LIMITS: Partial<Record<CanonicalChannelPlatform, number>> = {
  telegram: 3900,
  discord: 1900,
  slack: 3500,
  teams: 3500,
  whatsapp: 1400,
  signal: 1400,
  imessage: 1400,
  email: 8000,
};

function defaultStateFile(): string {
  return path.resolve(process.cwd(), '.zavorth', 'channel-progress-surface.json');
}

function stateKey(channel: CanonicalChannelPlatform, chatId: string, runId: string): string {
  return `${channel}:${chatId}:${runId}`;
}

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function redactSecrets(value: string): string {
  return value
    .replace(/(api[_-]?key|token|secret|password|authorization)\s*[:=]\s*["']?[^"'\s]+/giu, '$1=[redacted]')
    .replace(/([...&](?:access_token|token|key|secret|code)=)[^&\s]+/giu, '$1[redacted]');
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 18)).trimEnd()}\n\n...[truncated]`;
}

function stageLabel(stage: ChannelProgressStage): string {
  switch (stage) {
    case 'accepted':
      return 'Recebido';
    case 'planning':
      return 'Planejando';
    case 'tool_started':
      return 'Using tool';
    case 'tool_progress':
      return 'Trabalhando';
    case 'integration_auth_link':
      return 'Connection link';
    case 'approval_waiting':
      return 'Waiting for approval';
    case 'tool_completed':
      return 'Tool completed';
    case 'final':
      return 'Completed';
    case 'failed':
      return 'Failed';
    case 'cancelled':
      return 'Cancelado';
    default:
      return stage;
  }
}

function statusLine(input: ChannelProgressEvent): string {
  const parts = [
    input.toolName ? `tool=${input.toolName}` : null,
    input.actionId ? `action=${input.actionId}` : null,
    input.integrationId ? `integration=${input.integrationId}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' | ') : 'Zavorth is trabalhando nesse request.';
}

export class ChannelProgressSurfaceService {
  private readonly now: () => Date;
  private readonly stateFile: string | null;
  private readonly sender: ChannelProgressSender | null;
  private readonly minEditIntervalMs: number;
  private readonly sessions = new Map<string, ChannelProgressSession>();
  private readonly receipts: ChannelProgressReceipt[] = [];

  constructor(runtime: ChannelProgressSurfaceRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.stateFile = runtime.stateFile === null ? null : runtime.stateFile || defaultStateFile();
    this.sender = runtime.sender === undefined
      ? createDefaultSender(runtime.env || process.env, runtime.fetchImpl || fetch)
      : runtime.sender;
    this.minEditIntervalMs = Math.max(0, runtime.minEditIntervalMs ?? 800);
    this.loadState();
  }

  public capabilities(): ChannelProgressCapability[] {
    return ([
      'telegram',
      'discord',
      'slack',
      'teams',
      'whatsapp',
      'signal',
      'imessage',
      'email',
      'web',
      'api',
    ] as CanonicalChannelPlatform[]).map((channel) => this.capabilityFor(channel));
  }

  public capabilityFor(channel: CanonicalChannelPlatform): ChannelProgressCapability {
    const canEdit = EDIT_CAPABLE_CHANNELS.has(channel);
    const canDraft = DRAFT_CAPABLE_CHANNELS.has(channel);
    return {
      channel,
      canSend: true,
      canEdit,
      canDraft,
      throttleMs: canEdit ? this.minEditIntervalMs : 0,
      maxTextLength: CHANNEL_TEXT_LIMITS[channel] || 3000,
      summary: canEdit ? 'Supports live progress by editing one status message.'
        : 'Supports honest fallback progress; final response remains separate.',
    };
  }

  public snapshot(): ChannelProgressSnapshot {
    return {
      contractVersion: 'channel-progress-surface/1',
      generatedAt: this.now().toISOString(),
      capabilities: this.capabilities(),
      sessions: Array.from(this.sessions.values()).sort((left, right) => left.updatedAt.localeCompare(right.updatedAt)),
      receipts: this.receipts.slice(-100),
    };
  }

  public render(input: ChannelProgressEvent): string {
    const capability = this.capabilityFor(input.channel);
    const lines = [
      `Zavorth | ${stageLabel(input.stage)}`,
      normalizeText(input.title, input.stage === 'final' ? 'Response ready.' : 'Updating the request.'),
      '',
      normalizeText(input.finalText || input.detail || statusLine(input)),
    ];

    if (input.link) {
      lines.push('', `Link: ${input.link}`);
    }

    if (input.stage !== 'final') {
      lines.push('', 'This message can be updated during execution.');
    }

    return truncateText(redactSecrets(lines.join('\n')), capability.maxTextLength);
  }

  public async publish(input: ChannelProgressEvent): Promise<ChannelProgressReceipt> {
    const now = this.now();
    const event: ChannelProgressEvent = {
      ...input,
      createdAt: input.createdAt || now.toISOString(),
    };
    const key = stateKey(event.channel, event.chatId, event.runId);
    const current = this.sessions.get(key) || null;
    const capability = this.capabilityFor(event.channel);
    const text = this.render(event);
    const shouldEdit =
      Boolean(current?.anchorMessageId)
      && capability.canEdit
      && Boolean(this.sender?.editMessage)
      && current !== null
      && !this.isThrottleWindow(current, now);

    if (!this.sender) {
      const session = this.upsertSession(event, text, current?.anchorMessageId ?? event.messageId ?? null, 'off', null);
      const receipt = this.receipt(event, 'off', 'skipped', session.anchorMessageId, 'No channel sender was configured.');
      this.record(receipt);
      return receipt;
    }

    try {
      if (shouldEdit && current?.anchorMessageId) {
        await this.sender.editMessage?.({
          channel: event.channel,
          chatId: event.chatId,
          messageId: current.anchorMessageId,
          text,
        });
        const session = this.upsertSession(event, text, current.anchorMessageId, 'edit', null);
        const receipt = this.receipt(event, 'edit', 'edited', session.anchorMessageId, 'Progress status edited in-place.');
        this.record(receipt);
        return receipt;
      }

      if (current && capability.canEdit && this.isThrottleWindow(current, now) && event.stage !== 'final') {
        const receipt = this.receipt(event, current.transport, 'skipped', current.anchorMessageId, 'Progress update skipped by edit throttle.');
        this.record(receipt, false);
        return receipt;
      }

      const sent = await this.sender.sendMessage({
        channel: event.channel,
        chatId: event.chatId,
        text,
        replyToMessageId: event.messageId || null,
      });
      const sentMessageId = sent && typeof sent === 'object' ? sent.messageId : null;
      const messageId = sentMessageId ?? event.messageId ?? current?.anchorMessageId ?? null;
      const transport: ChannelProgressTransport = capability.canEdit ? 'edit' : 'send';
      const session = this.upsertSession(event, text, messageId, transport, null);
      const receipt = this.receipt(event, transport, 'sent', session.anchorMessageId, 'Progress status sent.');
      this.record(receipt);
      return receipt;
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const message = error instanceof Error ? err.message : String(error);
      const session = this.upsertSession(event, text, current?.anchorMessageId ?? event.messageId ?? null, current?.transport || 'send', message);
      const receipt = this.receipt(event, session.transport, 'failed', session.anchorMessageId, message);
      this.record(receipt);
      return receipt;
    }
  }

  private isThrottleWindow(session: ChannelProgressSession, now: Date): boolean {
    if (this.minEditIntervalMs <= 0) {
      return false;
    }
    return now.getTime() - new Date(session.updatedAt).getTime() < this.minEditIntervalMs;
  }

  private upsertSession(
    event: ChannelProgressEvent,
    text: string,
    messageId: string | number | null,
    transport: ChannelProgressTransport,
    lastError: string | null,
  ): ChannelProgressSession {
    const key = stateKey(event.channel, event.chatId, event.runId);
    const current = this.sessions.get(key) || null;
    const now = this.now().toISOString();
    const session: ChannelProgressSession = {
      runId: event.runId,
      channel: event.channel,
      chatId: event.chatId,
      anchorMessageId: messageId,
      transport,
      startedAt: current?.startedAt || now,
      updatedAt: now,
      stage: event.stage,
      lastText: text,
      lastError,
    };
    this.sessions.set(key, session);
    this.persist();
    return session;
  }

  private receipt(
    event: ChannelProgressEvent,
    transport: ChannelProgressTransport,
    status: ChannelProgressReceipt['status'],
    messageId: string | number | null,
    summary: string,
  ): ChannelProgressReceipt {
    return {
      id: `channel-progress-${randomUUID()}`,
      runId: event.runId,
      channel: event.channel,
      chatId: event.chatId,
      transport,
      stage: event.stage,
      status,
      createdAt: this.now().toISOString(),
      messageId,
      summary: redactSecrets(summary),
      safety: {
        secretsRedacted: true,
        progressNotTranscript: true,
        outboundPolicyRequired: true,
      },
      error: status === 'failed' ? redactSecrets(summary) : null,
    };
  }

  private record(receipt: ChannelProgressReceipt, persist = true): void {
    this.receipts.push(receipt);
    while (this.receipts.length > 200) {
      this.receipts.shift();
    }
    if (persist) {
      this.persist();
    }
  }

  private loadState(): void {
    if (!this.stateFile || !fs.existsSync(this.stateFile)) {
      return;
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(this.stateFile, 'utf8')) as Partial<ChannelProgressState>;
      for (const session of Object.values(parsed.sessions || {})) {
        if (session?.runId && session.channel && session.chatId) {
          this.sessions.set(stateKey(session.channel, session.chatId, session.runId), session);
        }
      }
      for (const receipt of parsed.receipts || []) {
        if (receipt?.id) {
          this.receipts.push(receipt);
        }
      }
    } catch (error: unknown) {// Corrupt progress state must not break channel delivery.
      logger.warn('[Channel Progress Surface] parsing failed', error);
    }
  }

  private persist(): void {
    if (!this.stateFile) {
      return;
    }
    const state: ChannelProgressState = {
      version: 1,
      updatedAt: this.now().toISOString(),
      sessions: Object.fromEntries(
        Array.from(this.sessions.values()).map((session) => [
          stateKey(session.channel, session.chatId, session.runId),
          session,
        ]),
      ),
      receipts: this.receipts.slice(-200),
    };
    fs.mkdirSync(path.dirname(this.stateFile), { recursive: true });
    fs.writeFileSync(this.stateFile, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  }
}

function createDefaultSender(env: NodeJS.ProcessEnv, fetchImpl: typeof fetch): ChannelProgressSender | null {
  const telegramToken = normalizeText(env.TELEGRAM_BOT_TOKEN);
  if (!telegramToken) {
    return null;
  }
  const telegramApiBase = `https://api.telegram.org/bot${telegramToken}`;
  return {
    async sendMessage(input) {
      if (input.channel !== 'telegram') {
        throw new Error(`No default sender configured for ${input.channel}.`);
      }
      const response = await fetchImpl(`${telegramApiBase}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: input.chatId,
          text: input.text,
          disable_web_page_preview: true,
          ...(input.replyToMessageId ? { reply_to_message_id: input.replyToMessageId } : {}),
        }),
      });
      const data = await readTelegramResponse(response);
      if (!response.ok || data?.ok === false) {
        throw new Error(`Telegram sendMessage failed: ${response.status}`);
      }
      return { messageId: data?.result?.message_id ?? null };
    },
    async editMessage(input) {
      if (input.channel !== 'telegram') {
        throw new Error(`No default editor configured for ${input.channel}.`);
      }
      const response = await fetchImpl(`${telegramApiBase}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: input.chatId,
          message_id: input.messageId,
          text: input.text,
          disable_web_page_preview: true,
        }),
      });
      const data = await readTelegramResponse(response);
      if (!response.ok || data?.ok === false) {
        throw new Error(`Telegram editMessageText failed: ${response.status}`);
      }
      return { messageId: data?.result?.message_id ?? input.messageId };
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function readTelegramResponse(response: Response): Promise<any> {
  try {
    return await response.json();
  } catch (error: unknown) {logger.warn('[Channel Progress Surface] filesystem check failed', error); return null; }
}
