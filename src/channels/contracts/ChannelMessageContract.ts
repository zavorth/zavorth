import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import type { NormalizedInboundMessage } from '../../runtime/agent/contracts/index.js';

export type CanonicalChannelPlatform =
  | 'web'
  | 'telegram'
  | 'discord'
  | 'slack'
  | 'whatsapp'
  | 'signal'
  | 'imessage'
  | 'teams'
  | 'email'
  | 'api';

export type CanonicalChannelInboundMessage = {
  platform: CanonicalChannelPlatform;
  userId: string;
  chatId: string;
  rawText: string;
  messageId: string | null;
  receivedAt: string;
  normalizedInboundMessage?: NormalizedInboundMessage;
  [key: string]: unknown;
};

export type CanonicalChannelOutboundEnvelope = {
  id: string;
  createdAt: string;
  platform: CanonicalChannelPlatform;
  transport: string;
  recipients: string[];
  message: string;
  payload: Record<string, unknown> | null;
  [key: string]: unknown;
};

type BuildInboundChannelEventInput = {
  platform: CanonicalChannelPlatform;
  userId: string;
  chatId: string;
  rawText: string;
  messageId?: string | null;
  now?: Date;
  fields?: Record<string, unknown>;
};

type BuildOutboundChannelEnvelopeInput = {
  platform: CanonicalChannelPlatform;
  transport: string;
  message: string;
  recipients?: Array<unknown> | null;
  payload?: Record<string, unknown> | null;
  now?: Date;
  fields?: Record<string, unknown>;
};

export function buildInboundChannelEvent(input: BuildInboundChannelEventInput) {
  const platform = normalizePlatform(input.platform);
  const messageId = normalizeNullable(input.messageId);
  const data: CanonicalChannelInboundMessage = {
    platform,
    userId: normalizeRequired(input.userId, 'userId'),
    chatId: normalizeRequired(input.chatId, 'chatId'),
    rawText: String(input.rawText || '').trim(),
    messageId,
    receivedAt: (input.now || new Date()).toISOString(),
    ...sanitizeExtraFields(input.fields),
  };
  data.normalizedInboundMessage = buildNormalizedInboundMessageFromChannelMessage(data);

  return {
    type: 'public_ws' as const,
    payload: {
      id: `${platform}-${messageId || randomUUID()}`,
      type: 'event' as const,
      payload: {
        topic: 'im_message',
        data,
      },
    },
  };
}

export type CanonicalChannelOutboundReply = {
  platform: CanonicalChannelPlatform;
  chatId: string;
  userId: string;
  text: string;
  createdAt: string;
};

type BuildOutboundReplyEventInput = {
  platform: CanonicalChannelPlatform;
  chatId: string;
  userId: string;
  text: string;
  now?: Date;
};

export function buildOutboundReplyEvent(input: BuildOutboundReplyEventInput) {
  const data: CanonicalChannelOutboundReply = {
    platform: normalizePlatform(input.platform),
    chatId: normalizeRequired(input.chatId, 'chatId'),
    userId: normalizeRequired(input.userId, 'userId'),
    text: String(input.text ?? ''),
    createdAt: (input.now || new Date()).toISOString(),
  };
  return {
    type: 'public_ws' as const,
    payload: {
      id: `${data.platform}-reply-${randomUUID()}`,
      type: 'event' as const,
      payload: {
        topic: 'im_reply',
        data,
      },
    },
  };
}

export function extractChannelMeshReplyEvent(
  event: unknown,
  platform: CanonicalChannelPlatform | string,
): CanonicalChannelOutboundReply | null {
  if (!event || typeof event !== 'object') return null;
  const gatewayEvent = event as { type?: unknown; payload?: { payload?: { topic?: unknown; data?: unknown } } };
  if (gatewayEvent.type !== 'public_ws') return null;
  const inner = gatewayEvent.payload?.payload;
  if (!inner || inner.topic !== 'im_reply') return null;
  const data = inner.data as Partial<CanonicalChannelOutboundReply> | undefined;
  if (!data) return null;
  const expectedPlatform = normalizePlatform(platform as CanonicalChannelPlatform);
  const actualPlatform = normalizePlatform(data.platform as CanonicalChannelPlatform);
  if (actualPlatform !== expectedPlatform) return null;
  if (typeof data.text !== 'string') return null;
  return {
    platform: actualPlatform,
    chatId: String(data.chatId || ''),
    userId: String(data.userId || ''),
    text: data.text,
    createdAt: String(data.createdAt || ''),
  };
}

