import fs from 'fs';
import os from 'os';
import path from 'path';
import { ZavorthFederatedMeshControlPlaneService } from '@zavorth/mesh/ZavorthFederatedMeshControlPlaneService.js';
import { NodeInvocationStoreService } from '../../src/services/NodeInvocationStoreService';
import { NodeInvokeService } from '../../src/services/NodeInvokeService';
import { NodeRegistryService } from '../../src/services/NodeRegistryService';

function mutationPlaneMock() {
  let plan: any = null;
  return {
    createPlan: jest.fn((input: any) => {
      plan = {
        id: 'federated-mesh-plan-1',
        domain: input.domain,
        actionId: input.actionId,
        status: input.approvalRequired ? 'waiting_approval' : 'draft',
        riskLevel: input.riskLevel,
        resourceImpact: input.resourceImpact,
        readinessGates: input.readinessGates,
        payload: input.payload,
        approval: {
          required: input.approvalRequired,
          status: input.approvalRequired ? 'pending' : 'not_required',
          permissionId: null,
          reason: input.approvalReason,
          defaultScope: 'once',
          availableScopes: ['once', 'session', 'host'],
        },
      };
      return plan;
    }),
    attachApproval: jest.fn((_planId: string, approval: any) => {
      plan = {
        ...plan,
        approval: {
          ...plan.approval,
          permissionId: approval.permissionId,
          status: approval.status,
          reason: approval.reason,
        },
      };
      return plan;
    }),
  };
}

function buildService(root: string, now = () => new Date('2026-04-21T10:00:00.000Z')) {
  const registry = new NodeRegistryService({
    now,
    stateFile: path.join(root, 'node-mesh-state.json'),
    secretsFile: path.join(root, 'node-mesh-secrets.json'),
    secureStorageService: {
      encryptString: jest.fn((value: string) => `enc:${value}`),
      decryptString: jest.fn((value: string) => value.replace(/^enc:/, '')),
    } as any,
  });
  const invocationStore = new NodeInvocationStoreService({
    now,
    stateFile: path.join(root, 'node-mesh-invocations.json'),
  });
  const invokeService = new NodeInvokeService({
    now,
    registryService: registry,
    invocationStoreService: invocationStore,
  });
  const mutationPlane = mutationPlaneMock();
  const trustDecisionService = {
    evaluate: jest.fn(async () => ({
      generatedAt: '2026-04-21T10:00:00.000Z',
      decision: 'requires_approval',
      ok: false,
      reason: 'Invocacao remota mutavel exige approval.',
      permission: { permission_id: 'perm-fmesh-1', status: 'pending' },
      profile: 'ops',
      capabilityId: 'files.write',
      recommendedScope: 'once',
    })),
  };
  const service = new ZavorthFederatedMeshControlPlaneService({
    now,
    localNodeId: 'local-test',
    registryService: registry,
    invokeService,
    mutationPlaneService: mutationPlane as any,
    trustDecisionService: trustDecisionService as any,
    distributedRuntimeService: {
      buildSnapshot: jest.fn(async () => ({
        summary: { posture: 'attention' },
      })),
    } as any,
  });
  return { service, registry, invokeService, invocationStore, mutationPlane, trustDecisionService };
}

