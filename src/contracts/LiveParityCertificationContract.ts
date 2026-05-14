import type { LiveReadinessStatus } from './LiveReadinessContract.js';

export const ZAVORTH_LIVE_PARITY_CERTIFICATION_CONTRACT_VERSION = '2026-05-05.live-phase-13' as const;

export type LiveParityCertificationProfile =
  | 'staging-live'
  | 'production-live';

export type LiveParityCertificationStatus =
  | 'certified'
  | 'attention'
  | 'blocked';

export type LiveParityCertificationEvidenceStatus =
  | 'passed'
  | 'failed';

export type LiveParityCertificationPhaseId =
  | 'phase-1-live-readiness'
  | 'phase-2-channel-p0'
  | 'phase-3-channel-long-tail'
  | 'phase-4-provider-p0'
  | 'phase-5-provider-long-tail'
  | 'phase-6-media-generation'
  | 'phase-7-speech-voice'
  | 'phase-8-web-research'
  | 'phase-9-file-document-diff'
  | 'phase-10-diagnostics-qa-migration'
  | 'phase-11-satellite-device'
  | 'phase-12-memory-artifacts-runtime';

export type LiveParityCertificationEvidenceId =
  | 'absorbed-source-classification'
  | 'no-disallowed-readiness-status'
  | 'provider-channel-live-smokes'
  | 'signal-teams-not-outbox-only'
  | 'runtime-families-not-placeholder'
  | 'device-safety-and-trust'
  | 'memory-artifact-runtime-real-proof'
  | 'signed-scope-and-exclusions'
  | 'phase-check-command-coverage';

export type LiveParityCertificationPhaseReport = {
  phaseId: LiveParityCertificationPhaseId;
  phase: string;
  status: string;
  targetCount: number;
  blocked: number;
  redactedReceipts: number;
  stagingLiveSmokeCommands: number;
  checkCommand: string;
  focusedTests: string[];
  secretValuesSerialized: false;
};

export type LiveParityCertificationEvidenceItem = {
  id: LiveParityCertificationEvidenceId;
  title: string;
  status: LiveParityCertificationEvidenceStatus;
  observed: string;
  required: string;
  command: string;
  evidence: string[];
  noLiveIo: true;
  secretValuesSerialized: false;
};

export type LiveParityCertificationGapLedgerItem = {
  phase: string;
  status: LiveReadinessStatus;
  count: number;
  itemIds: string[];
  signedScope: true;
};

export type LiveParityCertificationExclusionItem = {
  phase: string;
  targetId: string;
  status: string;
  reason: string;
  signed: true;
  secretValuesSerialized: false;
};

export type LiveParityCertificationReceipt = {
  id: string;
  profile: LiveParityCertificationProfile;
  generatedAt: string;
  status: LiveParityCertificationEvidenceStatus;
  summary: string;
  noLiveIo: true;
  secretValuesSerialized: false;
};

export type LiveParityCertificationSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_LIVE_PARITY_CERTIFICATION_CONTRACT_VERSION;
  phase: 'Phase 13 - Live Parity Certification';
  profile: LiveParityCertificationProfile;
  status: LiveParityCertificationStatus;
  claim: 'tracked-source-surface-live-parity-certified';
  statement: {
    trackedInventory: '125/125 absorbed source modules classified';
    liveRuntimeSurface: 'Zavorth-native contracts, services, adapters, policies, artifacts and receipts';
    productionLiveRelease: 'not-claimed-without-operator-live-receipts';
    externalLiveIo: 'not-executed-by-certification';
  };
  summary: {
    sourceModules: 125;
    acceptedSourceModules: number;
    liveReady: number;
    partialLiveWithSignedScope: number;
    intentionallyExcluded: number;
    configuredOnly: number;
    dryRunOnly: number;
    templateOnly: number;
    planned: number;
    blocked: number;
    misleadingAdapterBacked: 0;
    providers: 47;
    channels: 23;
    livePhases: 12;
    phaseReports: number;
    stagingLiveSmokeCommands: number;
    redactedReceipts: number;
    signedScopeGapGroups: number;
    signedExclusions: number;
    signalAndTeamsOutboxOnly: false;
    generatedProviderManifestsRemaining: false;
    runtimeFamiliesMarkedLiveByPlaceholder: false;
    deviceSensitiveInvokeBypassesTrust: false;
    memoryMarkedLiveWithoutWrite: false;
    artifactsMarkedLiveWithoutReplay: false;
    liveExternalCallRequiredToBuildCertificate: false;
    liveChannelSendRequiredToBuildCertificate: false;
    liveDeviceRequiredToBuildCertificate: false;
    secretValuesSerialized: false;
  };
  phases: LiveParityCertificationPhaseReport[];
  evidence: LiveParityCertificationEvidenceItem[];
  gapLedger: LiveParityCertificationGapLedgerItem[];
  signedExclusionsLedger: LiveParityCertificationExclusionItem[];
  receipts: LiveParityCertificationReceipt[];
  policy: {
    noLiveIoDuringCertification: true;
    stagingLiveSmokesAreOptIn: true;
    productionLiveRequiresOperatorReceiptLedger: true;
    partialLiveRequiresSignedScope: true;
    disallowedReadinessStatusesBlocked: true;
    noSecretsSerialized: true;
  };
  commands: {
    certifyStaging: 'npm run live-parity-certify -- --profile staging-live';
    certifyProduction: 'npm run live-parity-certify -- --profile production-live';
    certifyJson: 'npm run live-parity-certify:json --silent';
    check: 'npm run live-parity-certification:check --silent';
    focusedTests: string[];
    typecheck: 'npm run runtime:check --silent';
    nextStep: 'Live activation chain complete; run operator live smokes only when credentials/devices are ready';
  };
};
