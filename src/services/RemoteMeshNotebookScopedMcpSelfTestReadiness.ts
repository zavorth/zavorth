import type { RemoteMeshSandboxReadinessSnapshot } from '../contracts/RemoteMeshSandboxReadinessContract.js';
import { ZAVORTH_REMOTE_MESH_SANDBOX_R0_CONTRACT_VERSION } from '../contracts/RemoteMeshSandboxReadinessContract.js';

export function buildNotebookScopedMcpSelfTestReadiness(input: {
  target: string;
  port: number;
  now: () => Date;
}): RemoteMeshSandboxReadinessSnapshot {
  const { target, port, now } = input;
  return {
        generatedAt: now().toISOString(),
        contractVersion: ZAVORTH_REMOTE_MESH_SANDBOX_R0_CONTRACT_VERSION,
        phase: 'R0',
        status: 'ready',
        target: {
          nodeId: target,
          expectedTailnetName: null,
          expectedPorts: [port],
        },
        summary: {
          checks: 1,
          passed: 1,
          warnings: 0,
          missing: 0,
          blocked: 0,
          notRequired: 0,
          directRouteObserved: true,
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
        nextActions: [],
        commands: {
          readiness: 'npx tsx scripts/remote-mesh-sandbox-readiness.ts --json',
          readinessNoLiveProbes: 'npx tsx scripts/remote-mesh-sandbox-readiness.ts --json --no-live-probes',
          focusedTests: 'npx jest tests/services/RemoteMeshSandboxReadinessService.test.ts --runInBand',
          nextPhase: 'R1 - Remote Mesh and Sandbox Contracts',
        },
      };
}
