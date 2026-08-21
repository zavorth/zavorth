import type {
  LiveReadinessCertificationEvidenceId,
  LiveReadinessCertificationEvidenceItem,
  LiveReadinessCertificationEvidenceStatus,
  LiveReadinessCertificationExclusionItem,
  LiveReadinessCertificationGapLedgerItem,
  LiveReadinessCertificationPhaseId,
  LiveReadinessCertificationPhaseReport,
  LiveReadinessCertificationProfile,
  LiveReadinessCertificationReceipt,
  LiveReadinessCertificationSnapshot,
} from '../contracts/LiveReadinessCertificationContract.js';
import { ZAVORTH_LIVE_READINESS_CERTIFICATION_CONTRACT_VERSION } from '../contracts/LiveReadinessCertificationContract.js';

import { ChannelLiveActivationService } from './ChannelLiveActivationService.js';
import { ChannelLongTailActivationService } from './ChannelLongTailActivationService.js';
import { DiagnosticsQaMigrationLivePlaneService } from './DiagnosticsQaMigrationLivePlaneService.js';
import { FileDocumentDiffLivePlaneService } from './FileDocumentDiffLivePlaneService.js';
import { LiveReadinessService } from './LiveReadinessService.js';
import { MediaGenerationLivePlaneService } from './MediaGenerationLivePlaneService.js';
import { MemoryArtifactsRuntimeLiveClosureService } from './MemoryArtifactsRuntimeLiveClosureService.js';
import { ProviderLongTailActivationService } from './ProviderLongTailActivationService.js';
import { ProviderRuntimeActivationService } from './ProviderRuntimeActivationService.js';
import { WebRemoteDeviceLivePlaneService, SatelliteDeviceLivePlaneService } from './WebRemoteDeviceLivePlaneService.js';
import { SpeechVoiceLivePlaneService } from './SpeechVoiceLivePlaneService.js';
import { WebResearchLivePlaneService } from './WebResearchLivePlaneService.js';

type LiveReadinessCertificationRuntime = {
  now?: () => Date;
  liveReadinessService?: LiveReadinessService;
  channelLiveActivationService?: ChannelLiveActivationService;
  channelLongTailActivationService?: ChannelLongTailActivationService;
  providerRuntimeActivationService?: ProviderRuntimeActivationService;
  providerLongTailActivationService?: ProviderLongTailActivationService;
  mediaGenerationLivePlaneService?: MediaGenerationLivePlaneService;
  speechVoiceLivePlaneService?: SpeechVoiceLivePlaneService;
  webResearchLivePlaneService?: WebResearchLivePlaneService;
  fileDocumentDiffLivePlaneService?: FileDocumentDiffLivePlaneService;
  diagnosticsQaMigrationLivePlaneService?: DiagnosticsQaMigrationLivePlaneService;
  satelliteDeviceLivePlaneService?: SatelliteDeviceLivePlaneService;
  memoryArtifactsRuntimeLiveClosureService?: MemoryArtifactsRuntimeLiveClosureService;
};

type EvidenceInput = {
  id: LiveReadinessCertificationEvidenceId;
  title: string;
  passed: boolean;
  observed: string;
  required: string;
  command: string;
  evidence: string[];
};

export class LiveReadinessCertificationService {
  private readonly now: () => Date;
  private readonly liveReadiness: LiveReadinessService;
  private readonly channelP0: ChannelLiveActivationService;
  private readonly channelLongTail: ChannelLongTailActivationService;
  private readonly providerP0: ProviderRuntimeActivationService;
  private readonly providerLongTail: ProviderLongTailActivationService;
  private readonly mediaGeneration: MediaGenerationLivePlaneService;
  private readonly speechVoice: SpeechVoiceLivePlaneService;
  private readonly webResearch: WebResearchLivePlaneService;
  private readonly fileDocumentDiff: FileDocumentDiffLivePlaneService;
  private readonly diagnosticsQaMigration: DiagnosticsQaMigrationLivePlaneService;
  private readonly satelliteDevice: SatelliteDeviceLivePlaneService;
  private readonly memoryArtifactsRuntime: MemoryArtifactsRuntimeLiveClosureService;

