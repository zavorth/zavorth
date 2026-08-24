import { EpisodicMemoryBridge } from '../../src/context-engine/EpisodicMemoryBridge.js';
import type { ContextEvent } from '../../src/context-engine/ContextEngine.js';
import { MemoryWriteWorker } from '../../src/services/memory/MemoryWriteWorker.js';
import type { IMemoryBackend, MemoryRecord } from '../../src/services/memory/IMemoryBackend.js';

function buildEvents(): ContextEvent[] {
  const base = Date.parse('2026-01-01T10:00:00.000Z');
  return [
    { id: 'e1', timestamp: new Date(base).toISOString(), surface: 'telegram', chatId: 'c1', userId: 'u1', role: 'user', content: 'Remember that my deploy window is Sunday.' },
    { id: 'e2', timestamp: new Date(base + 1000).toISOString(), surface: 'telegram', chatId: 'c1', userId: 'u1', role: 'assistant', content: 'Noted your deploy window.' },
  ];
}

function stalledBackend(): IMemoryBackend {
  return {
    name: 'stalled-episode-backend',
    contractVersion: 2 as const,
    isAvailable: async () => true,
    addMemory: async () => undefined,
    searchMemory: async () => [],
    addMemoryRecord: () => new Promise<MemoryRecord>(() => undefined),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as unknown as IMemoryBackend;
}

describe('EpisodicMemoryBridge background write pipeline', () => {
  it('routes episode persistence through the worker so a stalled store never delays the caller', async () => {
    const bridge = new EpisodicMemoryBridge();
    const worker = new MemoryWriteWorker(stalledBackend(), { writeTimeoutMs: 60 });
    bridge.attachBackgroundWriter(worker);

    const startedAt = Date.now();
    await bridge.persistEpisode(buildEvents(), 'user-1');
    const elapsedMs = Date.now() - startedAt;

    expect(elapsedMs).toBeLessThan(5_000);
    expect(bridge.getStats().episodesPersisted).toBe(1);
  });

  it('drains pending episode writes on shutdown and reports abandoned counts', async () => {
    const bridge = new EpisodicMemoryBridge();
    const worker = new MemoryWriteWorker(stalledBackend(), { writeTimeoutMs: 5_000 });
    bridge.attachBackgroundWriter(worker);
    void bridge.persistEpisode(buildEvents(), 'user-1');
    await new Promise<void>((resolve) => setTimeout(resolve, 5));

    const report = await bridge.drainBackgroundWrites(20);

    expect(report.abandoned + report.timedOut).toBeGreaterThanOrEqual(1);
    expect(report.completed).toBe(0);
  });

  it('returns an empty drain report when no writer is attached', async () => {
    const bridge = new EpisodicMemoryBridge();
    const report = await bridge.drainBackgroundWrites();
    expect(report).toEqual({ completed: 0, failed: 0, timedOut: 0, abandoned: 0 });
  });
});
