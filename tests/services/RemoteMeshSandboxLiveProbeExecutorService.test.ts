import type { RemoteMeshSandboxReadinessSnapshot } from '../../src/contracts/RemoteMeshSandboxReadinessContract.js';
import { ZAVORTH_REMOTE_MESH_SANDBOX_R0_CONTRACT_VERSION } from '../../src/contracts/RemoteMeshSandboxReadinessContract.js';
import {
  MockRemoteMeshLiveProbeTransport,
  RemoteMeshSandboxLiveProbeExecutorService,
  type RemoteMeshLiveProbeTransport,
  type RemoteMeshLiveProbeTransportInvocation,
} from '../../src/services/RemoteMeshSandboxLiveProbeExecutorService.js';
import { RemoteMeshSandboxLiveActivationService } from '../../src/services/RemoteMeshSandboxLiveActivationService.js';

import type { RemoteMeshLiveProbeTransportResult } from '../../src/contracts/RemoteMeshSandboxLiveProbeContract.js';
import type { RemoteMeshSandboxLiveActivationSnapshot } from '../../src/contracts/RemoteMeshSandboxLiveActivationContract.js';

const readiness = (input: {
  target-: string | null;
  direct-: boolean;
  relay-: boolean;
  blocked-: number;
} = {}): RemoteMeshSandboxReadinessSnapshot => ({
  generatedAt: '2026-05-05T16:00:00.000Z',
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
    nextAction: 'Remote mesh and sandbox contracts',
  },
});

const armedActivation = (): RemoteMeshSandboxLiveActivationSnapshot => new RemoteMeshSandboxLiveActivationService({
  now: () => new Date('2026-05-05T16:00:00.000Z'),
}).buildSnapshot({
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

class CountingTransport implements RemoteMeshLiveProbeTransport {
  public readonly kind = 'mock' as const;
  public calls = 0;

  public async execute(input: RemoteMeshLiveProbeTransportInvocation): Promise<RemoteMeshLiveProbeTransportResult> {
    this.calls += 1;
    return new MockRemoteMeshLiveProbeTransport({
      now: () => new Date('2026-05-05T16:00:00.000Z'),
    }).execute(input);
  }
}

describe('RemoteMeshSandboxLiveProbeExecutorService R5', () => {
  it('defaults to a not-requested plan and performs no live operation', async () => {
    const transport = new CountingTransport();
    const snapshot = await new RemoteMeshSandboxLiveProbeExecutorService({
      now: () => new Date('2026-05-05T16:00:00.000Z'),
      transport,
    }).buildSnapshot();

    expect(snapshot.contractVersion).toBe('2026-05-05.remote-mesh-sandbox-r5-live-probe');
    expect(snapshot.phase).toBe('R5');
    expect(snapshot.status).toBe('not-requested');
    expect(transport.calls).toBe(0);
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        executionRequested: false,
        executionPerformed: false,
        liveNetworkCallPerformed: false,
        remoteProcessSpawned: false,
        filesystemMutationPerformed: false,
        rawCommandSerialized: false,
        secretValuesSerialized: false,
      }),
    );
  });

  it('refuses execution when R4 is not armed-ready', async () => {
    const transport = new CountingTransport();
    const snapshot = await new RemoteMeshSandboxLiveProbeExecutorService({ transport }).buildSnapshot({
      executeLiveProbe: true,
      activationSnapshot: new RemoteMeshSandboxLiveActivationService().buildSnapshot(),
    });

    expect(snapshot.status).toBe('refused');
    expect(snapshot.execution.reason).toContain('r4-armed-ready');
    expect(transport.calls).toBe(0);
    expect(snapshot.execution.receipt.status).toBe('blocked');
  });

  it('refuses an armed R4 plan when the live transport is not configured', async () => {
    const snapshot = await new RemoteMeshSandboxLiveProbeExecutorService().buildSnapshot({
      executeLiveProbe: true,
      activationSnapshot: armedActivation(),
    });

    expect(snapshot.status).toBe('refused');
    expect(snapshot.execution.reason).toContain('transport-configured');
    expect(snapshot.summary.executionPerformed).toBe(false);
  });

  it('executes exactly one low-risk status probe when R4 is armed and a transport is configured', async () => {
    const transport = new CountingTransport();
    const snapshot = await new RemoteMeshSandboxLiveProbeExecutorService({
      now: () => new Date('2026-05-05T16:00:00.000Z'),
      transport,
    }).buildSnapshot({
      executeLiveProbe: true,
      activationSnapshot: armedActivation(),
    });

    expect(snapshot.status).toBe('executed');
    expect(transport.calls).toBe(1);
    expect(snapshot.execution.payload).toEqual(
      expect.objectContaining({
        toolName: 'notebook.get_status',
        targetLabel: 'notebook-tailnet',
      }),
    );
    expect(snapshot.execution.result).toEqual(
      expect.objectContaining({
        status: 'success',
        liveNetworkCallPerformed: false,
        remoteProcessSpawned: false,
        filesystemMutationPerformed: false,
        rawCommandSerialized: false,
        secretValuesSerialized: false,
      }),
    );
    expect(snapshot.execution.receipt).toEqual(
      expect.objectContaining({
        status: 'executed',
        approvedBy: 'operator',
        rawCommandSerialized: false,
        noSecretsSerialized: true,
        mutationPerformed: false,
      }),
    );
    expect(snapshot.execution.receipt.stdoutHash).toHaveLength(64);
    expect(snapshot.execution.receipt.stderrHash).toHaveLength(64);
  });

  it('reports failed when the transport reports failure', async () => {
    const snapshot = await new RemoteMeshSandboxLiveProbeExecutorService({
      transport: new MockRemoteMeshLiveProbeTransport({
        now: () => new Date('2026-05-05T16:00:00.000Z'),
        status: 'failed',
      }),
    }).buildSnapshot({
      executeLiveProbe: true,
      activationSnapshot: armedActivation(),
    });

    expect(snapshot.status).toBe('failed');
    expect(snapshot.execution.result?.status).toBe('failed');
    expect(snapshot.execution.receipt.status).toBe('failed');
  });

  it('refuses any candidate that exposes a raw command surface', async () => {
    const activation = armedActivation();
    const unsafeActivation = {
      ...activation,
      plan: {
        ...activation.plan,
        candidate: {
          ...activation.plan.candidate,
          rawCommand: 'echo unsafe',
        },
      },
    } as unknown as RemoteMeshSandboxLiveActivationSnapshot;
    const transport = new CountingTransport();
    const snapshot = await new RemoteMeshSandboxLiveProbeExecutorService({ transport }).buildSnapshot({
      executeLiveProbe: true,
      activationSnapshot: unsafeActivation,
    });

    expect(snapshot.status).toBe('refused');
    expect(snapshot.execution.guards.find((guard) => guard.id === 'candidate-has-no-raw-command')?.status).toBe('blocked');
    expect(transport.calls).toBe(0);
  });
});
