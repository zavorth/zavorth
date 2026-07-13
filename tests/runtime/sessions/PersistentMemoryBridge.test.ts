import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { PersistentMemoryBridge } from '../../../src/runtime/sessions/PersistentMemoryBridge.js';
import { SessionPersistenceStore } from '../../../src/runtime/sessions/SessionPersistenceStore.js';

describe('PersistentMemoryBridge', () => {
  let bridge: PersistentMemoryBridge;
  let store: SessionPersistenceStore;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-test-'));
    store = new SessionPersistenceStore({ dbPath: tempDir });
    bridge = new PersistentMemoryBridge({
      sessionId: 'ses_test',
      persistenceStore: store,
      autoSave: false,
    });
    await bridge.initialize();
  });

  afterEach(async () => {
    await bridge.destroy();
    try {
      store.close();
    } catch {
      // already closed by destroy
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('initializes successfully', () => {
    const stats = bridge.getStats();
    expect(stats.isInitialized).toBe(true);
    expect(stats.sessionId).toBe('ses_test');
  });

  it('stores compressed chunks', async () => {
    const chunk = {
      id: 'mem_1',
      sessionId: 'ses_test',
      createdAt: '2026-01-01T00:00:00Z',
      originalTokenCount: 100,
      compressedSummary: 'Test summary',
      keywords: ['test'],
      relevanceScore: 1.0,
    };

    await bridge.onChunkCompressed(chunk);
    const stats = bridge.getStats();
    expect(stats.chunkCount).toBe(1);
    // isDirty is false because autoSave is false and save() was called immediately
    expect(stats.isDirty).toBe(false);
  });

  it('loads chunks', async () => {
    const chunk = {
      id: 'mem_1',
      sessionId: 'ses_test',
      createdAt: '2026-01-01T00:00:00Z',
      originalTokenCount: 100,
      compressedSummary: 'Test summary',
      keywords: ['test'],
      relevanceScore: 1.0,
    };

    await bridge.onChunkCompressed(chunk);
    const chunks = await bridge.loadChunks();
    expect(chunks.length).toBe(1);
    expect(chunks[0].id).toBe('mem_1');
  });

  it('saves and loads session state', async () => {
    const state = {
      id: 'ses_test',
      status: 'active' as const,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      workspace: '/test',
      model: 'gpt-4o',
      messageCount: 10,
      tokenUsage: { input: 1000, output: 500 },
      metadata: {},
    };

    await bridge.saveSessionState(state);
    const loaded = await bridge.loadSessionState();
    expect(loaded).not.toBeNull();
    expect(loaded?.id).toBe('ses_test');
  });

  it('persists chunks to disk', async () => {
    const chunk = {
      id: 'mem_1',
      sessionId: 'ses_test',
      createdAt: '2026-01-01T00:00:00Z',
      originalTokenCount: 100,
      compressedSummary: 'Test summary',
      keywords: ['test'],
      relevanceScore: 1.0,
    };

    await bridge.onChunkCompressed(chunk);
    await bridge.save();

    // Create new bridge to test persistence
    const newBridge = new PersistentMemoryBridge({
      sessionId: 'ses_test',
      persistenceStore: store,
      autoSave: false,
    });
    await newBridge.initialize();

    const chunks = await newBridge.loadChunks();
    expect(chunks.length).toBe(1);
    await newBridge.destroy();
  });
});
