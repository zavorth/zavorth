export interface SessionInfo {
  sessionId: string;
  createdAt: number;
  lastTouchedAt: number;
  keyId?: string;
  messageCount: number;
}

const sessions = new Map<string, SessionInfo>();
const sessionKeys = new Map<string, Set<string>>();

export function generateSessionId(body: Record<string, unknown>): string | null {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0 && body.input === undefined) return null;
  const fingerprint = JSON.stringify({
    m: messages.slice(0, 3).map((msg) => (msg as Record<string, unknown>).role ?? null),
    model: body.model ?? null,
  });
  return hashString(fingerprint);
}

export function touchSession(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.lastTouchedAt = Date.now();
    sessions.set(sessionId, session);
  } else {
    sessions.set(sessionId, { sessionId, createdAt: Date.now(), lastTouchedAt: Date.now(), messageCount: 0 });
  }
  pruneStaleSessions();
}

export function checkSessionLimit(
  keyId: string,
  limit: number
): { message: string } | null {
  pruneStaleSessions();
  const registered = sessionKeys.get(keyId);
  const count = registered ? registered.size : 0;
  if (count >= limit) {
    return {
      message: `Session limit reached (${count}/${limit} active sessions for this key). Close a session or wait for it to expire.`,
    };
  }
  return null;
}

export function extractExternalSessionId(headers: Headers): string | null {
  return headers.get("x-session-id") ?? headers.get("x-zavorth-session") ?? null;
}

export function registerKeySession(keyId: string, sessionId: string): void {
  let set = sessionKeys.get(keyId);
  if (!set) {
    set = new Set();
    sessionKeys.set(keyId, set);
  }
  set.add(sessionId);
}

export function isSessionRegisteredForKey(keyId: string, sessionId: string): boolean {
  return sessionKeys.get(keyId)?.has(sessionId) ?? false;
}

export function getActiveSessions(): SessionInfo[] {
  pruneStaleSessions();
  return Array.from(sessions.values());
}

export function getActiveSessionCount(): number {
  pruneStaleSessions();
  return sessions.size;
}

export function getAllActiveSessionCountsByKey(): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [keyId, set] of sessionKeys.entries()) {
    result[keyId] = set.size;
  }
  return result;
}

function pruneStaleSessions(): void {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [id, session] of sessions.entries()) {
    if (session.lastTouchedAt < cutoff) {
      sessions.delete(id);
      for (const set of sessionKeys.values()) {
        set.delete(id);
      }
    }
  }
}

function hashString(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return `sess_${Math.abs(hash).toString(36)}`;
}
