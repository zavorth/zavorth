/**
 * In-memory pub/sub for realtime duplex turn/phase events (SSE push).
 * Per-session listeners; cleaned up when empty.
 */

import type { VoiceDuplexSessionSnapshot } from './VoiceRealtimeDuplexSession.js';

export type VoiceDuplexEventType =
  | 'session'
  | 'turn'
  | 'phase'
  | 'partial'
  | 'barge_in'
  | 'error'
  | 'ended';

export type VoiceDuplexEvent = {
  type: VoiceDuplexEventType;
  sessionId: string;
  at: string;
  session?: VoiceDuplexSessionSnapshot | Record<string, unknown>;
  message?: string;
  /** Gap 6 — interim STT text while buffering utterance */
  partialText?: string;
};

export type VoiceDuplexEventListener = (event: VoiceDuplexEvent) => void;

const MAX_LISTENERS_PER_SESSION = 32;

const listenersBySession = new Map<string, Set<VoiceDuplexEventListener>>();

export function subscribe(
  sessionId: string,
  listener: VoiceDuplexEventListener,
): () => void {
  const id = String(sessionId || '').trim();
  if (!id) {
    return () => undefined;
  }

  let set = listenersBySession.get(id);
  if (!set) {
    set = new Set();
    listenersBySession.set(id, set);
  }

  if (set.size >= MAX_LISTENERS_PER_SESSION) {
    // Drop oldest by re-creating without first entry (Set insertion order).
    const first = set.values().next().value;
    if (first) set.delete(first);
  }

  set.add(listener);

  return () => {
    const current = listenersBySession.get(id);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) {
      listenersBySession.delete(id);
    }
  };
}

export function publish(sessionId: string, event: VoiceDuplexEvent): void {
  const id = String(sessionId || '').trim();
  if (!id) return;
  const set = listenersBySession.get(id);
  if (!set || set.size === 0) return;

  // Copy to tolerate unsubscribe during notify.
  for (const listener of [...set]) {
    try {
      listener(event);
    } catch {
      // Never let a bad subscriber break publishers.
    }
  }
}

/**
 * Publish a duplex snapshot to all subscribers for that session.
 * Infers type from phase when not provided:
 *   ended → ended, error → error, otherwise → phase
 * Callers should pass type 'session' | 'turn' when more specific.
 */
export function publishToSession(
  snapshot: VoiceDuplexSessionSnapshot,
  type?: VoiceDuplexEventType,
  message?: string,
): void {
  if (!snapshot?.sessionId) return;

  const inferred: VoiceDuplexEventType =
    type ||
    (snapshot.phase === 'ended'
      ? 'ended'
      : snapshot.phase === 'error'
        ? 'error'
        : 'phase');

  const msg =
    message ??
    (snapshot.lastError && (inferred === 'error' || snapshot.phase === 'error')
      ? snapshot.lastError
      : undefined);

  publish(snapshot.sessionId, {
    type: inferred,
    sessionId: snapshot.sessionId,
    at: new Date().toISOString(),
    session: snapshot,
    ...(msg ? { message: msg } : {}),
  });
}

/**
 * Long-poll friendly wait for the next event on a session (Desktop bridge path).
 * Resolves with the event, or null on timeout / empty sessionId.
 */
export function waitForEvent(
  sessionId: string,
  timeoutMs = 25_000,
): Promise<VoiceDuplexEvent | null> {
  const id = String(sessionId || '').trim();
  if (!id) return Promise.resolve(null);
  const wait = Math.max(500, Math.min(60_000, Number(timeoutMs) || 25_000));

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: VoiceDuplexEvent | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsub();
      resolve(value);
    };
    const unsub = subscribe(id, (event) => finish(event));
    const timer = setTimeout(() => finish(null), wait);
    timer.unref?.();
  });
}

export function getVoiceDuplexEventListenerCount(sessionId?: string): number {
  if (sessionId) {
    return listenersBySession.get(String(sessionId).trim())?.size ?? 0;
  }
  let total = 0;
  for (const set of listenersBySession.values()) total += set.size;
  return total;
}

export function resetVoiceDuplexEventBusForTests(): void {
  listenersBySession.clear();
}