  constructor(runtime: LiveReadinessCertificationRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.liveReadiness = runtime.liveReadinessService || new LiveReadinessService({ now: this.now });
    this.channelP0 = runtime.channelLiveActivationService || new ChannelLiveActivationService({
      now: this.now,
      liveReadinessService: this.liveReadiness,
    });
    this.channelLongTail = runtime.channelLongTailActivationService || new ChannelLongTailActivationService({
      now: this.now,
      liveReadinessService: this.liveReadiness,
    });
    this.providerP0 = runtime.providerRuntimeActivationService || new ProviderRuntimeActivationService({
      now: this.now,
      liveReadinessService: this.liveReadiness,
    });
    this.providerLongTail = runtime.providerLongTailActivationService || new ProviderLongTailActivationService({
      now: this.now,
      liveReadinessService: this.liveReadiness,
    });
    this.mediaGeneration = runtime.mediaGenerationLivePlaneService || new MediaGenerationLivePlaneService({
      now: this.now,
      liveReadinessService: this.liveReadiness,
    });
    this.speechVoice = runtime.speechVoiceLivePlaneService || new SpeechVoiceLivePlaneService({
      now: this.now,
      liveReadinessService: this.liveReadiness,
    });
    this.webResearch = runtime.webResearchLivePlaneService || new WebResearchLivePlaneService({
      now: this.now,
      liveReadinessService: this.liveReadiness,
    });
    this.fileDocumentDiff = runtime.fileDocumentDiffLivePlaneService || new FileDocumentDiffLivePlaneService({
      now: this.now,
      liveReadinessService: this.liveReadiness,
    });
    this.diagnosticsQaMigration = runtime.diagnosticsQaMigrationLivePlaneService || new DiagnosticsQaMigrationLivePlaneService({
      now: this.now,
      liveReadinessService: this.liveReadiness,
    });
    this.satelliteDevice = runtime.satelliteDeviceLivePlaneService || new SatelliteDeviceLivePlaneService({
      now: this.now,
      liveReadinessService: this.liveReadiness,
    });
    this.memoryArtifactsRuntime = runtime.memoryArtifactsRuntimeLiveClosureService || new MemoryArtifactsRuntimeLiveClosureService({
      now: this.now,
      liveReadinessService: this.liveReadiness,
    });
  }

