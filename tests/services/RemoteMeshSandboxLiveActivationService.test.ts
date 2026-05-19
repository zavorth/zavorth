import type { RemoteMeshSandboxReadinessSnapshot } from '../../src/contracts/RemoteMeshSandboxReadinessContract.js';
import { ZAVORTH_REMOTE_MESH_SANDBOX_R0_CONTRACT_VERSION } from '../../src/contracts/RemoteMeshSandboxReadinessContract.js';
import { RemoteMeshSandboxLiveActivationService } from '../../src/services/RemoteMeshSandboxLiveActivationService.js';

const readiness = (input: {
  target?: string | null;
  direct?: boolean;
  relay?: boolean;
  blocked?: number;
} = {}): RemoteMeshSandboxReadinessSnapshot => ({
  generatedAt: '2026-05-05T15:00:00.000Z',
  contractVersion: ZAVORTH_REMOTE_MESH_SANDBOX_R0_CONTRACT_VERSION,
  stage: 'R0',
  status: input.blocked && input.blocked > 0 ? 'blocked' : 'ready',
  target: {
    nodeId: input.target ?? 'notebook-tailnet',
    expectedTailnetName: 'zavorth-tailnet',
    expectedPorts: [22],
  },
  summary: {
    checks: 8,
    passed: 8 - (input.blocked || 0),
    warnings: 0,
    missing: 0,
    blocked: input.blocked || 0,
    notRequired: 0,
    directRouteObserved: input.direct !== false,
    relayRouteObserved: input.relay === true,
    remoteMutationPerformed: false,
    remoteExecutionRequiredToBuildSnapshot: false,
    freeformShellAllowed: false,
    secretValuesSerialized: false,
  },
  checks: [],
  receipts: [],
  policy: {
    allowRemoteMutationDuringReadiness: false,
    allowFreeformShell: false,
    allowUnauthenticatedMcp: false,
    allowDockerGroupPrivilege: false,
    requireTailscale: false,
    requireSshClient: false,
    requireTermuxForMobileNode: false,
    requireProotDistroForMobileNode: false,
    requireDockerRootlessWhenDockerAvailable: false,
  },
  nextActions: [],
  commands: {
    readiness: 'npx tsx scripts/remote-mesh-sandbox-readiness.ts --json',
    readinessNoLiveProbes: 'npx tsx scripts/remote-mesh-sandbox-readiness.ts --json --no-live-probes',
    focusedTests: 'npx jest tests/services/RemoteMeshSandboxReadinessService.test.ts --runInBand',
    nextStage: 'R1 - Remote Mesh and Sandbox Contracts',
  },
});

