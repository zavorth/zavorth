import type {
  ZavorthSkillCapabilityTag,
  ZavorthSkillEcosystemCheckStatus,
  ZavorthSkillEcosystemPackSnapshot,
  ZavorthSkillPackReceiptKind,
  ZavorthSkillPermissionProfileId,
} from './ZavorthSkillEcosystemPackContract.js';

export const ZAVORTH_SEMANTIC_SKILL_ECOSYSTEM_CERTIFICATION_CONTRACT_VERSION = '2026-05-05.semantic-s8' as const;

export type ZavorthSemanticSkillEcosystemCertificationStatus =
  | 'passed'
  | 'failed';

export type ZavorthSemanticSkillEcosystemClaimKind =
  | 'manifest-coverage'
  | 'capability-tag-coverage'
  | 'permission-profile-policy'
  | 'permission-evaluation-policy'
  | 'secretref-policy'
  | 'smoke-policy'
  | 'lifecycle-receipt-policy'
  | 'bridge-policy'
  | 'optionality-policy'
  | 'live-io-policy'
  | 'artifact-receipt-policy'
  | 'unsafe-skill-policy';

export type ZavorthSemanticSkillEcosystemClaimStatus =
  | 'covered'
  | 'owner-gated'
  | 'rejected'
  | 'gap';

export type ZavorthSemanticSkillEcosystemClaimPriority =
  | 'P0'
  | 'P1'
  | 'P2';

export type ZavorthSemanticSkillEcosystemClaim = {
  id: string;
  kind: ZavorthSemanticSkillEcosystemClaimKind;
  status: ZavorthSemanticSkillEcosystemClaimStatus;
  priority: ZavorthSemanticSkillEcosystemClaimPriority;
  manifestId?: string;
  capabilityTag?: ZavorthSkillCapabilityTag;
  profileId?: ZavorthSkillPermissionProfileId;
  receiptKind?: ZavorthSkillPackReceiptKind;
  sourceStatus?: ZavorthSkillEcosystemCheckStatus;
  expectedBehavior: string;
  zavorthEquivalent: string;
  evidence: string[];
  receiptIds: string[];
  notes: string[];
};

export type ZavorthSemanticSkillEcosystemScenario = {
  id:
    | 'inspect-before-enable'
    | 'live-connector-denied-without-secretref'
    | 'non-destructive-smoke-only'
    | 'receipt-lifecycle-secret-safe';
  status: 'passed' | 'failed';
  evidence: string[];
  receiptIds: string[];
  liveExternalIoPerformed: false;
  liveSecretsUsed: false;
  secretValuesSerialized: false;
  enabledByDefault: false;
};

export type ZavorthSemanticSkillEcosystemCertificationSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_SEMANTIC_SKILL_ECOSYSTEM_CERTIFICATION_CONTRACT_VERSION;
  status: ZavorthSemanticSkillEcosystemCertificationStatus;
  semanticPhase: 'S8';
  statement: 'Skill ecosystem semantics are certified as optional, manifest-driven, inspectable, permission-gated and receipt-first Zavorth capabilities.';
  packStatus: ZavorthSkillEcosystemPackSnapshot['status'];
  packContractVersion: ZavorthSkillEcosystemPackSnapshot['contractVersion'];
  runtime: ZavorthSkillEcosystemPackSnapshot['runtime'];
  claims: ZavorthSemanticSkillEcosystemClaim[];
  scenarios: ZavorthSemanticSkillEcosystemScenario[];
  summary: {
    semanticClaims: number;
    covered: number;
    ownerGated: number;
    rejected: number;
    gaps: number;
    p0Claims: number;
    p1Claims: number;
    p2Claims: number;
    receiptBackedClaims: number;
    manifestClaimsCertified: number;
    capabilityTagClaimsCertified: number;
    permissionProfileClaimsCertified: number;
    permissionEvaluationClaimsCertified: number;
    secretRefClaimsCertified: number;
    smokeClaimsCertified: number;
    lifecycleReceiptClaimsCertified: number;
    bridgeClaimsCertified: number;
    scenariosPassed: number;
    packManifests: number;
    packPermissionProfiles: number;
    packSmokeTests: number;
    packReceipts: number;
    safeDenials: number;
    connectorConcepts: number;
    workspaceCatalogInputs: number;
    enabledByDefault: false;
    liveSkillsRequireOwnerApproval: boolean;
    liveSkillsRequireSecretRef: boolean;
    nonDestructiveSmokeOnly: true;
    liveExternalIoPerformed: false;
    liveSecretsUsed: false;
    secretValuesSerialized: false;
    sourceCodeCopied: false;
  };
  policy: {
    semanticClaimRequiredForEveryManifest: true;
    semanticClaimRequiredForEveryPermissionProfile: true;
    semanticClaimRequiredForEverySmokeResult: true;
    semanticClaimRequiredForEveryLifecycleReceipt: true;
    optionalEcosystemCapacity: true;
    inspectBeforeEnablement: true;
    nonDestructiveSmokeOnly: true;
    liveSkillsRequireOwnerApproval: true;
    liveSkillsRequireSecretRef: true;
    denialsAreReceiptBacked: true;
    noSecretsInReceipts: true;
    noCoreBloat: true;
    mcpAcpBridgeOptional: true;
    noLiveIoDuringCertification: true;
    noSkillEnabledByDefault: true;
    defaultEnablementRejected: true;
    liveSecretUseRejected: true;
    destructiveSmokeRejected: true;
    gapsBlockRelease: true;
  };
  commands: {
    inspect: 'npm run semantic-skill-ecosystem-certification --silent';
    inspectJson: 'npm run semantic-skill-ecosystem-certification:json --silent';
    check: 'npm run semantic-skill-ecosystem-certification:check --silent';
    qa: 'npm run qa:semantic-skill-ecosystem-certification --silent';
    nextStage: 'S9 - Full Functional Closure Semantics';
  };
};
