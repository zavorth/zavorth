import type {
  CanaryMonitoringRollbackControl,
  CanaryMonitoringRollbackGate,
  CanaryMonitoringRollbackGateSnapshot,
  CanaryMonitoringRollbackGateStatus,
  CanaryMonitoringRollbackReceipt,
} from '../contracts/CanaryMonitoringRollbackGateContract.js';
import { ZAVORTH_CANARY_MONITORING_ROLLBACK_GATE_CONTRACT_VERSION } from '../contracts/CanaryMonitoringRollbackGateContract.js';

import { CanaryLaunchRehearsalService } from './CanaryLaunchRehearsalService.js';

type CanaryMonitoringRollbackGateRuntime = {
  now?: () => Date;
  canaryLaunchRehearsalService?: CanaryLaunchRehearsalService;
};

export class CanaryMonitoringRollbackGateService {
  private readonly now: () => Date;
  private readonly launchRehearsal: CanaryLaunchRehearsalService;

  constructor(runtime: CanaryMonitoringRollbackGateRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.launchRehearsal = runtime.canaryLaunchRehearsalService
      || new CanaryLaunchRehearsalService({ now: this.now });
  }

  public buildSnapshot(): CanaryMonitoringRollbackGateSnapshot {
    const launchRehearsalSnapshot = this.launchRehearsal.buildSnapshot();
    const controls = this.controls({
      releaseCandidateId: launchRehearsalSnapshot.releaseCandidate.id,
      canaryCohortId: launchRehearsalSnapshot.rehearsal.canaryCohortId,
      featureFlagKey: launchRehearsalSnapshot.rehearsal.featureFlagKey,
      observationWindowHours: launchRehearsalSnapshot.rehearsal.observationWindowHours,
    });
    const receipts = this.receipts(controls);
    const gates = this.gates({
      launchRehearsalReady: launchRehearsalSnapshot.summary.launchRehearsalReady,
      launchRehearsalSnapshot,
      controls,
      receipts,
    });
    const failedGates = gates.filter((gate) => gate.status === 'fail').length;
    const blockedControls = controls.filter((control) => control.status === 'blocked').length;
    const status: CanaryMonitoringRollbackGateStatus = launchRehearsalSnapshot.status === 'blocked' || failedGates > 0 || blockedControls > 0
      ? 'blocked'
      : controls.some((control) => control.status === 'monitoring-ready' || control.status === 'rollback-ready')
        ? 'monitoring-gate-ready'
        : 'attention';

    const abortThresholdsReady = this.abortThresholdControlsReady(controls);
    const rollbackCommandRehearsed = controls.some((control) =>
      control.id === 'rollback-command-rehearsal' && control.status === 'rollback-ready',
    );

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_CANARY_MONITORING_ROLLBACK_GATE_CONTRACT_VERSION,
      status,
      releaseCandidate: {
        id: launchRehearsalSnapshot.releaseCandidate.id,
        packageName: launchRehearsalSnapshot.releaseCandidate.packageName,
        packageVersion: launchRehearsalSnapshot.releaseCandidate.packageVersion,
        channel: 'release-candidate',
        npmDistTag: 'rc',
        monitoringGateOnly: true,
      },
      monitoring: {
        state: status === 'blocked' ? 'blocked' : 'monitoring-gate-ready',
        effectiveDecision: 'hold',
        canaryCohortId: launchRehearsalSnapshot.rehearsal.canaryCohortId,
        featureFlagKey: launchRehearsalSnapshot.rehearsal.featureFlagKey,
        observationWindowHours: launchRehearsalSnapshot.rehearsal.observationWindowHours,
        monitoringCadenceMinutes: 15,
        initialCanaryPercent: 5,
        maxCanaryPercentBeforePromotion: 5,
        abortThresholdsDefined: abortThresholdsReady,
        healthSignalMode: 'dry-run',
        rollbackTriggerMode: 'dry-run',
        rollbackCommandRehearsed,
        liveTrafficObserved: false,
        rollbackRecommended: false,
        promotable: false,
      },
      summary: {
        controls: controls.length,
        requiredControls: controls.filter((control) => control.requiredForGate).length,
        linkedControls: controls.filter((control) => control.status === 'linked').length,
        monitoringReadyControls: controls.filter((control) => control.status === 'monitoring-ready').length,
        rollbackReadyControls: controls.filter((control) => control.status === 'rollback-ready').length,
        operatorReadyControls: controls.filter((control) => control.status === 'operator-ready').length,
        lockedControls: controls.filter((control) => control.status === 'locked').length,
        blockedControls,
        gates: gates.length,
        passedGates: gates.filter((gate) => gate.status === 'pass').length,
        failedGates,
        receipts: receipts.length,
        launchRehearsalStatus: launchRehearsalSnapshot.status,
        launchRehearsalReady: launchRehearsalSnapshot.summary.launchRehearsalReady,
        heldReleaseExecutionGateLinked: controls.some((control) => control.id === 'held-release-execution-gate' && control.status === 'linked'),
        observationWindowDefined: controls.some((control) => control.id === 'observation-window-monitor' && control.status === 'monitoring-ready'),
        telemetryZavorthControlReady: controls.some((control) => control.id === 'telemetry-zavorthControl-monitor' && control.status === 'monitoring-ready'),
        healthBudgetReady: controls.some((control) => control.id === 'health-budget-monitor' && control.status === 'monitoring-ready'),
        errorRateThresholdReady: controls.some((control) => control.id === 'error-rate-threshold-monitor' && control.status === 'monitoring-ready'),
        latencyThresholdReady: controls.some((control) => control.id === 'latency-threshold-monitor' && control.status === 'monitoring-ready'),
        cohortExposureBounded: controls.some((control) => control.id === 'cohort-exposure-monitor' && control.status === 'monitoring-ready'),
        abortThresholdsReady,
        rollbackTriggersReady: controls.some((control) => control.id === 'rollback-trigger-control' && control.status === 'rollback-ready'),
        rollbackCommandRehearsed,
        killSwitchReady: controls.some((control) => control.id === 'kill-switch-control' && control.status === 'rollback-ready'),
        auditEvidenceReady: controls.some((control) => control.id === 'audit-evidence-control' && control.status === 'rollback-ready'),
        operatorHandoffsReady: this.operatorHandoffsReady(controls),
        monitoringRollbackGateReady: status === 'monitoring-gate-ready' && launchRehearsalSnapshot.summary.launchRehearsalReady,
        liveTrafficObserved: false,
        signatureRecorded: false,
        launchAuthorized: false,
        executionApproved: false,
        canaryStarted: false,
        rollbackExecuted: false,
        rolloutStarted: false,
        promotionExecuted: false,
        remoteStateMutated: false,
        npmPublishExecuted: false,
        githubReleaseCreated: false,
        gitTagMoved: false,
        secretValuesSerialized: false,
      },
      launchRehearsal: {
        contractVersion: launchRehearsalSnapshot.contractVersion,
        status: launchRehearsalSnapshot.status,
        releaseCandidate: launchRehearsalSnapshot.releaseCandidate,
        rehearsal: launchRehearsalSnapshot.rehearsal,
        summary: launchRehearsalSnapshot.summary,
        commands: launchRehearsalSnapshot.commands,
      },
      controls,
      gates,
      receipts,
      commands: {
        run: 'npm run canary-monitoring-rollback-gate --silent',
        runJson: 'npm run canary-monitoring-rollback-gate:json --silent',
        check: 'npm run canary-monitoring-rollback-gate:check --silent',
        requireGateReady: 'npm run canary-monitoring-rollback-gate --silent -- --require-gate-ready',
        launchRehearsal: 'npm run canary-launch-rehearsal --silent -- --require-rehearsed',
        releaseExecutionHeld: 'npm run capability-autopilot:release-execution --silent -- --no-execution-approval --no-tag-approval --no-publish-approval --no-canary-launch-approval',
        monitoringDryRun: `dry-run:monitor-canary --cohort ${launchRehearsalSnapshot.rehearsal.canaryCohortId} --window-hours ${launchRehearsalSnapshot.rehearsal.observationWindowHours} --no-traffic`,
        rollbackDryRun: 'dry-run:rollback-command --checkpoint required --no-execute',
        focusedTests: [
          'npx jest tests/services/CanaryMonitoringRollbackGateService.test.ts --runInBand',
          'npm run canary-monitoring-rollback-gate:check --silent',
          'npm run canary-monitoring-rollback-gate --silent -- --require-gate-ready',
        ],
        typecheck: 'npm run runtime:check --silent',
        nextStage: 'Canary promotion decision ledger',
      },
      policy: {
        monitoringGateOnly: true,
        consumesCanaryLaunchRehearsal: true,
        noLiveTrafficByDefault: true,
        noSignatureRecordedByDefault: true,
        noLaunchAuthorizedByDefault: true,
        noCanaryStarted: true,
        noRollbackExecuted: true,
        noRolloutStarted: true,
        noPromotionExecuted: true,
        noNpmPublish: true,
        noGithubReleaseCreated: true,
        noGitTagMoved: true,
        noStableTagMoved: true,
        noLatestTagMoved: true,
        noAutomaticExecution: true,
        noAutomaticPromotion: true,
        abortThresholdsRequired: true,
        observationWindowRequired: true,
        healthSignalsRequired: true,
        rollbackGateRequiredBeforePromotion: true,
        incidentCommanderRequired: true,
        supportBridgeRequired: true,
        auditEvidenceRequired: true,
        manualPromotionRequired: true,
        noRemoteMutationByDefault: true,
        noNetworkRequiredByDefault: true,
        secretsSerialized: false,
      },
    };
  }

  public formatGateText(snapshot: CanaryMonitoringRollbackGateSnapshot = this.buildSnapshot()): string {
    return [
      'Zavorth Canary Monitoring And Rollback Gate',
      `Status: ${snapshot.status}`,
      `Release candidate: ${snapshot.releaseCandidate.id}`,
      `Monitoring state: ${snapshot.monitoring.state}`,
      `Effective decision: ${snapshot.monitoring.effectiveDecision}`,
      `Canary cohort: ${snapshot.monitoring.canaryCohortId}`,
      `Feature flag: ${snapshot.monitoring.featureFlagKey}`,
      `Observation window: ${snapshot.monitoring.observationWindowHours}h`,
      `Monitoring cadence: ${snapshot.monitoring.monitoringCadenceMinutes}m`,
      `Initial canary percent: ${snapshot.monitoring.initialCanaryPercent}`,
      `Abort thresholds defined: ${snapshot.monitoring.abortThresholdsDefined}`,
      `Rollback command rehearsed: ${snapshot.monitoring.rollbackCommandRehearsed}`,
      `Live traffic observed: ${snapshot.monitoring.liveTrafficObserved}`,
      `Promotable: ${snapshot.monitoring.promotable}`,
      `Controls: ${snapshot.summary.linkedControls} linked, ${snapshot.summary.monitoringReadyControls} monitoring-ready, ${snapshot.summary.rollbackReadyControls} rollback-ready, ${snapshot.summary.operatorReadyControls} operator-ready, ${snapshot.summary.lockedControls} locked, ${snapshot.summary.blockedControls} blocked`,
      `Gates: ${snapshot.summary.passedGates}/${snapshot.summary.gates} pass`,
      `Receipts: ${snapshot.summary.receipts}`,
      `Launch rehearsal ready: ${snapshot.summary.launchRehearsalReady}`,
      `Monitoring rollback gate ready: ${snapshot.summary.monitoringRollbackGateReady}`,
      `Canary started: ${snapshot.summary.canaryStarted}`,
      `Rollback executed: ${snapshot.summary.rollbackExecuted}`,
      `Promotion executed: ${snapshot.summary.promotionExecuted}`,
      `Remote state mutated: ${snapshot.summary.remoteStateMutated}`,
      '',
      'Monitoring and rollback controls:',
      ...snapshot.controls.map((control) =>
        `- ${control.status.toUpperCase()} ${control.id}: ${control.command}`,
      ),
      '',
      'Gate results:',
      ...snapshot.gates.map((gate) =>
        `- ${gate.status.toUpperCase()} ${gate.id}: ${gate.observed} / ${gate.threshold} - ${gate.nextAction}`,
      ),
      '',
      `Next: ${snapshot.commands.nextStage}`,
    ].join('\n');
  }

  private controls(input: {
    releaseCandidateId: string;
    canaryCohortId: string;
    featureFlagKey: string;
    observationWindowHours: number;
  }): CanaryMonitoringRollbackControl[] {
    return [
      linkedControl({
        id: 'launch-rehearsal-input',
        surface: 'launch-rehearsal',
        command: 'npm run canary-launch-rehearsal --silent -- --require-rehearsed',
        evidence: `${input.releaseCandidateId} launch rehearsal is the monitoring gate input.`,
      }),
      linkedControl({
        id: 'held-release-execution-gate',
        surface: 'release-execution',
        command: 'npm run capability-autopilot:release-execution --silent -- --no-execution-approval --no-tag-approval --no-publish-approval --no-canary-launch-approval',
        evidence: 'Release execution remains linked in explicit hold mode.',
      }),
      monitoringControl({
        id: 'observation-window-monitor',
        surface: 'observation-window',
        command: `dry-run:define-observation-window --hours ${input.observationWindowHours} --cadence-minutes 15 --no-live-traffic`,
        evidence: 'Observation window and cadence are defined without observing live traffic.',
      }),
      monitoringControl({
        id: 'telemetry-zavorthControl-monitor',
        surface: 'telemetry',
        command: 'dry-run:prepare-canary-zavorthControl --no-live-attach --no-upload',
        evidence: 'Telemetry zavorthControl handoff is prepared without live attachment.',
      }),
      monitoringControl({
        id: 'health-budget-monitor',
        surface: 'health-budget',
        command: 'dry-run:health-budget --min-success-rate 99 --max-critical-alerts 0 --no-traffic',
        evidence: 'Health budget thresholds are prepared for the canary window.',
      }),
      monitoringControl({
        id: 'error-rate-threshold-monitor',
        surface: 'error-rate',
        command: 'dry-run:error-rate-threshold --max-5xx 0.5 --abort-on-breach --no-traffic',
        evidence: 'Error-rate abort threshold is explicit.',
      }),
      monitoringControl({
        id: 'latency-threshold-monitor',
        surface: 'latency',
        command: 'dry-run:latency-threshold --p95-ms 1200 --abort-on-breach --no-traffic',
        evidence: 'Latency abort threshold is explicit.',
      }),
      monitoringControl({
        id: 'cohort-exposure-monitor',
        surface: 'cohort',
        command: `dry-run:bound-canary-cohort --cohort ${input.canaryCohortId} --max-percent 5 --no-traffic`,
        evidence: 'Canary cohort exposure is bounded before any promotion.',
      }),
      rollbackControl({
        id: 'rollback-trigger-control',
        surface: 'rollback',
        command: 'dry-run:rollback-trigger --on-health-budget-breach --on-error-rate-breach --on-latency-breach',
        evidence: 'Rollback triggers are tied to explicit monitoring thresholds.',
      }),
      rollbackControl({
        id: 'rollback-command-rehearsal',
        surface: 'rollback',
        command: 'dry-run:rollback-command --checkpoint required --no-execute',
        evidence: 'Rollback command is rehearsed without executing.',
      }),
      rollbackControl({
        id: 'kill-switch-control',
        surface: 'kill-switch',
        command: `dry-run:kill-switch --flag ${input.featureFlagKey} --required --no-toggle`,
        evidence: 'Kill switch remains ready without toggling remote state.',
      }),
      rollbackControl({
        id: 'audit-evidence-control',
        surface: 'audit',
        command: 'dry-run:audit-evidence-ledger --include-monitoring-and-rollback --no-upload',
        evidence: 'Audit evidence ledger is prepared without upload.',
      }),
      operatorControl({
        id: 'incident-commander-handoff',
        surface: 'incident',
        command: 'manual:confirm-incident-commander-watch --required-before-canary',
        evidence: 'Incident command handoff is operator-ready.',
      }),
      operatorControl({
        id: 'support-bridge-handoff',
        surface: 'support',
        command: 'manual:confirm-support-bridge-watch --required-before-canary',
        evidence: 'Support bridge watch is operator-ready.',
      }),
      lockedControl({
        id: 'promotion-lock',
        surface: 'promotion',
        command: 'policy:no-canary-promotion no-next-cohort no-auto-promote',
        evidence: 'Promotion remains locked until monitoring evidence is real and signed.',
      }),
      lockedControl({
        id: 'publication-lock',
        surface: 'publication',
        command: 'policy:no-npm-publish no-github-release no-git-tag',
        evidence: 'Publication and tag movement remain locked.',
      }),
      lockedControl({
        id: 'remote-mutation-lock',
        surface: 'policy',
        command: 'policy:no-live-traffic no-remote-mutation no-rollback-execute',
        evidence: 'Monitoring gate does not mutate remote state or execute rollback.',
      }),
    ];
  }

  private gates(input: {
    launchRehearsalReady: boolean;
    launchRehearsalSnapshot: ReturnType<CanaryLaunchRehearsalService['buildSnapshot']>;
    controls: CanaryMonitoringRollbackControl[];
    receipts: CanaryMonitoringRollbackReceipt[];
  }): CanaryMonitoringRollbackGate[] {
    const required = input.controls.filter((control) => control.requiredForGate);
    const ready = required.filter((control) =>
      control.status === 'linked'
      || control.status === 'monitoring-ready'
      || control.status === 'rollback-ready'
      || control.status === 'operator-ready'
      || control.status === 'locked',
    );
    const releaseExecutionLinked = input.controls.some((control) => control.id === 'held-release-execution-gate' && control.status === 'linked');
    const monitoringSignalsReady = this.monitoringSignalsReady(input.controls);
    const rollbackControlsReady = this.rollbackControlsReady(input.controls);
    const abortThresholdsReady = this.abortThresholdControlsReady(input.controls);
    const operatorHandoffsReady = this.operatorHandoffsReady(input.controls);
    const liveTrafficSideEffectsBlocked = input.controls.every((control) =>
      control.liveTrafficObserved === false
      && control.canaryStarted === false
      && control.rollbackExecuted === false
      && control.mutatesRemoteState === false,
    ) && input.launchRehearsalSnapshot.summary.canaryStarted === false
      && input.launchRehearsalSnapshot.summary.remoteStateMutated === false;
    const publicationAndPromotionHeld = input.controls.every((control) =>
      control.promotionExecuted === false
      && control.publishesPackage === false,
    ) && input.launchRehearsalSnapshot.summary.promotionExecuted === false
      && input.launchRehearsalSnapshot.summary.npmPublishExecuted === false
      && input.launchRehearsalSnapshot.summary.githubReleaseCreated === false
      && input.launchRehearsalSnapshot.summary.gitTagMoved === false;
    const remoteMutationBlocked = input.controls.every((control) => control.mutatesRemoteState === false)
      && input.launchRehearsalSnapshot.summary.remoteStateMutated === false;

    return [
      gate({
        id: 'launch-rehearsal-ready',
        status: input.launchRehearsalReady ? 'pass' : 'fail',
        title: 'Canary launch rehearsal is ready',
        observed: input.launchRehearsalReady,
        threshold: true,
        receipt: 'canary-monitoring-rollback.launch-rehearsal-ready.receipt',
        nextAction: 'finish Preview engine1 before monitoring and rollback gate',
      }),
      gate({
        id: 'held-release-execution-gate-linked',
        status: releaseExecutionLinked ? 'pass' : 'fail',
        title: 'Held release execution gate is linked',
        observed: releaseExecutionLinked,
        threshold: true,
        receipt: 'canary-monitoring-rollback.release-execution-linked.receipt',
        nextAction: 'link release execution in explicit hold mode',
      }),
      gate({
        id: 'monitoring-signals-ready',
        status: monitoringSignalsReady ? 'pass' : 'fail',
        title: 'Observation window, telemetry, health, error, latency, and cohort signals are ready',
        observed: monitoringSignalsReady,
        threshold: true,
        receipt: 'canary-monitoring-rollback.monitoring-signals.receipt',
        nextAction: 'prepare all monitoring signals before canary observation',
      }),
      gate({
        id: 'rollback-controls-ready',
        status: rollbackControlsReady ? 'pass' : 'fail',
        title: 'Rollback trigger, rollback command, kill switch, and audit evidence are ready',
        observed: rollbackControlsReady,
        threshold: true,
        receipt: 'canary-monitoring-rollback.rollback-controls.receipt',
        nextAction: 'prepare rollback trigger, command, kill switch, and audit ledger',
      }),
      gate({
        id: 'abort-thresholds-explicit',
        status: abortThresholdsReady ? 'pass' : 'fail',
        title: 'Abort thresholds are explicit',
        observed: abortThresholdsReady,
        threshold: true,
        receipt: 'canary-monitoring-rollback.abort-thresholds.receipt',
        nextAction: 'define health, error-rate, latency, and cohort abort thresholds',
      }),
      gate({
        id: 'operator-handoffs-ready',
        status: operatorHandoffsReady ? 'pass' : 'fail',
        title: 'Incident commander and support bridge handoffs are ready',
        observed: operatorHandoffsReady,
        threshold: true,
        receipt: 'canary-monitoring-rollback.operator-handoffs.receipt',
        nextAction: 'prepare incident commander and support bridge watches',
      }),
      gate({
        id: 'live-traffic-side-effects-blocked',
        status: liveTrafficSideEffectsBlocked ? 'pass' : 'fail',
        title: 'Live traffic, canary start, rollback execution, and remote mutation are blocked',
        observed: liveTrafficSideEffectsBlocked,
        threshold: true,
        receipt: 'canary-monitoring-rollback.side-effects-blocked.receipt',
        nextAction: 'remove live traffic, canary start, rollback execution, or remote mutation from gate',
      }),
      gate({
        id: 'publication-and-promotion-held',
        status: publicationAndPromotionHeld ? 'pass' : 'fail',
        title: 'Publication and promotion remain held',
        observed: publicationAndPromotionHeld,
        threshold: true,
        receipt: 'canary-monitoring-rollback.publication-promotion-held.receipt',
        nextAction: 'restore no-publish/no-release/no-tag and no-promotion guarantees',
      }),
      gate({
        id: 'remote-mutation-blocked',
        status: remoteMutationBlocked ? 'pass' : 'fail',
        title: 'Remote mutation remains blocked',
        observed: remoteMutationBlocked,
        threshold: true,
        receipt: 'canary-monitoring-rollback.remote-mutation-blocked.receipt',
        nextAction: 'remove remote writes from monitoring and rollback gate',
      }),
      gate({
        id: 'monitoring-receipts-complete',
        status: input.receipts.length === input.controls.length && ready.length === required.length ? 'pass' : 'fail',
        title: 'Every monitoring and rollback control emits a receipt',
        observed: `${input.receipts.length}/${input.controls.length}`,
        threshold: `${input.controls.length}/${input.controls.length}`,
        receipt: 'canary-monitoring-rollback.receipts-complete.receipt',
        nextAction: 'repair missing monitoring receipts or blocked controls',
      }),
    ];
  }

  private receipts(controls: CanaryMonitoringRollbackControl[]): CanaryMonitoringRollbackReceipt[] {
    return controls.map((control) => ({
      id: control.receipt,
      controlId: control.id,
      status: control.status,
      command: control.command,
      evidence: control.evidence,
      dryRunOnly: control.dryRunOnly,
      liveTrafficObserved: false,
      noCanaryStarted: true,
      noRollbackExecuted: true,
      noPromotionExecuted: true,
      noPackagePublished: true,
      noRemoteMutation: true,
      secretValuesSerialized: false,
    }));
  }

  private monitoringSignalsReady(controls: CanaryMonitoringRollbackControl[]): boolean {
    return [
      'observation-window-monitor',
      'telemetry-zavorthControl-monitor',
      'health-budget-monitor',
      'error-rate-threshold-monitor',
      'latency-threshold-monitor',
      'cohort-exposure-monitor',
    ].every((id) => controls.some((control) => control.id === id && control.status === 'monitoring-ready'));
  }

  private rollbackControlsReady(controls: CanaryMonitoringRollbackControl[]): boolean {
    return [
      'rollback-trigger-control',
      'rollback-command-rehearsal',
      'kill-switch-control',
      'audit-evidence-control',
    ].every((id) => controls.some((control) => control.id === id && control.status === 'rollback-ready'));
  }

  private abortThresholdControlsReady(controls: CanaryMonitoringRollbackControl[]): boolean {
    return [
      'health-budget-monitor',
      'error-rate-threshold-monitor',
      'latency-threshold-monitor',
      'cohort-exposure-monitor',
      'rollback-trigger-control',
    ].every((id) => controls.some((control) =>
      control.id === id && (control.status === 'monitoring-ready' || control.status === 'rollback-ready'),
    ));
  }

  private operatorHandoffsReady(controls: CanaryMonitoringRollbackControl[]): boolean {
    return [
      'incident-commander-handoff',
      'support-bridge-handoff',
    ].every((id) => controls.some((control) => control.id === id && control.status === 'operator-ready'));
  }
}