describe('RemoteMeshSandboxLiveActivationService R4', () => {
  it('defaults to not-armed without executing any live operation', () => {
    const snapshot = new RemoteMeshSandboxLiveActivationService({
      now: () => new Date('2026-05-05T15:00:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.contractVersion).toBe('2026-05-05.remote-mesh-sandbox-r4-live-activation');
    expect(snapshot.phase).toBe('R4');
    expect(snapshot.status).toBe('not-armed');
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        liveExecutionAuthorized: false,
        liveExecutionPerformed: false,
        liveNetworkCallPerformed: false,
        remoteProcessSpawned: false,
        filesystemMutationPerformed: false,
        rawCommandSerialized: false,
        secretValuesSerialized: false,
      }),
    );
    expect(snapshot.ownerTrust.trusted).toBe(false);
    expect(snapshot.ownerTrust.mutableHostAccessGranted).toBe(false);
  });

  it('becomes ready-to-arm when owner trust, target, R0, R2, and R3 are all present', () => {
    const snapshot = new RemoteMeshSandboxLiveActivationService().buildSnapshot({
      tailnetTarget: 'notebook-tailnet',
      readinessSnapshot: readiness({ target: 'notebook-tailnet', direct: true }),
      ownerTrust: {
        trusted: true,
        source: 'test',
        operatorLabel: 'owner',
        acknowledgedRisk: true,
      },
    });

    expect(snapshot.status).toBe('ready-to-arm');
    expect(snapshot.summary.readyToArm).toBe(true);
    expect(snapshot.summary.liveExecutionAuthorized).toBe(false);
    expect(snapshot.plan.candidate).toEqual(
      expect.objectContaining({
        kind: 'mcp-status-probe',
        toolId: 'notebook.status',
        transport: 'mcp-http',
        risk: 'level-0-readonly',
        approval: 'not-required',
        rawCommand: null,
      }),
    );
    expect(snapshot.plan.gates.find((gate) => gate.id === 'owner-arm-live-probe')?.status).toBe('waiting');
  });

  it('becomes armed-ready only when the owner explicitly arms the low-risk probe', () => {
    const snapshot = new RemoteMeshSandboxLiveActivationService().buildSnapshot({
      tailnetTarget: 'notebook-tailnet',
      readinessSnapshot: readiness({ target: 'notebook-tailnet', direct: true }),
      ownerTrust: {
        trusted: true,
        source: 'test',
        operatorLabel: 'owner',
        acknowledgedRisk: true,
      },
      armLiveProbe: true,
    });

    expect(snapshot.status).toBe('armed-ready');
    expect(snapshot.summary.liveExecutionAuthorized).toBe(true);
    expect(snapshot.plan.liveExecution).toEqual(
      expect.objectContaining({
        authorized: true,
        performed: false,
        liveNetworkCallPerformed: false,
        remoteProcessSpawned: false,
        filesystemMutationPerformed: false,
        rawCommandSerialized: false,
      }),
    );
    expect(snapshot.plan.receipt).toEqual(
      expect.objectContaining({
        approvedBy: 'operator',
        status: 'allowed',
        rawCommandSerialized: false,
        mutationPerformed: false,
      }),
    );
  });

  it('requires explicit relay acceptance when R0 reports relay instead of direct route', () => {
    const withoutAcceptance = new RemoteMeshSandboxLiveActivationService().buildSnapshot({
      tailnetTarget: 'notebook-tailnet',
      readinessSnapshot: readiness({ target: 'notebook-tailnet', direct: false, relay: true }),
      ownerTrust: {
        trusted: true,
        source: 'test',
        acknowledgedRisk: true,
      },
    });
    const withAcceptance = new RemoteMeshSandboxLiveActivationService().buildSnapshot({
      tailnetTarget: 'notebook-tailnet',
      readinessSnapshot: readiness({ target: 'notebook-tailnet', direct: false, relay: true }),
      ownerTrust: {
        trusted: true,
        source: 'test',
        acknowledgedRisk: true,
      },
      acceptRelayRoute: true,
    });

    expect(withoutAcceptance.status).toBe('not-armed');
    expect(withoutAcceptance.plan.gates.find((gate) => gate.id === 'r0-route-accepted')?.status).toBe('waiting');
    expect(withAcceptance.status).toBe('ready-to-arm');
    expect(withAcceptance.plan.gates.find((gate) => gate.id === 'r0-route-accepted')?.status).toBe('passed');
  });

  it('blocks activation when R0 has blockers even if the owner arms the probe', () => {
    const snapshot = new RemoteMeshSandboxLiveActivationService().buildSnapshot({
      tailnetTarget: 'notebook-tailnet',
      readinessSnapshot: readiness({ target: 'notebook-tailnet', blocked: 1 }),
      ownerTrust: {
        trusted: true,
        source: 'test',
        acknowledgedRisk: true,
      },
      armLiveProbe: true,
    });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.summary.liveExecutionAuthorized).toBe(false);
    expect(snapshot.plan.gates.find((gate) => gate.id === 'r0-readiness-no-blockers')?.status).toBe('blocked');
    expect(snapshot.plan.receipt.status).toBe('blocked');
  });

  it('keeps R4 receipts redacted and never serializes raw commands', () => {
    const snapshot = new RemoteMeshSandboxLiveActivationService().buildSnapshot({
      tailnetTarget: 'notebook-tailnet',
      readinessSnapshot: readiness({ target: 'notebook-tailnet', direct: true }),
      ownerTrust: {
        trusted: true,
        source: 'test',
        operatorLabel: 'owner',
        acknowledgedRisk: true,
      },
      armLiveProbe: true,
    });

    expect(JSON.stringify(snapshot)).not.toContain('sk-1234567890abcdef');
    expect(snapshot.plan.candidate?.rawCommand).toBeNull();
    expect(snapshot.plan.adapterBinding?.preview.rawCommand).toBeNull();
    expect(snapshot.plan.adapterBinding?.preview.adapterCall.rawCommand).toBeNull();
    expect(snapshot.receipts.every((receipt) => receipt.rawCommandSerialized === false)).toBe(true);
    expect(snapshot.receipts.every((receipt) => receipt.noSecretsSerialized === true)).toBe(true);
  });
});