describe('ZavorthFederatedMeshControlPlaneService', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-federated-mesh-'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('reports implementation ready and dormant when no remote infra is live', async () => {
    const { service } = buildService(root);

    const snapshot = await service.buildSnapshot();

    expect(snapshot.summary.implementationReady).toBe(true);
    expect(snapshot.summary.infrastructureState).toBe('dormant');
    expect(snapshot.summary.heavyRuntimesStarted).toBe(false);
    expect(snapshot.nodes.find((entry) => entry.source === 'local')).toEqual(
      expect.objectContaining({
        id: 'local-test',
        profile: 'local',
      }),
    );
    expect(snapshot.actions[0]).toEqual(
      expect.objectContaining({
        id: 'pair-first-federated-node',
      }),
    );
  });

  it('pairs, heartbeats, routes and queues a read-only workload by capability', async () => {
    const { service, invokeService } = buildService(root);

    const paired = service.pairNode({
      nodeId: 'gpu-1',
      profile: 'gpu-worker',
      trust: 'trusted',
      capabilityIds: ['device.info', 'files.read', 'files.write', 'system.run'],
      commandScopes: ['read', 'write', 'execute'],
      requestedBy: 'tester',
    });
    const heartbeat = service.recordHeartbeat({
      nodeId: paired.node.id,
      capabilityIds: ['device.info', 'files.read', 'files.write', 'system.run'],
      latencyMs: 12,
      costScore: 3,
      trust: 'trusted',
      commandScopes: ['read', 'write', 'execute'],
      networkType: 'lan',
    });
    const route = await service.routeCapability({
      capabilityId: 'files.read',
      action: 'read',
      persist: true,
      mutable: false,
      requestedBy: 'tester',
    });

    expect(heartbeat.node).toEqual(expect.objectContaining({
      status: 'online',
      profile: 'gpu-worker',
    }));
    expect(route.status).toBe('queued');
    expect(route.selectedNode).toEqual(expect.objectContaining({
      id: 'gpu-1',
      profile: 'gpu-worker',
    }));
    expect(route.reasons.join(' ')).toContain('idempotency');
    expect(route.invocationResult).toEqual(expect.objectContaining({
      ok: true,
      status: 'queued',
      nodeId: 'gpu-1',
    }));
    expect(invokeService.claimPendingForNode('gpu-1')).toEqual([
      expect.objectContaining({
        capabilityId: 'files.read',
        payload: expect.objectContaining({
          federatedMesh: expect.objectContaining({
            idempotencyKey: expect.stringContaining('fmesh:'),
            cancelToken: expect.stringContaining('cancel:'),
          }),
        }),
      }),
    ]);
  });

  it('turns mutable remote routes into mutation plans and Trust Plane decisions', async () => {
    const { service, mutationPlane, trustDecisionService } = buildService(root);
    service.pairNode({
      nodeId: 'server-1',
      profile: 'lan',
      trust: 'trusted',
      capabilityIds: ['files.read', 'files.write'],
      commandScopes: ['read', 'write'],
    });
    service.recordHeartbeat({
      nodeId: 'server-1',
      capabilityIds: ['files.read', 'files.write'],
      trust: 'trusted',
      commandScopes: ['read', 'write'],
    });

    const route = await service.routeCapability({
      capabilityId: 'files.write',
      action: 'write',
      mutable: true,
      persist: true,
      payload: { path: '/tmp/out.txt' },
      requestedBy: 'tester',
      sourceSurface: 'jest',
    });

    expect(route.status).toBe('waiting_approval');
    expect(route.invocationResult).toBeNull();
    expect(route.mutationPlan).toEqual(expect.objectContaining({
      id: 'federated-mesh-plan-1',
      domain: 'federated-mesh',
      actionId: 'invoke-remote-capability',
      approval: expect.objectContaining({
        permissionId: 'perm-fmesh-1',
      }),
      payload: expect.objectContaining({
        nodeId: 'server-1',
        queueControl: expect.objectContaining({
          idempotencyKey: expect.stringContaining('fmesh:'),
          cancellable: true,
        }),
      }),
    }));
    expect(mutationPlane.createPlan).toHaveBeenCalledWith(expect.objectContaining({
      domain: 'federated-mesh',
      approvalRequired: true,
      readinessGates: expect.arrayContaining([
        expect.objectContaining({ id: 'federated-node-online', canProceed: true }),
        expect.objectContaining({ id: 'federated-node-trust', canProceed: true }),
      ]),
    }));
    expect(trustDecisionService.evaluate).toHaveBeenCalledWith(expect.objectContaining({
      domain: 'federated-mesh',
      actionId: 'invoke-remote-capability',
      approvalRequired: true,
    }));
  });

  it('revokes nodes and falls back local instead of breaking core routing', async () => {
    const { service } = buildService(root);
    service.pairNode({
      nodeId: 'lan-1',
      profile: 'lan',
      trust: 'trusted',
      capabilityIds: ['files.read'],
    });
    service.recordHeartbeat({
      nodeId: 'lan-1',
      capabilityIds: ['files.read'],
      trust: 'trusted',
    });

    const revoked = service.revokeNode({
      nodeId: 'lan-1',
      reason: 'teste',
    });
    const route = await service.routeCapability({
      capabilityId: 'files.read',
      mutable: false,
      persist: false,
    });
    const snapshot = await service.buildSnapshot();

    expect(revoked.status).toBe('revoked');
    expect(route.status).toBe('fallback_local');
    expect(route.selectedNode).toEqual(expect.objectContaining({
      source: 'local',
    }));
    expect(snapshot.summary.revokedNodes).toBe(1);
  });

  it('keeps offline paired mesh as infra offline with local fallback available', async () => {
    const { service } = buildService(root);
    service.pairNode({
      nodeId: 'server-offline',
      profile: 'official-remote',
      trust: 'trusted',
      capabilityIds: ['files.read'],
    });

    const snapshot = await service.buildSnapshot();
    const route = await service.routeCapability({
      capabilityId: 'files.read',
      mutable: false,
      persist: false,
    });

    expect(snapshot.summary.infrastructureState).toBe('offline');
    expect(snapshot.distributedRuntime.offlineReason).toContain('sem heartbeat');
    expect(route.status).toBe('fallback_local');
    expect(route.blockers.join(' ')).toContain('nao esta online');
  });
});
