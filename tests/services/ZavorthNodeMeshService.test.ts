import fs from 'fs';
import os from 'os';
import path from 'path';
import { ZavorthNodeMeshService } from '../../src/services/ZavorthNodeMeshService.js';
import { NodeInvokeService } from '../../src/services/NodeInvokeService.js';
import { NodeInvocationStoreService } from '../../src/services/NodeInvocationStoreService.js';
import { NodeRegistryService } from '../../src/services/NodeRegistryService.js';

describe('ZavorthNodeMeshService', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('builds an operator snapshot for the node mesh registry', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-node-mesh-'));
    tempDirs.push(root);
    const registry = new NodeRegistryService({
      now: () => new Date('2026-04-02T18:00:00.000Z'),
      stateFile: path.join(root, 'node-mesh-state.json'),
      secretsFile: path.join(root, 'node-mesh-secrets.json'),
      secureStorageService: {
        encryptString: jest.fn((value: string) => `enc:${value}`),
        decryptString: jest.fn((value: string) => value.replace(/^enc:/, '')),
      } as any,
    });

    registry.upsertNode({
      id: 'headless-1',
      label: 'Headless 1',
      profileId: 'headless-worker',
      kind: 'headless',
      transport: 'bridge',
      status: 'online',
      pairingStatus: 'paired',
      paired: true,
      createdAt: '2026-04-02T18:00:00.000Z',
      updatedAt: '2026-04-02T18:00:00.000Z',
      pairedAt: '2026-04-02T18:00:00.000Z',
      lastSeenAt: '2026-04-02T18:00:00.000Z',
      requestedBy: 'dashboard',
      capabilityIds: ['system.run', 'files.read', 'files.write'],
      hostHints: {
        hostname: 'oracle',
        platform: 'linux',
        workspace: '/srv',
        surface: 'node-host',
        arch: 'x64',
        deviceModel: 'Oracle VM',
      },
      notes: [],
      operatorSummary: 'Online.',
    });
    registry.upsertNode({
      id: 'desktop-1',
      label: 'Desktop 1',
      profileId: 'desktop-companion',
      kind: 'desktop',
      transport: 'remote',
      status: 'pairing',
      pairingStatus: 'pending',
      paired: false,
      createdAt: '2026-04-02T18:00:00.000Z',
      updatedAt: '2026-04-02T18:00:00.000Z',
      pairedAt: null,
      lastSeenAt: null,
      requestedBy: 'telegram-admin',
      capabilityIds: ['screen.capture'],
      hostHints: {
        hostname: 'windows',
        platform: 'win32',
        workspace: null,
        surface: 'desktop',
        arch: 'x64',
        deviceModel: 'Desktop Bridge',
      },
      notes: [],
      operatorSummary: 'Aguardando pairing.',
    });

    const invokeService = new NodeInvokeService({
      now: () => new Date('2026-04-02T18:10:00.000Z'),
      registryService: registry,
      invocationStoreService: new NodeInvocationStoreService({
        now: () => new Date('2026-04-02T18:10:00.000Z'),
        stateFile: path.join(root, 'node-mesh-invocations.json'),
      }),
    });
    invokeService.invoke({
      nodeId: 'headless-1',
      capabilityId: 'system.run',
      action: 'run',
      payload: { command: 'echo ok' },
      requestedBy: 'dashboard',
    });

    const service = new ZavorthNodeMeshService({
      now: () => new Date('2026-04-02T18:10:00.000Z'),
      registryService: registry,
      invokeService,
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        total: 2,
        paired: 1,
        pending: 1,
        online: 1,
        invokable: 1,
      }),
    );
    expect(snapshot.summary.queued).toBeGreaterThanOrEqual(1);
    expect(snapshot.summary.completedRecently).toBe(0);
    expect(snapshot.selected).toEqual(
      expect.objectContaining({
        id: 'desktop-1',
        pairingStatus: 'pending',
      }),
    );
    expect(snapshot.selected?.nextAction).toContain('Desktop Companion');
    expect(snapshot.selectedActivity).toEqual(
      expect.objectContaining({
        nodeId: 'desktop-1',
        summary: expect.objectContaining({
          pending: 0,
          claimed: 0,
        }),
      }),
    );
    expect(snapshot.capabilityCatalog).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'system.run' }),
        expect.objectContaining({ id: 'files.write' }),
      ]),
    );
    expect(snapshot.deviceProfiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'headless-worker' }),
        expect.objectContaining({ id: 'desktop-companion' }),
        expect.objectContaining({ id: 'mobile-companion' }),
      ]),
    );
    expect(snapshot.recommendedProfiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'headless-worker' }),
        expect.objectContaining({ id: 'desktop-companion' }),
      ]),
    );
    expect(snapshot.suggestedActions[0]).toEqual(
      expect.objectContaining({
        label: expect.stringContaining('Desktop Companion'),
      }),
    );
    expect(snapshot.narrative.headline).toContain('2 node(s)');
  });

  it('builds explicit activity and capabilities snapshots for a selected node', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-node-mesh-detail-'));
    tempDirs.push(root);
    const registry = new NodeRegistryService({
      now: () => new Date('2026-04-02T19:00:00.000Z'),
      stateFile: path.join(root, 'node-mesh-state.json'),
      secretsFile: path.join(root, 'node-mesh-secrets.json'),
      secureStorageService: {
        encryptString: jest.fn((value: string) => `enc:${value}`),
        decryptString: jest.fn((value: string) => value.replace(/^enc:/, '')),
      } as any,
    });

    registry.upsertNode({
      id: 'oracle-node',
      label: 'Oracle Node',
      profileId: 'headless-worker',
      kind: 'headless',
      transport: 'bridge',
      status: 'online',
      pairingStatus: 'paired',
      paired: true,
      createdAt: '2026-04-02T19:00:00.000Z',
      updatedAt: '2026-04-02T19:00:00.000Z',
      pairedAt: '2026-04-02T19:00:00.000Z',
      lastSeenAt: '2026-04-02T19:00:00.000Z',
      requestedBy: 'dashboard',
      capabilityIds: ['system.run', 'files.write'],
      hostHints: {
        hostname: 'oracle',
        platform: 'linux',
        workspace: '/srv',
        surface: 'node-host',
      },
      notes: [],
      operatorSummary: 'Online.',
    });

    const invokeService = new NodeInvokeService({
      now: () => new Date('2026-04-02T19:05:00.000Z'),
      registryService: registry,
      invocationStoreService: new NodeInvocationStoreService({
        now: () => new Date('2026-04-02T19:05:00.000Z'),
        stateFile: path.join(root, 'node-mesh-invocations.json'),
      }),
    });
    invokeService.invoke({
      nodeId: 'oracle-node',
      capabilityId: 'system.run',
      action: 'run',
      payload: { command: 'echo ok' },
      requestedBy: 'dashboard',
    });

    const service = new ZavorthNodeMeshService({
      now: () => new Date('2026-04-02T19:05:00.000Z'),
      registryService: registry,
      invokeService,
    });

    const node = service.getNodeEntry('oracle-node');
    const activity = service.buildActivitySnapshot('oracle-node');
    const capabilities = service.buildCapabilitiesSnapshot('oracle-node');

    expect(node).toEqual(
      expect.objectContaining({
        id: 'oracle-node',
        canInvoke: true,
      }),
    );
    expect(activity).toEqual(
      expect.objectContaining({
        nodeId: 'oracle-node',
      }),
    );
    expect(activity?.summary.active || 0).toBeGreaterThanOrEqual(1);
    expect(activity?.summary.pending || 0).toBeGreaterThanOrEqual(1);
    expect(capabilities).toEqual(
      expect.objectContaining({
        nodeId: 'oracle-node',
        summary: expect.objectContaining({
          total: 2,
          risky: 2,
        }),
        capabilities: expect.arrayContaining([
          expect.objectContaining({ id: 'system.run' }),
          expect.objectContaining({ id: 'files.write' }),
        ]),
      }),
    );
  });

  it('highlights stale pairing drafts and old queued work in the mesh snapshot', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-node-mesh-stale-'));
    tempDirs.push(root);
    const registry = new NodeRegistryService({
      now: () => new Date('2026-04-02T23:00:00.000Z'),
      stateFile: path.join(root, 'node-mesh-state.json'),
      secretsFile: path.join(root, 'node-mesh-secrets.json'),
      pairingDraftStaleMs: 1000 * 60 * 30,
      secureStorageService: {
        encryptString: jest.fn((value: string) => `enc:${value}`),
        decryptString: jest.fn((value: string) => value.replace(/^enc:/, '')),
      } as any,
    });

    registry.upsertNode({
      id: 'desktop-stale',
      label: 'Desktop Stale',
      profileId: 'desktop-companion',
      kind: 'desktop',
      transport: 'remote',
      status: 'pairing',
      pairingStatus: 'pending',
      paired: false,
      createdAt: '2026-04-02T20:00:00.000Z',
      updatedAt: '2026-04-02T20:00:00.000Z',
      pairedAt: null,
      lastSeenAt: null,
      requestedBy: 'dashboard',
      capabilityIds: ['screen.capture'],
      hostHints: {
        hostname: 'windows-main',
        platform: 'win32',
        workspace: null,
        surface: 'desktop',
      },
      notes: [],
      operatorSummary: 'Aguardando pairing.',
    });

    registry.upsertNode({
      id: 'oracle-node',
      label: 'Oracle Node',
      profileId: 'headless-worker',
      kind: 'headless',
      transport: 'bridge',
      status: 'online',
      pairingStatus: 'paired',
      paired: true,
      createdAt: '2026-04-02T19:00:00.000Z',
      updatedAt: '2026-04-02T19:00:00.000Z',
      pairedAt: '2026-04-02T19:00:00.000Z',
      lastSeenAt: '2026-04-02T23:00:00.000Z',
      requestedBy: 'dashboard',
      capabilityIds: ['system.run'],
      hostHints: {
        hostname: 'oracle',
        platform: 'linux',
        workspace: '/srv',
        surface: 'node-host',
      },
      notes: [],
      operatorSummary: 'Online.',
    });

    const invokeService = new NodeInvokeService({
      now: () => new Date('2026-04-02T23:00:00.000Z'),
      registryService: registry,
      invocationStoreService: {
        listActive: jest.fn(() => []),
        listRecent: jest.fn(() => []),
        summarizeNode: jest.fn((nodeId: string) => ({
          pending: nodeId === 'oracle-node' ? 1 : 0,
          claimed: nodeId === 'oracle-node' ? 1 : 0,
          completedRecently: 0,
          stalePending: nodeId === 'oracle-node' ? 1 : 0,
          staleClaimed: nodeId === 'oracle-node' ? 1 : 0,
          recent: null,
        })),
        enqueue: jest.fn(),
        claimPending: jest.fn(() => []),
        complete: jest.fn(),
      } as any,
    });

    const service = new ZavorthNodeMeshService({
      now: () => new Date('2026-04-02T23:00:00.000Z'),
      registryService: registry,
      invokeService,
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.staleQueued).toBe(2);
    expect(snapshot.entries.find((entry) => entry.id === 'desktop-stale')).toEqual(
      expect.objectContaining({
        lifecycle: expect.objectContaining({
          pairingDraftStale: true,
        }),
      }),
    );
    expect(snapshot.entries.find((entry) => entry.id === 'oracle-node')).toEqual(
      expect.objectContaining({
        stalePendingInvocations: 1,
        staleClaimedInvocations: 1,
      }),
    );
    expect(snapshot.suggestedActions[0]).toEqual(
      expect.objectContaining({
        label: expect.stringContaining('Regenerar pairing'),
      }),
    );
  });

  it('prioritizes expired pairing drafts and stale queue debt in the mesh snapshot', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-node-mesh-hygiene-'));
    tempDirs.push(root);
    const registry = new NodeRegistryService({
      now: () => new Date('2026-04-02T22:00:00.000Z'),
      stateFile: path.join(root, 'node-mesh-state.json'),
      secretsFile: path.join(root, 'node-mesh-secrets.json'),
      pairingDraftStaleMs: 1000 * 60 * 30,
      secureStorageService: {
        encryptString: jest.fn((value: string) => `enc:${value}`),
        decryptString: jest.fn((value: string) => value.replace(/^enc:/, '')),
      } as any,
    });

    registry.upsertNode({
      id: 'desktop-stale',
      label: 'Desktop Stale',
      profileId: 'desktop-companion',
      kind: 'desktop',
      transport: 'remote',
      status: 'pairing',
      pairingStatus: 'pending',
      paired: false,
      createdAt: '2026-04-02T20:00:00.000Z',
      updatedAt: '2026-04-02T20:00:00.000Z',
      pairedAt: null,
      lastSeenAt: null,
      requestedBy: 'dashboard',
      capabilityIds: ['screen.capture'],
      hostHints: {
        hostname: 'windows-main',
        platform: 'win32',
        workspace: null,
        surface: 'desktop',
      },
      notes: [],
      operatorSummary: 'Aguardando pairing.',
    });
    registry.upsertNode({
      id: 'oracle-node',
      label: 'Oracle Node',
      profileId: 'headless-worker',
      kind: 'headless',
      transport: 'bridge',
      status: 'online',
      pairingStatus: 'paired',
      paired: true,
      createdAt: '2026-04-02T20:00:00.000Z',
      updatedAt: '2026-04-02T20:00:00.000Z',
      pairedAt: '2026-04-02T20:00:00.000Z',
      lastSeenAt: '2026-04-02T22:00:00.000Z',
      requestedBy: 'dashboard',
      capabilityIds: ['system.run'],
      hostHints: {
        hostname: 'oracle',
        platform: 'linux',
        workspace: '/srv',
        surface: 'node-host',
      },
      notes: [],
      operatorSummary: 'Online.',
    });

    const invokeService = new NodeInvokeService({
      now: () => new Date('2026-04-02T22:00:00.000Z'),
      registryService: registry,
      invocationStoreService: {
        listRecent: jest.fn(() => []),
        listActive: jest.fn(() => []),
        summarizeNode: jest.fn((nodeId: string) => nodeId === 'oracle-node' ? {
              pending: 0,
              claimed: 0,
              completedRecently: 0,
              stalePending: 1,
              staleClaimed: 1,
              recent: null,
            }
          : {
              pending: 0,
              claimed: 0,
              completedRecently: 0,
              stalePending: 0,
              staleClaimed: 0,
              recent: null,
            }),
      } as any,
    });
    const service = new ZavorthNodeMeshService({
      now: () => new Date('2026-04-02T22:00:00.000Z'),
      registryService: registry,
      invokeService,
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        expiredDrafts: 1,
        staleQueued: 2,
      }),
    );
    expect(snapshot.suggestedActions[0]).toEqual(
      expect.objectContaining({
        label: expect.stringContaining('Regenerar pairing'),
        actionHint: expect.stringContaining('regenerate-pairing-draft'),
      }),
    );
    expect(snapshot.narrative.operatorSummary).toContain('regenerate-pairing-draft');
    expect(snapshot.entries.find((entry) => entry.id === 'desktop-stale')).toEqual(
      expect.objectContaining({
        stalePairingDraft: true,
      }),
    );
  });

  it('surfaces node host maintenance when a stale queue can be repaired by the host itself', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-node-mesh-maintenance-'));
    tempDirs.push(root);
    const registry = new NodeRegistryService({
      now: () => new Date('2026-04-02T22:30:00.000Z'),
      stateFile: path.join(root, 'node-mesh-state.json'),
      secretsFile: path.join(root, 'node-mesh-secrets.json'),
      secureStorageService: {
        encryptString: jest.fn((value: string) => `enc:${value}`),
        decryptString: jest.fn((value: string) => value.replace(/^enc:/, '')),
      } as any,
    });

    registry.upsertNode({
      id: 'oracle-node',
      label: 'Oracle Node',
      profileId: 'headless-worker',
      kind: 'headless',
      transport: 'bridge',
      status: 'online',
      pairingStatus: 'paired',
      paired: true,
      createdAt: '2026-04-02T22:00:00.000Z',
      updatedAt: '2026-04-02T22:00:00.000Z',
      pairedAt: '2026-04-02T22:00:00.000Z',
      lastSeenAt: '2026-04-02T22:30:00.000Z',
      requestedBy: 'dashboard',
      capabilityIds: ['system.run', 'node.maintenance'],
      hostHints: {
        hostname: 'oracle',
        platform: 'linux',
        workspace: '/srv',
        surface: 'node-host',
      },
      notes: [],
      operatorSummary: 'Online.',
    });

    const invokeService = new NodeInvokeService({
      now: () => new Date('2026-04-02T22:30:00.000Z'),
      registryService: registry,
      invocationStoreService: {
        listRecent: jest.fn(() => []),
        listActive: jest.fn(() => []),
        summarizeNode: jest.fn(() => ({
          pending: 0,
          claimed: 0,
          completedRecently: 0,
          stalePending: 1,
          staleClaimed: 1,
          recent: null,
        })),
      } as any,
    });
    const service = new ZavorthNodeMeshService({
      now: () => new Date('2026-04-02T22:30:00.000Z'),
      registryService: registry,
      invokeService,
    });

    const snapshot = service.buildSnapshot({ selectedNodeId: 'oracle-node' });

    expect(snapshot.selected).toEqual(
      expect.objectContaining({
        id: 'oracle-node',
      }),
    );
    expect(snapshot.selected?.nextAction).toContain('maintenance');
    expect(snapshot.entries.find((entry) => entry.id === 'oracle-node')).toEqual(
      expect.objectContaining({
        nextAction: expect.stringContaining('maintenance'),
        maintenance: expect.objectContaining({
          supported: true,
          recoverKind: 'queue-node-host-maintenance',
        }),
      }),
    );
    expect(snapshot.suggestedActions[0]).toEqual(
      expect.objectContaining({
        label: expect.stringContaining('maintenance'),
        actionHint: expect.stringContaining('queue-node-host-maintenance'),
      }),
    );
    expect(snapshot.narrative.operatorSummary).toContain('queue-node-host-maintenance');
    expect(snapshot.selectedActivity).toEqual(
      expect.objectContaining({
        nodeId: 'oracle-node',
        maintenance: expect.objectContaining({
          supported: true,
          recoverKind: 'queue-node-host-maintenance',
        }),
        narrative: expect.objectContaining({
          operatorSummary: expect.stringContaining('queue-node-host-maintenance'),
        }),
      }),
    );
  });

  it('surfaces release-stale-claims when stale queue debt exists without maintenance capability', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-node-mesh-release-claims-'));
    tempDirs.push(root);
    const registry = new NodeRegistryService({
      now: () => new Date('2026-04-03T02:00:00.000Z'),
      stateFile: path.join(root, 'node-mesh-state.json'),
      secretsFile: path.join(root, 'node-mesh-secrets.json'),
      secureStorageService: {
        encryptString: jest.fn((value: string) => `enc:${value}`),
        decryptString: jest.fn((value: string) => value.replace(/^enc:/, '')),
      } as any,
    });

    registry.upsertNode({
      id: 'bridge-node',
      label: 'Bridge Node',
      profileId: 'headless-worker',
      kind: 'headless',
      transport: 'bridge',
      status: 'online',
      pairingStatus: 'paired',
      paired: true,
      createdAt: '2026-04-03T01:00:00.000Z',
      updatedAt: '2026-04-03T02:00:00.000Z',
      pairedAt: '2026-04-03T01:00:00.000Z',
      lastSeenAt: '2026-04-03T02:00:00.000Z',
      requestedBy: 'dashboard',
      capabilityIds: ['system.run'],
      hostHints: {
        hostname: 'bridge',
        platform: 'linux',
        workspace: '/srv',
        surface: 'node-host',
      },
      notes: [],
      operatorSummary: 'Online.',
    });

    const invokeService = new NodeInvokeService({
      now: () => new Date('2026-04-03T02:00:00.000Z'),
      registryService: registry,
      invocationStoreService: {
        listRecent: jest.fn(() => []),
        listActive: jest.fn(() => []),
        summarizeNode: jest.fn(() => ({
          pending: 0,
          claimed: 0,
          completedRecently: 0,
          stalePending: 1,
          staleClaimed: 1,
          recent: null,
        })),
      } as any,
    });

    const service = new ZavorthNodeMeshService({
      now: () => new Date('2026-04-03T02:00:00.000Z'),
      registryService: registry,
      invokeService,
    });

    const snapshot = service.buildSnapshot({ selectedNodeId: 'bridge-node' });

    expect(snapshot.suggestedActions[0]).toEqual(
      expect.objectContaining({
        label: expect.stringContaining('Revisar queue antiga'),
        actionHint: expect.stringContaining('release-stale-claims'),
      }),
    );
    expect(snapshot.narrative.operatorSummary).toContain('release-stale-claims');
    expect(snapshot.selectedActivity).toEqual(
      expect.objectContaining({
        maintenance: expect.objectContaining({
          supported: false,
          recoverKind: null,
        }),
        narrative: expect.objectContaining({
          operatorSummary: expect.stringContaining('release-stale-claims'),
        }),
      }),
    );
  });

  it('treats maintenance capability and latest repair cycle as first-class node host state', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-node-mesh-maint-state-'));
    tempDirs.push(root);
    const registry = new NodeRegistryService({
      now: () => new Date('2026-04-03T03:00:00.000Z'),
      stateFile: path.join(root, 'node-mesh-state.json'),
      secretsFile: path.join(root, 'node-mesh-secrets.json'),
      secureStorageService: {
        encryptString: jest.fn((value: string) => `enc:${value}`),
        decryptString: jest.fn((value: string) => value.replace(/^enc:/, '')),
      } as any,
    });

    registry.upsertNode({
      id: 'oracle-node',
      label: 'Oracle Node',
      profileId: 'headless-worker',
      kind: 'headless',
      transport: 'bridge',
      status: 'online',
      pairingStatus: 'paired',
      paired: true,
      createdAt: '2026-04-03T02:00:00.000Z',
      updatedAt: '2026-04-03T03:00:00.000Z',
      pairedAt: '2026-04-03T02:00:00.000Z',
      lastSeenAt: '2026-04-03T03:00:00.000Z',
      requestedBy: 'dashboard',
      capabilityIds: ['system.run', 'node.maintenance'],
      hostHints: {
        hostname: 'oracle',
        platform: 'linux',
        workspace: '/srv',
        surface: 'node-host',
      },
      notes: [],
      operatorSummary: 'Online.',
    });

    const maintenanceRecord = {
      id: 'invoke-maint-1',
      nodeId: 'oracle-node',
      capabilityId: 'node.maintenance',
      action: 'repair',
      payload: { reason: 'node-mesh-recover' },
      requestedBy: 'dashboard',
      transport: 'bridge',
      status: 'completed',
      requestedAt: '2026-04-03T02:55:00.000Z',
      queuedAt: '2026-04-03T02:55:00.000Z',
      claimedAt: '2026-04-03T02:55:10.000Z',
      completedAt: '2026-04-03T02:55:20.000Z',
      ok: true,
      resultSummary: 'Repair do node host removed 2 result(s) invalid(s).',
      output: null,
      staleAt: null,
      staleReason: null,
    };

    const invokeService = new NodeInvokeService({
      now: () => new Date('2026-04-03T03:00:00.000Z'),
      registryService: registry,
      invocationStoreService: {
        listRecent: jest.fn(() => [maintenanceRecord]),
        listActive: jest.fn(() => []),
        summarizeNode: jest.fn(() => ({
          pending: 0,
          claimed: 0,
          completedRecently: 1,
          stalePending: 0,
          staleClaimed: 0,
          recent: maintenanceRecord,
        })),
      } as any,
    });

    const service = new ZavorthNodeMeshService({
      now: () => new Date('2026-04-03T03:00:00.000Z'),
      registryService: registry,
      invokeService,
    });

    const snapshot = service.buildSnapshot({ selectedNodeId: 'oracle-node' });
    const activity = service.buildActivitySnapshot('oracle-node');
    const capabilities = service.buildCapabilitiesSnapshot('oracle-node');

    expect(snapshot.narrative.operatorSummary).toContain('1 host(s) com node.maintenance');
    expect(activity).toEqual(
      expect.objectContaining({
        maintenance: expect.objectContaining({
          supported: true,
          latestAction: 'repair',
          latestStatus: 'completed',
          latestResultSummary: expect.stringContaining('removed 2 result'),
          recoverKind: null,
        }),
        narrative: expect.objectContaining({
          operatorSummary: expect.stringContaining('node.maintenance/repair'),
        }),
      }),
    );
    expect(capabilities).toEqual(
      expect.objectContaining({
        maintenance: expect.objectContaining({
          supported: true,
          latestAction: 'repair',
          latestStatus: 'completed',
          latestResultSummary: expect.stringContaining('removed 2 result'),
        }),
        narrative: expect.objectContaining({
          operatorSummary: expect.stringContaining('Maintenance local disponivel via node.maintenance'),
        }),
      }),
    );
  });
});
