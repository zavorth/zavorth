import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { UserModelFactStore } from '../../../src/services/user-model/UserModelFactStore.js';
import type { UserModelFact } from '../../../src/contracts/user-model/UserModelFactContract.js';

describe('UserModelFactStore', () => {
  let tmpDir: string;
  let store: UserModelFactStore;

  const sampleFact: UserModelFact = {
    id: 'fact-101',
    userId: 'user-alpha',
    content: 'Prefers TypeScript over plain JavaScript',
    kind: 'preference',
    category: 'coding_style',
    status: 'active',
    version: 1,
    confidence: 0.95,
    evidence: [
      {
        turnId: 'turn-1',
        citation: 'User explicitly requested TypeScript',
        timestamp: '2026-08-29T00:00:00.000Z',
      },
    ],
    source: 'explicit',
    language: 'en',
    surface: null,
    lastObservedAt: '2026-08-29T00:00:00.000Z',
    occurrences: 1,
    targetTools: [],
  };

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-fact-store-test-'));
    store = new UserModelFactStore({ dataDir: tmpDir });
    await store.initialize();
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Safe cleanup
    }
  });

  it('saves fact to append-only log and updates snapshot projection', async () => {
    const saved = await store.saveFact(sampleFact);
    expect(saved).toEqual(sampleFact);

    const logContent = fs.readFileSync(path.join(tmpDir, 'facts.log'), 'utf8');
    expect(logContent.trim()).toBe(JSON.stringify(sampleFact));

    const retrieved = await store.getFactById('fact-101');
    expect(retrieved).toEqual(sampleFact);
  });

  it('returns null for nonexistent fact id', async () => {
    const nonexistent = await store.getFactById('missing-id');
    expect(nonexistent).toBeNull();
  });

  it('filters facts by userId, status, category, and surface', async () => {
    await store.saveFact(sampleFact);

    const fact2: UserModelFact = {
      ...sampleFact,
      id: 'fact-102',
      content: 'Uses dark mode in CLI',
      kind: 'preference',
      category: 'ui',
      status: 'draft',
      surface: 'cli',
    };

    const otherUserFact: UserModelFact = {
      ...sampleFact,
      id: 'fact-103',
      userId: 'user-beta',
    };

    await store.saveFact(fact2);
    await store.saveFact(otherUserFact);

    const allAlpha = await store.listFactsByUserId('user-alpha');
    expect(allAlpha).toHaveLength(2);

    const activeOnly = await store.listFactsByUserId('user-alpha', { status: 'active' });
    expect(activeOnly).toHaveLength(1);
    expect(activeOnly[0].id).toBe('fact-101');

    const cliSurface = await store.listFactsByUserId('user-alpha', { surface: 'cli' });
    expect(cliSurface).toHaveLength(2);

    const webSurface = await store.listFactsByUserId('user-alpha', { surface: 'web' });
    expect(webSurface).toHaveLength(1);
    expect(webSurface[0].id).toBe('fact-101');
  });

  it('records lifecycle events in append-only events.log', async () => {
    await store.recordLifecycleEvent({
      id: 'event-1',
      factId: 'fact-101',
      userId: 'user-alpha',
      eventType: 'created',
      timestamp: '2026-08-29T00:00:00.000Z',
    });

    const eventsContent = fs.readFileSync(path.join(tmpDir, 'events.log'), 'utf8');
    expect(eventsContent).toContain('created');
    expect(eventsContent).toContain('fact-101');
  });

  it('tracks turn deduplication checkpoint', async () => {
    expect(store.isTurnProcessed('turn-abc')).toBe(false);

    await store.markTurnProcessed('turn-abc');
    expect(store.isTurnProcessed('turn-abc')).toBe(true);

    const reloadedStore = new UserModelFactStore({ dataDir: tmpDir });
    await reloadedStore.initialize();
    expect(reloadedStore.isTurnProcessed('turn-abc')).toBe(true);
  });

  it('self-heals and rebuilds snapshot from facts.log when snapshot is corrupted', async () => {
    await store.saveFact(sampleFact);

    const updatedFact: UserModelFact = {
      ...sampleFact,
      version: 2,
      occurrences: 2,
      confidence: 0.99,
    };
    await store.saveFact(updatedFact);

    fs.writeFileSync(path.join(tmpDir, 'facts.snapshot.json'), '{ broken-json: true', 'utf8');

    const reloadedStore = new UserModelFactStore({ dataDir: tmpDir });
    await reloadedStore.initialize();

    const recovered = await reloadedStore.getFactById('fact-101');
    expect(recovered).not.toBeNull();
    expect(recovered?.version).toBe(2);
    expect(recovered?.confidence).toBe(0.99);
  });

  it('rebuilds snapshot cleanly when snapshot file is completely missing', async () => {
    await store.saveFact(sampleFact);
    fs.unlinkSync(path.join(tmpDir, 'facts.snapshot.json'));

    const reloadedStore = new UserModelFactStore({ dataDir: tmpDir });
    await reloadedStore.initialize();

    const recovered = await reloadedStore.getFactById('fact-101');
    expect(recovered).toEqual(sampleFact);
  });
});
