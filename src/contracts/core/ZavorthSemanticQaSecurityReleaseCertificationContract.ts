import type {
  ZavorthQaSecurityReleaseCertificationSnapshot,
  ZavorthQaSecurityReleaseCheckStatus,
  ZavorthQaSecurityReleaseEvidenceKind,
  ZavorthQaSecurityReleaseFamilyId,
  ZavorthQaSecurityReleaseReceipt,
  ZavorthQaSecurityReleaseSeverity,
} from '../ZavorthQaSecurityReleaseCertificationContract.js';

export const ZAVORTH_SEMANTIC_QA_SECURITY_RELEASE_CERTIFICATION_CONTRACT_VERSION = '2026-05-05.semantic-s7' as const;

export type ZavorthSemanticQaSecurityReleaseCertificationStatus =
  | 'passed'
  | 'failed';

export type ZavorthSemanticQaSecurityReleaseClaimKind =
  | 'family-coverage'
  | 'receipt-coverage'
  | 'qa-scenario-policy'
  | 'security-control-policy'
  | 'release-acceptance-policy'
  | 'workflow-semantic-policy'
  | 'patch-risk-policy'
  | 'functional-runner-policy'
  | 'local-only-policy'
  | 'artifact-receipt-policy'
  | 'unsafe-release-policy';

export type ZavorthSemanticQaSecurityReleaseClaimStatus =
  | 'covered'
  | 'owner-gated'
  | 'rejected'
  | 'gap';

export type ZavorthSemanticQaSecurityReleaseClaimPriority =
  | 'P0'
  | 'P1'
  | 'P2';

export type ZavorthSemanticQaSecurityReleaseClaim = {
  id: string;
  kind: ZavorthSemanticQaSecurityReleaseClaimKind;
  status: ZavorthSemanticQaSecurityReleaseClaimStatus;
  priority: ZavorthSemanticQaSecurityReleaseClaimPriority;
  familyId?: ZavorthQaSecurityReleaseFamilyId;
  checkId?: string;
  receiptStatus?: ZavorthQaSecurityReleaseCheckStatus;
  severity?: ZavorthQaSecurityReleaseSeverity;
  evidenceKind?: ZavorthQaSecurityReleaseEvidenceKind;
  expectedBehavior: string;
  zavorthEquivalent: string;
  evidence: string[];
  receiptIds: string[];
  notes: string[];
};

export type ZavorthSemanticQaSecurityReleaseScenario = {
  id:
    | 'blocking-failure-blocks-release'
    | 'tracked-patch-warning-is-owner-gated'
    | 'workflow-semantics-do-not-copy-yaml'
    | 'release-certification-stays-local-only';
  status: 'passed' | 'failed';
  evidence: string[];
  receiptIds: string[];
  liveExternalIoPerformed: false;
  secretValuesSerialized: false;
  rawWorkflowYamlCopied: false;
  dependencyPatchesAcceptedSilently: false;
};

export type ZavorthSemanticQaSecurityReleaseCertificationSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_SEMANTIC_QA_SECURITY_RELEASE_CERTIFICATION_CONTRACT_VERSION;
  status: ZavorthSemanticQaSecurityReleaseCertificationStatus;
  semanticPhase: 'S7';
  statement: 'QA, security, release, workflow and patch-risk semantics are certified as local-only artifact-first Zavorth release gates.';
  packStatus: ZavorthQaSecurityReleaseCertificationSnapshot['status'];
  packContractVersion: ZavorthQaSecurityReleaseCertificationSnapshot['contractVersion'];
  runtime: ZavorthQaSecurityReleaseCertificationSnapshot['runtime'];
  claims: ZavorthSemanticQaSecurityReleaseClaim[];
  scenarios: ZavorthSemanticQaSecurityReleaseScenario[];
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
    familyClaimsCertified: number;
    receiptClaimsCertified: number;
    qaScenarioClaimsCertified: number;
    securityControlClaimsCertified: number;
    releaseAcceptanceClaimsCertified: number;
    workflowSemanticClaimsCertified: number;
    patchRiskClaimsCertified: number;
    functionalRunnerClaimsCertified: number;
    scenariosPassed: number;
    packFamilies: number;
    packReceipts: number;
    passFamilies: number;
    warnFamilies: number;
    failFamilies: number;
    warningReceipts: number;
    blockingFailures: number;
    localChecksOnly: true;
    dependencyPatchesAcceptedSilently: false;
    rawWorkflowYamlCopied: false;
    liveExternalIoPerformed: false;
    secretValuesSerialized: false;
    sourceCodeCopied: false;
  };
  policy: {
    semanticClaimRequiredForEveryFamily: true;
    semanticClaimRequiredForEveryReceipt: true;
    localChecksOnly: true;
    noRawWorkflowYamlCopy: true;
    dependencyPatchesNeedReceipt: true;
    patchWarningsRemainOwnerGated: true;
    blockingFailuresBlockRelease: true;
    noLiveProviderCalls: true;
    noLiveChannelSends: true;
    noSecretValuesSerialized: true;
    artifactFirstReceipts: true;
    optionalCiCompatible: true;
    noSourceWorkflowCopy: true;
    rawWorkflowYamlRejected: true;
    silentPatchAcceptanceRejected: true;
    liveReleaseIoRejected: true;
    gapsBlockRelease: true;
  };
  commands: {
    inspect: 'npm run semantic-qa-security-release-certification --silent';
    inspectJson: 'npm run semantic-qa-security-release-certification:json --silent';
    check: 'npm run semantic-qa-security-release-certification:check --silent';
    qa: 'npm run qa:semantic-qa-security-release-certification --silent';
    nextAction: 'Skill ecosystem semantics';
  };
};

export type ZavorthSemanticQaSecurityReleaseReceiptLike = Pick<
  ZavorthQaSecurityReleaseReceipt,
  | 'id'
  | 'familyId'
  | 'checkId'
  | 'label'
  | 'status'
  | 'severity'
  | 'evidenceKind'
  | 'target'
  | 'observed'
  | 'command'
  | 'artifactFirst'
  | 'localCheckPerformed'
  | 'liveExternalIoPerformed'
  | 'secretValuesSerialized'
  | 'rawWorkflowYamlCopied'
  | 'dependencyPatchAcceptedSilently'
  | 'notes'
>;
