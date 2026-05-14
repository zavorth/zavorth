export const ZAVORTH_OWNER_GATED_LIVE_ACTIVATION_CONTRACT_VERSION = '2026-05-05.owner-gated-live-activation' as const;

export type ZavorthOwnerGatedLiveActivationStatus =
  | 'passed'
  | 'blocked';

export type ZavorthOwnerGatedLiveActivationGroupId =
  | 'agent.bridge.claude-code-cli'
  | 'agent.bridge.acpx'
  | 'agent.bridge.codex-acp'
  | 'provider.claude.vertex'
  | 'provider.claude.bedrock'
  | 'channel.whatsapp.baileys'
  | 'channel.matrix.crypto'
  | 'runtime.terminal.pty'
  | 'runtime.shell.tree-sitter'
  | 'native.wrapper.android'
  | 'native.wrapper.ios'
  | 'native.wrapper.macos'
  | 'native.local-tts.mlx'
  | 'skill.release-note-drafter'
  | 'skill.qa-scenario-author'
  | 'skill.web-research-reviewer'
  | 'skill.connector-calendar-brief'
  | 'skill.connector-email-draft'
  | 'skill.connector-issue-triage'
  | 'skill.catalog.chrome-devtools'
  | 'skill.catalog.codenavi'
  | 'bridge.mcp.skill-connectors'
  | 'bridge.acp.skill-connectors';

export type ZavorthOwnerGatedLiveActivationFamily =
  | 'agent-runtime-bridge'
  | 'provider-route'
  | 'channel-route'
  | 'runtime-enhancement'
  | 'native-device'
  | 'skill'
  | 'skill-bridge';

export type ZavorthOwnerGatedLiveActivationPhase =
  | 'S2'
  | 'S3'
  | 'S4'
  | 'S5'
  | 'S6'
  | 'S8';

export type ZavorthOwnerGatedLiveActivationMode =
  | 'controlled-route'
  | 'configured-live-io'
  | 'local-runtime';

export type ZavorthOwnerGatedLiveActivationRouteStatus =
  | 'activated'
  | 'approval-required'
  | 'blocked';

export type ZavorthOwnerGatedLiveIoStatus =
  | 'ready'
  | 'secretref-required'
  | 'config-required'
  | 'not-required';

export type ZavorthOwnerGatedLiveActivationPriority = 'P0' | 'P1' | 'P2';

export type ZavorthOwnerGatedLiveActivationCommand = {
  kind:
    | 'doctor'
    | 'dry-run'
    | 'configured'
    | 'staging-live'
    | 'policy-check';
  command: string;
  requiresLiveIoConfirmation: boolean;
  requiresOwnerApproval: boolean;
};

export type ZavorthOwnerGatedLiveActivationReceipt = {
  id: string;
  groupId: ZavorthOwnerGatedLiveActivationGroupId;
  status: ZavorthOwnerGatedLiveActivationRouteStatus;
  mode: ZavorthOwnerGatedLiveActivationMode;
  liveIoStatus: ZavorthOwnerGatedLiveIoStatus;
  ownerApprovalId: string | null;
  activationRequested: boolean;
  artifactFirst: true;
  liveExternalIoPerformed: false;
  secretValuesSerialized: false;
  enabledByDefault: false;
  reason: string;
};

export type ZavorthOwnerGatedLiveActivationEntry = {
  groupId: ZavorthOwnerGatedLiveActivationGroupId;
  label: string;
  family: ZavorthOwnerGatedLiveActivationFamily;
  sourcePhase: ZavorthOwnerGatedLiveActivationPhase;
  priority: ZavorthOwnerGatedLiveActivationPriority;
  status: ZavorthOwnerGatedLiveActivationRouteStatus;
  mode: ZavorthOwnerGatedLiveActivationMode;
  liveIoStatus: ZavorthOwnerGatedLiveIoStatus;
  profile: 'controlled-live' | 'local-runtime' | 'staging-live';
  requiredApproval: boolean;
  ownerApprovalId: string | null;
  requiredSecretRefs: string[];
  configuredSecretRefs: string[];
  missingSecretRefs: string[];
  requiredConfigRefs: string[];
  configuredConfigRefs: string[];
  missingConfigRefs: string[];
  runtimeTarget: string;
  policyTarget: string;
  commands: ZavorthOwnerGatedLiveActivationCommand[];
  receipt: ZavorthOwnerGatedLiveActivationReceipt;
  notes: string[];
};

export type ZavorthOwnerGatedLiveActivationSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_OWNER_GATED_LIVE_ACTIVATION_CONTRACT_VERSION;
  status: ZavorthOwnerGatedLiveActivationStatus;
  statement: 'Owner-gated live capabilities are activated as controlled Zavorth routes with receipts, approvals, SecretRefs and no default live I/O.';
  activationRequested: boolean;
  ownerApprovalId: string | null;
  entries: ZavorthOwnerGatedLiveActivationEntry[];
  receipts: ZavorthOwnerGatedLiveActivationReceipt[];
  summary: {
    groups: 23;
    activated: number;
    approvalRequired: number;
    blocked: number;
    families: number;
    agentRuntimeBridges: number;
    providerRoutes: number;
    channelRoutes: number;
    runtimeEnhancements: number;
    nativeDeviceTargets: number;
    skills: number;
    skillBridges: number;
    configuredLiveIoReady: number;
    secretRefRequired: number;
    configRequired: number;
    localOnlyOrNoLiveIoRequired: number;
    requiredSecretRefs: number;
    configuredSecretRefs: number;
    missingSecretRefs: number;
    requiredConfigRefs: number;
    configuredConfigRefs: number;
    missingConfigRefs: number;
    receipts: number;
    liveExternalIoPerformed: false;
    secretValuesSerialized: false;
    enabledByDefault: false;
  };
  policy: {
    activateAllOwnerGatedRoutesWhenApproved: true;
    activationDoesNotPerformLiveIo: true;
    liveIoRequiresSecretRefsAndExplicitStagingCommand: true;
    writesShellAndNativeAccessRequirePolicyReceipts: true;
    providerRoutesUseRealProviderMeshNotApiImpersonation: true;
    localModelsUseProviderMeshCompatibleRoutes: true;
    noBypassPermissions: true;
    noDefaultEnablement: true;
    noSecretsSerialized: true;
    receiptsRequiredForEveryActivatedGroup: true;
  };
  commands: {
    inspect: 'npm run owner-gated-live-activation --silent';
    inspectJson: 'npm run owner-gated-live-activation:json --silent';
    activate: 'npm run owner-gated-live-activation -- --activate --owner-approval-id <id>';
    check: 'npm run owner-gated-live-activation:check --silent';
    qa: 'npm run qa:owner-gated-live-activation --silent';
    nextStep: 'Owner-gated live activation routes are resolved';
  };
};
