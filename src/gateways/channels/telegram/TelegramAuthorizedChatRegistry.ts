import fs from 'node:fs';
import path from 'node:path';import type { Context } from 'grammy';
import { logger } from '../../../logger.js';

export type TelegramAuthorizedChatRecord = {
  chatId: string;
  chatType: string;
  userId: string;
  username: string | null;
  firstName: string | null;
  lastSeenAt: string;
  source: 'telegram-ingress';
};

export type TelegramAuthorizedChatRegistrySnapshot = {
  version: 1;
  updatedAt: string;
  chats: TelegramAuthorizedChatRecord[];
};

const DEFAULT_RELATIVE_PATH = path.join('data', 'runtime', 'telegram-authorized-chats.json');

export class TelegramAuthorizedChatRegistry {
  constructor(private readonly registryPath = path.resolve(process.cwd(), DEFAULT_RELATIVE_PATH)) {}

  public recordAuthorizedContext(ctx: Context): TelegramAuthorizedChatRecord | null {
    const chatId = String(ctx.chat?.id || '').trim();
    const userId = String(ctx.from?.id || '').trim();
    if (!chatId || !userId) {
      return null;
    }

    const now = new Date().toISOString();
    const next: TelegramAuthorizedChatRecord = {
      chatId,
      chatType: String(ctx.chat?.type || 'unknown').trim() || 'unknown',
      userId,
      username: cleanOptional(ctx.from?.username),
      firstName: cleanOptional(ctx.from?.first_name),
      lastSeenAt: now,
      source: 'telegram-ingress',
    };

    const snapshot = this.read();
    const existing = snapshot.chats.findIndex((chat) => chat.chatId === chatId && chat.userId === userId);
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

  public read(): TelegramAuthorizedChatRegistrySnapshot {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.registryPath, 'utf8')) as Partial<TelegramAuthorizedChatRegistrySnapshot>;
      const chats = Array.isArray(parsed.chats)
        ? parsed.chats
            .map((chat) => normalizeRecord(chat))
            .filter((chat): chat is TelegramAuthorizedChatRecord => Boolean(chat))
        : [];
      return {
        version: 1,
        updatedAt: cleanOptional(parsed.updatedAt) || new Date(0).toISOString(),
        chats,
      };
    } catch (error: unknown) {logger.warn('[Telegram Authorized Chat Registry] parsing failed', error);
    return {
        version: 1,
        updatedAt: new Date(0).toISOString(),
        chats: [],
      };
  }
  }

  private write(snapshot: TelegramAuthorizedChatRegistrySnapshot): void {
    fs.mkdirSync(path.dirname(this.registryPath), { recursive: true });
    fs.writeFileSync(this.registryPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  }
}

function normalizeRecord(value: unknown): TelegramAuthorizedChatRecord | null {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : null;
  const chatId = cleanOptional(record?.chatId);
  const userId = cleanOptional(record?.userId);
  if (!chatId || !userId) {
    return null;
  }
  return {
    chatId,
    chatType: cleanOptional(record?.chatType) || 'unknown',
    userId,
    username: cleanOptional(record?.username),
    firstName: cleanOptional(record?.firstName),
    lastSeenAt: cleanOptional(record?.lastSeenAt) || new Date(0).toISOString(),
    source: 'telegram-ingress',
  };
}

function cleanOptional(value: unknown): string | null {
  const text = String(value || '').trim();
  return text || null;
}