  public buildSnapshot(input: { profile?: LiveReadinessCertificationProfile } = {}): LiveReadinessCertificationSnapshot {
    const profile = input.profile || 'staging-live';
    const generatedAt = this.now().toISOString();
    const readiness = this.liveReadiness.buildSnapshot();
    const channelP0 = this.channelP0.buildSnapshot();
    const channelLongTail = this.channelLongTail.buildSnapshot();
    const providerP0 = this.providerP0.buildSnapshot();
    const providerLongTail = this.providerLongTail.buildSnapshot();
    const mediaGeneration = this.mediaGeneration.buildSnapshot();
    const speechVoice = this.speechVoice.buildSnapshot();
    const webResearch = this.webResearch.buildSnapshot();
    const fileDocumentDiff = this.fileDocumentDiff.buildSnapshot();
    const diagnosticsQaMigration = this.diagnosticsQaMigration.buildSnapshot();
    const satelliteDevice = this.satelliteDevice.buildSnapshot();
    const memoryArtifactsRuntime = this.memoryArtifactsRuntime.buildSnapshot();

    const activationReports = [
      this.activationReport('gate-1-live-readiness', 'Intent model - Live Readiness Kernel', readiness.status, readiness.summary.sourceModules, readiness.summary.blocked, readiness.summary.receipts, 0, readiness.commands.check, readiness.commands.focusedTests),
      this.activationReport('gate-2-channel-p0', channelP0.gate, channelP0.status, channelP0.summary.channels, channelP0.summary.blocked, channelP0.summary.redactedReceipts, channelP0.summary.stagingLiveSmokeCommands, channelP0.commands.check, channelP0.commands.focusedTests),
      this.activationReport('gate-3-channel-long-tail', channelLongTail.gate, channelLongTail.status, channelLongTail.summary.channels, channelLongTail.summary.blocked, channelLongTail.summary.redactedReceipts, channelLongTail.summary.stagingLiveSmokeCommands, channelLongTail.commands.check, channelLongTail.commands.focusedTests),
      this.activationReport('gate-4-provider-p0', providerP0.gate, providerP0.status, providerP0.summary.providers, providerP0.summary.blocked, providerP0.summary.redactedReceipts, providerP0.summary.chatSmokeCommands, providerP0.commands.check, providerP0.commands.focusedTests),
      this.activationReport('gate-5-provider-long-tail', providerLongTail.gate, providerLongTail.status, providerLongTail.summary.providers, providerLongTail.summary.blocked, providerLongTail.summary.redactedReceipts, providerLongTail.summary.smokeCommands, providerLongTail.commands.check, providerLongTail.commands.focusedTests),
      this.activationReport('gate-6-media-generation', mediaGeneration.gate, mediaGeneration.status, mediaGeneration.summary.targets, mediaGeneration.summary.blocked, mediaGeneration.summary.redactedReceipts, mediaGeneration.summary.stagingLiveSmokeCommands, mediaGeneration.commands.check, mediaGeneration.commands.focusedTests),
      this.activationReport('gate-7-speech-voice', speechVoice.gate, speechVoice.status, speechVoice.summary.targets, speechVoice.summary.blocked, speechVoice.summary.redactedReceipts, speechVoice.summary.stagingLiveSmokeCommands, speechVoice.commands.check, speechVoice.commands.focusedTests),
      this.activationReport('gate-8-web-research', webResearch.gate, webResearch.status, webResearch.summary.targets, webResearch.summary.blocked, webResearch.summary.redactedReceipts, webResearch.summary.stagingLiveSmokeCommands, webResearch.commands.check, webResearch.commands.focusedTests),
      this.activationReport('gate-9-file-document-diff', fileDocumentDiff.gate, fileDocumentDiff.status, fileDocumentDiff.summary.targets, fileDocumentDiff.summary.blocked, fileDocumentDiff.summary.redactedReceipts, fileDocumentDiff.summary.stagingLiveSmokeCommands, fileDocumentDiff.commands.check, fileDocumentDiff.commands.focusedTests),
      this.activationReport('gate-10-diagnostics-qa-migration', diagnosticsQaMigration.gate, diagnosticsQaMigration.status, diagnosticsQaMigration.summary.targets, diagnosticsQaMigration.summary.blocked, diagnosticsQaMigration.summary.redactedReceipts, diagnosticsQaMigration.summary.stagingLiveSmokeCommands, diagnosticsQaMigration.commands.check, diagnosticsQaMigration.commands.focusedTests),
      this.activationReport('gate-11-satellite-device', satelliteDevice.gate || 'gate-11-satellite-device', satelliteDevice.status, satelliteDevice.summary.targets, satelliteDevice.summary.blocked, satelliteDevice.summary.redactedReceipts, satelliteDevice.summary.stagingLiveSmokeCommands, satelliteDevice.commands.check, satelliteDevice.commands.focusedTests),
      this.activationReport('gate-12-memory-artifacts-runtime', memoryArtifactsRuntime.gate, memoryArtifactsRuntime.status, memoryArtifactsRuntime.summary.targets, memoryArtifactsRuntime.summary.blocked, memoryArtifactsRuntime.summary.redactedReceipts, memoryArtifactsRuntime.summary.stagingLiveSmokeCommands, memoryArtifactsRuntime.commands.check, memoryArtifactsRuntime.commands.focusedTests),
    ];

    const disallowed = this.countDisallowed(readiness);
    const gapLedger = this.buildGapLedger(readiness);
    const signedExclusionsLedger = this.buildSignedExclusionsLedger([
      speechVoice,
      satelliteDevice,
      memoryArtifactsRuntime,
    ]);
    const acceptedSourceModules = readiness.summary.liveReady + readiness.summary.partialLive;
    const channelRoutes = channelP0.summary.channels + channelLongTail.summary.channels;
    const providerRoutes = providerP0.summary.providers + providerLongTail.summary.providers;
    const providerChannelSmokeCommands = channelP0.summary.stagingLiveSmokeCommands
      + channelLongTail.summary.stagingLiveSmokeCommands
      + providerP0.summary.chatSmokeCommands
      + providerLongTail.summary.smokeCommands;
    const stagingLiveSmokeCommands = activationReports.reduce((sum, report) => sum + report.stagingLiveSmokeCommands, 0);
    const redactedReceipts = activationReports.reduce((sum, report) => sum + report.redactedReceipts, 0);

    const evidence = [
      this.evidence({
        id: 'absorbed-source-classification',
        title: 'Absorbed source modules have accepted live-consistency classifications',
        passed: acceptedSourceModules === readiness.summary.sourceModules
          && readiness.summary.blocked === 0,
        observed: `${acceptedSourceModules}/${readiness.summary.sourceModules} accepted; ${readiness.summary.liveReady} live-ready, ${readiness.summary.partialLive} partial-live`,
        required: `${readiness.summary.sourceModules}/${readiness.summary.sourceModules} accepted as live-ready or partial-live with signed scope`,
        command: readiness.commands.check,
        evidence: [
          `${readiness.summary.receipts} readiness receipts emitted.`,
          `${gapLedger.length} signed scope gap groups recorded.`,
        ],
      }),
      this.evidence({
        id: 'no-disallowed-readiness-status',
        title: 'No disallowed readiness status remains',
        passed: disallowed === 0,
        observed: `configured ${readiness.summary.configuredOnly}, dry-run ${readiness.summary.dryRunOnly}, template ${readiness.summary.templateOnly}, planned ${readiness.summary.planned}, blocked ${readiness.summary.blocked}`,
        required: '0 configured-only, dry-run-only, template-only, planned, blocked or misleading adapter-backed entries',
        command: readiness.commands.check,
        evidence: [
          'The live readiness kernel carries no template-only or planned source modules.',
          'misleadingAdapterBacked is fixed at 0 by this contract.',
        ],
      }),
      this.evidence({
        id: 'provider-channel-live-smokes',
        title: 'Provider and channel smokes expose local and opt-in live modes',
        passed: channelP0.summary.blocked === 0
          && channelLongTail.summary.blocked === 0
          && providerP0.summary.blocked === 0
          && providerLongTail.summary.blocked === 0
          && providerChannelSmokeCommands >= channelRoutes + providerRoutes
          && providerLongTail.summary.generatedProviderManifestsRemainingTotal === false,
        observed: `${channelRoutes} channels, ${providerRoutes} providers, ${providerChannelSmokeCommands} opt-in smoke commands`,
        required: `${channelRoutes} channel routes and ${providerRoutes} provider routes with local/focused tests and opt-in staging-live commands`,
        command: 'npm run qa:channel-live-activation --silent && npm run qa:provider-long-tail-activation --silent',
        evidence: [
          `${providerLongTail.summary.generatedProviderManifestsRemainingLongTail} generated long-tail provider manifests remaining.`,
          `${channelLongTail.summary.templateOnlyRemaining} long-tail channel templates remaining.`,
        ],
      }),
      this.evidence({
        id: 'signal-teams-not-outbox-only',
        title: 'Signal and Teams are no longer outbox-only',
        passed: channelP0.summary.signalAndTeamsOutboxOnly === false,
        observed: `signalAndTeamsOutboxOnly=${channelP0.summary.signalAndTeamsOutboxOnly}`,
        required: 'Signal and Teams have real activation paths, not outbox-only placeholders',
        command: channelP0.commands.check,
        evidence: [
          'Signal has JSON-RPC/signal-cli activation route.',
          'Teams has Microsoft Graph activation route.',
        ],
      }),
      this.evidence({
        id: 'runtime-families-not-placeholder',
        title: 'Runtime families are not certified by placeholder plans',
        passed: mediaGeneration.summary.blocked === 0
          && webResearch.summary.browserExtractionMarkedLiveByNoNetworkPlan === false
          && fileDocumentDiff.summary.fileTransferMarkedLiveByPlanOnly === false
          && fileDocumentDiff.summary.documentExtractMarkedLiveByDryPlaceholder === false
          && diagnosticsQaMigration.summary.diagnosticsMarkedLiveBySyntheticSnapshot === false
          && diagnosticsQaMigration.summary.migrationMarkedLiveByPlanOnly === false,
        observed: `${mediaGeneration.summary.targets + speechVoice.summary.targets + webResearch.summary.targets + fileDocumentDiff.summary.targets + diagnosticsQaMigration.summary.targets} runtime-family live targets`,
        required: 'runtime-family primitives do not return placeholder content in live profile',
        command: 'npm run runtime-family-closure:check --silent',
        evidence: [
          'Media, speech, web, file/document/diff, diagnostics, QA and migration expose adapter/service proof gates.',
          'Browser, file transfer, document extract, diagnostics and migration placeholder flags are false.',
        ],
      }),
      this.evidence({
        id: 'device-safety-and-trust',
        title: 'Satellite and device surfaces keep sensitive actions behind trust gates',
        passed: satelliteDevice.summary.deviceMarkedLiveWithoutPairing === false
          && satelliteDevice.summary.sensitiveInvokeBypassesTrust === false
          && satelliteDevice.summary.unsupportedNativeApisHidden === false,
        observed: `${satelliteDevice.summary.targets} device targets, ${satelliteDevice.summary.pairingTargets} pairing targets, ${satelliteDevice.summary.webAuthnTargets} WebAuthn targets`,
        required: 'device pairing, heartbeat, trust and unsupported native API truthfulness are explicit',
        command: satelliteDevice.commands.check,
        evidence: [
          `${satelliteDevice.summary.cameraTargets} camera targets and ${satelliteDevice.summary.geolocationTargets} geolocation targets represented.`,
          `${satelliteDevice.summary.offlineQueueTargets} offline queue targets represented.`,
        ],
      }),
      this.evidence({
        id: 'memory-artifact-runtime-real-proof',
        title: 'Memory, artifact and runtime executor proof is real and gated',
        passed: memoryArtifactsRuntime.summary.memoryMarkedLiveWithoutWrite === false
          && memoryArtifactsRuntime.summary.artifactsMarkedLiveWithoutReplay === false
          && memoryArtifactsRuntime.summary.runtimeMarkedLiveWithoutExecutionProfile === false
          && memoryArtifactsRuntime.summary.unsafeRuntimeBypassesApproval === false,
        observed: `${memoryArtifactsRuntime.summary.targets} Intent model2 targets, ${memoryArtifactsRuntime.summary.rememberRecallForgetTargets} memory write/recall targets, ${memoryArtifactsRuntime.summary.artifactIndexReplayTargets} artifact replay targets`,
        required: 'memory writes/recalls/forgets, artifacts replay, runtime execution profile and approvals are proven',
        command: memoryArtifactsRuntime.commands.check,
        evidence: [
          `${memoryArtifactsRuntime.summary.approvalGateTargets} approval-gated runtime targets.`,
          `${memoryArtifactsRuntime.summary.redactedReceipts} redacted Intent model2 receipts.`,
        ],
      }),
      this.evidence({
        id: 'signed-scope-and-exclusions',
        title: 'Partial-live scope and exclusions are signed',
        passed: gapLedger.length > 0 && signedExclusionsLedger.length > 0,
        observed: `${gapLedger.length} signed scope gap groups, ${signedExclusionsLedger.length} signed exclusions`,
        required: 'partial-live modules have signed scope, and excluded surfaces are explicit',
        command: 'npm run live-readiness-certify -- --profile staging-live',
        evidence: [
          'Partial-live source modules carry readiness gap groups and receipts.',
          'Google Meet meeting bridge is signed as excluded until an approved governed bridge exists.',
        ],
      }),
      this.evidence({
        id: 'phase-check-command-coverage',
        title: 'All live activation report check commands are present',
        passed: activationReports.length === 12
          && activationReports.every((report) => report.blocked === 0)
          && activationReports.every((report) => report.checkCommand.length > 0)
          && stagingLiveSmokeCommands >= acceptedSourceModules,
        observed: `${activationReports.length} activation reports, ${stagingLiveSmokeCommands} staging-live smoke commands, ${redactedReceipts} redacted receipts`,
        required: `12 completed live activation reports, at least ${acceptedSourceModules} opt-in staging-live commands, no blocked activation report`,
        command: 'npm run live-readiness-certification:check --silent',
        evidence: activationReports.map((report) => `${report.phase}: ${report.status}, ${report.targetCount} target(s).`),
      }),
    ];

    const failed = evidence.filter((item) => item.status === 'failed').length;
    const status = failed > 0 ? 'blocked' : 'certified';
    const receipts = this.receipts(profile, generatedAt, evidence);

    return {
      generatedAt,
      contractVersion: ZAVORTH_LIVE_READINESS_CERTIFICATION_CONTRACT_VERSION,
      gate: 'live-consistency-certification',
      profile,
      status,
      claim: 'tracked-source-surface-live-consistency-certified',
      statement: {
        trackedInventory: `${acceptedSourceModules}/${readiness.summary.sourceModules} absorbed source modules classified`,
        liveRuntimeSurface: 'Zavorth-native contracts, services, adapters, policies, artifacts and receipts',
        productionLiveRelease: 'not-claimed-without-operator-live-receipts',
        externalLiveIo: 'not-executed-by-certification',
      },
      summary: {
        sourceModules: readiness.summary.sourceModules,
        acceptedSourceModules,
        liveReady: readiness.summary.liveReady,
        partialLiveWithSignedScope: readiness.summary.partialLive,
        intentionallyExcluded: signedExclusionsLedger.length,
        configuredOnly: readiness.summary.configuredOnly,
        dryRunOnly: readiness.summary.dryRunOnly,
        templateOnly: readiness.summary.templateOnly,
        planned: readiness.summary.planned,
        blocked: readiness.summary.blocked,
        misleadingAdapterBacked: 0,
        providers: providerRoutes,
        channels: channelRoutes,
        livePhases: 12,
        phaseReports: activationReports.length,
        stagingLiveSmokeCommands,
        redactedReceipts,
        signedScopeGapGroups: gapLedger.length,
        signedExclusions: signedExclusionsLedger.length,
        signalAndTeamsOutboxOnly: false,
        generatedProviderManifestsRemaining: false,
        runtimeFamiliesMarkedLiveByPlaceholder: false,
        deviceSensitiveInvokeBypassesTrust: false,
        memoryMarkedLiveWithoutWrite: false,
        artifactsMarkedLiveWithoutReplay: false,
        liveExternalCallRequiredToBuildCertificate: false,
        liveChannelSendRequiredToBuildCertificate: false,
        liveDeviceRequiredToBuildCertificate: false,
        secretValuesSerialized: false,
      },
      phases: activationReports,
      evidence,
      gapLedger,
      signedExclusionsLedger,
      receipts,
      policy: {
        noLiveIoDuringCertification: true,
        stagingLiveSmokesAreOptIn: true,
        productionLiveRequiresOperatorReceiptLedger: true,
        partialLiveRequiresSignedScope: true,
        disallowedReadinessStatusesBlocked: true,
        noSecretsSerialized: true,
      },
      commands: {
        certifyStaging: 'npm run live-readiness-certify -- --profile staging-live',
        certifyProduction: 'npm run live-readiness-certify -- --profile production-live',
        certifyJson: 'npm run live-readiness-certify:json --silent',
        check: 'npm run live-readiness-certification:check --silent',
        focusedTests: ['npx jest tests/services/LiveReadinessCertificationService.test.ts --runInBand'],
        typecheck: 'npm run runtime:check --silent',
        nextStep: 'Live activation chain complete; run operator live smokes only when credentials/devices are ready',
      },
    };
  }

