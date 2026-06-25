export const ZAVORTH_QA_SECURITY_RELEASE_CERTIFICATION_CONTRACT_VERSION = '2026-05-05.checkpoint-7' as const;

export type ZavorthQaSecurityReleaseFamilyId =
  | 'qa-scenarios'
  | 'security'
  | 'release-acceptance'
  | 'workflow-semantics'
  | 'patch-risk'
  | 'functional-consistency';

export type ZavorthQaSecurityReleaseCheckStatus = 'pass' | 'warn' | 'fail';

export type ZavorthQaSecurityReleaseSnapshotStatus = 'passed' | 'failed';

export type ZavorthQaSecurityReleaseSeverity = 'blocking' | 'required' | 'advisory';

export type ZavorthQaSecurityReleaseEvidenceKind =
  | 'local-command'
  | 'local-file'
  | 'local-directory'
  | 'package-manifest'
  | 'workflow-semantic'
  | 'patch-ledger'
  | 'policy';

export type ZavorthQaSecurityReleaseReceipt = {
  id: string;
  familyId: ZavorthQaSecurityReleaseFamilyId;
  checkId: string;
  label: string;
  status: ZavorthQaSecurityReleaseCheckStatus;
  severity: ZavorthQaSecurityReleaseSeverity;
  evidenceKind: ZavorthQaSecurityReleaseEvidenceKind;
  target: string;
  observed: string;
  command: string | null;
  artifactFirst: true;
  localCheckPerformed: boolean;
  liveExternalIoPerformed: false;
  secretValuesSerialized: false;
  rawWorkflowYamlCopied: false;
  dependencyPatchAcceptedSilently: false;
  notes: string[];
};

export type ZavorthQaScenarioCheck = ZavorthQaSecurityReleaseReceipt & {
  familyId: 'qa-scenarios';
  scenarioId: string;
  scenarioKind: 'runtime' | 'provider' | 'channel' | 'device' | 'release' | 'security';
};

export type ZavorthSecurityCertificationReceipt = ZavorthQaSecurityReleaseReceipt & {
  familyId: 'security';
  controlId: string;
};

export type ZavorthReleaseAcceptanceReceipt = ZavorthQaSecurityReleaseReceipt & {
  familyId: 'release-acceptance';
  acceptanceId: string;
};

export type ZavorthWorkflowSemanticReceipt = ZavorthQaSecurityReleaseReceipt & {
  familyId: 'workflow-semantics';
  semanticId: string;
  copiedWorkflowYaml: false;
};

export type ZavorthPatchRiskReceipt = ZavorthQaSecurityReleaseReceipt & {
  familyId: 'patch-risk';
  patchId: string;
  decision: 'none-present' | 'tracked' | 'owner-decision-required' | 'rejected';
};

export type ZavorthCertificationFamilyResult = {
  familyId: ZavorthQaSecurityReleaseFamilyId;
  label: string;
  status: ZavorthQaSecurityReleaseCheckStatus;
  receipts: ZavorthQaSecurityReleaseReceipt[];
  requiredChecks: number;
  advisoryChecks: number;
  blockingFailures: number;
  warnings: number;
  notes: string[];
};

export type ZavorthQaScenarioImporterSnapshot = {
  status: ZavorthQaSecurityReleaseCheckStatus;
  scenariosImported: number;
  receipts: ZavorthQaScenarioCheck[];
  qaDirectoriesDiscovered: string[];
  liveExternalIoPerformed: false;
  secretValuesSerialized: false;
};

export type ZavorthSecurityCertificationSnapshot = {
  status: ZavorthQaSecurityReleaseCheckStatus;
  controlsChecked: number;
  receipts: ZavorthSecurityCertificationReceipt[];
  localOnly: true;
  secretValuesSerialized: false;
  liveExternalIoPerformed: false;
};

export type ZavorthReleaseAcceptanceSnapshot = {
  status: ZavorthQaSecurityReleaseCheckStatus;
  acceptanceChecks: number;
  receipts: ZavorthReleaseAcceptanceReceipt[];
  packageBinPresent: boolean;
  packageDistExported: boolean;
  liveExternalIoPerformed: false;
  secretValuesSerialized: false;
};

export type ZavorthWorkflowSemanticSnapshot = {
  status: ZavorthQaSecurityReleaseCheckStatus;
  workflowFilesObserved: number;
  semanticsChecked: number;
  receipts: ZavorthWorkflowSemanticReceipt[];
  rawWorkflowYamlCopied: false;
  liveExternalIoPerformed: false;
  secretValuesSerialized: false;
};

export type ZavorthPatchRiskLedgerSnapshot = {
  status: ZavorthQaSecurityReleaseCheckStatus;
  patchFilesObserved: number;
  receipts: ZavorthPatchRiskReceipt[];
  dependencyPatchesAcceptedSilently: false;
  liveExternalIoPerformed: false;
  secretValuesSerialized: false;
};

export type ZavorthFunctionalReleaseCertificationRunnerSnapshot = {
  status: ZavorthQaSecurityReleaseCheckStatus;
  families: ZavorthCertificationFamilyResult[];
  printableLines: string[];
  dependencyPatchesAcceptedSilently: false;
  rawWorkflowYamlCopied: false;
  liveExternalIoPerformed: false;
  secretValuesSerialized: false;
};

export type ZavorthQaSecurityReleaseCertificationSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_QA_SECURITY_RELEASE_CERTIFICATION_CONTRACT_VERSION;
  status: ZavorthQaSecurityReleaseSnapshotStatus;
  phase: 7;
  statement: 'Zavorth QA, security, release, workflow and patch-risk surfaces are certified through local artifact-first checks.';
  runtime: {
    platform: NodeJS.Platform;
    arch: string;
    nodeVersion: string;
    cwd: string;
  };
  qaScenarios: ZavorthQaScenarioImporterSnapshot;
  security: ZavorthSecurityCertificationSnapshot;
  releaseAcceptance: ZavorthReleaseAcceptanceSnapshot;
  workflowSemantics: ZavorthWorkflowSemanticSnapshot;
  patchRisk: ZavorthPatchRiskLedgerSnapshot;
  functionalConsistencyRunner: ZavorthFunctionalReleaseCertificationRunnerSnapshot;
  summary: {
    families: number;
    passFamilies: number;
    warnFamilies: number;
    failFamilies: number;
    receipts: number;
    scenariosImported: number;
    securityChecks: number;
    releaseChecks: number;
    workflowChecks: number;
    patchRisksTracked: number;
    dependencyPatchesAcceptedSilently: false;
    rawWorkflowYamlCopied: false;
    liveExternalIoPerformed: false;
    secretValuesSerialized: false;
  };
  policy: {
    localChecksOnly: true;
    noRawWorkflowYamlCopy: true;
    dependencyPatchesNeedReceipt: true;
    noLiveProviderCalls: true;
    noLiveChannelSends: true;
    noSecretValuesSerialized: true;
    artifactFirstReceipts: true;
    optionalCiCompatible: true;
  };
  commands: {
    inspect: 'npm run zavorth-qa-security-release-certification-pack --silent';
    inspectJson: 'npm run zavorth-qa-security-release-certification-pack:json --silent';
    check: 'npm run zavorth-qa-security-release-certification-pack:check --silent';
    qa: 'npm run qa:zavorth-qa-security-release-certification-pack --silent';
    nextStage: 'Dashboard controls - Skill Ecosystem Pack';
  };
};
