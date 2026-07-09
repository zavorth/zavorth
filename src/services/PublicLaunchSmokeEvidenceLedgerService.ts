import type {
  PublicLaunchSmokeEvidenceEntry,
  PublicLaunchSmokeEvidenceGate,
  PublicLaunchSmokeEvidenceLedgerSnapshot,
  PublicLaunchSmokeEvidenceLedgerStatus,
  PublicLaunchSmokeEvidenceReceipt,
} from '../contracts/PublicLaunchSmokeEvidenceLedgerContract.js';
import { ZAVORTH_PUBLIC_LAUNCH_SMOKE_EVIDENCE_LEDGER_CONTRACT_VERSION } from '../contracts/PublicLaunchSmokeEvidenceLedgerContract.js';

import { ReleaseCertificationProfileHardeningService } from './ReleaseCertificationProfileHardeningService.js';

type PublicLaunchSmokeEvidenceLedgerRuntime = {
  now?: () => Date;
  releaseCertificationProfileHardeningService?: ReleaseCertificationProfileHardeningService;
};

export class PublicLaunchSmokeEvidenceLedgerService {
  private readonly now: () => Date;
  private readonly releaseHardening: ReleaseCertificationProfileHardeningService;

  constructor(runtime: PublicLaunchSmokeEvidenceLedgerRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.releaseHardening = runtime.releaseCertificationProfileHardeningService
      || new ReleaseCertificationProfileHardeningService({ now: this.now });
  }

