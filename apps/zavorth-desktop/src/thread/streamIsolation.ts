/**
 * Helpers for streaming isolation / message list performance.
 * Pure helpers — safe for unit tests.
 */

export type StreamSlice<T extends { id: string; role?: string }> = {
  frozen: T[]; // messages before last streaming assistant (stable)
  live: T | null; // last assistant if streaming
  tail: T[]; // any after live (usually empty)
  streamingId: string | null;
};

/**
 * If busy and last message is assistant, that is live; rest frozen.
 * If streamingMessageId provided, use that.
 * Else no live.
 */
export function sliceStreamingMessages<T extends { id: string; role?: string }>(
  messages: T[],
  opts: { busy: boolean; streamingMessageId?: string | null },
): StreamSlice<T> {
  const list = Array.isArray(messages) ? messages : [];
  const empty: StreamSlice<T> = {
    frozen: list,
    live: null,
    tail: [],
    streamingId: null,
  };

  if (list.length === 0) {
    return { frozen: [], live: null, tail: [], streamingId: null };
  }

  const explicitId =
    opts.streamingMessageId != null && String(opts.streamingMessageId).length > 0
      ? String(opts.streamingMessageId)
      : null;

  if (explicitId) {
    const idx = list.findIndex((m) => m.id === explicitId);
    if (idx < 0) {
      return empty;
    }
    return {
      frozen: list.slice(0, idx),
      live: list[idx],
      tail: list.slice(idx + 1),
      streamingId: explicitId,
    };
  }

  if (!opts.busy) {
    return empty;
  }

  // busy: last assistant message is live
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const role = list[i].role;
    if (role === 'assistant') {
      return {
        frozen: list.slice(0, i),
        live: list[i],
        tail: list.slice(i + 1),
        streamingId: list[i].id,
      };
    }
  }

  return empty;
}

/**
 * false if same id and streaming (avoid remount during token stream).
 */
export function shouldRemountMessage(
  prevId: string,
  nextId: string,
  isStreaming: boolean,
): boolean {
  if (prevId === nextId && isStreaming) return false;
  if (prevId === nextId) return false;
  return true;
}
