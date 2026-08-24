import { asMemoryBackendV2, type IMemoryBackendV2 } from './MemoryBackendCompat.js';
import type { IMemoryBackend, MemoryRecord, MemoryWriteOptions } from './IMemoryBackend.js';
import { logger } from '../../logger.js';

export type MemoryWriteRequest = {
  userId: string;
  content: string;
  options?: MemoryWriteOptions;
};

export type MemoryWriteOutcomeStatus = 'completed' | 'failed' | 'timeout' | 'abandoned';

export type MemoryWriteOutcome = {
  status: MemoryWriteOutcomeStatus;
  record: MemoryRecord | null;
  durationMs: number;
  error: string | null;
};

export type MemoryWriteDrainReport = {
  completed: number;
  failed: number;
  timedOut: number;
  abandoned: number;
};

export type MemoryWriteWorkerStats = {
  queued: number;
  inFlight: boolean;
  completed: number;
  failed: number;
  timedOut: number;
  abandoned: number;
};

export type MemoryWriteWorkerOptions = {
  /** Bounded wait per write before it is reported as timed out. */
  writeTimeoutMs?: number;
  now?: () => number;
};

type QueueEntry = {
  request: MemoryWriteRequest;
  resolve: (outcome: MemoryWriteOutcome) => void;
  enqueuedAtMs: number;
  settled: boolean;
};

const DEFAULT_WRITE_TIMEOUT_MS = 5_000;

class MemoryWriteTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Memory write exceeded ${timeoutMs}ms.`);
    this.name = 'MemoryWriteTimeoutError';
  }
}

/**
 * Serialized background write pipeline over the governed v2 memory path.
 *
 * Every write goes through `asMemoryBackendV2(...).addMemoryRecord`, one at a
 * time, each bounded by `writeTimeoutMs`. Callers are never delayed beyond the
 * timeout window and promises never reject; shutdown calls `drain()` which
 * resolves or reports every pending write as abandoned.
 */
export class MemoryWriteWorker {
  private readonly backendV2: IMemoryBackendV2;
  private readonly writeTimeoutMs: number;
  private readonly now: () => number;
  private readonly queue: QueueEntry[] = [];
  private processing = false;
  private inFlight = false;
  private currentEntry: QueueEntry | null = null;
  private counters = {
    completed: 0,
    failed: 0,
    timedOut: 0,
    abandoned: 0,
  };

  constructor(backend: IMemoryBackend, options: MemoryWriteWorkerOptions = {}) {
    this.backendV2 = asMemoryBackendV2(backend);
    this.writeTimeoutMs = Math.max(1, options.writeTimeoutMs ?? DEFAULT_WRITE_TIMEOUT_MS);
    this.now = options.now || (() => Date.now());
  }

  public get backendName(): string {
    return this.backendV2.name;
  }

  public enqueue(request: MemoryWriteRequest): Promise<MemoryWriteOutcome> {
    return new Promise<MemoryWriteOutcome>((resolve) => {
      this.queue.push({ request, resolve, enqueuedAtMs: this.now(), settled: false });
      void this.processQueue();
    });
  }

  public getStats(): MemoryWriteWorkerStats {
    return {
      queued: this.queue.length,
      inFlight: this.inFlight,
      ...this.counters,
    };
  }

  /**
   * Shutdown primitive: waits for queued/in-flight writes up to `drainWindowMs`,
   * then abandons whatever remains. The returned report states exactly how many
   * writes were abandoned so operators know what did not persist.
   */
  public async drain(drainWindowMs: number = DEFAULT_WRITE_TIMEOUT_MS): Promise<MemoryWriteDrainReport> {
    const deadlineMs = this.now() + Math.max(0, drainWindowMs);
    while ((this.queue.length > 0 || this.inFlight) && this.now() < deadlineMs) {
      await new Promise<void>((resolve) => {
        const poll = setTimeout(resolve, 10);
        poll.unref();
      });
    }
    const abandoned = this.queue.splice(0, this.queue.length);
    if (this.currentEntry) {
      abandoned.push(this.currentEntry);
      this.currentEntry = null;
    }
    for (const entry of abandoned) {
      entry.settled = true;
      entry.resolve({
        status: 'abandoned',
        record: null,
        durationMs: Math.max(0, this.now() - entry.enqueuedAtMs),
        error: 'Abandoned by shutdown drain.',
      });
    }
    this.counters.abandoned += abandoned.length;
    if (abandoned.length > 0) {
      logger.warn('[MemoryWriteWorker] drain abandoned pending writes', {
        count: abandoned.length,
        backend: this.backendName,
      });
    }
    return { ...this.counters };
  }

  private async processQueue(): Promise<void> {
    if (this.processing) {
      return;
    }
    this.processing = true;
    try {
      while (this.queue.length > 0) {
        const entry = this.queue.shift();
        if (!entry || entry.settled) {
          continue;
        }
        this.inFlight = true;
        this.currentEntry = entry;
        const outcome = await this.writeWithTimeout(entry.request);
        this.inFlight = false;
        if (entry.settled) {
          continue;
        }
        this.currentEntry = null;
        if (outcome.status === 'completed') this.counters.completed += 1;
        else if (outcome.status === 'timeout') this.counters.timedOut += 1;
        else if (outcome.status === 'failed') this.counters.failed += 1;
        entry.settled = true;
        entry.resolve(outcome);
      }
    } finally {
      this.processing = false;
      this.inFlight = false;
      this.currentEntry = null;
    }
  }

  private async writeWithTimeout(request: MemoryWriteRequest): Promise<MemoryWriteOutcome> {
    const startedAtMs = this.now();
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      const writePromise = this.backendV2.addMemoryRecord(
        request.userId,
        request.content,
        request.options,
      );
      const timeoutPromise = new Promise<never>((_, rejectTimeout) => {
        timer = setTimeout(() => rejectTimeout(new MemoryWriteTimeoutError(this.writeTimeoutMs)), this.writeTimeoutMs);
        timer.unref();
      });
      const record = await Promise.race([writePromise, timeoutPromise]);
      return {
        status: 'completed',
        record,
        durationMs: Math.max(0, this.now() - startedAtMs),
        error: null,
      };
    } catch (error: unknown) {
      const timedOut = error instanceof MemoryWriteTimeoutError;
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('[MemoryWriteWorker] background write did not complete', {
        status: timedOut ? 'timeout' : 'failed',
        backend: this.backendName,
        error: message,
      });
      return {
        status: timedOut ? 'timeout' : 'failed',
        record: null,
        durationMs: Math.max(0, this.now() - startedAtMs),
        error: message,
      };
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }
}

type SharedWorkerRegistry = {
  workers: MemoryWriteWorker[];
};

const sharedWorkers: SharedWorkerRegistry = { workers: [] };

/** Registers a worker for process-wide shutdown draining. */
export function registerSharedMemoryWriteWorker(worker: MemoryWriteWorker): void {
  if (!sharedWorkers.workers.includes(worker)) {
    sharedWorkers.workers.push(worker);
  }
}

/** Test helper. */
export function resetSharedMemoryWriteWorkers(): void {
  sharedWorkers.workers = [];
}

/**
 * Drains every registered shared worker within the window and aggregates the
 * reports so shutdown logs one honest summary including abandoned writes.
 */
export async function drainAllMemoryWrites(drainWindowMs?: number): Promise<MemoryWriteDrainReport & { workers: number }> {
  const reports = await Promise.all(sharedWorkers.workers.map((worker) => worker.drain(drainWindowMs)));
  return {
    workers: reports.length,
    completed: reports.reduce((total, report) => total + report.completed, 0),
    failed: reports.reduce((total, report) => total + report.failed, 0),
    timedOut: reports.reduce((total, report) => total + report.timedOut, 0),
    abandoned: reports.reduce((total, report) => total + report.abandoned, 0),
  };
}
