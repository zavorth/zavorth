import fs from 'fs';
import os from 'os';
import path from 'path';
import { DeviceCapabilityPolicy } from '../../src/nodes/policy/DeviceCapabilityPolicy.js';
import { NodeInvokeService } from '../../src/services/NodeInvokeService.js';
import { NodeInvocationStoreService } from '../../src/services/NodeInvocationStoreService.js';
import { NodeRegistryService } from '../../src/services/NodeRegistryService.js';

describe('NodeInvokeService', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('queues remote invocations only for paired online nodes with declared capabilities', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-node-invoke-'));
    tempDirs.push(root);
    const registry = new NodeRegistryService({
      now: () => new Date('2026-04-02T17:00:00.000Z'),
      stateFile: path.join(root, 'node-mesh-state.json'),
      secretsFile: path.join(root, 'node-mesh-secrets.json'),
      secureStorageService: {
        encryptString: jest.fn((value: string) => `enc:${value}`),
        decryptString: jest.fn((value: string) => value.replace(/^enc:/, '')),
      } as any,
    });
    registry.upsertNode({
      id: 'pending-node',
      label: 'Pending Node',
      kind: 'headless',
      transport: 'bridge',
      status: 'pairing',
      pairingStatus: 'pending',
      paired: false,
      createdAt: '2026-04-02T17:00:00.000Z',
      updatedAt: '2026-04-02T17:00:00.000Z',
      pairedAt: null,
      lastSeenAt: null,
      requestedBy: 'dashboard',
      capabilityIds: ['system.run'],
      hostHints: { hostname: null, platform: null, workspace: null, surface: null },
      notes: [],
      operatorSummary: 'Pairing pendente.',
    });
    registry.upsertNode({
      id: 'paired-node',
      label: 'Paired Node',
      kind: 'headless',
      transport: 'bridge',
      status: 'online',
      pairingStatus: 'paired',
      paired: true,
      createdAt: '2026-04-02T17:00:00.000Z',
      updatedAt: '2026-04-02T17:00:00.000Z',
      pairedAt: '2026-04-02T17:00:00.000Z',
      lastSeenAt: '2026-04-02T17:00:00.000Z',
      requestedBy: 'dashboard',
      capabilityIds: ['system.run'],
      hostHints: { hostname: 'node-host', platform: 'linux', workspace: null, surface: null },
      notes: [],
      operatorSummary: 'Pronto.',
    });

    const service = new NodeInvokeService({
      now: () => new Date('2026-04-02T17:05:00.000Z'),
      registryService: registry,
      invocationStoreService: new NodeInvocationStoreService({
        now: () => new Date('2026-04-02T17:05:00.000Z'),
        stateFile: path.join(root, 'node-mesh-invocations.json'),
      }),
    });

    expect(
      service.invoke({
        nodeId: 'missing-node',
        capabilityId: 'system.run',
        action: 'diagnose',
      }),
    ).toEqual(
      expect.objectContaining({
        status: 'unavailable',
      }),
    );

    expect(
      service.invoke({
        nodeId: 'pending-node',
        capabilityId: 'system.run',
        action: 'diagnose',
      }),
    ).toEqual(
      expect.objectContaining({
        status: 'blocked',
      }),
    );

    const queued = service.invoke({
        nodeId: 'paired-node',
        capabilityId: 'system.run',
        action: 'diagnose',
      });

    expect(queued).toEqual(expect.objectContaining({
      ok: true,
      status: 'queued',
      nodeId: 'paired-node',
      invocationId: expect.any(String),
      policyDecision: expect.objectContaining({
        source: 'declared-capabilities-fallback',
        capabilityAllowed: true,
        bypassed: false,
      }),
      traceId: expect.any(String),
      runId: expect.any(String),
      execution_lifecycle: expect.arrayContaining([
        expect.objectContaining({
          kind: 'execution',
          status: 'planned',
          source: 'node-invoke',
        }),
      ]),
    }));

    expect(service.claimPendingForNode('paired-node', 2)).toEqual([
      expect.objectContaining({
        nodeId: 'paired-node',
        action: 'diagnose',
        status: 'claimed',
        execution_lifecycle: expect.arrayContaining([
          expect.objectContaining({ status: 'planned' }),
          expect.objectContaining({ status: 'running' }),
        ]),
      }),
    ]);
  });

  it('blocks invoke when the capability is outside the approved allowlist for the node', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-node-invoke-allowlist-'));
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
      id: 'restricted-node',
      label: 'Restricted Node',
      kind: 'headless',
      transport: 'remote',
      status: 'online',
      pairingStatus: 'paired',
      paired: true,
      createdAt: '2026-04-02T18:00:00.000Z',
      updatedAt: '2026-04-02T18:00:00.000Z',
      pairedAt: '2026-04-02T18:00:00.000Z',
      lastSeenAt: '2026-04-02T18:00:00.000Z',
      requestedBy: 'dashboard',
      capabilityIds: ['system.run', 'files.read'],
      approvedCapabilityIds: ['files.read'],
      hostHints: { hostname: 'restricted-host', platform: 'linux', workspace: null, surface: 'node-host' },
      notes: [],
      operatorSummary: 'Allowlist restrita.',
    });

    const service = new NodeInvokeService({
      now: () => new Date('2026-04-02T18:05:00.000Z'),
      registryService: registry,
      invocationStoreService: new NodeInvocationStoreService({
        now: () => new Date('2026-04-02T18:05:00.000Z'),
        stateFile: path.join(root, 'node-mesh-invocations.json'),
      }),
    });

    const blocked = service.invoke({
      nodeId: 'restricted-node',
      capabilityId: 'system.run',
      action: 'diagnose',
    });
    expect(blocked).toEqual(expect.objectContaining({
      ok: false,
      status: 'blocked',
      reason: expect.stringContaining('allowlist'),
      policyDecision: expect.objectContaining({
        source: 'registry-approved-capabilities',
        allowedCapabilityIds: ['files.read'],
        capabilityAllowed: false,
        policyRequired: true,
        bypassed: false,
      }),
      execution_lifecycle: expect.arrayContaining([
        expect.objectContaining({
          status: 'blocked',
          source: 'node-invoke',
          metadata: expect.objectContaining({
            policyDecision: expect.objectContaining({
              source: 'registry-approved-capabilities',
              capabilityAllowed: false,
            }),
          }),
        }),
      ]),
    }));

    expect(service.invoke({
      nodeId: 'restricted-node',
      capabilityId: 'files.read',
      action: 'inspect',
    })).toEqual(expect.objectContaining({
      ok: true,
      status: 'queued',
      nodeId: 'restricted-node',
      policyDecision: expect.objectContaining({
        source: 'registry-approved-capabilities',
        capabilityAllowed: true,
      }),
    }));
  });

  it('uses DeviceCapabilityPolicy as the explicit gate when registry approvals are absent', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-node-invoke-device-policy-'));
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
      id: 'policy-node',
      label: 'Policy Node',
      kind: 'headless',
      transport: 'remote',
      status: 'online',
      pairingStatus: 'paired',
      paired: true,
      createdAt: '2026-04-02T19:00:00.000Z',
      updatedAt: '2026-04-02T19:00:00.000Z',
      pairedAt: '2026-04-02T19:00:00.000Z',
      lastSeenAt: '2026-04-02T19:00:00.000Z',
      requestedBy: 'dashboard',
      capabilityIds: ['system.run', 'files.read'],
      hostHints: { hostname: 'policy-host', platform: 'linux', workspace: null, surface: 'node-host' },
      notes: [],
      operatorSummary: 'Policy externa restrita.',
    });
    const devicePolicy = new DeviceCapabilityPolicy({
      policyFile: path.join(root, 'device-capability-policy.json'),
      now: () => new Date('2026-04-02T19:01:00.000Z'),
    });
    devicePolicy.setPolicy('policy-node', {
      allowedCapabilities: ['files.read'],
      source: 'manual',
      notes: ['Gate explicito para teste P1-008b.'],
    });

    const service = new NodeInvokeService({
      now: () => new Date('2026-04-02T19:05:00.000Z'),
      registryService: registry,
      deviceCapabilityPolicy: devicePolicy,
      invocationStoreService: new NodeInvocationStoreService({
        now: () => new Date('2026-04-02T19:05:00.000Z'),
        stateFile: path.join(root, 'node-mesh-invocations.json'),
      }),
    });

    const blocked = service.invoke({
      nodeId: 'policy-node',
      capabilityId: 'system.run',
      action: 'diagnose',
    });
    expect(blocked).toEqual(expect.objectContaining({
      ok: false,
      status: 'blocked',
      reason: expect.stringContaining('DeviceCapabilityPolicy'),
      commandHint: expect.stringContaining('DeviceCapabilityPolicy'),
      policyDecision: expect.objectContaining({
        source: 'device-capability-policy',
        allowedCapabilityIds: ['files.read'],
        capabilityDeclared: true,
        capabilityAllowed: false,
        policyRequired: true,
        bypassed: false,
      }),
    }));

    expect(service.invoke({
      nodeId: 'policy-node',
      capabilityId: 'files.read',
      action: 'inspect',
    })).toEqual(expect.objectContaining({
      ok: true,
      status: 'queued',
      nodeId: 'policy-node',
      policyDecision: expect.objectContaining({
        source: 'device-capability-policy',
        allowedCapabilityIds: ['files.read'],
        capabilityAllowed: true,
        bypassed: false,
      }),
    }));
  });
});
