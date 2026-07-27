import type { RemoteMeshSandboxReadinessSnapshot } from '../../src/contracts/RemoteMeshSandboxReadinessContract.js';
import { ZAVORTH_REMOTE_MESH_SANDBOX_R0_CONTRACT_VERSION } from '../../src/contracts/RemoteMeshSandboxReadinessContract.js';
import { RemoteMeshSandboxAuditTimelineService } from '../../src/services/RemoteMeshSandboxAuditTimelineService.js';
import {
  MockRemoteMeshLiveProbeTransport,
  RemoteMeshSandboxLiveProbeExecutorService,
} from '../../src/services/RemoteMeshSandboxLiveProbeExecutorService.js';

const readiness = (input: {
  target?: string | null;
  direct?: boolean;
  blocked?: number;
} = {}): RemoteMeshSandboxReadinessSnapshot => ({
  generatedAt: '2026-05-05T17:00:00.000Z',
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
    relayRouteObserved: false,
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
  nextActions: ['Rerun readiness with a concrete target.'],
  commands: {
    readiness: 'npx tsx scripts/remote-mesh-sandbox-readiness.ts --json',
    readinessNoLiveProbes: 'npx tsx scripts/remote-mesh-sandbox-readiness.ts --json --no-live-probes',
    focusedTests: 'npx jest tests/services/RemoteMeshSandboxReadinessService.test.ts --runInBand',
    nextAction: 'Remote mesh and sandbox contracts',
  },
});

describe('RemoteMeshSandboxAuditTimelineService R6', () => {
  it('builds a safe audit timeline from the default non-executing R5 path', async () => {
    const snapshot = await new RemoteMeshSandboxAuditTimelineService({
      now: () => new Date('2026-05-05T17:00:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.contractVersion).toBe('2026-05-05.remote-mesh-sandbox-r6-audit-timeline');
    expect(snapshot.lifecycleStep).toBe('R6');
    expect(snapshot.status).toBe('timeline-attention');
    expect(snapshot.summary.entries).toBeGreaterThan(0);
    expect(snapshot.summary.timelineHasExecutionReceipt).toBe(true);
    expect(snapshot.summary.timelineHasOperatorNextAction).toBe(true);
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        liveNetworkCallPerformed: false,
        remoteProcessSpawned: false,
        filesystemMutationPerformed: false,
        mutationPerformed: false,
        rawCommandSerialized: false,
        secretValuesSerialized: false,
      }),
    );
  });

  it('indexes timeline entries by run, action, decision, node, tool, status, and receipt', async () => {
    const snapshot = await new RemoteMeshSandboxAuditTimelineService().buildSnapshot();

    expect(snapshot.query.runId).toBe('remote-live-probe:notebook-status');
    expect(snapshot.indexes.byRunId[snapshot.query.runId!].length).toBe(snapshot.summary.entries);
    expect(snapshot.query.actionId).toBeTruthy();
    expect(snapshot.indexes.byActionId[snapshot.query.actionId!]).toBeTruthy();
    expect(snapshot.indexes.byDecisionId[snapshot.query.decisionId!]).toBeTruthy();
    expect(snapshot.indexes.byNodeId[snapshot.query.nodeId!]).toBeTruthy();
    expect(snapshot.indexes.byToolId[snapshot.query.toolId!]).toBeTruthy();
    expect(snapshot.indexes.byStatus.planned).toBeTruthy();
    for (const receiptId of snapshot.query.receiptIds) {
      expect(snapshot.indexes.byReceiptId[receiptId]).toBeTruthy();
    }
  });

  it('shows executed probe evidence when R5 ran through the mock transport', async () => {
    const liveProbe = await new RemoteMeshSandboxLiveProbeExecutorService({
      now: () => new Date('2026-05-05T17:00:00.000Z'),
      transport: new MockRemoteMeshLiveProbeTransport({
        now: () => new Date('2026-05-05T17:00:00.000Z'),
      }),
    }).buildSnapshot({
      executeLiveProbe: true,
      activationInput: {
        tailnetTarget: 'notebook-tailnet',
        readinessSnapshot: readiness({ target: 'notebook-tailnet', direct: true }),
        ownerTrust: {
          trusted: true,
          source: 'test',
          operatorLabel: 'owner',
          acknowledgedRisk: true,
        },
        armLiveProbe: true,
      },
    });
    const snapshot = await new RemoteMeshSandboxAuditTimelineService().buildSnapshot({
      liveProbeSnapshot: liveProbe,
    });

    expect(snapshot.source.liveProbeStatus).toBe('executed');
    expect(snapshot.summary.executed).toBeGreaterThan(0);
    expect(snapshot.timeline.some((entry) => entry.kind === 'live-probe-result' && entry.status === 'executed')).toBe(true);
    expect(snapshot.receipts.some((receipt) => receipt.status === 'executed')).toBe(true);
  });

  it('keeps failure UX explicit for a failed R5 transport', async () => {
    const liveProbe = await new RemoteMeshSandboxLiveProbeExecutorService({
      transport: new MockRemoteMeshLiveProbeTransport({
        now: () => new Date('2026-05-05T17:00:00.000Z'),
        status: 'failed',
      }),
    }).buildSnapshot({
      executeLiveProbe: true,
      activationInput: {
        tailnetTarget: 'notebook-tailnet',
        readinessSnapshot: readiness({ target: 'notebook-tailnet', direct: true }),
        ownerTrust: {
          trusted: true,
          source: 'test',
          operatorLabel: 'owner',
          acknowledgedRisk: true,
        },
        armLiveProbe: true,
      },
    });
    const snapshot = await new RemoteMeshSandboxAuditTimelineService().buildSnapshot({
      liveProbeSnapshot: liveProbe,
    });
    const failedEntry = snapshot.timeline.find((entry) => entry.kind === 'live-probe-result');

    expect(snapshot.status).toBe('timeline-attention');
    expect(failedEntry).toEqual(
      expect.objectContaining({
        status: 'failed',
        cause: expect.any(String),
        impact: expect.any(String),
        safeNextAction: expect.any(String),
        retryable: true,
      }),
    );
  });

  it('never exposes raw commands or secrets in timeline entries or receipts', async () => {
    const snapshot = await new RemoteMeshSandboxAuditTimelineService().buildSnapshot();

    expect(snapshot.timeline.every((entry) => entry.sideEffects.rawCommandSerialized === false)).toBe(true);
    expect(snapshot.timeline.every((entry) => entry.sideEffects.secretValuesSerialized === false)).toBe(true);
    expect(snapshot.receipts.every((receipt) => receipt.rawCommandSerialized === false)).toBe(true);
    expect(snapshot.receipts.every((receipt) => receipt.noSecretsSerialized === true)).toBe(true);
    expect(JSON.stringify(snapshot)).not.toContain('sk-1234567890abcdef');
  });
});