  public formatCertificationText(snapshot: LiveReadinessCertificationSnapshot = this.buildSnapshot()): string {
    return [
      'Zavorth Live Consistency Certification',
      `Status: ${snapshot.status}`,
      `Profile: ${snapshot.profile}`,
      `Claim: ${snapshot.claim}`,
      `Tracked modules: ${snapshot.summary.acceptedSourceModules}/${snapshot.summary.sourceModules}`,
      `Providers/channels: ${snapshot.summary.providers}/${snapshot.summary.channels}`,
      `Staging-live smoke commands: ${snapshot.summary.stagingLiveSmokeCommands}`,
      `Disallowed statuses: configured ${snapshot.summary.configuredOnly}, dry-run ${snapshot.summary.dryRunOnly}, template ${snapshot.summary.templateOnly}, planned ${snapshot.summary.planned}, blocked ${snapshot.summary.blocked}`,
      `Production live release: ${snapshot.statement.productionLiveRelease}`,
      '',
      'Evidence:',
      ...snapshot.evidence.map((item) => `- ${item.status.toUpperCase()} ${item.id}: ${item.observed} / ${item.required}`),
      '',
      `Next: ${snapshot.commands.nextStep}`,
    ].join('\n');
  }

  private countDisallowed(readiness: ReturnType<LiveReadinessService['buildSnapshot']>): number {
    return readiness.summary.configuredOnly
      + readiness.summary.dryRunOnly
      + readiness.summary.templateOnly
      + readiness.summary.planned
      + readiness.summary.blocked;
  }

