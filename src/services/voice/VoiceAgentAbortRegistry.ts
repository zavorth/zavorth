/**
 * In-process registry so barge-in AbortSignal reaches LLM chatDetailed.
 * Signals are never serialized to disk/JSON.
 */

const byDuplexSession = new Map<string, AbortSignal>();

export function registerVoiceAgentAbort(duplexSessionId: string, signal: AbortSignal): void {
  const id = String(duplexSessionId || '').trim();
  if (!id) return;
  byDuplexSession.set(id, signal);
  const cleanup = () => {
    if (byDuplexSession.get(id) === signal) {
      byDuplexSession.delete(id);
    }
  };
  if (signal.aborted) cleanup();
  else signal.addEventListener('abort', cleanup, { once: true });
}

export function unregisterVoiceAgentAbort(duplexSessionId: string): void {
  byDuplexSession.delete(String(duplexSessionId || '').trim());
}

export function getVoiceAgentAbort(duplexSessionId: string | null | undefined): AbortSignal | null {
  const id = String(duplexSessionId || '').trim();
  if (!id) return null;
  return byDuplexSession.get(id) || null;
}

/**
 * Extract abort signal from agent request metadata (in-process voice duplex).
 */
export function resolveAbortSignalFromRequestMetadata(
  metadata: Record<string, unknown> | null | undefined,
): AbortSignal | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const direct = metadata.voiceAbortSignal;
  if (direct && typeof (direct as AbortSignal).aborted === 'boolean') {
    return direct as AbortSignal;
  }
  const duplexId = String(metadata.duplexSessionId || '').trim();
  if (duplexId) {
    return getVoiceAgentAbort(duplexId);
  }
  return null;
}

export function resetVoiceAgentAbortRegistryForTests(): void {
  byDuplexSession.clear();
}
