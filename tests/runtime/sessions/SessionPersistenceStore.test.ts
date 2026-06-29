import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { SessionPersistenceStore } from '../../../src/runtime/sessions/SessionPersistenceStore.js';

describe('SessionPersistenceStore', () => {
  let store: SessionPersistenceStore;
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-test-'));
    store = new SessionPersistenceStore({ dbPath: tempDir });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('initializes directories', async () => {
    await store.initialize();
    expect(fs.existsSync(path.join(tempDir, 'sessions'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, 'memory'))).toBe(true);
  });

  it('saves and loads session', async () => {
    await store.initialize();
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

    await store.saveSession(state);
    const loaded = await store.loadSession('ses_test');

    expect(loaded).not.toBeNull();
    expect(loaded?.id).toBe('ses_test');
    expect(loaded?.status).toBe('active');
  });

  it('returns null for non-existent session', async () => {
    const loaded = await store.loadSession('nonexistent');
    expect(loaded).toBeNull();
  });

  it('lists sessions', async () => {
    await store.initialize();
    await store.saveSession({
      id: 'ses_1',
      status: 'active',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      workspace: '/test',
      model: 'gpt-4o',
      messageCount: 5,
      tokenUsage: { input: 500, output: 250 },
      metadata: {},
    });

    const sessions = await store.listSessions();
    expect(sessions.length).toBe(1);
    expect(sessions[0].id).toBe('ses_1');
  });

  it('saves and loads memory chunks', async () => {
    await store.initialize();
    const chunks = [
      {
        id: 'chunk_1',
        sessionId: 'ses_test',
        content: 'Test memory',
        keywords: ['test'],
        timestamp: '2026-01-01T00:00:00Z',
        tokenCount: 10,
      },
    ];

    await store.saveMemoryChunks('ses_test', chunks);
    const loaded = await store.loadMemoryChunks('ses_test');

    expect(loaded.length).toBe(1);
    expect(loaded[0].id).toBe('chunk_1');
  });

  it('deletes session and memory', async () => {
    await store.initialize();
    await store.saveSession({
      id: 'ses_test',
      status: 'active',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      workspace: '/test',
      model: 'gpt-4o',
      messageCount: 5,
      tokenUsage: { input: 500, output: 250 },
      metadata: {},
    });

    await store.deleteSession('ses_test');
    const loaded = await store.loadSession('ses_test');
    expect(loaded).toBeNull();
  });

  it('returns stats', async () => {
    await store.initialize();
    const stats = await store.getStats();
    expect(stats.totalSessions).toBe(0);
    expect(stats.totalMemoryChunks).toBe(0);
  });
});
