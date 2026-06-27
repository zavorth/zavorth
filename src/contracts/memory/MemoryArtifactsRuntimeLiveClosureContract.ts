import type { LiveReadinessStatus } from '../LiveReadinessContract.js';

export const ZAVORTH_MEMORY_ARTIFACTS_RUNTIME_LIVE_CLOSURE_CONTRACT_VERSION = '2026-05-05.live-checkpoint-12' as const;

export type MemoryArtifactsRuntimeLiveTargetId =
  | 'memory-core'
  | 'active-memory'
  | 'memory-wiki'
  | 'memory-lancedb'
  | 'thread-ownership'
  | 'codex'
  | 'openshell'
  | 'llm-task'
  | 'vydra'
  | 'skill-workshop'
  | 'acpx';

export type MemoryArtifactsRuntimeLiveCapability =
  | 'memory.active'
  | 'memory.vector'
  | 'memory.wiki'
  | 'artifact.index'
  | 'artifact.replay'
  | 'thread.ownership'
  | 'agent.runtime'
  | 'sandbox.remote'
  | 'task.orchestrate'
  | 'workspace.command'
  | 'bridge.protocol';

export type MemoryArtifactsRuntimeLiveMode =
  | 'memory-remember'
  | 'memory-recall'
  | 'memory-cite'
  | 'memory-forget'
  | 'artifact-body-index'
  | 'artifact-replay'
  | 'wiki-upsert'
  | 'wiki-search'
  | 'vector-backend-decision'
  | 'thread-ownership-enforcement'
  | 'codex-runtime-invoke'
  | 'openshell-sandbox-exec'
  | 'local-runtime-exec'
  | 'task-orchestration'
  | 'workspace-command-plugin'
  | 'acp-bridge-proof'
  | 'approval-gate';

export type MemoryArtifactsRuntimeLiveStatus =
  | 'memory-live'
  | 'artifact-runtime-live'
  | 'runtime-executor-live'
  | 'governed-workspace-live'
  | 'bridge-live'
  | 'blocked';

export type MemoryArtifactsRuntimeLiveAdapterFamily =
  | 'file-backed-memory-ledger'
  | 'artifact-index-replay-ledger'
  | 'runtime-executor-profile'
  | 'workflow-orchestration-ledger'
  | 'plugin-workshop-runtime'
  | 'bridge-protocol-ledger';

export type MemoryArtifactsRuntimeLiveGateKind =
  | 'memory-remember'
  | 'memory-recall'
  | 'memory-cite'
  | 'memory-forget'
  | 'wiki-persistence'
  | 'wiki-search'
  | 'vector-backend-decision'
  | 'artifact-body-index'
  | 'artifact-replay'
  | 'thread-ownership-enforcement'
  | 'codex-runtime-profile'
  | 'openshell-sandbox-profile'
  | 'local-runtime-exec'
  | 'task-orchestration'
  | 'workspace-command-plugin'
  | 'acp-bridge-proof'
  | 'approval-gate'
  | 'artifact-receipt'
  | 'configured-doctor'
  | 'mock-smoke'
  | 'staging-live-smoke'
  | 'redacted-receipt';

export type MemoryArtifactsRuntimeLiveGateStatus =
  | 'passed'
  | 'partial'
  | 'missing'
  | 'blocked';

export type MemoryArtifactsRuntimeLiveConfigSchema = {
  requiredEnv: string[];
  optionalEnv: string[];
  secretEnv: string[];
  artifactEnv: string[];
  secretValuesSerialized: false;
};

export type MemoryArtifactsRuntimeLiveGate = {
  kind: MemoryArtifactsRuntimeLiveGateKind;
  status: MemoryArtifactsRuntimeLiveGateStatus;
  evidence: string;
  command: string | null;
};

export type MemoryArtifactsRuntimeLiveReceipt = {
  id: string;
  targetId: MemoryArtifactsRuntimeLiveTargetId;
  status: MemoryArtifactsRuntimeLiveStatus;
  readinessStatus: Extract<LiveReadinessStatus, 'partial-live' | 'configured-only' | 'blocked'>;
  capabilities: MemoryArtifactsRuntimeLiveCapability[];
  adapterFamily: MemoryArtifactsRuntimeLiveAdapterFamily;
  modes: MemoryArtifactsRuntimeLiveMode[];
  liveIoPerformed: false;
  stagingLiveRequiresExplicitCommand: true;
  artifactFirst: true;
  unsafeActionsRequireApproval: true;
  secretValuesSerialized: false;
};

export type MemoryArtifactsRuntimeLiveEntry = {
  targetId: MemoryArtifactsRuntimeLiveTargetId;
  status: MemoryArtifactsRuntimeLiveStatus;
  readinessStatus: Extract<LiveReadinessStatus, 'partial-live' | 'configured-only' | 'blocked'>;
  capabilities: MemoryArtifactsRuntimeLiveCapability[];
  adapterFamily: MemoryArtifactsRuntimeLiveAdapterFamily;
  modes: MemoryArtifactsRuntimeLiveMode[];
  adapterTarget: string;
  serviceTargets: string[];
  configSchema: MemoryArtifactsRuntimeLiveConfigSchema;
  gates: MemoryArtifactsRuntimeLiveGate[];
  gaps: string[];
  doctorCommand: string;
  stagingLiveSmokeCommand: string;
  receipt: MemoryArtifactsRuntimeLiveReceipt;
};

export type MemoryArtifactsRuntimeLiveClosureSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_MEMORY_ARTIFACTS_RUNTIME_LIVE_CLOSURE_CONTRACT_VERSION;
  phase: 'Intent model2 - Memory, Artifacts And Runtime Executor Live Closure';
  status: 'closed' | 'attention' | 'blocked';
  summary: {
    targets: 11;
    memoryTargets: number;
    artifactTargets: number;
    runtimeTargets: number;
    workflowTargets: number;
    pluginTargets: number;
    bridgeTargets: number;
    rememberRecallForgetTargets: number;
    artifactIndexReplayTargets: number;
    threadOwnershipTargets: number;
    approvalGateTargets: number;
    stagingLiveSmokeCommands: number;
    redactedReceipts: number;
    blocked: number;
    memoryMarkedLiveWithoutWrite: false;
    artifactsMarkedLiveWithoutReplay: false;
    runtimeMarkedLiveWithoutExecutionProfile: false;
    unsafeRuntimeBypassesApproval: false;
    liveIoRequiredBySandboxAdapterCheck: false;
    secretValuesSerialized: false;
  };
  entries: MemoryArtifactsRuntimeLiveEntry[];
  receipts: MemoryArtifactsRuntimeLiveReceipt[];
  policy: {
    noLiveIoDuringSandboxAdapterCheck: true;
    memoryWriteRecallForgetRequired: true;
    artifactIndexReplayRequired: true;
    threadOwnershipRequired: true;
    runtimeExecutionProfileRequired: true;
    unsafeRuntimeRequiresApproval: true;
    stagingLiveRequiresExplicitOperatorCommand: true;
    noSecretsSerialized: true;
  };
  commands: {
    check: 'npm run memory-artifacts-runtime-live-closure:check --silent';
    doctor: 'npm run memory-artifacts-runtime-live-closure -- --profile configured';
    stagingLiveSmoke: 'npm run memory-artifacts-runtime-live-closure -- --profile staging-live --target <target> --confirm-live-io';
    focusedTests: string[];
    typecheck: 'npm run runtime:check --silent';
    nextStage: 'Approval gate - Channel Live Activation Long Tail';
  };
};
