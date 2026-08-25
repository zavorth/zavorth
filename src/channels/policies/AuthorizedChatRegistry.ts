import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../../logger.js';

export type AuthorizedChatContext = {
  chat?: { id?: number | string | null; type?: string | null } | null;
  from?: {
    id?: number | string | null;
    username?: string | null;
    first_name?: string | null;
  } | null;
};

export type AuthorizedChatRecord = {
  channelId: string;
  chatId: string;
  chatType: string;
  userId: string;
  username: string | null;
  firstName: string | null;
  lastSeenAt: string;
  source: string;
};

export type AuthorizedChatRegistrySnapshot = {
  version: 1;
  updatedAt: string;
  chats: AuthorizedChatRecord[];
};

type AuthorizedChatRegistryOptions = {
  channelId?: string;
  registryPath?: string;
};

const DEFAULT_CHANNEL_ID = 'telegram';

export class AuthorizedChatRegistry {
  private readonly channelId: string;
  private readonly registryPath: string;

  constructor(options: AuthorizedChatRegistryOptions = {}) {
    this.channelId = String(options.channelId || DEFAULT_CHANNEL_ID).trim() || DEFAULT_CHANNEL_ID;
    this.registryPath = path.resolve(
      options.registryPath ||
        path.join(process.cwd(), 'data', 'runtime', `${this.channelId}-authorized-chats.json`),
    );
  }

  public recordAuthorizedContext(context: AuthorizedChatContext): AuthorizedChatRecord | null {
    const chatId = String(context.chat?.id || '').trim();
    const userId = String(context.from?.id || '').trim();
    if (!chatId || !userId) {
      return null;
    }

    const now = new Date().toISOString();
    const next: AuthorizedChatRecord = {
      channelId: this.channelId,
      chatId,
      chatType: String(context.chat?.type || 'unknown').trim() || 'unknown',
      userId,
      username: cleanOptional(context.from?.username),
      firstName: cleanOptional(context.from?.first_name),
      lastSeenAt: now,
      source: `${this.channelId}-ingress`,
    };

    const snapshot = this.read();
    const existing = snapshot.chats.findIndex(
      (chat) => chat.chatId === chatId && chat.userId === userId,
    );
    if (existing >= 0) {
      snapshot.chats[existing] = {
        ...snapshot.chats[existing],
        ...next,
        lastSeenAt: now,
      };
    } else {
      snapshot.chats.push(next);
    }
    snapshot.updatedAt = now;
    snapshot.chats.sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
    this.write(snapshot);
    return next;
  }

  public read(): AuthorizedChatRegistrySnapshot {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.registryPath, 'utf8')) as Partial<AuthorizedChatRegistrySnapshot>;
      const chats = Array.isArray(parsed.chats)
        ? parsed.chats
            .map((chat) => normalizeRecord(chat, this.channelId))
            .filter((chat): chat is AuthorizedChatRecord => Boolean(chat))
        : [];
      return {
        version: 1,
        updatedAt: cleanOptional(parsed.updatedAt) || new Date(0).toISOString(),
        chats,
      };
    } catch (error: unknown) {
      logger.warn('[Authorized Chat Registry] parsing failed', error);
      return {
        version: 1,
        updatedAt: new Date(0).toISOString(),
        chats: [],
      };
    }
  }

  private write(snapshot: AuthorizedChatRegistrySnapshot): void {
    fs.mkdirSync(path.dirname(this.registryPath), { recursive: true });
    fs.writeFileSync(this.registryPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  }
}

function normalizeRecord(value: unknown, fallbackChannelId: string): AuthorizedChatRecord | null {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : null;
  const chatId = cleanOptional(record?.chatId);
  const userId = cleanOptional(record?.userId);
  if (!chatId || !userId) {
    return null;
  }
  return {
    channelId: cleanOptional(record?.channelId) || fallbackChannelId,
    chatId,
    chatType: cleanOptional(record?.chatType) || 'unknown',
    userId,
    username: cleanOptional(record?.username),
    firstName: cleanOptional(record?.firstName),
    lastSeenAt: cleanOptional(record?.lastSeenAt) || new Date(0).toISOString(),
    source: cleanOptional(record?.source) || `${fallbackChannelId}-ingress`,
  };
}

function cleanOptional(value: unknown): string | null {
  const text = String(value || '').trim();
  return text || null;
}
