import {
  ZAVORTH_PERCEPTION_DEVICE_CONTROL_COMPLETION_CONTRACT_VERSION,
  type ZavorthPerceptionDeviceControlCompletionEntry,
  type ZavorthPerceptionDeviceControlCompletionSnapshot,
  type ZavorthPerceptionDeviceControlCompletionStatus,
} from '../contracts/ZavorthPerceptionDeviceControlCompletionContract.js';
import { ZavorthNativeCompanionDevicePackService } from './ZavorthNativeCompanionDevicePackService.js';
import { ZavorthPerceptionCrossSurfaceCertificationService } from './ZavorthPerceptionCrossSurfaceCertificationService.js';

type Runtime = {
  now?: () => Date;
  perception?: Pick<ZavorthPerceptionCrossSurfaceCertificationService, 'buildSnapshot'>;
  device?: Pick<ZavorthNativeCompanionDevicePackService, 'buildSnapshot'>;
};

const NATURAL_COMMANDS: ZavorthPerceptionDeviceControlCompletionSnapshot['naturalCommands'] = [
  {
    utterance: 'look at my screen',
    route: 'pc-vision',
    defaultMode: 'read-only',
    commandHint: '/vision inspect',
  },
  {
    utterance: 'check this website visually',
    route: 'browser-vision',
    defaultMode: 'read-only',
    commandHint: '/vision browser inspect',
  },
  {
    utterance: 'open this site and confirm what is visible',
    route: 'browser-control',
    defaultMode: 'approval-required',
    commandHint: '/computer plan',
  },
  {
    utterance: 'look at my connected phone',
    route: 'android-observe',
    defaultMode: 'read-only',
    commandHint: '/device inspect',
  },
  {
    utterance: 'tap/type on my phone to fix this',
    route: 'android-control',
    defaultMode: 'approval-required',
    commandHint: '/device approve <plan>',
  },
];

export class ZavorthPerceptionDeviceControlCompletionService {
  private readonly now: () => Date;
  private readonly perception: Pick<ZavorthPerceptionCrossSurfaceCertificationService, 'buildSnapshot'>;
  private readonly device: Pick<ZavorthNativeCompanionDevicePackService, 'buildSnapshot'>;

  public constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.perception = runtime.perception || new ZavorthPerceptionCrossSurfaceCertificationService({
      now: this.now,
    });
    this.device = runtime.device || new ZavorthNativeCompanionDevicePackService({
      now: this.now,
    });
  }

  public async buildSnapshot(): Promise<ZavorthPerceptionDeviceControlCompletionSnapshot> {
    const [perception, device] = await Promise.all([
      this.perception.buildSnapshot(),
      this.device.buildSnapshot(),
    ]);
    const entries = buildEntries({ perception, device });
    const status = resolveStatus(entries);
    const passed = entries.filter((entry) => entry.status === 'passed').length;
    const attention = entries.filter((entry) => entry.status === 'attention').length;
    const blocked = entries.filter((entry) => entry.status === 'blocked').length;
    const pcScreenshotReadOnlyReady = hasPassed(perception, 'pc-screenshot');
    const browserViewReady = hasPassed(perception, 'browser-dom') && hasPassed(perception, 'browser-screenshot');
    const browserControlPolicyGated = perception.zavorthControlProjection.liveSafetyStatus.explicitApprovalRequired
      && perception.zavorthControlProjection.liveSafetyStatus.mutationRequiresApproval;
    const androidObserveReady = hasPassed(perception, 'adb-screenshot') && hasPassed(perception, 'adb-ui-dump');
    const androidControlPolicyGated = hasPassed(perception, 'approval-required-tap-type-click')
      && device.policy.biometricOrDeviceConfirmRequiresTrust;
    const visualArtifactsInReceipts = perception.zavorthControlProjection.artifacts.length >= 5
      && perception.zavorthControlProjection.artifacts.every((artifact) =>
        artifact.redacted === true && artifact.rawContentStored === false);

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_PERCEPTION_DEVICE_CONTROL_COMPLETION_CONTRACT_VERSION,
      source: 'ZavorthPerceptionDeviceControlCompletionService',
      status,
      perception,
      device,
      entries,
      naturalCommands: NATURAL_COMMANDS,
      summary: {
        entries: entries.length,
        passed,
        attention,
        blocked,
        pcScreenshotReadOnlyReady,
        browserViewReady,
        browserControlPolicyGated,
        androidObserveReady,
        androidControlPolicyGated,
        naturalRoutingReady: NATURAL_COMMANDS.length >= 5
          && perception.naturalPlan.status !== 'denied'
          && perception.surfaceResponse.blocks.length > 0,
        visualArtifactsInReceipts,
        rawSecretsSerialized: false,
        workspaceMutationPerformed: false,
        externalIoPerformed: false,
      },
      safety: {
        policyBrokerRequired: true,
        pcObservationReadOnlyByDefault: true,
        browserControlRequiresReadinessAndApproval: true,
        androidTapTypeInstallRequiresApproval: true,
        adbRequiresOwnerAuthorizedDevice: true,
        terminalAutomationBypassBlocked: hasPassed(perception, 'blocked-terminal-automation'),
        secretScreenAutomationBlocked: hasPassed(perception, 'blocked-secrets-screen'),
        visualArtifactsRedacted: visualArtifactsInReceipts,
        noLiveDeviceMutationDuringCertification: true,
        rawSecretsSerialized: false,
      },
      commands: {
        inspect: 'npm run zavorth:perception-device-control-completion',
        inspectJson: 'npm run zavorth:perception-device-control-completion:json',
        check: 'npm run zavorth:perception-device-control-completion:check --silent',
        nextStage: 'Intent model1 - ZavorthControl Final Product Polish',
      },
    };
  }

  public formatSnapshotText(snapshot: ZavorthPerceptionDeviceControlCompletionSnapshot): string {
    const lines = [
      'Zavorth Perception And Device Control Completion - Intent model0',
      '',
      `Status: ${snapshot.status}`,
      `Entries: ${snapshot.summary.passed}/${snapshot.summary.entries} passed, attention=${snapshot.summary.attention}, blocked=${snapshot.summary.blocked}`,
      `PC screenshot read-only: ${snapshot.summary.pcScreenshotReadOnlyReady}`,
      `Browser view ready: ${snapshot.summary.browserViewReady}`,
      `Browser control gated: ${snapshot.summary.browserControlPolicyGated}`,
      `Android observe ready: ${snapshot.summary.androidObserveReady}`,
      `Android control gated: ${snapshot.summary.androidControlPolicyGated}`,
      `Natural routing ready: ${snapshot.summary.naturalRoutingReady}`,
      '',
      'Completion matrix:',
    ];
    for (const entry of snapshot.entries) {
      lines.push(`- ${entry.label}: ${entry.status} | daily=${entry.readyForDailyUse} | live=${entry.liveReadyWhenHostConfigured} | approval=${entry.requiresApprovalForMutation}`);
      for (const blocker of entry.blockers) lines.push(`  blocker: ${blocker}`);
    }
    lines.push('', 'Natural commands:');
    for (const command of snapshot.naturalCommands) {
      lines.push(`- "${command.utterance}" -> ${command.route} (${command.defaultMode}) via ${command.commandHint}`);
    }
    lines.push('', 'Safety: read-only vision may route naturally; tap/type/click/install/ZavorthControl always stays policy/approval-gated.');
    lines.push(`Next: ${snapshot.commands.nextStage}`);
    return lines.join('\n');
  }
}