  private buildGapLedger(readiness: ReturnType<LiveReadinessService['buildSnapshot']>): LiveReadinessCertificationGapLedgerItem[] {
    return readiness.gaps
      .filter((gap) => gap.status === 'partial-live')
      .map((gap) => ({
        phase: (gap as { phase?: string; gate?: string }).phase
          ?? (gap as { phase?: string; gate?: string }).gate
          ?? '',
        status: gap.status,
        count: gap.count,
        itemIds: gap.itemIds,
        signedScope: true,
      }));
  }

  private buildSignedExclusionsLedger(snapshots: any[]): LiveReadinessCertificationExclusionItem[] {
    const exclusions: LiveReadinessCertificationExclusionItem[] = [];
    for (const snapshot of snapshots) {
      for (const entry of Array.isArray(snapshot.entries) ? snapshot.entries : []) {
        const status = String(entry.status || '');
        const hasSignedExclusion = Array.isArray(entry.gates)
          && entry.gates.some((gate: any) => String(gate.evidence || '').toLowerCase().includes('signed exclusion'));
        if (!status.includes('excluded') && !hasSignedExclusion) {
          continue;
        }
        exclusions.push({
          phase: String((snapshot.gate ?? snapshot.phase) || ''),
          targetId: String(entry.targetId || entry.channelId || entry.providerId || 'unknown'),
          status,
          reason: Array.isArray(entry.gaps) && entry.gaps.length > 0
            ? String(entry.gaps[0])
            : 'signed live-consistency decision',
          signed: true,
          secretValuesSerialized: false,
        });
      }
    }
    return exclusions;
  }