function linkedControl(input: {
  id: CanaryMonitoringRollbackControl['id'];
  surface: CanaryMonitoringRollbackControl['surface'];
  command: string;
  evidence: string;
}): CanaryMonitoringRollbackControl {
  return buildControl(input, 'source-gate', 'linked', true);
}

function monitoringControl(input: {
  id: CanaryMonitoringRollbackControl['id'];
  surface: CanaryMonitoringRollbackControl['surface'];
  command: string;
  evidence: string;
}): CanaryMonitoringRollbackControl {
  return buildControl(input, 'monitoring-threshold', 'monitoring-ready', true);
}

function rollbackControl(input: {
  id: CanaryMonitoringRollbackControl['id'];
  surface: CanaryMonitoringRollbackControl['surface'];
  command: string;
  evidence: string;
}): CanaryMonitoringRollbackControl {
  return buildControl(input, 'rollback-control', 'rollback-ready', true);
}

function operatorControl(input: {
  id: CanaryMonitoringRollbackControl['id'];
  surface: CanaryMonitoringRollbackControl['surface'];
  command: string;
  evidence: string;
}): CanaryMonitoringRollbackControl {
  return buildControl(input, 'operator-handoff', 'operator-ready', false);
}

function lockedControl(input: {
  id: CanaryMonitoringRollbackControl['id'];
  surface: CanaryMonitoringRollbackControl['surface'];
  command: string;
  evidence: string;
}): CanaryMonitoringRollbackControl {
  return buildControl(input, 'policy-lock', 'locked', false);
}

function buildControl(
  input: {
    id: CanaryMonitoringRollbackControl['id'];
    surface: CanaryMonitoringRollbackControl['surface'];
    command: string;
    evidence: string;
  },
  mode: CanaryMonitoringRollbackControl['mode'],
  status: CanaryMonitoringRollbackControl['status'],
  dryRunOnly: boolean,
): CanaryMonitoringRollbackControl {
  return {
    ...input,
    mode,
    status,
    receipt: `canary-monitoring-rollback.${input.id}.receipt`,
    requiredForGate: true,
    dryRunOnly,
    liveTrafficObserved: false,
    canaryStarted: false,
    rollbackExecuted: false,
    promotionExecuted: false,
    publishesPackage: false,
    mutatesRemoteState: false,
    secretValuesSerialized: false,
  };
}

function gate(input: CanaryMonitoringRollbackGate): CanaryMonitoringRollbackGate {
  return input;
}
