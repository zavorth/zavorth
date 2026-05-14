export const ZAVORTH_REMOTE_SANDBOX_CONTRACT_VERSION = '2026-05-04.worker-3' as const;

export type RemoteSandboxStatus =
  | 'closed'
  | 'attention';

export type RemoteSandboxMode =
  | 'artifact-first-mirror'
  | 'remote';

export type RemoteSandboxFeatureStatus =
  | 'native-runtime-proof'
  | 'missing';

export type RemoteSandboxFeatureId =
  | 'config-contract'
  | 'cli-adapter'
  | 'lifecycle-manager'
  | 'ssh-transport'
  | 'remote-execution'
  | 'filesystem-bridge'
  | 'artifact-first-mirror'
  | 'workspace-sync'
  | 'env-filter'
  | 'readiness-doctor'
  | 'security-behavior-tests';

export type RemoteSandboxArtifactKind =
  | 'sandbox.session'
  | 'sandbox.command'
  | 'sandbox.workspace-delta'
  | 'sandbox.sync-plan'
  | 'sandbox.readiness'
  | 'sandbox.apply-plan'
  | 'sandbox.remote.receipt';

export type OpenShellRemoteSandboxConfig = {
  mode: RemoteSandboxMode;
  command: string;
  gateway: string | null;
  gatewayEndpoint: string | null;
  source: string;
  policy: string | null;
  providers: string[];
  gpu: boolean;
  autoProviders: boolean;
  remoteWorkspaceDir: string;
  remoteAgentWorkspaceDir: string;
  timeoutMs: number;
};

export type OpenShellCliInvocation = {
  command: string;
  args: string[];
  timeoutMs: number;
  env: Record<string, string>;
  displayCommand: string;
  liveIoRequired: false;
  secretValuesSerialized: false;
};

export type OpenShellLifecycleAction =
  | 'get'
  | 'create'
  | 'delete';

export type OpenShellLifecyclePlan = {
  runtimeId: string;
  scopeKey: string;
  actions: Array<{
    action: OpenShellLifecycleAction;
    invocation: OpenShellCliInvocation;
    receipt: string;
  }>;
  deterministicRuntimeId: true;
  deleteIsExplicit: true;
};

export type OpenShellSshSessionPlan = {
  runtimeId: string;
  sshConfigInvocation: OpenShellCliInvocation;
  remoteCommand: string;
  pty: boolean;
  stdinMode: 'pipe-open' | 'closed';
  sanitizedEnvKeys: string[];
  blockedEnvKeys: string[];
  receipt: string;
  liveIoRequired: false;
  secretValuesSerialized: false;
};

export type OpenShellWorkspaceSyncPlan = {
  mode: RemoteSandboxMode;
  localRoot: string;
  remoteRoot: string;
  remoteAgentRoot: string;
  uploadBeforeExec: boolean;
  collectAfterExec: boolean;
  mirrorBackToHost: false;
  applyRequiresMutationApproval: true;
  excludedGlobs: string[];
  pathGuards: Array<
    | 'local-root-containment'
    | 'remote-managed-root-containment'
    | 'reject-symlink-parents'
    | 'reject-final-symlink'
    | 'reject-hardlink-alias'
    | 'artifact-first-output'
  >;
  outputArtifactKind: 'sandbox.workspace-delta';
  applyPlanArtifactKind: 'sandbox.apply-plan';
  receipt: string;
};

export type OpenShellRemoteCommandPlan = {
  runtimeId: string;
  command: string;
  workingDirectory: string;
  timeoutMs: number;
  pty: boolean;
  stdinMode: 'pipe-open' | 'closed';
  lifecycle: OpenShellLifecyclePlan;
  ssh: OpenShellSshSessionPlan;
  workspace: OpenShellWorkspaceSyncPlan;
  artifacts: RemoteSandboxArtifactKind[];
  receipt: string;
  liveIoRequired: false;
  filesystemWriteRequired: false;
  secretValuesSerialized: false;
};

export type OpenShellReadinessSnapshot = {
  status: 'ready' | 'needs-config' | 'blocked';
  checks: Array<{
    id: string;
    status: 'pass' | 'warn' | 'fail';
    observed: string;
    nextAction: string | null;
  }>;
  smoke: {
    command: string;
    liveIoRequired: false;
    secretValuesSerialized: false;
  };
  receipt: string;
};

export type RemoteSandboxFeature = {
  id: RemoteSandboxFeatureId;
  status: RemoteSandboxFeatureStatus;
  evidence: string[];
  artifactKinds: RemoteSandboxArtifactKind[];
  receiptKind: 'sandbox.remote.receipt';
};

export type OpenShellRemoteSandboxSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_REMOTE_SANDBOX_CONTRACT_VERSION;
  status: RemoteSandboxStatus;
  sourceModule: 'openshell';
  primitiveId: 'sandbox.remote';
  summary: {
    features: number;
    nativeRuntimeProofs: number;
    missing: number;
    lifecycleActions: number;
    readinessChecks: number;
    artifactKinds: number;
    liveExternalCallRequired: false;
    liveSshRequired: false;
    processSpawnRequired: false;
    filesystemWriteRequired: false;
    mirrorBackToHost: false;
    secretValuesSerialized: false;
  };
  config: OpenShellRemoteSandboxConfig;
  lifecycle: OpenShellLifecyclePlan;
  commandPlan: OpenShellRemoteCommandPlan;
  readiness: OpenShellReadinessSnapshot;
  features: RemoteSandboxFeature[];
  artifactKinds: RemoteSandboxArtifactKind[];
  receipts: string[];
  policy: {
    noSourceImports: true;
    noSourceManifestRuntimeDependency: true;
    noLiveIoInProof: true;
    noSecretsSerialized: true;
    artifactFirstMirror: true;
    mutationApprovalRequiredForHostApply: true;
    dockerBindsUnsupported: true;
    envDenylistRequired: true;
  };
  commands: {
    check: 'npm run openshell-sandbox-parity:check --silent';
    focusedTests: string[];
    typecheck: 'npm run runtime:check --silent';
    nextWorker: 'Worker 4 - SDK/export closure';
  };
};
