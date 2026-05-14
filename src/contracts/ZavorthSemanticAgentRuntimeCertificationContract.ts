import type {
  SourceAgentRuntimeBridgePackSnapshot,
  SourceAgentRuntimeBridgeStatus,
  SourceAgentRuntimeDirectness,
  SourceAgentRuntimePackageName,
  SourceAgentRuntimeToolPolicyDoctorSnapshot,
  SourceAgentRuntimeUsageKind,
} from './SourceAgentRuntimeBridgeContract.js';

export const ZAVORTH_SEMANTIC_AGENT_RUNTIME_CERTIFICATION_CONTRACT_VERSION = '2026-05-05.semantic-s2' as const;

export type ZavorthSemanticAgentRuntimeCertificationStatus =
  | 'passed'
  | 'failed';

export type ZavorthSemanticAgentRuntimeClaimKind =
  | 'package-usage'
  | 'runtime-adapter'
  | 'tool-policy'
  | 'permission-guard'
  | 'cwd-sandbox'
  | 'bridge-policy'
  | 'provider-route'
  | 'receipt-policy'
  | 'local-model-policy'
  | 'live-execution-policy';

export type ZavorthSemanticAgentRuntimeClaimStatus =
  | 'covered'
  | 'replaced'
  | 'owner-gated'
  | 'rejected'
  | 'gap';

export type ZavorthSemanticAgentRuntimeClaimPriority =
  | 'P0'
  | 'P1'
  | 'P2';

export type ZavorthSemanticAgentRuntimeClaim = {
  id: string;
  kind: ZavorthSemanticAgentRuntimeClaimKind;
  status: ZavorthSemanticAgentRuntimeClaimStatus;
  priority: ZavorthSemanticAgentRuntimeClaimPriority;
  packageName?: SourceAgentRuntimePackageName;
  bridgeId?: string;
  directness?: SourceAgentRuntimeDirectness;
  usageKind?: SourceAgentRuntimeUsageKind;
  expectedBehavior: string;
  zavorthEquivalent: string;
  evidence: string[];
  receiptIds: string[];
  notes: string[];
};

export type ZavorthSemanticAgentRuntimePolicyScenario = {
  id: 'disabled-tools' | 'read-only-tools' | 'configured-without-write-approval' | 'configured-single-write-approval';
  status: 'passed' | 'failed';
  doctor: SourceAgentRuntimeToolPolicyDoctorSnapshot;
};

export type ZavorthSemanticAgentRuntimeCertificationSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_SEMANTIC_AGENT_RUNTIME_CERTIFICATION_CONTRACT_VERSION;
  status: ZavorthSemanticAgentRuntimeCertificationStatus;
  semanticPhase: 'S2';
  statement: 'Agent runtime semantics are certified as optional Zavorth-native provider and bridge behavior with policy, cwd control and artifact-first receipts.';
  sourceRoot: string;
  zavorthRoot: string;
  bridgeStatus: SourceAgentRuntimeBridgePackSnapshot['status'];
  bridgeContractVersion: SourceAgentRuntimeBridgePackSnapshot['contractVersion'];
  claims: ZavorthSemanticAgentRuntimeClaim[];
  toolPolicyScenarios: ZavorthSemanticAgentRuntimePolicyScenario[];
  summary: {
    semanticClaims: number;
    covered: number;
    replaced: number;
    ownerGated: number;
    rejected: number;
    gaps: number;
    p0Claims: number;
    p1Claims: number;
    p2Claims: number;
    receiptBackedClaims: number;
    packagesClassified: number;
    bridgesCertified: number;
    bridgeStatuses: Record<string, SourceAgentRuntimeBridgeStatus>;
    toolPolicyScenariosPassed: number;
    liveExecutionPerformed: false;
    enabledByDefault: false;
    bypassPermissionsAllowed: false;
    sourceCodeCopied: false;
    secretValuesSerialized: false;
  };
  configRoutes: {
    apiKey: 'ANTHROPIC_API_KEY';
    bedrock: 'ZAVORTH_CLAUDE_AGENT_SDK_ROUTE=bedrock';
    vertex: 'ZAVORTH_CLAUDE_AGENT_SDK_ROUTE=vertex';
    foundry: 'ZAVORTH_CLAUDE_AGENT_SDK_ROUTE=foundry';
    localModelRecommendation: 'Provider Mesh via Ollama, LM Studio, vLLM or OpenAI-compatible local providers';
  };
  policy: {
    semanticClaimRequiredForEveryAgentRuntimePackage: true;
    claudeAgentSdkOptionalProviderOnly: true;
    toolPolicyRequiredBeforeLiveTools: true;
    writesAndShellRequireExplicitApproval: true;
    canUseToolMustDenyOutsidePolicy: true;
    acpAndCliBridgesOwnerGated: true;
    sandboxCwdControlled: true;
    noExternalAgentRuntimeExecutionDuringCertification: true;
    noAnthropicApiImpersonation: true;
    noProviderBypass: true;
    noImportPathShim: true;
    artifactFirstReceipts: true;
    gapsBlockRelease: true;
  };
  commands: {
    inspect: 'npm run semantic-agent-runtime-certification --silent';
    inspectJson: 'npm run semantic-agent-runtime-certification:json --silent';
    check: 'npm run semantic-agent-runtime-certification:check --silent';
    qa: 'npm run qa:semantic-agent-runtime-certification --silent';
    nextPhase: 'S3 - Provider Mesh Semantics';
  };
};