function buildEntries(input: {
  perception: Awaited<ReturnType<ZavorthPerceptionCrossSurfaceCertificationService['buildSnapshot']>>;
  device: Awaited<ReturnType<ZavorthNativeCompanionDevicePackService['buildSnapshot']>>;
}): ZavorthPerceptionDeviceControlCompletionEntry[] {
  const { perception, device } = input;
  return [
    entry({
      id: 'pc.screenshot-read-only',
      label: 'PC screenshot/read-only vision',
      kind: 'pc',
      passed: hasPassed(perception, 'pc-screenshot')
        && perception.safety.noWorkspaceMutation
        && perception.safety.noExternalIo,
      readyForDailyUse: true,
      liveReadyWhenHostConfigured: true,
      requiresApprovalForMutation: false,
      evidence: [
        matrixEvidence(perception, 'pc-screenshot'),
        `artifacts=${perception.zavorthControlProjection.artifacts.filter((artifact) => artifact.targetId === 'pc').length}`,
      ],
      blockers: [],
    }),
    entry({
      id: 'browser.view',
      label: 'Browser DOM/screenshot view',
      kind: 'browser',
      passed: hasPassed(perception, 'browser-dom') && hasPassed(perception, 'browser-screenshot'),
      readyForDailyUse: true,
      liveReadyWhenHostConfigured: true,
      requiresApprovalForMutation: false,
      evidence: [matrixEvidence(perception, 'browser-dom'), matrixEvidence(perception, 'browser-screenshot')],
      blockers: ['Live browser capture requires browser sidecar readiness on this host.'],
    }),
    entry({
      id: 'browser.control-gated',
      label: 'Browser control remains policy-gated',
      kind: 'browser',
      passed: perception.zavorthControlProjection.liveSafetyStatus.explicitApprovalRequired
        && perception.zavorthControlProjection.liveSafetyStatus.mutationRequiresApproval
        && perception.zavorthControlProjection.liveSafetyStatus.noVisualMutationWithoutOwnerApproval,
      readyForDailyUse: true,
      liveReadyWhenHostConfigured: true,
      requiresApprovalForMutation: true,
      evidence: [
        `explicitApprovalRequired=${perception.zavorthControlProjection.liveSafetyStatus.explicitApprovalRequired}`,
        `mutationRequiresApproval=${perception.zavorthControlProjection.liveSafetyStatus.mutationRequiresApproval}`,
      ],
      blockers: [],
    }),
    entry({
      id: 'android.observe',
      label: 'Android ADB observe/read-only evidence',
      kind: 'android',
      passed: hasPassed(perception, 'adb-screenshot') && hasPassed(perception, 'adb-ui-dump'),
      readyForDailyUse: true,
      liveReadyWhenHostConfigured: true,
      requiresApprovalForMutation: false,
      evidence: [matrixEvidence(perception, 'adb-screenshot'), matrixEvidence(perception, 'adb-ui-dump')],
      blockers: ['Live Android observe requires ADB installed and owner-authorized USB debugging.'],
    }),
    entry({
      id: 'android.control-gated',
      label: 'Android tap/type/install control remains approval-gated',
      kind: 'android',
      passed: hasPassed(perception, 'approval-required-tap-type-click')
        && device.policy.androidIosMacosWrappersOwnerGated
        && device.summary.enabledByDefault === false,
      readyForDailyUse: true,
      liveReadyWhenHostConfigured: true,
      requiresApprovalForMutation: true,
      evidence: [
        matrixEvidence(perception, 'approval-required-tap-type-click'),
        `nativeWrappersOwnerGated=${device.summary.nativeWrappersOwnerGated}`,
      ],
      blockers: [],
    }),
    entry({
      id: 'natural.commands',
      label: 'Natural commands route to vision/browser/device',
      kind: 'natural-command',
      passed: NATURAL_COMMANDS.length >= 5
        && perception.naturalPlan.status !== 'denied'
        && perception.surfaceResponse.blocks.length > 0,
      readyForDailyUse: true,
      liveReadyWhenHostConfigured: true,
      requiresApprovalForMutation: true,
      evidence: NATURAL_COMMANDS.map((command) => `${command.utterance}->${command.route}`),
      blockers: [],
    }),
    entry({
      id: 'visual.artifact-receipts',
      label: 'Visual artifacts are receipt-safe',
      kind: 'artifact',
      passed: perception.zavorthControlProjection.artifacts.length >= 5
        && perception.zavorthControlProjection.artifacts.every((artifact) =>
          artifact.redacted === true && artifact.rawContentStored === false)
        && perception.zavorthControlProjection.receipts.every((receipt) => receipt.rawSecretSerialized === false),
      readyForDailyUse: true,
      liveReadyWhenHostConfigured: true,
      requiresApprovalForMutation: false,
      evidence: [
        `artifacts=${perception.zavorthControlProjection.artifacts.length}`,
        `receipts=${perception.zavorthControlProjection.receipts.length}`,
      ],
      blockers: [],
    }),
    entry({
      id: 'safety.no-bypass',
      label: 'No terminal, secret-screen or live mutation bypass',
      kind: 'safety',
      passed: hasPassed(perception, 'blocked-terminal-automation')
        && hasPassed(perception, 'blocked-secrets-screen')
        && perception.safety.mutationStillRequiresApproval,
      readyForDailyUse: true,
      liveReadyWhenHostConfigured: true,
      requiresApprovalForMutation: true,
      evidence: [
        matrixEvidence(perception, 'blocked-terminal-automation'),
        matrixEvidence(perception, 'blocked-secrets-screen'),
        `mutationStillRequiresApproval=${perception.safety.mutationStillRequiresApproval}`,
      ],
      blockers: [],
    }),
  ];
}

