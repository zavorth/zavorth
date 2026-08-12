import fs from 'fs';
import os from 'os';
import path from 'path';
import { NodePairingService } from '../../src/services/NodePairingService.js';
import { NodeRegistryService } from '../../src/services/NodeRegistryService.js';

describe('NodeRegistryService', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('persists nodes and secret metadata in the runtime registry', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-node-registry-'));
    tempDirs.push(root);
    const service = new NodeRegistryService({
      now: () => new Date('2026-04-02T15:00:00.000Z'),
      stateFile: path.join(root, 'node-mesh-state.json'),
      secretsFile: path.join(root, 'node-mesh-secrets.json'),
      secureStorageService: {
        encryptString: jest.fn((value: string) => `enc:${value}`),
        decryptString: jest.fn((value: string) => value.replace(/^enc:/, '')),
      } as any,
    });

    service.upsertNode({
      id: 'oracle-node',
      label: 'Oracle Node',
      profileId: 'headless-worker',
      kind: 'headless',
      transport: 'bridge',
      status: 'offline',
      pairingStatus: 'paired',
      paired: true,
      createdAt: '2026-04-02T15:00:00.000Z',
      updatedAt: '2026-04-02T15:00:00.000Z',
      pairedAt: '2026-04-02T15:00:00.000Z',
      lastSeenAt: null,
      requestedBy: 'telegram-admin',
      capabilityIds: ['system.run', 'files.read'],
      hostHints: {
        hostname: 'oracle',
        platform: 'linux',
        workspace: '/srv/zavorth',
        surface: 'node-host',
        arch: 'x64',
        osRelease: '6.8.0',
        nodeVersion: 'v24.0.0',
        deviceModel: 'Oracle VM',
        networkType: 'ethernet',
        locationLabel: 'Sao Paulo',
      },
      notes: ['bootstrap inicial'],
      operatorSummary: 'Pairing em andamento.',
    });
    service.storeSecret('oracle-node', 'pairingCode', 'abc123');
    const heartbeat = service.recordHeartbeat('oracle-node');

    expect(service.listNodes()).toEqual([
      expect.objectContaining({
        id: 'oracle-node',
        label: 'Oracle Node',
        profileId: 'headless-worker',
        status: 'online',
        capabilityIds: ['files.read', 'system.run'],
        hostHints: expect.objectContaining({
          arch: 'x64',
          osRelease: '6.8.0',
          deviceModel: 'Oracle VM',
          locationLabel: 'Sao Paulo',
        }),
      }),
    ]);
    expect(heartbeat).toEqual(
      expect.objectContaining({
        profileId: 'headless-worker',
        status: 'online',
        lastSeenAt: '2026-04-02T15:00:00.000Z',
      }),
    );
    expect(service.patchNode('oracle-node', { operatorSummary: 'Atualizado.' })).toEqual(
      expect.objectContaining({
        profileId: 'headless-worker',
      }),
    );
    expect(service.getStoredSecretKeys('oracle-node')).toEqual(['pairingCode']);
    expect(service.getSecretValue('oracle-node', 'pairingCode')).toBe('abc123');
  });

  it('expires old pending pairing drafts and clears their bootstrap secrets lazily', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-node-registry-stale-'));
    tempDirs.push(root);
    const secureStorageService = {
      encryptString: jest.fn((value: string) => `enc:${value}`),
      decryptString: jest.fn((value: string) => value.replace(/^enc:/, '')),
    } as any;
    const service = new NodeRegistryService({
      now: () => new Date('2026-04-02T19:00:00.000Z'),
      stateFile: path.join(root, 'node-mesh-state.json'),
      secretsFile: path.join(root, 'node-mesh-secrets.json'),
      pairingDraftStaleMs: 1000 * 60 * 30,
      secureStorageService,
    });

    const pairing = new NodePairingService({
      now: () => new Date('2026-04-02T19:00:00.000Z'),
      registryService: service,
    });
    const draft = pairing.createPairingDraft({
      label: 'Desktop Node',
      profileId: 'desktop-companion',
      requestedBy: 'dashboard',
    });

    expect(service.getStoredSecretKeys(draft.entry.id)).toEqual(['pairingCode', 'sharedSecret']);

    const registryLater = new NodeRegistryService({
      now: () => new Date('2026-04-02T21:00:00.000Z'),
      stateFile: path.join(root, 'node-mesh-state.json'),
      secretsFile: path.join(root, 'node-mesh-secrets.json'),
      pairingDraftStaleMs: 1000 * 60 * 30,
      secureStorageService,
    });
    const staleEntry = registryLater.getNode(draft.entry.id);
    const rawState = registryLater.readState();

    expect(staleEntry).toEqual(
      expect.objectContaining({
        id: draft.entry.id,
        pairingStatus: 'revoked',
        status: 'blocked',
        lifecycle: expect.objectContaining({
          pairingDraftAgeMs: 1000 * 60 * 60 * 2,
          pairingDraftStale: true,
        }),
      }),
    );
    expect(rawState.entries[draft.entry.id]).toEqual(
      expect.objectContaining({
        pairingStatus: 'revoked',
        lifecycle: expect.objectContaining({
          pairingDraftStale: true,
        }),
      }),
    );
    expect(registryLater.getStoredSecretKeys(draft.entry.id)).toEqual([]);
  });

  it('keeps approved capabilities constrained to the declared node catalog', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-node-registry-allowlist-'));
    tempDirs.push(root);
    const service = new NodeRegistryService({
      now: () => new Date('2026-04-02T22:00:00.000Z'),
      stateFile: path.join(root, 'node-mesh-state.json'),
      secretsFile: path.join(root, 'node-mesh-secrets.json'),
      secureStorageService: {
        encryptString: jest.fn((value: string) => `enc:${value}`),
        decryptString: jest.fn((value: string) => value.replace(/^enc:/, '')),
      } as any,
    });

    service.upsertNode({
      id: 'restricted-node',
      label: 'Restricted Node',
      profileId: 'headless-worker',
      kind: 'headless',
      transport: 'remote',
      status: 'online',
      pairingStatus: 'paired',
      paired: true,
      createdAt: '2026-04-02T22:00:00.000Z',
      updatedAt: '2026-04-02T22:00:00.000Z',
      pairedAt: '2026-04-02T22:00:00.000Z',
      lastSeenAt: '2026-04-02T22:00:00.000Z',
      requestedBy: 'dashboard',
      capabilityIds: ['system.run', 'files.read'],
      approvedCapabilityIds: ['files.read', 'screen.capture'],
      hostHints: {
        hostname: 'restricted',
        platform: 'linux',
        workspace: null,
        surface: 'node-host',
      },
      notes: [],
      operatorSummary: 'Pareado com allowlist.',
    });

    const updated = service.setApprovedCapabilities('restricted-node', ['system.run', 'screen.capture']);

    expect(service.getNode('restricted-node')).toEqual(expect.objectContaining({
      approvedCapabilityIds: ['system.run'],
    }));
    expect(updated).toEqual(expect.objectContaining({
      approvedCapabilityIds: ['system.run'],
    }));
  });

  it('removes revoked historical nodes together with their secret buckets', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-node-registry-prune-'));
    tempDirs.push(root);
    const service = new NodeRegistryService({
      now: () => new Date('2026-04-14T20:00:00.000Z'),
      stateFile: path.join(root, 'node-mesh-state.json'),
      secretsFile: path.join(root, 'node-mesh-secrets.json'),
      secureStorageService: {
        encryptString: jest.fn((value: string) => `enc:${value}`),
        decryptString: jest.fn((value: string) => value.replace(/^enc:/, '')),
      } as any,
    });

    service.upsertNode({
      id: 'revoked-node',
      label: 'Revoked Node',
      profileId: 'headless-worker',
      kind: 'headless',
      transport: 'bridge',
      status: 'blocked',
      pairingStatus: 'revoked',
      paired: false,
      createdAt: '2026-04-05T10:00:00.000Z',
      updatedAt: '2026-04-05T10:00:00.000Z',
      pairedAt: null,
      lastSeenAt: null,
      requestedBy: 'dashboard',
      capabilityIds: ['system.run'],
      hostHints: {
        hostname: null,
        platform: null,
        workspace: null,
        surface: 'node-host',
      },
      notes: ['historico antigo'],
      operatorSummary: 'Node revogado.',
    });
    service.storeSecret('revoked-node', 'sharedSecret', 'secret-value');

    const removed = service.removeNodes(['revoked-node']);

    expect(removed).toEqual({
      removedNodeIds: ['revoked-node'],
      removedEntries: 1,
      removedSecretBuckets: 1,
      removedSecretKeys: 1,
    });
    expect(service.getNode('revoked-node')).toBeNull();
    expect(service.getStoredSecretKeys('revoked-node')).toEqual([]);
  });
});
