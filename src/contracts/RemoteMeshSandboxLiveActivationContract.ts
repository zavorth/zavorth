import type {
  RemoteExecutionReceipt,
  RemoteMeshApprovalMode,
  RemoteMeshRiskTier,
  RemoteMeshTransportKind,
} from './RemoteMeshSandboxContract.js';
import type { RemoteMeshAdapterDryRunBinding } from './RemoteMeshSandboxAdapterContract.js';
import type { RemoteMeshPolicyEvaluation } from './RemoteMeshSandboxPolicyContract.js';
import type { RemoteMeshSandboxReadinessSnapshot } from './RemoteMeshSandboxReadinessContract.js';

export const ZAVORTH_REMOTE_MESH_SANDBOX_R4_LIVE_ACTIVATION_VERSION =
  '2026-05-05.remote-mesh-sandbox-r4-live-activation' as const;

export type RemoteMeshLiveActivationStatus =
  | 'not-armed'
  | 'ready-to-arm'
  | 'armed-ready'
  | 'blocked';

export type RemoteMeshLiveActivationGateStatus =
  | 'passed'
  | 'waiting'
  | 'blocked';

export type RemoteMeshLiveActivationGateId =
  | 'owner-trust'
  | 'target-configured'
  | 'r0-readiness-no-blockers'
  | 'r0-target-bound'
  | 'r0-route-accepted'
  | 'r2-low-risk-policy'
  | 'r3-dry-run-binding'
  | 'owner-arm-live-probe';

export type RemoteMeshOwnerTrustProof = {
  trusted: boolean;
  source: 'none' | 'test' | 'env' | 'hostauth';
  operatorLabel: string | null;
  acknowledgedRisk: boolean;
  mutableHostAccessGranted: false;
};

export type RemoteMeshLiveActivationGate = {
  id: RemoteMeshLiveActivationGateId;
  status: RemoteMeshLiveActivationGateStatus;
  evidence: string;
  remediation: string | null;
};

export type RemoteMeshLiveProbeKind =
  | 'mcp-status-probe'
  | 'ssh-wrapper-status-probe'
  | 'termux-proot-version-probe';

export type RemoteMeshLiveProbeCandidate = {
  id: string;
  kind: RemoteMeshLiveProbeKind;
  targetNodeId: string;
  tailnetTarget: string | null;
  actionId: string;
  evaluationId: string;
  adapterBindingId: string;
  toolId: string;
  transport: RemoteMeshTransportKind | 'policy-only';
  risk: RemoteMeshRiskTier;
  approval: RemoteMeshApprovalMode;
  commandTemplateId: string | null;
  mcpToolName: string | null;
  rawCommand: null;
  maxRuntimeMs: number;
  teardownRequired: boolean;
};

export type RemoteMeshLiveActivationPlan = {
  id: string;
  status: RemoteMeshLiveActivationStatus;
  candidate: RemoteMeshLiveProbeCandidate | null;
  readiness: RemoteMeshSandboxReadinessSnapshot;
  policyEvaluation: RemoteMeshPolicyEvaluation | null;
  adapterBinding: RemoteMeshAdapterDryRunBinding | null;
  gates: RemoteMeshLiveActivationGate[];
  receipt: RemoteExecutionReceipt;
  liveExecution: {
    authorized: boolean;
    performed: false;
    liveNetworkCallPerformed: false;
    remoteProcessSpawned: false;
    filesystemMutationPerformed: false;
    rawCommandSerialized: false;
    secretValuesSerialized: false;
  };
};

export type RemoteMeshSandboxLiveActivationSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_REMOTE_MESH_SANDBOX_R4_LIVE_ACTIVATION_VERSION;
  phase: 'R4';
  status: RemoteMeshLiveActivationStatus;
  summary: {
    gates: number;
    passed: number;
    waiting: number;
    blocked: number;
    hasCandidate: boolean;
    ownerTrusted: boolean;
    targetConfigured: boolean;
    readyToArm: boolean;
    liveExecutionAuthorized: boolean;
    liveExecutionPerformed: false;
    liveNetworkCallPerformed: false;
    remoteProcessSpawned: false;
    filesystemMutationPerformed: false;
    rawCommandSerialized: false;
    secretValuesSerialized: false;
  };
  ownerTrust: RemoteMeshOwnerTrustProof;
  plan: RemoteMeshLiveActivationPlan;
  receipts: RemoteExecutionReceipt[];
  commands: {
    check: 'npm run remote-mesh:sandbox:live-activation --silent';
    focusedTests: 'npx jest tests/services/RemoteMeshSandboxLiveActivationService.test.ts --runInBand';
    typecheck: 'npm run runtime:check --silent';
    nextStage: 'R5 - Single Low-Risk Live Probe Executor';
  };
};
