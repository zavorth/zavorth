export type MinimalRuntimeEvent = {
  type: string;
  payload?: unknown;
  emittedAt: string;
};

export type MinimalRuntimeEventListener = (event: MinimalRuntimeEvent) => void | Promise<void>;

export type MinimalRuntimeEventBusSnapshot = {
  version: 1;
  generatedAt: string;
  listenerTypes: number;
  listenerCount: number;
  emittedEvents: number;
  failedDeliveries: number;
  recentEvents: Array<{
    type: string;
    emittedAt: string;
    listenerCount: number;
  }>;
};

export class MinimalRuntimeEventBus {
  private readonly listeners = new Map<string, Set<MinimalRuntimeEventListener>>();
  private readonly recentEvents: MinimalRuntimeEventBusSnapshot['recentEvents'] = [];
  private emittedEvents = 0;
  private failedDeliveries = 0;

  public on(type: string, listener: MinimalRuntimeEventListener): () => void {
    const normalized = this.normalizeType(type);
    const bucket = this.listeners.get(normalized) || new Set<MinimalRuntimeEventListener>();
    bucket.add(listener);
    this.listeners.set(normalized, bucket);
    return () => bucket.delete(listener);
  }

  public async emit(type: string, payload?: unknown): Promise<void> {
    const event: MinimalRuntimeEvent = {
      type: this.normalizeType(type),
      payload,
      emittedAt: new Date().toISOString(),
    };
    const listeners = [
      ...(this.listeners.get(event.type) || []),
      ...(this.listeners.get('*') || []),
    ];
    this.emittedEvents += 1;
    this.recentEvents.push({
      type: event.type,
      emittedAt: event.emittedAt,
      listenerCount: listeners.length,
    });
    this.recentEvents.splice(0, Math.max(0, this.recentEvents.length - 20));

    for (const listener of listeners) {
      try {
        await listener(event);
      } catch (error: unknown) {this.failedDeliveries += 1;
      }
    }
  }

  public snapshot(): MinimalRuntimeEventBusSnapshot {
    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      listenerTypes: this.listeners.size,
      listenerCount: Array.from(this.listeners.values()).reduce((total, bucket) => total + bucket.size, 0),
      emittedEvents: this.emittedEvents,
      failedDeliveries: this.failedDeliveries,
      recentEvents: this.recentEvents.slice(),
    };
  }

  private normalizeType(type: string): string {
    return String(type || '').trim() || '*';
  }
}
