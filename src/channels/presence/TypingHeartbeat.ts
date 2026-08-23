export type TypingHeartbeatOptions = {
  /** Sends one presence action (for example a chat "typing" action). */
  sendAction: () => Promise<unknown>;
  /** Delay between renewal actions. Must stay below platform expiry (~5s on Telegram). */
  intervalMs?: number;
  /** Hard lifetime cap; the heartbeat always stops itself after this long. */
  maxDurationMs?: number;
};

const DEFAULT_INTERVAL_MS = 4000;
const DEFAULT_MAX_DURATION_MS = 120000;

/**
 * Renews a chat presence action on an interval so the indicator survives long
 * operations. Self-limiting: it always stops itself once the maximum duration
 * elapses even if stop() is never called, so a forgotten heartbeat can never
 * leak timers or renew forever.
 */
export class TypingHeartbeat {
  private readonly sendAction: () => Promise<unknown>;
  private readonly intervalMs: number;
  private readonly maxDurationMs: number;
  private renewalTimer: ReturnType<typeof setTimeout> | null = null;
  private stopTimer: ReturnType<typeof setTimeout> | null = null;
  private running = false;

  constructor(options: TypingHeartbeatOptions) {
    this.sendAction = options.sendAction;
    this.intervalMs = Math.max(250, options.intervalMs ?? DEFAULT_INTERVAL_MS);
    this.maxDurationMs = Math.max(this.intervalMs, options.maxDurationMs ?? DEFAULT_MAX_DURATION_MS);
  }

  public start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    void this.renew();
    this.renewalTimer = setInterval(() => {
      void this.renew();
    }, this.intervalMs);
    this.stopTimer = setTimeout(() => {
      this.stop();
    }, this.maxDurationMs);
  }

  public stop(): void {
    this.running = false;
    if (this.renewalTimer !== null) {
      clearInterval(this.renewalTimer);
      this.renewalTimer = null;
    }
    if (this.stopTimer !== null) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
  }

  private async renew(): Promise<void> {
    try {
      await this.sendAction();
    } catch {
      // Presence actions are best-effort; delivery failures must not surface.
    }
  }
}
