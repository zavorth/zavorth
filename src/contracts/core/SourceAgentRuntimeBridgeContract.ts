export const ZAVORTH_SOURCE_AGENT_RUNTIME_BRIDGE_CONTRACT_VERSION = '2026-05-05.gate-2' as const;

export const SOURCE_AGENT_RUNTIME_PACKAGES = [
  '@anthropic-ai/sdk',
  '@anthropic-ai/vertex-sdk',
  '@anthropic-ai/claude-agent-sdk',
  '@agentclientprotocol/claude-agent-acp',
  '@anthropic-ai/claude-code',
  'acpx',
  '@zed-industries/codex-acp',
] as const;

export type SourceAgentRuntimePackageName = typeof SOURCE_AGENT_RUNTIME_PACKAGES[number];

export type SourceAgentRuntimeBridgeStatus =
  | 'ready'
  | 'disabled'
  | 'missing'
  | 'owner_decision_required'
  | 'blocked';

export type SourceAgentRuntimeBridgeSnapshotStatus =
  | 'passed'
  | 'failed';

export type SourceAgentRuntimeUsageKind =
  | 'direct-provider-sdk'
  | 'direct-vertex-sdk'
  | 'claude-agent-sdk-runtime'
  | 'transitive-acp-runtime'
  | 'claude-code-cli-backend'
  | 'acp-bridge'
  | 'lockfile-only'
  | 'unknown';

export type SourceAgentRuntimeDirectness =
  | 'direct'
  | 'indirect'
  | 'lockfile-only'
  | 'not-present';

export type SourceAgentRuntimeDecision =
  | 'implemented'
  | 'zavorth-native-provider'
  | 'optional-bridge-owner-gated'
  | 'provider-mesh-only'
  | 'rejected-by-default';

export type SourceAgentRuntimeToolPolicyMode =
  | 'disabled'
  | 'read-only'
  | 'configured';

export type SourceAgentRuntimeToolRisk =
  | 'safe'
  | 'attention'
  | 'danger'
  | 'unknown';

export type SourceAgentRuntimeToolDecision =
  | 'allow'
  | 'deny'
  | 'approval_required';

export type SourceAgentRuntimePackageEvidence = {
  packageName: SourceAgentRuntimePackageName;
  usageKind: SourceAgentRuntimeUsageKind;
  directness: SourceAgentRuntimeDirectness;
  inSourcePackageJson: boolean;
  inSourceLockfile: boolean;
  inSourceSource: boolean;
  inZavorthPackageJson: boolean;
  inZavorthLockfile: boolean;
  sourceReferenceFiles: string[];
  zavorthReferenceFiles: string[];
  notes: string[];
};

export type SourceAgentRuntimeBridgeReadiness = {
  bridgeId: 'claude-agent-sdk' | 'claude-code-cli' | 'acpx' | 'codex-acp' | 'anthropic-direct-sdk' | 'anthropic-vertex-sdk';
  status: SourceAgentRuntimeBridgeStatus;
  decision: SourceAgentRuntimeDecision;
  usageKind: SourceAgentRuntimeUsageKind;
  packages: SourceAgentRuntimePackageName[];
  enabledByDefault: false;
  enabledByEnv: boolean;
  liveExecutionPerformed: false;
  dryRunAvailable: boolean;
  requiresOwnerApproval: boolean;
  activationEnvVars: string[];
  cwdPolicy: {
    controlledCwdRequired: true;
    workspaceRootsRequired: boolean;
  };
  toolPolicy: {
    zavorthPolicyRequired: true;
    canUseToolRequired: boolean;
    approvalRequiredForWritesAndShell: true;
    bypassPermissionsAllowed: false;
  };
  artifactReceipts: {
    required: true;
    kinds: string[];
  };
  reason: string;
};

