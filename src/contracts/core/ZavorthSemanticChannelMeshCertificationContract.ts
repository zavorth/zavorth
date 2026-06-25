import type {
  ChannelPackStatus,
  ChannelRuntimeAction,
  ChannelRuntimeFamily,
  ChannelRuntimeId,
  SourceChannelMeshExpansionSnapshot,
  SourceChannelMeshPackageName,
} from './SourceChannelMeshExpansionContract.js';

export const ZAVORTH_SEMANTIC_CHANNEL_MESH_CERTIFICATION_CONTRACT_VERSION = '2026-05-05.semantic-s4' as const;

export type ZavorthSemanticChannelMeshCertificationStatus =
  | 'passed'
  | 'failed';

export type ZavorthSemanticChannelMeshClaimKind =
  | 'package-coverage'
  | 'pack-runtime'
  | 'secret-policy'
  | 'allowlist-policy'
  | 'simulator-action'
  | 'webhook-policy'
  | 'patch-risk-policy'
  | 'live-io-policy'
  | 'receipt-policy'
  | 'unsafe-channel-policy';

export type ZavorthSemanticChannelMeshClaimStatus =
  | 'covered'
  | 'replaced'
  | 'owner-gated'
  | 'rejected'
  | 'gap';

export type ZavorthSemanticChannelMeshClaimPriority =
  | 'P0'
  | 'P1'
  | 'P2';

export type ZavorthSemanticChannelMeshClaim = {
  id: string;
  kind: ZavorthSemanticChannelMeshClaimKind;
  status: ZavorthSemanticChannelMeshClaimStatus;
  priority: ZavorthSemanticChannelMeshClaimPriority;
  packageName?: SourceChannelMeshPackageName;
  channelId?: ChannelRuntimeId;
  family?: ChannelRuntimeFamily;
  runtimeStatus?: ChannelPackStatus;
  action?: ChannelRuntimeAction;
  expectedBehavior: string;
  zavorthEquivalent: string;
  evidence: string[];
  receiptIds: string[];
  notes: string[];
};

export type ZavorthSemanticChannelSecretScenario = {
  id: 'missing-required-secret' | 'configured-secret-redacted' | 'missing-allowlist';
  status: 'passed' | 'failed';
  channelId: ChannelRuntimeId;
  evidence: string[];
  secretValuesSerialized: false;
};

export type ZavorthSemanticChannelMeshCertificationSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_SEMANTIC_CHANNEL_MESH_CERTIFICATION_CONTRACT_VERSION;
  status: ZavorthSemanticChannelMeshCertificationStatus;
  semanticPhase: 'S4';
  statement: 'Channel Mesh semantics are certified as optional channel packs, SecretRef and allowlist policy, offline action receipts and explicit live-smoke controls.';
  sourceRoot: string;
  zavorthRoot: string;
  channelMeshStatus: SourceChannelMeshExpansionSnapshot['status'];
  channelMeshContractVersion: SourceChannelMeshExpansionSnapshot['contractVersion'];
  claims: ZavorthSemanticChannelMeshClaim[];
  secretScenarios: ZavorthSemanticChannelSecretScenario[];
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
    packagesCertified: number;
    packsCertified: number;
    secretPoliciesCertified: number;
    allowlistPoliciesCertified: number;
    simulatorActionsCertified: number;
    secretScenariosPassed: number;
    packStatuses: Record<string, ChannelPackStatus>;
    liveIoPerformed: false;
    enabledByDefault: false;
    secretValuesSerialized: false;
    sourceCodeCopied: false;
  };
  policy: {
    semanticClaimRequiredForEveryChannelPackage: true;
    optionalPacksOnly: true;
    secretRefOnlyChannelAuth: true;
    allowlistRequiredBeforeLiveSend: true;
    webhookAndInboundRequireReceipts: true;
    simulatorMustCoverCoreActions: true;
    whatsappBaileysRequiresPatchRiskOwnerDecision: true;
    noLiveIoDuringCertification: true;
    liveSmokeRequiresExplicitOperatorCommand: true;
    rawSecretValuesRejected: true;
    unallowlistedLiveSendRejected: true;
    noSourceSourceCopy: true;
    artifactFirstReceipts: true;
    gapsBlockRelease: true;
  };
  commands: {
    inspect: 'npm run semantic-channel-mesh-certification --silent';
    inspectJson: 'npm run semantic-channel-mesh-certification:json --silent';
    check: 'npm run semantic-channel-mesh-certification:check --silent';
    qa: 'npm run qa:semantic-channel-mesh-certification --silent';
    nextStage: 'S5 - Memory, Document, Search And Terminal Semantics';
  };
};
