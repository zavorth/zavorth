import type {
  RemoteExecutionReceipt,
  RemoteMeshJson,
  RemoteMeshTransportKind,
} from './RemoteMeshSandboxContract.js';
import type {
  RemoteMeshLiveProbeCandidate,
  RemoteMeshSandboxLiveActivationSnapshot,
} from './RemoteMeshSandboxLiveActivationContract.js';

export const ZAVORTH_REMOTE_MESH_SANDBOX_R5_LIVE_PROBE_VERSION =
  '2026-05-05.remote-mesh-sandbox-r5-live-probe' as const;

export type RemoteMeshLiveProbeExecutionStatus =
  | 'not-requested'
  | 'refused'
  | 'executed'
  | 'failed';

export type RemoteMeshLiveProbeTransportKind =
  | 'not-configured'
  | 'local'
  | 'mcp-http-status';

export type RemoteMeshLiveProbeGuardId =
  | 'explicit-execute-live-probe'
  | 'r4-armed-ready'
  | 'candidate-present'
  | 'candidate-is-status-probe'
  | 'candidate-level-0-readonly'
  | 'candidate-has-no-raw-command'
  | 'transport-configured'
  | 'transport-result-safe';

export type RemoteMeshLiveProbeGuardStatus =
  | 'passed'
  | 'waiting'
  | 'blocked';

export type RemoteMeshLiveProbeGuard = {
  id: RemoteMeshLiveProbeGuardId;
  status: RemoteMeshLiveProbeGuardStatus;
  evidence: string;
  remediation: string | null;
};

export type RemoteMeshLiveProbeTransportPayload = {
  toolName: string;
  params: Record<string, RemoteMeshJson>;
  timeoutMs: number;
  targetLabel: string | null;
};

export type RemoteMeshLiveProbeTransportResult = {
  status: 'success' | 'failed';
  startedAt: string;
  finishedAt: string;
  exitCode: number | null;
  stdoutPreview: string;
  stderrPreview: string;
  transportEvidence: string[];
  liveNetworkCallPerformed: boolean;
  remoteProcessSpawned: boolean;
  filesystemMutationPerformed: boolean;
  rawCommandSerialized: false;
  secretValuesSerialized: false;
};

export type RemoteMeshLiveProbeRequest = {
  executeLiveProbe: boolean;
  activationSnapshot: RemoteMeshSandboxLiveActivationSnapshot;
  transportKind: RemoteMeshLiveProbeTransportKind;
};

export type RemoteMeshLiveProbeExecution = {
  id: string;
  status: RemoteMeshLiveProbeExecutionStatus;
  reason: string;
  activationStatus: RemoteMeshSandboxLiveActivationSnapshot['status'];
  candidate: RemoteMeshLiveProbeCandidate | null;
  transportKind: RemoteMeshLiveProbeTransportKind;
  payload: RemoteMeshLiveProbeTransportPayload | null;
  guards: RemoteMeshLiveProbeGuard[];
  result: RemoteMeshLiveProbeTransportResult | null;
  receipt: RemoteExecutionReceipt;
  liveExecution: {
    requested: boolean;
    performed: boolean;
    liveNetworkCallPerformed: boolean;
    remoteProcessSpawned: boolean;
    filesystemMutationPerformed: boolean;
    rawCommandSerialized: false;
    secretValuesSerialized: false;
  };
};

export type RemoteMeshSandboxLiveProbeSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_REMOTE_MESH_SANDBOX_R5_LIVE_PROBE_VERSION;
  phase: 'R5';
  status: RemoteMeshLiveProbeExecutionStatus;
  summary: {
    guards: number;
    passed: number;
    waiting: number;
    blocked: number;
    executionRequested: boolean;
    executionPerformed: boolean;
    executionRefused: boolean;
    executionFailed: boolean;
    activationStatus: RemoteMeshSandboxLiveActivationSnapshot['status'];
    transportKind: RemoteMeshLiveProbeTransportKind;
    liveNetworkCallPerformed: boolean;
    remoteProcessSpawned: boolean;
    filesystemMutationPerformed: boolean;
    rawCommandSerialized: false;
    secretValuesSerialized: false;
    receipts: number;
  };
  request: RemoteMeshLiveProbeRequest;
  activation: RemoteMeshSandboxLiveActivationSnapshot;
  execution: RemoteMeshLiveProbeExecution;
  receipts: RemoteExecutionReceipt[];
  commands: {
    check: 'npm run remote-mesh:sandbox:live-probe --silent';
    focusedTests: 'npx jest tests/services/RemoteMeshSandboxLiveProbeExecutorService.test.ts --runInBand';
    typecheck: 'npm run runtime:check --silent';
    nextAction: 'Remote session timeline and audit surface';
  };
};
