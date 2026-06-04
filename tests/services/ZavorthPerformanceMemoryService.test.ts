import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import { ZavorthPerformanceMemoryService } from '../../src/services/ZavorthPerformanceMemoryService.js';

describe('ZavorthPerformanceMemoryService', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-perf-'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('records aggregate route performance without storing prompts or secrets', () => {
    const storePath = path.join(root, 'performance-memory.json');
    const service = new ZavorthPerformanceMemoryService({
      storePath,
      now: () => new Date('2026-06-02T12:00:00.000Z'),
    });

    service.record({
      providerId: 'gemini',
      routeId: 'gemini-fast',
      taskKind: 'code',
      status: 'success',
      latencyMs: 1200,
      tokens: 900,
      costUsd: 0.01,
    });
    const snapshot = service.record({
      providerId: 'gemini',
      routeId: 'gemini-fast',
      taskKind: 'code',
      status: 'failure',
      latencyMs: 2000,
      tokens: 300,
      costUsd: 0.02,
    });

    expect(snapshot.sampleCount).toBe(2);
    expect(snapshot.topRoutes[0]).toMatchObject({
      providerId: 'gemini',
      routeId: 'gemini-fast',
      taskKind: 'code',
      attempts: 2,
      successes: 1,
      failures: 1,
    });
    expect(snapshot.recommendations[0].reason).toContain('Best observed route');
    const raw = fs.readFileSync(storePath, 'utf8');
    expect(raw).not.toContain('prompt');
    expect(snapshot.safety).toMatchObject({
      noPromptBodiesStored: true,
      noSecretsStored: true,
      aggregateOnlyInLlmContext: true,
    });
  });

  it('can use Operational StateDB style meta storage instead of JSON', () => {
    const meta = new Map<string, unknown>();
    const service = new ZavorthPerformanceMemoryService({
      stateDb: {
        getMeta: (key) => meta.get(key) as never,
        setMeta: (key, value) => {
          meta.set(key, value);
        },
      },
      now: () => new Date('2026-06-02T12:00:00.000Z'),
    });

    const snapshot = service.record({
      providerId: 'openai',
      routeId: 'openai-main',
      taskKind: 'research',
      status: 'success',
    });

    expect(snapshot.store).toBe('state-db');
    expect(meta.size).toBe(1);
  });
});
