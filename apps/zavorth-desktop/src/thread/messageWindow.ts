/**
 * Window long chat threads for render performance without a virtual-list dependency.
 * Pure helpers — safe for unit tests.
 */

export const DEFAULT_MESSAGE_WINDOW = 80;
export const MESSAGE_WINDOW_STEP = 80;

export type MessageLike = { id: string };

export type MessageWindowResult<T extends MessageLike> = {
  visible: T[];
  hiddenCount: number;
  windowSize: number;
  total: number;
  canRevealMore: boolean;
};

/**
 * Returns the trailing window of messages (most recent last).
 * When windowSize >= messages.length, returns all.
 */
export function windowMessages<T extends MessageLike>(
  messages: T[],
  windowSize: number = DEFAULT_MESSAGE_WINDOW,
): MessageWindowResult<T> {
  const total = messages.length;
  const size = Math.max(1, Math.floor(windowSize) || DEFAULT_MESSAGE_WINDOW);
  if (total <= size) {
    return {
      visible: messages,
      hiddenCount: 0,
      windowSize: size,
      total,
      canRevealMore: false,
    };
  }
  const hiddenCount = total - size;
  return {
    visible: messages.slice(hiddenCount),
    hiddenCount,
    windowSize: size,
    total,
    canRevealMore: true,
  };
}

export function nextMessageWindow(current: number, step: number = MESSAGE_WINDOW_STEP): number {
  return Math.max(DEFAULT_MESSAGE_WINDOW, current + Math.max(1, step));
}
