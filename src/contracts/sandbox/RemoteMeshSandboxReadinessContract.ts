export const ZAVORTH_REMOTE_MESH_SANDBOX_R0_CONTRACT_VERSION =
  '2026-05-05.remote-mesh-sandbox-r0' as const;

export type RemoteMeshSandboxReadinessStatus = 'ready' | 'attention' | 'blocked';

export type RemoteMeshSandboxCheckStatus =
  | 'passed'
  | 'warning'
  | 'missing'
  | 'blocked'
  | 'not-required';

export type RemoteMeshSandboxComponent =
  | 'policy-guardrails'
  | 'tailscale-cli'
  | 'tailscale-status'
  | 'tailscale-peer-route'
  | 'ssh-cli'
  | 'mcp-config'
  | 'termux-environment'
  | 'proot-distro-cli'
  | 'docker-cli'
  | 'docker-rootless';

export type RemoteMeshSandboxCheckSeverity =
  | 'policy'
  | 'required'
  | 'recommended'
  | 'optional';

export type RemoteMeshSandboxTarget = {
  nodeId: string | null;
  expectedTailnetName: string | null;
  expectedPorts: number[];
};

export type RemoteMeshSandboxProbe = {
  component: RemoteMeshSandboxComponent;
  observed: boolean;
  evidence: string;
  command: string | null;
  details?: string[];
  capabilities?: string[];
  risks?: string[];
  authenticated?: boolean | null;
  directConnection?: boolean | null;
  relayConnection?: boolean | null;
  latencyMs?: number | null;
  rootless?: boolean | null;
  dockerGroupPrivilegeDetected?: boolean | null;
  freeformShellExposed?: boolean | null;
  unauthenticatedMcpExposed?: boolean | null;
  mutationPerformed?: false;
  secretsSerialized?: false;
};

export type RemoteMeshSandboxPolicy = {
  allowRemoteMutationDuringReadiness: false;
  allowFreeformShell: boolean;
  allowUnauthenticatedMcp: boolean;
  allowDockerGroupPrivilege: boolean;
  requireTailscale: boolean;
  requireSshClient: boolean;
  requireTermuxForMobileNode: boolean;
  requireProotDistroForMobileNode: boolean;
  requireDockerRootlessWhenDockerAvailable: boolean;
};

export type RemoteMeshSandboxReadinessInput = {
  generatedAt?: string;
  target?: Partial<RemoteMeshSandboxTarget>;
  probes?: Partial<Record<RemoteMeshSandboxComponent, RemoteMeshSandboxProbe>>;
  policy?: Partial<RemoteMeshSandboxPolicy>;
};

export type RemoteMeshSandboxReadinessCheck = {
  component: RemoteMeshSandboxComponent;
  status: RemoteMeshSandboxCheckStatus;
  severity: RemoteMeshSandboxCheckSeverity;
  evidence: string;
  command: string | null;
  details: string[];
  risks: string[];
  remediation: string[];
};

export type RemoteMeshSandboxReadinessReceipt = {
  id: string;
  component: RemoteMeshSandboxComponent;
  status: RemoteMeshSandboxCheckStatus;
  noRemoteMutation: true;
  noFreeformShell: true;
  secretValuesSerialized: false;
};

export type RemoteMeshSandboxReadinessSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_REMOTE_MESH_SANDBOX_R0_CONTRACT_VERSION;
  phase: 'R0';
  status: RemoteMeshSandboxReadinessStatus;
  target: RemoteMeshSandboxTarget;
  summary: {
    checks: number;
    passed: number;
    warnings: number;
    missing: number;
    blocked: number;
    notRequired: number;
    directRouteObserved: boolean;
    relayRouteObserved: boolean;
    remoteMutationPerformed: false;
    remoteExecutionRequiredToBuildSnapshot: false;
    freeformShellAllowed: false;
    secretValuesSerialized: false;
  };
  checks: RemoteMeshSandboxReadinessCheck[];
  receipts: RemoteMeshSandboxReadinessReceipt[];
  policy: RemoteMeshSandboxPolicy;
  nextActions: string[];
  commands: {
    readiness: 'npx tsx scripts/remote-mesh-sandbox-readiness.ts --json';
    readinessNoLiveProbes: 'npx tsx scripts/remote-mesh-sandbox-readiness.ts --json --no-live-probes';
    focusedTests: 'npx jest tests/services/RemoteMeshSandboxReadinessService.test.ts --runInBand';
    nextAction: 'Remote mesh and sandbox contracts';
  };
};
