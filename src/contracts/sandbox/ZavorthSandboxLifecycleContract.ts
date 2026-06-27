import type { ZavorthCapabilityRunEnvelope } from '../ZavorthMutationPlaneContract.js';

export const ZAVORTH_SANDBOX_LIFECYCLE_CONTRACT_VERSION =
  '2026-05-14.sandbox-lifecycle-natural-control' as const;

export type ZavorthSandboxLifecycleRuntimeId =
  | 'auto'
  | 'docker'
  | 'gvisor'
  | 'firecracker';

export type ZavorthSandboxLifecycleIntent =
  | 'inspect'
  | 'list'
  | 'start'
  | 'use'
  | 'cleanup'
  | 'stop'
  | 'deny';

export type ZavorthSandboxLifecycleStatus =
  | 'ready'
  | 'planned'
  | 'approval-required'
  | 'blocked';

export type ZavorthSandboxLifecycleActionKind =
  | 'notice'
  | 'doctor'
  | 'list_runtime_resources'
  | 'start_runtime'
  | 'execute_in_sandbox'
  | 'cleanup_owned_resources'
  | 'stop_user_runtime'
  | 'ask_approval'
  | 'deny';

export type ZavorthSandboxLifecycleAction = {
  id: string;
  kind: ZavorthSandboxLifecycleActionKind;
  runtime: ZavorthSandboxLifecycleRuntimeId;
  label: string;
  description: string;
  command: string | null;
  requiresApproval: boolean;
  canRunNow: boolean;
  userVisible: boolean;
};

export type ZavorthSandboxLifecycleReceipt = {
  id: string;
  kind: 'route' | 'policy' | 'ownership' | 'cleanup' | 'blocked';
  status: 'done' | 'approval-required' | 'blocked';
  reason: string;
  rawSecretSerialized: false;
};

export type ZavorthSandboxLifecycleResource = {
  id: string;
  runtime: ZavorthSandboxLifecycleRuntimeId;
  kind: 'container' | 'microvm' | 'process' | 'daemon' | 'unknown';
  label: string;
  status: 'running' | 'stopped' | 'unknown' | 'unavailable';
  ownedByZavorth: boolean;
  safeToStopAutomatically: boolean;
  source: 'docker-ps' | 'firecracker-temp' | 'ownership-ledger' | 'readiness' | 'request';
  detail: string;
};

export type ZavorthSandboxLifecyclePlan = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_SANDBOX_LIFECYCLE_CONTRACT_VERSION;
  source: 'ZavorthSandboxLifecycleManager';
  requestText: string;
  actorId: string | null;
  sourceSurface: string;
  status: ZavorthSandboxLifecycleStatus;
  intent: ZavorthSandboxLifecycleIntent;
  requestedRuntime: ZavorthSandboxLifecycleRuntimeId;
  selectedRuntime: ZavorthSandboxLifecycleRuntimeId;
  targetResourceId: string | null;
  confidence: number;
  liveRequested: boolean;
  approval: {
    required: boolean;
    reason: string | null;
    approvalId: string | null;
  };
  runtimeState: {
    canRunNow: boolean;
    status: string;
    detail: string;
    heavyRuntime: boolean;
    startsOnRead: false;
  };
  ownership: {
    onlyManageZavorthOwnedResources: true;
    neverStopUserOwnedDaemonByDefault: true;
    ownershipLedgerRequired: true;
    ownedResourceIds: string[];
    explicitUserOwnedRuntimeRequest: boolean;
    explicitResourceTarget: boolean;
    canStopAfterUse: boolean;
  };
  inventory: {
    readOnly: true;
    resources: ZavorthSandboxLifecycleResource[];
    canListWithoutStartingRuntime: true;
    nextQuestionHint: string;
  };
  notices: {
    beforeUse: string;
    afterUse: string;
    blocked: string | null;
  };
  safety: {
    policyBrokerRequired: true;
    noHiddenDaemonStart: true;
    noUserOwnedDaemonShutdown: true;
    userOwnedDaemonShutdownRequiresExplicitRequestAndApproval: true;
    dryRunWhenStrongSandboxMissing: true;
    cleanupContainersOrVmsOnlyWhenZavorthOwned: true;
    networkDefault: ZavorthCapabilityRunEnvelope['networkPolicy'];
  };
  actions: ZavorthSandboxLifecycleAction[];
  receipts: ZavorthSandboxLifecycleReceipt[];
  commands: {
    natural: 'npm run zavorth:sandbox-lifecycle -- --text "<request>"';
    naturalJson: 'npm run zavorth:sandbox-lifecycle:json -- --text "<request>"';
    doctor: 'npm run sandbox:doctor';
    check: 'npm run zavorth:sandbox-lifecycle:check --silent';
  };
};