export type SourceAgentRuntimeToolPolicyDecisionReceipt = {
  toolName: string;
  aliases: string[];
  risk: SourceAgentRuntimeToolRisk;
  decision: SourceAgentRuntimeToolDecision;
  approvalRequired: boolean;
  approvalGranted: boolean;
  reason: string;
};

export type SourceAgentRuntimeToolPolicyDoctorSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_SOURCE_AGENT_RUNTIME_BRIDGE_CONTRACT_VERSION;
  status: SourceAgentRuntimeBridgeSnapshotStatus;
  mode: SourceAgentRuntimeToolPolicyMode;
  requestedTools: string[];
  approvedToolIds: string[];
  decisions: SourceAgentRuntimeToolPolicyDecisionReceipt[];
  summary: {
    allowed: number;
    denied: number;
    approvalRequired: number;
    dangerousToolsWithoutApproval: number;
    readOnlyToolsAllowed: number;
  };
  policy: {
    noFreeToolExecution: true;
    writesAndShellRequireApproval: boolean;
    deniedToolsRemainDeniedInCanUseTool: true;
    artifactFirstReceipts: true;
  };
};

export type SourceAgentRuntimeAdapterGuardSnapshot = {
  adapterPath: string;
  hasClaudeAgentSdkAdapter: boolean;
  hasCanUseToolGuard: boolean;
  hasCwdControl: boolean;
  hasPlanMode: boolean;
  hasDontAskModeOnlyAfterPolicy: boolean;
  forbidsBypassPermissions: boolean;
  noSecretSerializationClaim: true;
};

export type SourceAgentRuntimeBridgePackSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_SOURCE_AGENT_RUNTIME_BRIDGE_CONTRACT_VERSION;
  status: SourceAgentRuntimeBridgeSnapshotStatus;
  gate: 'source-agent-runtime-bridge';
  statement: 'Source agent runtimes are absorbed as optional Zavorth-native runtime bridges with policy, cwd control and artifact-first receipts.';
  sourceRoot: string;
  zavorthRoot: string;
  packageEvidence: SourceAgentRuntimePackageEvidence[];
  bridges: SourceAgentRuntimeBridgeReadiness[];
  adapterGuards: SourceAgentRuntimeAdapterGuardSnapshot;
  toolPolicyDoctor: SourceAgentRuntimeToolPolicyDoctorSnapshot;
  summary: {
    packagesTracked: number;
    packagesPresentInSource: number;
    packagesImplementedInZavorth: number;
    bridgesReady: number;
    bridgesOwnerGated: number;
    liveExecutionPerformed: false;
    enabledByDefault: false;
    unsafeDefaultToolExecution: false;
    bypassPermissionsAllowed: false;
  };
  configRoutes: {
    apiKey: 'ANTHROPIC_API_KEY';
    bedrock: 'ZAVORTH_CLAUDE_AGENT_SDK_ROUTE=bedrock';
    vertex: 'ZAVORTH_CLAUDE_AGENT_SDK_ROUTE=vertex';
    foundry: 'ZAVORTH_CLAUDE_AGENT_SDK_ROUTE=foundry';
    localModelRecommendation: 'Provider Mesh via Ollama, LM Studio, vLLM or OpenAI-compatible local providers';
  };
  policy: {
    noSourceSourceCopy: true;
    noAnthropicApiImpersonation: true;
    noProviderBypass: true;
    claudeAgentSdkNeverEnabledByDefault: true;
    claudeCodeCliNeverEnabledByDefault: true;
    acpxNeverEnabledByDefault: true;
    sandboxCwdControlled: true;
    artifactFirstReceipts: true;
  };
  commands: {
    inspect: 'npm run source-agent-runtime-bridge --silent';
    inspectJson: 'npm run source-agent-runtime-bridge:json --silent';
    check: 'npm run source-agent-runtime-bridge:check --silent';
    qa: 'npm run qa:source-agent-runtime-bridge --silent';
    nextAction: 'Approval gate - Provider Mesh Expansion Pack';
  };
};