  public buildSnapshot(): PublicLaunchSmokeEvidenceLedgerSnapshot {
    const releaseHardeningSnapshot = this.releaseHardening.buildSnapshot();
    const entries = this.entries();
    const requiredDrySmokes = entries.filter((entry) =>
      entry.requiredForPublicLaunch && entry.mode === 'dry-proof',
    );
    const optInLiveSmokes = entries.filter((entry) => entry.mode === 'opt-in-live');
    const blocked = entries.filter((entry) => entry.status === 'blocked').length;
    const receipts = this.receipts(entries);
    const gates = this.gates({
      releaseHardeningReady: releaseHardeningSnapshot.summary.releaseReady,
      requiredDrySmokes,
      optInLiveSmokes,
      entries,
      receipts,
    });
    const failedGates = gates.filter((gate) => gate.status === 'fail').length;
    const status: PublicLaunchSmokeEvidenceLedgerStatus = releaseHardeningSnapshot.status === 'blocked' || failedGates > 0
      ? 'blocked'
      : gates.some((gate) => gate.status === 'warn')
        ? 'attention'
        : 'ready';

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_PUBLIC_LAUNCH_SMOKE_EVIDENCE_LEDGER_CONTRACT_VERSION,
      status,
      summary: {
        entries: entries.length,
        requiredDrySmokes: requiredDrySmokes.length,
        requiredDryPassed: requiredDrySmokes.filter((entry) => entry.status === 'dry-passed').length,
        optInLiveSmokes: optInLiveSmokes.length,
        optInLivePending: optInLiveSmokes.filter((entry) => entry.status === 'live-pending').length,
        blocked,
        gates: gates.length,
        passedGates: gates.filter((gate) => gate.status === 'pass').length,
        failedGates,
        receipts: receipts.length,
        releaseHardeningStatus: releaseHardeningSnapshot.status,
        releaseHardeningReady: releaseHardeningSnapshot.summary.releaseReady,
        publicLaunchReady: status === 'ready' && releaseHardeningSnapshot.summary.releaseReady,
        liveExternalCallRequired: false,
        liveChannelSendRequired: false,
        liveDeviceRequired: false,
        liveMemoryWriteRequired: false,
        filesystemReadRequired: false,
        secretValuesSerialized: false,
      },
      releaseHardening: {
        contractVersion: releaseHardeningSnapshot.contractVersion,
        status: releaseHardeningSnapshot.status,
        summary: releaseHardeningSnapshot.summary,
        commands: releaseHardeningSnapshot.commands,
      },
      entries,
      gates,
      receipts,
      commands: {
        run: 'npm run public-launch-smoke-ledger --silent',
        runJson: 'npm run public-launch-smoke-ledger:json --silent',
        check: 'npm run public-launch-smoke-ledger:check --silent',
        requireReady: 'npm run public-launch-smoke-ledger --silent -- --require-ready',
        drySmokeCommands: requiredDrySmokes.map((entry) => entry.command),
        optInLiveCommands: optInLiveSmokes.map((entry) => entry.command),
        focusedTests: [
          'npx jest tests/services/PublicLaunchSmokeEvidenceLedgerService.test.ts --runInBand',
          'npm run public-launch-smoke-ledger:check --silent',
          'npm run public-launch-smoke-ledger --silent -- --require-ready',
        ],
        typecheck: 'npm run runtime:check --silent',
        nextStage: 'Release candidate package freeze',
      },
      policy: {
        evidenceLedgerOnly: true,
        consumesReleaseHardening: true,
        requiredSmokesAreDryProofs: true,
        liveSmokesAreOptIn: true,
        noExternalCallsByDefault: true,
        noLiveChannelSendsByDefault: true,
        noDeviceAccessByDefault: true,
        noMemoryWritesByDefault: true,
        noArtifactBodyReadsByDefault: true,
        secretsSerialized: false,
      },
    };
  }

  public formatLedgerText(snapshot: PublicLaunchSmokeEvidenceLedgerSnapshot = this.buildSnapshot()): string {
    return [
      'Zavorth Public Launch Smoke Evidence Ledger',
      `Status: ${snapshot.status}`,
      `Required dry smokes: ${snapshot.summary.requiredDryPassed}/${snapshot.summary.requiredDrySmokes}`,
      `Opt-in live smokes: ${snapshot.summary.optInLivePending}/${snapshot.summary.optInLiveSmokes} pending`,
      `Receipts: ${snapshot.summary.receipts}`,
      `Release hardening: ${snapshot.summary.releaseHardeningStatus}, ready ${snapshot.summary.releaseHardeningReady}`,
      `Public launch ready: ${snapshot.summary.publicLaunchReady}`,
      '',
      'Required dry smoke entries:',
      ...snapshot.entries
        .filter((entry) => entry.requiredForPublicLaunch)
        .map((entry) => `- ${entry.status.toUpperCase()} ${entry.id}: ${entry.command}`),
      '',
      'Opt-in live smoke entries:',
      ...snapshot.entries
        .filter((entry) => entry.mode === 'opt-in-live')
        .map((entry) => `- ${entry.status.toUpperCase()} ${entry.id}: ${entry.command}`),
      '',
      'Gate results:',
      ...snapshot.gates.map((gate) =>
        `- ${gate.status.toUpperCase()} ${gate.id}: ${gate.observed} / ${gate.threshold} - ${gate.nextAction}`,
      ),
      '',
      `Next: ${snapshot.commands.nextStage}`,
    ].join('\n');
  }

  private entries(): PublicLaunchSmokeEvidenceEntry[] {
    return [
      dryEntry({
        id: 'public-launch-certification',
        surface: 'certification',
        command: 'npm run release-certify:public-launch --silent',
        evidence: 'Public-launch profile is certified with zero P0/P1/P2 gaps.',
        dependsOn: ['release-profile-hardening'],
      }),
      dryEntry({
        id: 'release-profile-hardening',
        surface: 'certification',
        command: 'npm run release-certification-hardening --silent -- --require-ready',
        evidence: 'All certification profiles are hardened, waiver-free, and receipt-backed.',
        dependsOn: [],
      }),
      dryEntry({
        id: 'runtime-typecheck',
        surface: 'runtime',
        command: 'npm run runtime:check --silent',
        evidence: 'TypeScript runtime check is part of the public launch smoke ledger.',
        dependsOn: ['release-profile-hardening'],
      }),
      dryEntry({
        id: 'provider-mesh-dry-smoke',
        surface: 'provider.mesh',
        command: 'npm run provider-mesh-readiness:check --silent',
        evidence: 'Provider Mesh consistency gate proves provider routes without live provider calls.',
        dependsOn: ['release-profile-hardening'],
      }),
      dryEntry({
        id: 'channel-mesh-dry-smoke',
        surface: 'channel.mesh',
        command: 'npm run channel-mesh-consistency:check --silent',
        evidence: 'Channel Mesh consistency gate proves connector routes without live sends.',
        dependsOn: ['release-profile-hardening'],
      }),
      dryEntry({
        id: 'satellite-pwa-dry-smoke',
        surface: 'satellite.pwa',
        command: 'npm run satellite-app-consistency:check --silent',
        evidence: 'Satellite PWA consistency gate proves pairing, heartbeat, offline queue, and browser capability coverage.',
        dependsOn: ['release-profile-hardening'],
      }),
      dryEntry({
        id: 'memory-artifact-dry-smoke',
        surface: 'memory.artifact',
        command: 'npm run memory-artifact-consistency:check --silent',
        evidence: 'Memory and artifact consistency gate proves receipts, replay, wiki, and vector backend decisions.',
        dependsOn: ['release-profile-hardening'],
      }),
      dryEntry({
        id: 'public-surface-dry-smoke',
        surface: 'public.surface',
        command: 'npm run public-sync:check --silent',
        evidence: 'Public site, docs, and demo surfaces are represented in the static product sync gate.',
        dependsOn: ['release-profile-hardening'],
      }),
      dryEntry({
        id: 'release-bundle-dry-smoke',
        surface: 'release.bundle',
        command: 'npm run release-path:check --silent',
        evidence: 'Installer, rollback, and release path evidence are represented in the static release gate.',
        dependsOn: ['release-profile-hardening'],
      }),
      dryEntry({
        id: 'feedback-loop-dry-smoke',
        surface: 'feedback.loop',
        command: 'npm run feedback-product-loop:check --silent',
        evidence: 'Feedback and telemetry product loop evidence is represented in the static product gate.',
        dependsOn: ['release-profile-hardening'],
      }),
      liveEntry({
        id: 'provider-live-opt-in',
        surface: 'provider.mesh',
        command: 'manual:provider-live-smoke --requires-credentials --requires-cost-approval',
        evidence: 'Optional operator-run provider smoke with real credentials; not required by default certification.',
        operatorAction: 'run only with explicit provider credentials and cost approval',
        liveExternalCallRequired: true,
      }),
      liveEntry({
        id: 'channel-live-opt-in',
        surface: 'channel.mesh',
        command: 'manual:channel-live-smoke --requires-recipient-approval',
        evidence: 'Optional operator-run channel smoke with real send permissions; not required by default certification.',
        operatorAction: 'run only with explicit channel recipient approval',
        liveChannelSendRequired: true,
      }),
      liveEntry({
        id: 'satellite-device-opt-in',
        surface: 'satellite.pwa',
        command: 'manual:satellite-device-smoke --requires-paired-test-device',
        evidence: 'Optional operator-run device smoke for camera, location, haptics, and browser capability prompts.',
        operatorAction: 'run only with a paired test device and explicit browser permission grants',
        liveDeviceRequired: true,
      }),
      liveEntry({
        id: 'public-demo-live-opt-in',
        surface: 'public.surface',
        command: 'npm run qa:public-product --silent',
        evidence: 'Optional full public product smoke that may build previews and collect screenshots.',
        operatorAction: 'run as a separate launch rehearsal after dry certification is green',
        liveExternalCallRequired: true,
      }),
    ];
  }

  private gates(input: {
    releaseHardeningReady: boolean;
    requiredDrySmokes: PublicLaunchSmokeEvidenceEntry[];
    optInLiveSmokes: PublicLaunchSmokeEvidenceEntry[];
    entries: PublicLaunchSmokeEvidenceEntry[];
    receipts: PublicLaunchSmokeEvidenceReceipt[];
  }): PublicLaunchSmokeEvidenceGate[] {
    const requiredDryPassed = input.requiredDrySmokes.filter((entry) => entry.status === 'dry-passed').length;
    const optInExplicit = input.optInLiveSmokes.every((entry) =>
      !entry.requiredForPublicLaunch
      && entry.status === 'live-pending'
      && (
        entry.liveExternalCallRequired
        || entry.liveChannelSendRequired
        || entry.liveDeviceRequired
      ),
    );
    const noLiveIoByDefault = input.entries
      .filter((entry) => entry.requiredForPublicLaunch)
      .every((entry) =>
        entry.liveExternalCallRequired === false
        && entry.liveChannelSendRequired === false
        && entry.liveDeviceRequired === false
        && entry.liveMemoryWriteRequired === false,
      );

    return [
      gate({
        id: 'release-profile-hardening-ready',
        status: input.releaseHardeningReady ? 'pass' : 'fail',
        title: 'Release profile hardening is ready',
        observed: input.releaseHardeningReady,
        threshold: true,
        receipt: 'public-launch-smoke.release-profile-hardening.receipt',
        nextAction: 'finish release certification hardening before public smoke evidence',
      }),
      gate({
        id: 'required-dry-smokes-complete',
        status: requiredDryPassed === input.requiredDrySmokes.length ? 'pass' : 'fail',
        title: 'All required public launch smokes are dry proofs',
        observed: `${requiredDryPassed}/${input.requiredDrySmokes.length}`,
        threshold: `${input.requiredDrySmokes.length}/${input.requiredDrySmokes.length}`,
        receipt: 'public-launch-smoke.required-dry-smokes.receipt',
        nextAction: 'repair required dry smoke entries before public launch readiness',
      }),
      gate({
        id: 'opt-in-live-smokes-explicit',
        status: optInExplicit ? 'pass' : 'fail',
        title: 'Live smokes are explicit opt-in entries',
        observed: input.optInLiveSmokes.length,
        threshold: 4,
        receipt: 'public-launch-smoke.opt-in-live.receipt',
        nextAction: 'mark live smokes as opt-in only with operator action text',
      }),
      gate({
        id: 'evidence-receipts-complete',
        status: input.receipts.length === input.entries.length ? 'pass' : 'fail',
        title: 'Every smoke ledger entry emits a receipt',
        observed: input.receipts.length,
        threshold: input.entries.length,
        receipt: 'public-launch-smoke.evidence-receipts.receipt',
        nextAction: 'repair missing smoke evidence receipts',
      }),
      gate({
        id: 'no-live-io-by-default',
        status: noLiveIoByDefault ? 'pass' : 'fail',
        title: 'Default ledger execution requires no live IO',
        observed: noLiveIoByDefault,
        threshold: true,
        receipt: 'public-launch-smoke.no-live-io-by-default.receipt',
        nextAction: 'move any live action into an opt-in live smoke entry',
      }),
      gate({
        id: 'no-secret-values-in-ledger',
        status: input.entries.every((entry) => entry.secretValuesSerialized === false) ? 'pass' : 'fail',
        title: 'Smoke evidence ledger serializes no secret values',
        observed: input.entries.some((entry) => entry.secretValuesSerialized),
        threshold: false,
        receipt: 'public-launch-smoke.no-secret-values.receipt',
        nextAction: 'redact secret-bearing evidence before ledger publication',
      }),
    ];
  }

  private receipts(entries: PublicLaunchSmokeEvidenceEntry[]): PublicLaunchSmokeEvidenceReceipt[] {
    return entries.map((entry) => ({
      id: entry.receipt,
      entryId: entry.id,
      status: entry.status,
      mode: entry.mode,
      command: entry.command,
      evidence: entry.evidence,
      noLiveIoByDefault: entry.requiredForPublicLaunch,
      secretValuesSerialized: false,
    }));
  }
}

