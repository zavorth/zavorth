import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ZavorthProviderLiveProofStoreService } from '../../src/services/ZavorthProviderLiveProofStoreService.js';

describe('ZavorthProviderLiveProofStoreService', () => {
  it('persists sanitized live provider proof as route health evidence', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-provider-proof-'));
    try {
      const service = new ZavorthProviderLiveProofStoreService({
        projectRoot: root,
        now: () => new Date('2026-05-16T12:00:00.000Z'),
        ttlMs: 60_000,
      });
      service.writeFromMatrixSnapshot(matrixSnapshot('passed'));

      const raw = fs.readFileSync(service.filePath, 'utf8');
      const health = service.readFreshHealthMap();

      expect(raw).toContain('zavorth-provider-live-proof-store/1');
      expect(raw).toContain('abc123');
      expect(raw).not.toContain('test-secret');
      expect(health.gemini).toEqual(expect.objectContaining({
        ready: true,
        status: 'healthy',
        checkedAt: '2026-05-16T12:00:00.000Z',
      }));
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('ignores expired proof instead of allowing stale default routing', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-provider-proof-'));
    try {
      const writer = new ZavorthProviderLiveProofStoreService({
        projectRoot: root,
        now: () => new Date('2026-05-16T12:00:00.000Z'),
        ttlMs: 1,
      });
      writer.writeFromMatrixSnapshot(matrixSnapshot('passed'));
      const reader = new ZavorthProviderLiveProofStoreService({
        projectRoot: root,
        now: () => new Date('2026-05-16T12:00:01.000Z'),
        ttlMs: 1,
      });

      expect(reader.readFreshHealthMap()).toEqual({});
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

function matrixSnapshot(status: 'passed' | 'failed') {
  return {
    contractVersion: '2026-05-14.phase-3-live-completion',
    schemaVersion: 1,
    surface: 'provider-readiness-matrix',
    generatedAt: '2026-05-16T12:00:00.000Z',
    status: 'ready',
    activeProvider: 'gemini',
    activeModel: 'gemini-test',
    summary: {} as any,
    entries: [
      {
        id: 'gemini',
        label: 'Gemini',
        providerName: 'gemini',
        providerId: 'gemini',
        familyIds: ['gemini'],
        routeKind: 'official',
        routeClass: 'official',
        mode: 'cloud',
        credentialKind: 'api_key',
        credentialRefs: ['GEMINI_API_KEY'],
        requirements: ['GEMINI_API_KEY'],
        currentModelName: 'gemini-test',
        capabilities: ['chat'],
        status: 'ready',
        catalogReady: true,
        authConfigured: true,
        baseUrlConfigured: true,
        discoverySupported: true,
        health: null,
        issue: null,
        explanation: [],
        userAction: 'Ready.',
        testCommand: 'zavorth providers test gemini',
        probe: {
          status,
          mode: 'explicit_live_probe',
          liveNetworkUsed: true,
          requestedAt: '2026-05-16T12:00:00.000Z',
          completedAt: '2026-05-16T12:00:00.000Z',
          durationMs: 20,
          target: 'https://generativelanguage.googleapis.com/v1beta/models',
          httpStatus: status === 'passed' ? 200 : 401,
          modelCount: status === 'passed' ? 1 : null,
          evidenceHash: 'abc123',
          summary: status === 'passed' ? 'Live probe passed.' : 'Live probe failed.',
        },
        rawSecretsPresent: false,
        liveReady: status === 'passed',
        defaultRouteAllowed: status === 'passed',
        readinessProof: status === 'passed' ? 'live_probe' : 'catalog',
        defaultBlockReason: status === 'passed' ? null : 'failed',
      },
    ],
    profiles: [],
    simpleCatalog: {} as any,
    liveCompletion: {} as any,
    commands: [],
    commandCenterProjection: {} as any,
    invariants: [],
    nextAction: 'done',
  } as any;
}
