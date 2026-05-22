import { randomBytes } from 'crypto';

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
  private readonly entries = new Map<string, TelegramExperienceCallbackEntry>();

  constructor(runtime: TelegramExperienceActionCardRegistryRuntime = {}) {
    this.now = runtime.now || (() => Date.now());
    this.ttlMs = runtime.ttlMs || DEFAULT_TTL_MS;
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
  }

  private isValidCallbackData(data: string): boolean {
    return data.startsWith(CALLBACK_PREFIX)
      && byteLength(data) <= CALLBACK_MAX_BYTES
      && /^xcard:[A-Za-z0-9_-]{8,40}$/.test(data);
  }

  private prune(): void {
    const now = this.now();
    for (const [key, entry] of this.entries.entries()) {
      if (entry.expiresAt <= now) {
        this.entries.delete(key);
      }
    }
  }
}

export const defaultTelegramExperienceActionCardRegistry = new TelegramExperienceActionCardRegistry();
