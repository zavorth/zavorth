/**
 * Pure message queue for the composer when the agent is busy.
 */

export type QueuedPrompt = {
  id: string;
  text: string;
  createdAt: number;
};

export const MAX_QUEUE_LENGTH = 20;

let queueIdSeq = 0;

/** Create a unique queue item id (injectable-friendly pure factory). */
export function createQueueId(
  now: () => number = Date.now,
  random: () => string = () => Math.random().toString(36).slice(2, 10),
): string {
  queueIdSeq += 1;
  return `q-${now().toString(36)}-${random()}-${queueIdSeq}`;
}

/**
 * Append a prompt to the queue. Empty/whitespace text is rejected (queue unchanged).
 * When length would exceed MAX_QUEUE_LENGTH, oldest items are trimmed.
 */
export function enqueuePrompt(
  queue: QueuedPrompt[],
  text: string,
  now: number = Date.now(),
  idFactory: () => string = createQueueId,
): QueuedPrompt[] {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return queue;

  const item: QueuedPrompt = {
    id: idFactory(),
    text: trimmed,
    createdAt: now,
  };

  const next = [...queue, item];
  if (next.length <= MAX_QUEUE_LENGTH) return next;
  // Trim oldest (front) until at cap
  return next.slice(next.length - MAX_QUEUE_LENGTH);
}

export function dequeuePrompt(queue: QueuedPrompt[]): {
  next: QueuedPrompt | null;
  remaining: QueuedPrompt[];
} {
  if (!queue.length) {
    return { next: null, remaining: [] };
  }
  const [next, ...remaining] = queue;
  return { next: next ?? null, remaining };
}

export function removeQueuedPrompt(queue: QueuedPrompt[], id: string): QueuedPrompt[] {
  return queue.filter((item) => item.id !== id);
}

export function clearQueue(_queue: QueuedPrompt[]): QueuedPrompt[] {
  return [];
}

/**
 * Whether the user can send immediately, should queue, or is blocked.
 * Empty text is handled by the caller before calling this.
 * - !busy → send
 * - busy and queue at cap → blocked
 * - busy → queue
 */
export function canSubmitNow(
  busy: boolean,
  queueLength: number,
): 'send' | 'queue' | 'blocked' {
  if (!busy) return 'send';
  if (queueLength >= MAX_QUEUE_LENGTH) return 'blocked';
  return 'queue';
}

export function peekQueue(queue: QueuedPrompt[]): QueuedPrompt | null {
  return queue[0] ?? null;
}

/**
 * When the agent is no longer busy and the queue has items, dequeue the first
 * prompt for auto-submit. Otherwise leave the queue unchanged.
 */
export function nextAutoSubmit(
  busy: boolean,
  queue: QueuedPrompt[],
): { prompt: QueuedPrompt | null; remaining: QueuedPrompt[] } {
  if (busy || !queue.length) {
    return { prompt: null, remaining: queue };
  }
  const { next, remaining } = dequeuePrompt(queue);
  return { prompt: next, remaining };
}
