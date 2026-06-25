import type { CapabilityNormalizationSnapshot } from './CapabilityNormalizationContract.js';
import type { CodexRuntimeSnapshot } from './CodexRuntimeContract.js';
import type { ModuleSdkExportSnapshot } from './ModuleSdkExportContract.js';
import type { OpenShellRemoteSandboxSnapshot } from './RemoteSandboxContract.js';
import type { ReleaseCertificationSnapshot } from './ReleaseCertificationContract.js';
import type { ProviderChannelSmokeProofSnapshot } from './ProviderChannelSmokeProofContract.js';
import type { RuntimeFamilyClosureSnapshot } from './RuntimeFamilyClosureContract.js';

export const ZAVORTH_FINAL_ABSORPTION_CERTIFICATION_CONTRACT_VERSION = '2026-05-04.worker-7' as const;

export type FinalAbsorptionCertificationStatus =
  | 'certified'
  | 'blocked';

export type FinalAbsorptionCertificationClaim =
  | 'tracked-private-inventory-certified';

export type FinalAbsorptionEvidenceStatus =
  | 'passed'
  | 'failed';

export type FinalAbsorptionEvidenceId =
  | 'worker-1-normalization'
  | 'worker-2-codex-runtime'
  | 'worker-3-openshell-sandbox'
  | 'worker-4-module-sdk-export'
  | 'worker-5-provider-channel-smoke'
  | 'worker-6-runtime-family'
  | 'public-launch-certification';

export type FinalAbsorptionEvidenceItem = {
  id: FinalAbsorptionEvidenceId;
  title: string;
  status: FinalAbsorptionEvidenceStatus;
  command: string;
  observed: string;
  required: string;
  evidence: string[];
  receiptId: string;
  noLiveIo: true;
  secretValuesSerialized: false;
};

export type FinalAbsorptionCertificationReceipt = {
  id: string;
  evidenceId: FinalAbsorptionEvidenceId;
  generatedAt: string;
  status: FinalAbsorptionEvidenceStatus;
  summary: string;
  noLiveIo: true;
  secretValuesSerialized: false;
};

export type FinalAbsorptionCertificationSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_FINAL_ABSORPTION_CERTIFICATION_CONTRACT_VERSION;
  status: FinalAbsorptionCertificationStatus;
  claim: FinalAbsorptionCertificationClaim;
  statement: {
    privateCertification: 'Zavorth has absorbed the tracked private capability inventory into Zavorth-native contracts, services, policies, artifacts, receipts, and no-live-IO proof gates.';
    trackedInventory: '125 normalized source modules are covered by the Worker 1 through Worker 6 closure chain.';
    liveEndToEndConsistency: 'not-claimed-by-this-certificate';
    publicLaunch: 'certified-by-static-and-no-live-IO-profile';
  };
  summary: {
    evidenceItems: number;
    passed: number;
    failed: number;
    normalizedSourceModules: number;
    primitives: number;
    codexRuntimeFeatures: number;
    openshellSandboxFeatures: number;
    sdkSubpaths: number;
    providerRoutes: number;
    channelRoutes: number;
    runtimeFamilyPrimitives: number;
    runtimeFamilySourceModules: number;
    runtimeFamilyModeProofs: number;
    p0Gaps: number;
    p1Gaps: number;
    p2Gaps: number;
    totalReceipts: number;
    liveExternalCallRequired: false;
    liveChannelSendRequired: false;
    liveDeviceRequired: false;
    liveMemoryWriteRequired: false;
    filesystemReadRequired: false;
    filesystemWriteRequired: false;
    artifactBodyReadRequired: false;
    secretValuesSerialized: false;
  };
  evidence: FinalAbsorptionEvidenceItem[];
  receipts: FinalAbsorptionCertificationReceipt[];
  sourceSnapshots: {
    capabilityNormalization: Pick<CapabilityNormalizationSnapshot, 'contractVersion' | 'summary'>;
    codexRuntime: Pick<CodexRuntimeSnapshot, 'contractVersion' | 'status' | 'summary'>;
    openshellSandbox: Pick<OpenShellRemoteSandboxSnapshot, 'contractVersion' | 'status' | 'summary'>;
    moduleSdkExport: Pick<ModuleSdkExportSnapshot, 'contractVersion' | 'status' | 'summary'>;
    providerChannelSmoke: Pick<ProviderChannelSmokeProofSnapshot, 'contractVersion' | 'status' | 'summary'>;
    runtimeFamilyClosure: Pick<RuntimeFamilyClosureSnapshot, 'contractVersion' | 'status' | 'summary'>;
    releaseCertification: Pick<ReleaseCertificationSnapshot, 'contractVersion' | 'profile' | 'status' | 'summary'>;
  };
  policy: {
    finalCertificateOnly: true;
    noLiveProviderCalls: true;
    noLiveChannelSends: true;
    noLiveDeviceAccess: true;
    noLiveMemoryWrites: true;
    noFilesystemWrites: true;
    noArtifactBodyReads: true;
    noSecretValuesSerialized: true;
    liveEndToEndConsistencyRequiresSeparateOperatorRun: true;
  };
  commands: {
    certify: 'npm run final-absorption-certify --silent';
    certifyJson: 'npm run final-absorption-certify:json --silent';
    check: 'npm run final-absorption-certification:check --silent';
    focusedTests: string[];
    typecheck: 'npm run runtime:check --silent';
    terminalWorker: 'Worker 7 - final certification and documentation';
    nextStep: 'No next worker in this closure chain';
  };
};
