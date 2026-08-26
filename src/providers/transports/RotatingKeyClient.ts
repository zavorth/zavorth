import { isProviderAbortError } from '../ProviderAbort.js';

export interface KeyRotationHooks {
  signal?: AbortSignal;
  onKeyFailure?(keyNumber: number, totalKeys: number, error: unknown): void;
  onFailoverSuccess?(keyNumber: number, totalKeys: number): void;
  exhaustionError(lastError: unknown): unknown;
}

export interface StreamingKeyOperation<TClient, TChunk, TEvent> {
  open(client: TClient): Promise<AsyncIterable<TChunk>>;
  prologue?(): Iterable<TEvent>;
  project(chunk: TChunk): Iterable<TEvent>;
}

export class RotatingKeyClient<TClient> {
  private readonly clients: readonly TClient[];
  /** Shared index across run() and stream() for deliberate cross-operation load-distribution rotation. */
  private index = 0;

  constructor(clients: readonly TClient[]) {
    if (clients.length === 0) {
      throw new Error('At least one client is required for key rotation');
    }
    this.clients = clients;
  }

  get size(): number {
    return this.clients.length;
  }

  get currentIndex(): number {
    return this.index;
  }

  async run<TResult>(
    operation: (client: TClient) => Promise<TResult>,
    hooks: KeyRotationHooks,
  ): Promise<TResult> {
    let lastError: unknown;
    for (let attempt = 0; attempt < this.clients.length; attempt += 1) {
      const clientIndex = (this.index + attempt) % this.clients.length;
      try {
        const result = await operation(this.clients[clientIndex]);
        if (attempt > 0) {
          hooks.onFailoverSuccess?.(clientIndex + 1, this.clients.length);
        }
        this.index = clientIndex;
        return result;
      } catch (error: unknown) {
        if (isProviderAbortError(error, hooks.signal)) {
          throw error;
        }
        lastError = error;
        hooks.onKeyFailure?.(clientIndex + 1, this.clients.length, error);
      }
    }
    throw hooks.exhaustionError(lastError);
  }

  async *stream<TChunk, TEvent>(
    operation: StreamingKeyOperation<TClient, TChunk, TEvent>,
    hooks: KeyRotationHooks,
  ): AsyncGenerator<TEvent> {
    let lastError: unknown;
    for (let attempt = 0; attempt < this.clients.length; attempt += 1) {
      const clientIndex = (this.index + attempt) % this.clients.length;
      try {
        const iterable = await operation.open(this.clients[clientIndex]);
        if (attempt > 0) {
          hooks.onFailoverSuccess?.(clientIndex + 1, this.clients.length);
        }
        this.index = clientIndex;
        if (operation.prologue) {
          for (const event of operation.prologue()) {
            yield event;
          }
        }
        for await (const chunk of iterable) {
          for (const event of operation.project(chunk)) {
            yield event;
          }
        }
        return;
      } catch (error: unknown) {
        if (isProviderAbortError(error, hooks.signal)) {
          throw error;
        }
        lastError = error;
        hooks.onKeyFailure?.(clientIndex + 1, this.clients.length, error);
      }
    }
    throw hooks.exhaustionError(lastError);
  }
}
