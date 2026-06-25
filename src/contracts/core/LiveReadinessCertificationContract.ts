import type { LiveReadinessStatus } from './LiveReadinessContract.js';

export const ZAVORTH_LIVE_READINESS_CERTIFICATION_CONTRACT_VERSION = '2026-05-05.live-checkpoint-13' as const;

export type LiveReadinessCertificationProfile =
  | 'staging-live'
  | 'production-live';

export type LiveReadinessCertificationStatus =
  | 'certified'
  | 'attention'
  | 'blocked';

export type LiveReadinessCertificationEvidenceStatus =
  | 'passed'
  | 'failed';

export type LiveReadinessCertificationPhaseId =
  | 'checkpoint-1-live-readiness'
  | 'checkpoint-2-channel-p0'
  | 'checkpoint-3-channel-long-tail'
  | 'checkpoint-4-provider-p0'
  | 'checkpoint-5-provider-long-tail'
  | 'checkpoint-6-media-generation'
  | 'checkpoint-7-speech-voice'
  | 'checkpoint-8-web-research'
  | 'checkpoint-9-file-document-diff'
  | 'checkpoint-10-diagnostics-qa-migration'
  | 'checkpoint-11-satellite-device'
  | 'checkpoint-12-memory-artifacts-runtime';

export type LiveReadinessCertificationEvidenceId =
  | 'absorbed-source-classification'
  | 'no-disallowed-readiness-status'
  | 'provider-channel-live-smokes'
  | 'signal-teams-not-outbox-only'
  | 'runtime-families-not-placeholder'
  | 'device-safety-and-trust'
  | 'memory-artifact-runtime-real-proof'
  | 'signed-scope-and-exclusions'
  | 'phase-check-command-coverage';

export type LiveReadinessCertificationPhaseReport = {
  phaseId: LiveReadinessCertificationPhaseId;
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

export type LiveReadinessCertificationEvidenceItem = {
  id: LiveReadinessCertificationEvidenceId;
  title: string;
  status: LiveReadinessCertificationEvidenceStatus;
  observed: string;
  required: string;
  command: string;
  evidence: string[];
  noLiveIo: true;
  secretValuesSerialized: false;
};

export type LiveReadinessCertificationGapLedgerItem = {
  phase: string;
  status: LiveReadinessStatus;
  count: number;
  itemIds: string[];
  signedScope: true;
};

export type LiveReadinessCertificationExclusionItem = {
  phase: string;
  targetId: string;
  status: string;
  reason: string;
  signed: true;
  secretValuesSerialized: false;
};

export type LiveReadinessCertificationReceipt = {
  id: string;
  profile: LiveReadinessCertificationProfile;
  generatedAt: string;
  status: LiveReadinessCertificationEvidenceStatus;
  summary: string;
  noLiveIo: true;
  secretValuesSerialized: false;
};

export type LiveReadinessCertificationSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_LIVE_READINESS_CERTIFICATION_CONTRACT_VERSION;
  phase: 'Intent model3 - Live Consistency Certification';
  profile: LiveReadinessCertificationProfile;
  status: LiveReadinessCertificationStatus;
  claim: 'tracked-source-surface-live-consistency-certified';
  statement: {
    trackedInventory: string;
    liveRuntimeSurface: 'Zavorth-native contracts, services, adapters, policies, artifacts and receipts';
    productionLiveRelease: 'not-claimed-without-operator-live-receipts';
    externalLiveIo: 'not-executed-by-certification';
  };
  summary: {
    sourceModules: number;
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
    providers: number;
    channels: number;
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
  phases: LiveReadinessCertificationPhaseReport[];
  evidence: LiveReadinessCertificationEvidenceItem[];
  gapLedger: LiveReadinessCertificationGapLedgerItem[];
  signedExclusionsLedger: LiveReadinessCertificationExclusionItem[];
  receipts: LiveReadinessCertificationReceipt[];
  policy: {
    noLiveIoDuringCertification: true;
    stagingLiveSmokesAreOptIn: true;
    productionLiveRequiresOperatorReceiptLedger: true;
    partialLiveRequiresSignedScope: true;
    disallowedReadinessStatusesBlocked: true;
    noSecretsSerialized: true;
  };
  commands: {
    certifyStaging: 'npm run live-readiness-certify -- --profile staging-live';
    certifyProduction: 'npm run live-readiness-certify -- --profile production-live';
    certifyJson: 'npm run live-readiness-certify:json --silent';
    check: 'npm run live-readiness-certification:check --silent';
    focusedTests: string[];
    typecheck: 'npm run runtime:check --silent';
    nextStep: 'Live activation chain complete; run operator live smokes only when credentials/devices are ready';
  };
};
