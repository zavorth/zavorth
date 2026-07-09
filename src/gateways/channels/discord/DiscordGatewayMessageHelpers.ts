import { ChannelType } from 'discord.js';import type { MessageAttachment } from '../../../contracts/IMessageBroker.js';
import { logger } from '../../../logger.js';
import {
MAX_DISCORD_MESSAGE_LENGTH,
  MAX_RECENT_CHANNELS,
  type DiscordGatewayInteractionLike,
  type DiscordGatewayMessageLike,
  type DiscordGatewayRecentChannel,
} from './DiscordGatewayTypes.js';


export function buildDiscordChatId(
  guildId: string | null,
  channelId: string,
  threadId: string | null,
  parentChannelId?: string | null,
): string {
  if (guildId) {
    if (threadId) {
      const parentId = String(parentChannelId || '').trim() || channelId;
      return `discord:guild:${guildId}:channel:${parentId}:thread:${threadId}`;
    }
    return `discord:guild:${guildId}:channel:${channelId}`;
  }

  return `discord:dm:${channelId}`;
}

export function resolveDiscordThreadId(
  channel: DiscordGatewayMessageLike['channel'] | DiscordGatewayInteractionLike['channel'],
  channelId: string,
): string | null {
  const parentId = String(channel?.parentId || '').trim();
  if (parentId) {
    return channelId;
  }

  const channelType = channel?.type;
  const threadTypes = new Set<number | string>([
    ChannelType.PublicThread,
    ChannelType.PrivateThread,
    ChannelType.AnnouncementThread,
    'PublicThread',
    'PrivateThread',
    'AnnouncementThread',
  ]);

  return threadTypes.has(channelType as any) ? channelId : null;
}

export function extractDiscordAttachments(rawAttachments: unknown): MessageAttachment[] {
  const values = toDiscordAttachmentValues(rawAttachments);
  return values
    .map((entry, index) => normalizeDiscordAttachment(entry, index))
    .filter((entry): entry is MessageAttachment => entry !== null);
}

export function toDiscordAttachmentValues(rawAttachments: unknown): unknown[] {
  if (!rawAttachments) {
    return [];
  }

  if (Array.isArray(rawAttachments)) {
    return rawAttachments;
  }

  if (typeof rawAttachments === 'object') {
    const candidate = rawAttachments as Record<string, any>;
    if (typeof candidate.values === 'function') {
      try {
        return Array.from(candidate.values());
      } catch (error: unknown) {logger.warn('[Discord way Message Helpers] operation failed', error); return []; }
    }
    if ('url' in candidate || 'name' in candidate || 'contentType' in candidate) {
      return [candidate];
    }
  }

  return [];
}

export function normalizeDiscordAttachment(entry: unknown, index: number): MessageAttachment | null {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const attachment = entry as Record<string, any>;
  const name = String(attachment.name || attachment.filename || '').trim() || `attachment-${index + 1}`;
  const url = String(attachment.url || attachment.proxyURL || attachment.proxyUrl || '').trim() || null;
  const contentType = String(attachment.contentType || attachment.content_type || '').trim() || null;
  const size = Number(attachment.size || 0) || null;

  return {
    id: String(attachment.id || '').trim() || null,
    name,
    url,
    contentType,
    size,
  };
}

export function composeDiscordInboundText(content: string, attachments: MessageAttachment[]): string {
  const normalizedContent = String(content || '').trim();
  if (attachments.length === 0) {
    return normalizedContent;
  }

  const attachmentLines = attachments.map((attachment) => {
    const sizeLabel = attachment.size ? `${attachment.size} bytes` : 'unknown size';
    const typeLabel = attachment.contentType || 'unknown type';
    const urlLabel = attachment.url ? ` | ${attachment.url}` : '';
    return `- ${attachment.name || 'attachment'} (${typeLabel}, ${sizeLabel})${urlLabel}`;
  });
  const attachmentSummary = ['Discord attachments:', ...attachmentLines].join('\n');

  if (normalizedContent) {
    return `${normalizedContent}\n\n${attachmentSummary}`;
  }

  return `Analyze the attached files and answer using this context.\n\n${attachmentSummary}`;
}

export function chunkDiscordMessage(text: string): string[] {
  const normalized = String(text || '').trim();
  if (!normalized) {
    return [];
  }

  const chunks: string[] = [];
  let remaining = normalized;
  while (remaining.length > MAX_DISCORD_MESSAGE_LENGTH) {
    const slice = remaining.slice(0, MAX_DISCORD_MESSAGE_LENGTH);
    const lastBreak = Math.max(slice.lastIndexOf('\n'), slice.lastIndexOf(' '));
    const cut = lastBreak > 0 ? lastBreak : MAX_DISCORD_MESSAGE_LENGTH;
    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) {
    chunks.push(remaining);
  }
  return chunks.filter(Boolean);
}

export function rememberDiscordRecentChannel(
  recentChannels: DiscordGatewayRecentChannel[],
  channelId: string,
  guildId: string | null,
  authorId: string | null,
  isDirectMessage: boolean,
  now: () => Date,
): DiscordGatewayRecentChannel[] {
  const next = [
    {
      channelId,
      guildId,
      authorId: String(authorId || '').trim() || null,
      isDirectMessage,
      observedAt: now().toISOString(),
    },
    ...recentChannels.filter((entry) => entry.channelId !== channelId),
  ];

  return next.slice(0, MAX_RECENT_CHANNELS);
}