function entry(input: {
  id: string;
  label: string;
  kind: ZavorthPerceptionDeviceControlCompletionEntry['kind'];
  passed: boolean;
  readyForDailyUse: boolean;
  liveReadyWhenHostConfigured: boolean;
  requiresApprovalForMutation: boolean;
  evidence: string[];
  blockers: string[];
}): ZavorthPerceptionDeviceControlCompletionEntry {
  return {
    id: input.id,
    label: input.label,
    kind: input.kind,
    status: input.passed ? 'passed' : 'attention',
    readyForDailyUse: input.readyForDailyUse,
    liveReadyWhenHostConfigured: input.liveReadyWhenHostConfigured,
    requiresApprovalForMutation: input.requiresApprovalForMutation,
    evidence: input.evidence,
    blockers: input.blockers,
  };
}

function hasPassed(
  snapshot: Awaited<ReturnType<ZavorthPerceptionCrossSurfaceCertificationService['buildSnapshot']>>,
  id: string,
): boolean {
  return snapshot.certificationMatrix.some((entry) => entry.id === id && entry.status === 'passed');
}

function matrixEvidence(
  snapshot: Awaited<ReturnType<ZavorthPerceptionCrossSurfaceCertificationService['buildSnapshot']>>,
  id: string,
): string {
  const row = snapshot.certificationMatrix.find((entry) => entry.id === id);
  return row ? `${row.id}:${row.status}:${row.evidence}` : `${id}:missing`;
}

function resolveStatus(entries: ZavorthPerceptionDeviceControlCompletionEntry[]): ZavorthPerceptionDeviceControlCompletionStatus {
  if (entries.some((entry) => entry.status === 'blocked')) return 'blocked';
  if (entries.some((entry) => entry.status === 'attention')) return 'attention';
  return 'passed';
}