export function buildNormalizedInboundMessageFromChannelMessage(
  message: CanonicalChannelInboundMessage,
): NormalizedInboundMessage {
  const platform = normalizePlatform(message.platform);
  const userId = normalizeRequired(message.userId, 'userId');
  const chatId = normalizeRequired(message.chatId, 'chatId');
  const sessionId = `${platform}:${chatId}`;
  const messageId = normalizeNullable(message.messageId);
  const channelFields = extractChannelFields(message);

  return {
    requestId: messageId ? `${platform}:${messageId}` : undefined,
    traceId: null,
    userId,
    sessionId,
    channel: 'api',
    text: String(message.rawText || '').trim(),
    workspace: null,
    requestedTools: [],
    replyPort: {
      id: `${sessionId}:channel-mesh`,
      label: `${platform} Channel Mesh`,
      kind: 'api',
      status: 'available',
      primary: true,
      description: 'Normalized non-Telegram channel for the Zavorth Agent Gateway.',
    },
    metadata: {
      source: 'channel-mesh',
      surface: platform,
      platform,
      channelPlatform: platform,
      channelUserId: userId,
      chatId,
      messageId,
      receivedAt: normalizeRequired(message.receivedAt, 'receivedAt'),
      normalizedInboundMessage: true,
      canonicalChannelInboundMessage: true,
      channelFields,
    },
  };
}

export function buildOutboundChannelEnvelope(
  input: BuildOutboundChannelEnvelopeInput,
): CanonicalChannelOutboundEnvelope {
  const platform = normalizePlatform(input.platform);
  return {
    id: `${platform}-${randomUUID()}`,
    createdAt: (input.now || new Date()).toISOString(),
    platform,
    transport: String(input.transport || '').trim() || 'local-outbox',
    recipients: normalizeRecipients(input.recipients || []),
    message: String(input.message || '').trim(),
    payload: input.payload && typeof input.payload === 'object' ? input.payload : null,
    ...sanitizeExtraFields(input.fields),
  };
}

export function persistChannelOutboxEnvelope(
  outboxDir: string,
  envelope: CanonicalChannelOutboundEnvelope,
): string {
  const targetDir = path.resolve(outboxDir);
  fs.mkdirSync(targetDir, { recursive: true });
  const targetFile = path.join(
    targetDir,
    `${String(envelope.createdAt || '').replace(/[:.]/g, '-')}-${String(envelope.id || '').trim()}.json`,
  );
  fs.writeFileSync(targetFile, `${JSON.stringify(envelope, null, 2)}\n`, 'utf8');
  return targetFile;
}

function normalizePlatform(input: CanonicalChannelPlatform): CanonicalChannelPlatform {
  return String(input || '').trim().toLowerCase() as CanonicalChannelPlatform;
}

function normalizeRequired(input: unknown, field: string): string {
  const normalized = String(input || '').trim();
  if (!normalized) {
    throw new Error(`${field} is required for the canonical channel contract.`);
  }
  return normalized;
}

function normalizeNullable(input: unknown): string | null {
  const normalized = String(input || '').trim();
  return normalized || null;
}

function normalizeRecipients(input: Array<unknown>): string[] {
  return Array.from(
    new Set(
      input
        .map((entry) => String(entry || '').trim())
        .filter(Boolean),
    ),
  );
}

function sanitizeExtraFields(input: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input || {})) {
    if (!String(key || '').trim() || value === undefined) {
      continue;
    }
    output[key] = value;
  }
  return output;
}

function extractChannelFields(input: CanonicalChannelInboundMessage): Record<string, unknown> {
  const core = new Set([
    'platform',
    'userId',
    'chatId',
    'rawText',
    'messageId',
    'receivedAt',
    'normalizedInboundMessage',
  ]);
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!core.has(key) && value !== undefined) {
      output[key] = value;
    }
  }
  return output;
}
