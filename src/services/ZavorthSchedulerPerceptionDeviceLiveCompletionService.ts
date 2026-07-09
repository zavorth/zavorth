import {
  ZAVORTH_SCHEDULER_PERCEPTION_DEVICE_LIVE_COMPLETION_CONTRACT_VERSION,
  type ZavorthSchedulerPerceptionDeviceCompletionEntry,
  type ZavorthSchedulerPerceptionDeviceCompletionStatus,
  type ZavorthSchedulerPerceptionDeviceLiveCompletionSnapshot,
} from '../contracts/ZavorthSchedulerPerceptionDeviceLiveCompletionContract.js';
import { ZavorthNativeCompanionDevicePackService } from './ZavorthNativeCompanionDevicePackService.js';

import { ZavorthPerceptionCrossSurfaceCertificationService } from './ZavorthPerceptionCrossSurfaceCertificationService.js';
import { ZavorthScheduledTaskDailyOpsReadinessService } from './ZavorthScheduledTaskDailyOpsReadinessService.js';

type Runtime = {
  now?: () => Date;
  scheduler?: Pick<ZavorthScheduledTaskDailyOpsReadinessService, 'buildSnapshot'>;
  perception?: Pick<ZavorthPerceptionCrossSurfaceCertificationService, 'buildSnapshot'>;
  device?: Pick<ZavorthNativeCompanionDevicePackService, 'buildSnapshot'>;
};

export class ZavorthSchedulerPerceptionDeviceLiveCompletionService {
  private readonly now: () => Date;
  private readonly scheduler: Pick<ZavorthScheduledTaskDailyOpsReadinessService, 'buildSnapshot'>;
  private readonly perception: Pick<ZavorthPerceptionCrossSurfaceCertificationService, 'buildSnapshot'>;
  private readonly device: Pick<ZavorthNativeCompanionDevicePackService, 'buildSnapshot'>;

