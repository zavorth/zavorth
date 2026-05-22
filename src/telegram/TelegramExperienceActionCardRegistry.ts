import { randomBytes } from 'crypto';
import fs from 'fs';
import path from 'path';

export type TelegramExperienceCallbackScope = {
  userId?: string | null;
  chatId?: string | null;
  sessionId?: string | null;
};

export type TelegramExperienceCallbackEntry = TelegramExperienceCallbackScope & {
  id: string;
  cardId: string;
  actionId: string;
  commandText: string;
  createdAt: number;
  expiresAt: number;
};

export type TelegramExperienceCallbackResolveResult =
  | {
      ok: true;
      entry: TelegramExperienceCallbackEntry;
    }
  | {
      ok: false;
      reason: 'invalid' | 'expired' | 'not_found' | 'forbidden';
    };

export type TelegramExperienceActionCardRegistryRuntime = {
  now?: () => number;
  ttlMs?: number;
  storePath?: string | null;
};

const CALLBACK_PREFIX = 'xcard:';
const CALLBACK_MAX_BYTES = 64;
const DEFAULT_TTL_MS = 10 * 60 * 1000;

function normalizeId(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text || null;
}

function byteLength(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

export class TelegramExperienceActionCardRegistry {
  private readonly now: () => number;
  private readonly ttlMs: number;
  private readonly storePath: string | null;
  private readonly entries = new Map<string, TelegramExperienceCallbackEntry>();

  constructor(runtime: TelegramExperienceActionCardRegistryRuntime = {}) {
    this.now = runtime.now || (() => Date.now());
    this.ttlMs = runtime.ttlMs || DEFAULT_TTL_MS;
    this.storePath = normalizeId(runtime.storePath ?? process.env.ZAVORTH_TELEGRAM_EXPERIENCE_CALLBACK_STORE);
    this.loadStore();
  }

  public register(input: {
    cardId: string;
    actionId: string;
    commandText: string;
    scope?: TelegramExperienceCallbackScope | null;
    ttlMs?: number;
  }): string {
    this.prune();
    const now = this.now();
    const ttlMs = Math.max(1_000, Math.min(input.ttlMs || this.ttlMs, 60 * 60 * 1000));
    let callbackData = '';
    for (let attempts = 0; attempts < 8; attempts += 1) {
      const opaqueId = randomBytes(9).toString('base64url');
      callbackData = `${CALLBACK_PREFIX}${opaqueId}`;
      if (byteLength(callbackData) <= CALLBACK_MAX_BYTES && !this.entries.has(callbackData)) break;
    }
    if (!callbackData || this.entries.has(callbackData)) {
      throw new Error('Unable to allocate Telegram action card callback id.');
    }

    this.entries.set(callbackData, {
      id: callbackData,
      cardId: input.cardId,
      actionId: input.actionId,
      commandText: input.commandText,
      userId: normalizeId(input.scope?.userId),
      chatId: normalizeId(input.scope?.chatId),
      sessionId: normalizeId(input.scope?.sessionId),
      createdAt: now,
      expiresAt: now + ttlMs,
    });
    this.saveStore();
    return callbackData;
  }

  public resolve(
    callbackData: unknown,
    scope: TelegramExperienceCallbackScope = {},
  ): TelegramExperienceCallbackResolveResult {
    const data = String(callbackData ?? '').trim();
    if (!this.isValidCallbackData(data)) {
      return { ok: false, reason: 'invalid' };
    }

    const entry = this.entries.get(data);
    if (!entry) {
      return { ok: false, reason: 'not_found' };
    }
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(data);
      this.saveStore();
      return { ok: false, reason: 'expired' };
    }

    const userId = normalizeId(scope.userId);
    const chatId = normalizeId(scope.chatId);
    const sessionId = normalizeId(scope.sessionId);
    if (
      (entry.userId && entry.userId !== userId)
      || (entry.chatId && entry.chatId !== chatId)
      || (entry.sessionId && entry.sessionId !== sessionId)
    ) {
      return { ok: false, reason: 'forbidden' };
    }
    this.prune();
    return { ok: true, entry };
  }

  public size(): number {
    this.prune();
    return this.entries.size;
  }

  public clear(): void {
    this.entries.clear();
    this.saveStore();
  }

  private isValidCallbackData(data: string): boolean {
    return data.startsWith(CALLBACK_PREFIX)
      && byteLength(data) <= CALLBACK_MAX_BYTES
      && /^xcard:[A-Za-z0-9_-]{8,40}$/.test(data);
  }

  private prune(): void {
    const now = this.now();
    let changed = false;
    for (const [key, entry] of this.entries.entries()) {
      if (entry.expiresAt <= now) {
        this.entries.delete(key);
        changed = true;
      }
    }
    if (changed) {
      this.saveStore();
    }
  }

  private loadStore(): void {
    if (!this.storePath) return;
    try {
      if (!fs.existsSync(this.storePath)) return;
      const parsed = JSON.parse(fs.readFileSync(this.storePath, 'utf8')) as { entries?: TelegramExperienceCallbackEntry[] };
      const now = this.now();
      for (const entry of Array.isArray(parsed.entries) ? parsed.entries : []) {
        if (!this.isValidCallbackData(entry?.id) || entry.expiresAt <= now) {
          continue;
        }
        this.entries.set(entry.id, {
          id: entry.id,
          cardId: normalizeId(entry.cardId) || 'unknown-card',
          actionId: normalizeId(entry.actionId) || 'unknown-action',
          commandText: normalizeId(entry.commandText) || '',
          userId: normalizeId(entry.userId),
          chatId: normalizeId(entry.chatId),
          sessionId: normalizeId(entry.sessionId),
          createdAt: Number.isFinite(Number(entry.createdAt)) ? Number(entry.createdAt) : now,
          expiresAt: Number(entry.expiresAt),
        });
      }
    } catch {
      this.entries.clear();
    }
  }

  private saveStore(): void {
    if (!this.storePath) return;
    const entries = Array.from(this.entries.values()).filter((entry) => entry.expiresAt > this.now());
    const payload = {
      version: 'telegram-experience-action-card-callbacks/v1',
      updatedAt: new Date(this.now()).toISOString(),
      entries,
    };
    fs.mkdirSync(path.dirname(this.storePath), { recursive: true });
    fs.writeFileSync(this.storePath, `${JSON.stringify(payload, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  }
}

export const defaultTelegramExperienceActionCardRegistry = new TelegramExperienceActionCardRegistry();
