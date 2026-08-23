/**
 * Pure PTY session selection and polling policies for the terminal panel —
 * no React, no DOM, safe for unit tests.
 */
import type { PtyRegistryEntry } from '../apiClient';

/**
 * Pick the registry entry a panel tab should attach to. Preference order:
 * 1. an alive entry whose sessionId carries the requested kind prefix
 *    (e.g. "shell:" tabs prefer shell-owned sessions),
 * 2. any alive entry in the workspace,
 * 3. null when nothing is running (the panel shows the honest empty state).
 */
export function pickPtySession(
  entries: PtyRegistryEntry[],
  sessionKey?: string,
): PtyRegistryEntry | null {
  const alive = (entries || []).filter(
    (entry) => entry && typeof entry.sessionId === 'string' && entry.sessionId.length > 0,
  );
  if (alive.length === 0) return null;

  const kind = String(sessionKey || '').split(':')[0];
  if (kind) {
    const owned = alive.find((entry) => String(entry.sessionId).startsWith(`${kind}:`));
    if (owned) return owned;
  }
  return alive[0];
}

const POLL_BASE_MS = 200;
const POLL_MAX_MS = 5000;

/** Exponential poll backoff after failures: 200 -> 400 -> ... capped at 5s. */
export function nextPollBackoffMs(failureCount: number): number {
  const clamped = Number.isFinite(failureCount) && failureCount > 0 ? Math.floor(failureCount) : 0;
  return Math.min(POLL_BASE_MS * 2 ** clamped, POLL_MAX_MS);
}