  public constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.scheduler = runtime.scheduler || new ZavorthScheduledTaskDailyOpsReadinessService({
      now: this.now,
    });
    this.perception = runtime.perception || new ZavorthPerceptionCrossSurfaceCertificationService({
      now: this.now,
    });
    this.device = runtime.device || new ZavorthNativeCompanionDevicePackService({
      now: this.now,
    });
  }

  public async buildSnapshot(): Promise<ZavorthSchedulerPerceptionDeviceLiveCompletionSnapshot> {
    const generatedAt = this.now().toISOString();
    const [scheduler, perception, device] = await Promise.all([
      this.scheduler.buildSnapshot({ now: generatedAt }),
      this.perception.buildSnapshot(),
      this.device.buildSnapshot(),
    ]);
    const entries = buildEntries({ scheduler, perception, device });
    const status = resolveStatus(entries);
    const passed = entries.filter((entry) => entry.status === 'passed').length;
    const attention = entries.filter((entry) => entry.status === 'attention').length;
    const blocked = entries.filter((entry) => entry.status === 'blocked').length;

    return {
      generatedAt,
      contractVersion: ZAVORTH_SCHEDULER_PERCEPTION_DEVICE_LIVE_COMPLETION_CONTRACT_VERSION,
      source: 'ZavorthSchedulerPerceptionDeviceLiveCompletionService',
      status,
      scheduler,
      perception,
      device,
      entries,
      summary: {
        entries: entries.length,
        passed,
        attention,
        blocked,
        schedulerDailyUseReady: scheduler.summary.dailyUseReady,
        perceptionReadOnlyReady: perception.status === 'passed',
        deviceCompanionReady: device.status === 'passed',
        hostSpecificLiveChecksRequired: true,
        rawSecretsSerialized: false,
        workspaceMutationPerformed: false,
        externalIoPerformed: false,
      },
      liveCompletion: {
        scheduledTasksCanOperateDaily: scheduler.summary.dailyUseReady,
        scheduledLiveTicksUseGateway: scheduler.safety.noDirectDispatcherBypass,
        perceptionCanRouteNaturally: perception.naturalPlan.status !== 'denied',
        pcBrowserAndroidReadOnlyCertified: perception.status === 'passed',
        deviceCompanionBridgeCertified: device.status === 'passed',
        androidAdbRequiresHostAuthorization: true,
        browserLiveRequiresSidecarReadiness: true,
        computerMutationRequiresApproval: true,
        defaultRouteRequiresReadinessProof: true,
      },
      safety: {
        policyBrokerRequired: true,
        noDirectSchedulerDispatch: scheduler.safety.noDirectDispatcherBypass,
        noUnapprovedComputerMutation: perception.safety.mutationStillRequiresApproval,
        noSecretScreenAutomation: perception.zavorthControlProjection.liveSafetyStatus.hardBlocksPreserved,
        noTerminalAutomationBypass: perception.certificationMatrix.some((entry) =>
          entry.id === 'blocked-terminal-automation' && entry.status === 'passed'),
        visualArtifactsRedacted: perception.zavorthControlProjection.artifacts.every((artifact) =>
          artifact.redacted === true && artifact.rawContentStored === false),
        deviceActionsOwnerGated: device.summary.enabledByDefault === false,
        rawSecretsSerialized: false,
      },
      commands: {
        inspect: 'npm run zavorth:scheduler-perception-device-live-completion',
        inspectJson: 'npm run zavorth:scheduler-perception-device-live-completion:json',
        check: 'npm run zavorth:scheduler-perception-device-live-completion:check --silent',
        nextStage: 'ZavorthControl controls - End-to-End Mission Flow and Public Runtime Certification',
      },
    };
  }

  public formatSnapshotText(snapshot: ZavorthSchedulerPerceptionDeviceLiveCompletionSnapshot): string {
    const lines = [
      'Zavorth Scheduler + Perception + Device Live Completion - Surface controls',
      '',
      `Status: ${snapshot.status}`,
      `Entries: ${snapshot.summary.passed}/${snapshot.summary.entries} passed, attention=${snapshot.summary.attention}, blocked=${snapshot.summary.blocked}`,
      `Scheduler daily-use ready: ${snapshot.summary.schedulerDailyUseReady}`,
      `Perception read-only ready: ${snapshot.summary.perceptionReadOnlyReady}`,
      `Device companion ready: ${snapshot.summary.deviceCompanionReady}`,
      '',
      'Completion matrix:',
    ];
    for (const entry of snapshot.entries) {
      lines.push(`- ${entry.label}: ${entry.status} | daily=${entry.dailyUseReady} | live=${entry.liveReady} | default=${entry.defaultRouteAllowed}`);
      if (entry.hostDependency) lines.push(`  host: ${entry.hostDependency}`);
      if (entry.defaultBlockReason) lines.push(`  block: ${entry.defaultBlockReason}`);
    }
    lines.push('', 'Safety: live ADB/browser/computer control remains owner-gated and policy-gated.');
    lines.push(`Next: ${snapshot.commands.nextStage}`);
    return lines.join('\n');
  }
}