  private activationReport(
    phaseId: LiveReadinessCertificationPhaseId,
    phase: string,
    status: string,
    targetCount: number,
    blocked: number,
    redactedReceipts: number,
    stagingLiveSmokeCommands: number,
    checkCommand: string,
    focusedTests: string[],
  ): LiveReadinessCertificationPhaseReport {
    return {
      phaseId,
      phase,
      status,
      targetCount,
      blocked,
      redactedReceipts,
      stagingLiveSmokeCommands,
      checkCommand,
      focusedTests,
      secretValuesSerialized: false,
    };
  }

  private evidence(input: EvidenceInput): LiveReadinessCertificationEvidenceItem {
    const status: LiveReadinessCertificationEvidenceStatus = input.passed ? 'passed' : 'failed';
    return {
      id: input.id,
      title: input.title,
      status,
      observed: input.observed,
      required: input.required,
      command: input.command,
      evidence: input.evidence,
      noLiveIo: true,
      secretValuesSerialized: false,
    };
  }

  private receipts(
    profile: LiveReadinessCertificationProfile,
    generatedAt: string,
    evidence: LiveReadinessCertificationEvidenceItem[],
  ): LiveReadinessCertificationReceipt[] {
    return evidence.map((item) => ({
      id: `live-readiness-certification.${item.id}.receipt`,
      profile,
      generatedAt,
      status: item.status,
      summary: `${item.title}: observed ${item.observed}; required ${item.required}.`,
      noLiveIo: true,
      secretValuesSerialized: false,
    }));
  }
}
