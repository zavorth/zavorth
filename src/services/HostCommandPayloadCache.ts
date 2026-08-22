export interface CachedPayload {
  command: string;
  args: string[];
  cwd: string;
  createdAt: number;
}

export class HostCommandPayloadCache {
  private static instance: HostCommandPayloadCache | null = null;
  private readonly cache = new Map<string, CachedPayload>();
  private readonly TTL_MS = 30 * 60 * 1000; // 30 minutes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private cleanupInterval: any;

  private constructor() {
    // Periodic cleanup of expired entries
    this.cleanupInterval = setInterval(() => this.prune(), 60 * 1000);
    if (this.cleanupInterval && typeof this.cleanupInterval.unref === 'function') {
      this.cleanupInterval.unref();
    }
  }

  public static getInstance(): HostCommandPayloadCache {
    if (!HostCommandPayloadCache.instance) {
      HostCommandPayloadCache.instance = new HostCommandPayloadCache();
    }
    return HostCommandPayloadCache.instance;
  }

  public set(operationId: string, command: string, args: string[], cwd: string): void {
    this.cache.set(operationId, {
      command,
      args,
      cwd,
      createdAt: Date.now()
    });
  }

  public get(operationId: string): CachedPayload | undefined {
    const entry = this.cache.get(operationId);
    if (!entry) return undefined;
    if (Date.now() - entry.createdAt > this.TTL_MS) {
      this.cache.delete(operationId);
      return undefined;
    }
    return entry;
  }

  public delete(operationId: string): void {
    this.cache.delete(operationId);
  }

  public clear(): void {
    this.cache.clear();
  }

  public prune(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.createdAt > this.TTL_MS) {
        this.cache.delete(key);
      }
    }
  }

  // Helper for tests to clean up intervals
  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
    HostCommandPayloadCache.instance = null;
  }
}