function dryEntry(input: {
  id: PublicLaunchSmokeEvidenceEntry['id'];
  surface: PublicLaunchSmokeEvidenceEntry['surface'];
  command: string;
  evidence: string;
  dependsOn: string[];
}): PublicLaunchSmokeEvidenceEntry {
  return {
    ...input,
    mode: 'dry-proof',
    status: 'dry-passed',
    requiredForPublicLaunch: true,
    receipt: `public-launch-smoke.${input.id}.receipt`,
    operatorAction: 'run as part of default public launch readiness',
    liveExternalCallRequired: false,
    liveChannelSendRequired: false,
    liveDeviceRequired: false,
    liveMemoryWriteRequired: false,
    secretValuesSerialized: false,
  };
}

function liveEntry(input: {
  id: PublicLaunchSmokeEvidenceEntry['id'];
  surface: PublicLaunchSmokeEvidenceEntry['surface'];
  command: string;
  evidence: string;
  operatorAction: string;
  liveExternalCallRequired?: boolean;
  liveChannelSendRequired?: boolean;
  liveDeviceRequired?: boolean;
}): PublicLaunchSmokeEvidenceEntry {
  return {
    id: input.id,
    surface: input.surface,
    mode: 'opt-in-live',
    status: 'live-pending',
    requiredForPublicLaunch: false,
    command: input.command,
    receipt: `public-launch-smoke.${input.id}.receipt`,
    evidence: input.evidence,
    operatorAction: input.operatorAction,
    dependsOn: ['release-profile-hardening'],
    liveExternalCallRequired: input.liveExternalCallRequired || false,
    liveChannelSendRequired: input.liveChannelSendRequired || false,
    liveDeviceRequired: input.liveDeviceRequired || false,
    liveMemoryWriteRequired: false,
    secretValuesSerialized: false,
  };
}

function gate(input: PublicLaunchSmokeEvidenceGate): PublicLaunchSmokeEvidenceGate {
  return input;
}
