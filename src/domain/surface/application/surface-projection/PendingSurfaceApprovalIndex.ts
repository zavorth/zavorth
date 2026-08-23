/**
 * Maps chat+message → pending approval so reactions / voice can resolve task id
 * without the user retyping the UUID.
 */

export type PendingSurfaceApprovalEntry = {
  approvalId: string;
  surface: string;
  chatId: string;
  messageId: string;
  highRisk?: boolean;
  numberedOptions?: string[];
  createdAt: number;
  expiresAt: number;
};

const DEFAULT_TTL_MS = 30 * 60 * 1000;
const store = new Map<string, PendingSurfaceApprovalEntry>();

function key(surface: string, chatId: string, messageId: string): string {
  return `${String(surface).toLowerCase()}::${chatId}::${messageId}`;
}

function chatKey(surface: string, chatId: string): string {
  return `${String(surface).toLowerCase()}::chat::${chatId}`;
}

const latestByChat = new Map<string, string>(); // chatKey → full key

export function registerPendingSurfaceApproval(input: {
  approvalId: string;
  surface: string;
  chatId: string | number;
  messageId: string | number;
  highRisk?: boolean;
  numberedOptions?: string[];
  ttlMs?: number;
}): PendingSurfaceApprovalEntry {
  const surface = String(input.surface || 'plain').toLowerCase();
  const chatId = String(input.chatId);
  const messageId = String(input.messageId);
  const now = Date.now();
  const entry: PendingSurfaceApprovalEntry = {
    approvalId: String(input.approvalId).trim(),
    surface,
    chatId,
    messageId,
    highRisk: Boolean(input.highRisk),
    numberedOptions: input.numberedOptions,
    createdAt: now,
    expiresAt: now + Math.max(60_000, input.ttlMs ?? DEFAULT_TTL_MS),
  };
  const k = key(surface, chatId, messageId);
  store.set(k, entry);
  latestByChat.set(chatKey(surface, chatId), k);
  pruneExpired();
  return entry;
}

export function resolvePendingSurfaceApproval(input: {
  surface: string;
  chatId: string | number;
  messageId?: string | number | null;
}): PendingSurfaceApprovalEntry | null {
  pruneExpired();
  const surface = String(input.surface || 'plain').toLowerCase();
  const chatId = String(input.chatId);
  if (input.messageId != null && String(input.messageId).trim()) {
    const entry = store.get(key(surface, chatId, String(input.messageId)));
    if (entry && entry.expiresAt > Date.now()) return entry;
  }
  const latestKey = latestByChat.get(chatKey(surface, chatId));
  if (!latestKey) return null;
  const entry = store.get(latestKey);
  if (!entry || entry.expiresAt <= Date.now()) return null;
  return entry;
}

export function clearPendingSurfaceApproval(input: {
  surface: string;
  chatId: string | number;
  messageId?: string | number | null;
  approvalId?: string | null;
}): void {
  const surface = String(input.surface || 'plain').toLowerCase();
  const chatId = String(input.chatId);
  if (input.messageId != null) {
    store.delete(key(surface, chatId, String(input.messageId)));
  }
  if (input.approvalId) {
    for (const [k, entry] of store.entries()) {
      if (entry.surface === surface && entry.chatId === chatId && entry.approvalId === input.approvalId) {
        store.delete(k);
      }
    }
  }
  const ck = chatKey(surface, chatId);
  const latest = latestByChat.get(ck);
  if (latest && !store.has(latest)) {
    latestByChat.delete(ck);
  }
}

/**
 * Retires every rendered presenter of an approval across ALL surfaces. The
 * approval spine calls this when a decision lands on any surface, so taps and
 * numbered replies against stale cards elsewhere resolve to nothing instead
 * of re-executing a decision that already happened.
 */
export function clearPendingSurfaceApprovalsByApprovalId(approvalId: string): number {
  const normalized = String(approvalId || '').trim();
  if (!normalized) {
    return 0;
  }
  let removed = 0;
  for (const [k, entry] of [...store.entries()]) {
    if (entry.approvalId !== normalized) {
      continue;
    }
    store.delete(k);
    removed += 1;
    const ck = chatKey(entry.surface, entry.chatId);
    if (latestByChat.get(ck) === k) {
      latestByChat.delete(ck);
    }
  }
  return removed;
}

export function resetPendingSurfaceApprovalIndexForTests(): void {
  store.clear();
  latestByChat.clear();
}

function pruneExpired(): void {
  const now = Date.now();
  for (const [k, entry] of store.entries()) {
    if (entry.expiresAt <= now) store.delete(k);
  }
}
