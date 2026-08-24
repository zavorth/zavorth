import { MemoryWriteWorker } from '../../src/services/memory/MemoryWriteWorker.js';
import type { IMemoryBackend, MemoryRecord, MemoryWriteOptions } from '../../src/services/memory/IMemoryBackend.js';

function buildRecord(content: string): MemoryRecord {
  const now = new Date().toISOString();
  return {
    id: `id-${content}`,
    userId: 'user-1',
    content,
    metadata: { key: `key-${content}`, category: 'episode', source: 'test' },
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

function immediateBackend(writes: Array<{ content: string }>): IMemoryBackend {
  return {
    name: 'immediate-test-backend',
    contractVersion: 2 as const,
    isAvailable: async () => true,
    addMemory: async () => undefined,
    searchMemory: async () => [],
    addMemoryRecord: async (_userId: string, content: string, _options?: MemoryWriteOptions) => {
      writes.push({ content });
      return buildRecord(content);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as unknown as IMemoryBackend;
}

function stalledBackend(): IMemoryBackend {
  return {
    name: 'stalled-test-backend',
    contractVersion: 2 as const,
    isAvailable: async () => true,
    addMemory: async () => undefined,
    searchMemory: async () => [],
    addMemoryRecord: () => new Promise<MemoryRecord>(() => undefined),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as unknown as IMemoryBackend;
}

describe('MemoryWriteWorker background pipeline', () => {
  it('persists every write through the governed v2 path, one at a time, in order', async () => {
    const writes: Array<{ content: string }> = [];
    let active = 0;
    let maxActive = 0;
    const backend = immediateBackend(writes);
    const originalAdd = backend.addMemoryRecord!.bind(backend);
    backend.addMemoryRecord = async (...args: Parameters<NonNullable<IMemoryBackend['addMemoryRecord']>>) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      try {
        return await originalAdd(...args);
      } finally {
        active -= 1;
      }
    };
    const worker = new MemoryWriteWorker(backend);

    const outcomes = await Promise.all(
      ['first', 'second', 'third'].map((content) =>
        worker.enqueue({ userId: 'user-1', content }),
      ),
    );

    expect(outcomes.map((outcome) => outcome.status)).toEqual(['completed', 'completed', 'completed']);
    expect(writes.map((write) => write.content)).toEqual(['first', 'second', 'third']);
    expect(maxActive).toBe(1);
    expect(worker.getStats().completed).toBe(3);
  });

  it('never lets a stalled backend delay the caller beyond the bounded timeout', async () => {
    const worker = new MemoryWriteWorker(stalledBackend(), { writeTimeoutMs: 40 });

    const startedAt = Date.now();
    const outcome = await worker.enqueue({ userId: 'user-1', content: 'slow episode' });
    const elapsedMs = Date.now() - startedAt;

    expect(outcome.status).toBe('timeout');
    expect(elapsedMs).toBeLessThan(2_000);
    expect(worker.getStats().timedOut).toBe(1);
  });

  it('reports failed writes without rejecting the enqueue promise', async () => {
    const failingBackend = immediateBackend([]);
    failingBackend.addMemoryRecord = async () => {
      throw new Error('store offline');
    };
    const worker = new MemoryWriteWorker(failingBackend, { writeTimeoutMs: 200 });

    const outcome = await worker.enqueue({ userId: 'user-1', content: 'doomed' });

    expect(outcome.status).toBe('failed');
    expect(outcome.error).toContain('store offline');
  });

  it('drain reports unfinished writes as abandoned once the shutdown window expires', async () => {
    const worker = new MemoryWriteWorker(stalledBackend(), { writeTimeoutMs: 5_000 });
    void worker.enqueue({ userId: 'user-1', content: 'in flight forever' });
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
    void worker.enqueue({ userId: 'user-1', content: 'never started' });

    const report = await worker.drain(30);

    expect(report.abandoned).toBe(2);
    expect(report.completed).toBe(0);
    expect(worker.getStats().queued).toBe(0);
    expect(worker.getStats().abandoned).toBe(2);
  });

  it('resolves immediately when drain is called with an empty pipeline', async () => {
    const worker = new MemoryWriteWorker(immediateBackend([]));
    const report = await worker.drain(10);
    expect(report).toEqual({ completed: 0, failed: 0, timedOut: 0, abandoned: 0 });
  });
});