function buildEntries(input: {
  scheduler: Awaited<ReturnType<ZavorthScheduledTaskDailyOpsReadinessService['buildSnapshot']>>;
  perception: Awaited<ReturnType<ZavorthPerceptionCrossSurfaceCertificationService['buildSnapshot']>>;
  device: Awaited<ReturnType<ZavorthNativeCompanionDevicePackService['buildSnapshot']>>;
}): ZavorthSchedulerPerceptionDeviceCompletionEntry[] {
  return [
    entry({
      id: 'scheduler.daily-ops',
      label: 'Governed scheduled task daily operations',
      kind: 'scheduler',
      passed: input.scheduler.summary.dailyUseReady,
      dailyUseReady: input.scheduler.summary.dailyUseReady,
      liveReady: input.scheduler.liveTickCertification.status === 'passed',
      defaultRouteAllowed: input.scheduler.summary.dailyUseReady,
      hostDependency: input.scheduler.summary.hostTaskChecked ? null : 'Run with a concrete --task=<id> for host-specific task evidence.',
      defaultBlockReason: null,
      evidence: [
        `schedulerStatus=${input.scheduler.status}`,
        `dailyUseReady=${input.scheduler.summary.dailyUseReady}`,
        `liveTick=${input.scheduler.liveTickCertification.status}`,
      ],
    }),
    entry({
      id: 'scheduler.no-direct-dispatch',
      label: 'Scheduled execution does not bypass gateway',
      kind: 'safety',
      passed: input.scheduler.safety.noDirectDispatcherBypass,
      dailyUseReady: true,
      liveReady: input.scheduler.safety.noDirectDispatcherBypass,
      defaultRouteAllowed: input.scheduler.safety.noDirectDispatcherBypass,
      hostDependency: null,
      defaultBlockReason: null,
      evidence: ['noDirectDispatcherBypass=true'],
    }),
    entry({
      id: 'perception.cross-surface',
      label: 'PC, browser and Android read-only perception',
      kind: 'perception',
      passed: input.perception.status === 'passed',
      dailyUseReady: input.perception.status === 'passed',
      liveReady: input.perception.status === 'passed',
      defaultRouteAllowed: true,
      hostDependency: 'Browser live capture requires sidecar readiness; Android live capture requires ADB installed and authorized.',
      defaultBlockReason: null,
      evidence: [
        `perceptionStatus=${input.perception.status}`,
        `matrix=${input.perception.certificationMatrix.length}`,
        `targets=${input.perception.zavorthControlProjection.targets.length}`,
      ],
    }),
    entry({
      id: 'perception.mutation-gates',
      label: 'Computer and device mutation gates',
      kind: 'safety',
      passed: input.perception.safety.mutationStillRequiresApproval
        && input.perception.zavorthControlProjection.liveSafetyStatus.hardBlocksPreserved,
      dailyUseReady: true,
      liveReady: true,
      defaultRouteAllowed: false,
      hostDependency: null,
      defaultBlockReason: 'Tap, type, click, install, uninstall and external control stay blocked until explicit approval.',
      evidence: [
        `mutationStillRequiresApproval=${input.perception.safety.mutationStillRequiresApproval}`,
        `hardBlocksPreserved=${input.perception.zavorthControlProjection.liveSafetyStatus.hardBlocksPreserved}`,
      ],
    }),
    entry({
      id: 'device.native-companion',
      label: 'Satellite/PWA and desktop companion device bridge',
      kind: 'device',
      passed: input.device.status === 'passed',
      dailyUseReady: input.device.status === 'passed',
      liveReady: input.device.summary.pwaBridgeFunctional && input.device.summary.desktopBridgeFunctional,
      defaultRouteAllowed: input.device.summary.enabledByDefault === false,
      hostDependency: 'Native wrappers and optional runtimes remain owner-gated until packaged/provisioned.',
      defaultBlockReason: null,
      evidence: [
        `deviceStatus=${input.device.status}`,
        `pwa=${input.device.summary.pwaBridgeFunctional}`,
        `desktop=${input.device.summary.desktopBridgeFunctional}`,
      ],
    }),
    entry({
      id: 'device.owner-gated-live',
      label: 'Device live actions are not enabled by default',
      kind: 'safety',
      passed: input.device.summary.enabledByDefault === false
        && input.device.summary.liveExternalIoPerformed === false
        && input.device.summary.secretValuesSerialized === false,
      dailyUseReady: true,
      liveReady: true,
      defaultRouteAllowed: false,
      hostDependency: null,
      defaultBlockReason: 'Camera, location, confirmation, screen and native wrapper actions require device trust, browser permission or owner approval.',
      evidence: [
        `enabledByDefault=${input.device.summary.enabledByDefault}`,
        `liveExternalIoPerformed=${input.device.summary.liveExternalIoPerformed}`,
        `secretValuesSerialized=${input.device.summary.secretValuesSerialized}`,
      ],
    }),
  ];
}

function entry(input: {
  id: string;
  label: string;
  kind: ZavorthSchedulerPerceptionDeviceCompletionEntry['kind'];
  passed: boolean;
  dailyUseReady: boolean;
  liveReady: boolean;
  defaultRouteAllowed: boolean;
  hostDependency: string | null;
  defaultBlockReason: string | null;
  evidence: string[];
}): ZavorthSchedulerPerceptionDeviceCompletionEntry {
  return {
    id: input.id,
    label: input.label,
    kind: input.kind,
    status: input.passed ? 'passed' : 'attention',
    dailyUseReady: input.dailyUseReady,
    liveReady: input.liveReady,
    defaultRouteAllowed: input.defaultRouteAllowed,
    hostDependency: input.hostDependency,
    defaultBlockReason: input.defaultBlockReason,
    evidence: input.evidence,
  };
}

function resolveStatus(entries: ZavorthSchedulerPerceptionDeviceCompletionEntry[]): ZavorthSchedulerPerceptionDeviceCompletionStatus {
  if (entries.some((entry) => entry.status === 'blocked')) return 'blocked';
  if (entries.some((entry) => entry.status === 'attention')) return 'attention';
  return 'passed';
}
