import type {
  CanaryPlanDryRunHoldControl,
  CanaryPlanDryRunHoldGate,
  CanaryPlanDryRunHoldReceipt,
  CanaryPlanDryRunHoldSnapshot,
  CanaryPlanDryRunHoldStatus,
} from '../contracts/CanaryPlanDryRunHoldContract.js';
import { ZAVORTH_CANARY_PLAN_DRY_RUN_HOLD_CONTRACT_VERSION } from '../contracts/CanaryPlanDryRunHoldContract.js';
import { PreCanaryGoNoGoAlignmentService } from './PreCanaryGoNoGoAlignmentService.js';

type CanaryPlanDryRunHoldRuntime = {
  now?: () => Date;
  preCanaryGoNoGoAlignmentService?: PreCanaryGoNoGoAlignmentService;
};

export class CanaryPlanDryRunHoldService {
  private readonly now: () => Date;
  private readonly alignment: PreCanaryGoNoGoAlignmentService;

  constructor(runtime: CanaryPlanDryRunHoldRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.alignment = runtime.preCanaryGoNoGoAlignmentService
      || new PreCanaryGoNoGoAlignmentService({ now: this.now });
  }

  public buildSnapshot(): CanaryPlanDryRunHoldSnapshot {
    const alignmentSnapshot = this.alignment.buildSnapshot();
    const controls = this.controls(alignmentSnapshot.releaseCandidate.id);
    const receipts = this.receipts(controls);
    const gates = this.gates({
      alignmentReady: alignmentSnapshot.summary.alignmentReady,
      alignmentSnapshot,
      controls,
      receipts,
    });
    const failedGates = gates.filter((gate) => gate.status === 'fail').length;
    const blockedControls = controls.filter((control) => control.status === 'blocked').length;
    const status: CanaryPlanDryRunHoldStatus = alignmentSnapshot.status === 'blocked' || failedGates > 0 || blockedControls > 0
      ? 'blocked'
      : controls.some((control) => control.status === 'dry-run-ready')
        ? 'dry-run-ready'
        : 'attention';

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_CANARY_PLAN_DRY_RUN_HOLD_CONTRACT_VERSION,
      status,
      releaseCandidate: {
        id: alignmentSnapshot.releaseCandidate.id,
        packageName: alignmentSnapshot.releaseCandidate.packageName,
        packageVersion: alignmentSnapshot.releaseCandidate.packageVersion,
        channel: 'release-candidate',
        npmDistTag: 'rc',
        canaryPlanDryRunOnly: true,
      },
      plan: {
        state: status === 'blocked' ? 'blocked' : 'dry-run-ready',
        effectiveDecision: 'hold',
        executable: false,
        launchAuthorized: false,
        canaryCohortId: 'dry-run-canary-cohort',
        cohortPercent: 5,
        maxCohortPercent: 10,
        featureFlagKey: 'zavorth.rc.1.1.canary',
        featureFlagDefault: 'off',
        observationWindowHours: 48,
        minimumObservationWindowHours: 24,
        rollbackTrigger: {
          errorRatePercent: 1,
          p95LatencyMs: 2500,
          crashFreePercent: 99.5,
          supportSeverity: 'high',
          killSwitchRequired: true,
        },
        promotion: {
          automaticPromotion: false,
          manualPromotionRequired: true,
          nextCohortPercent: null,
          promotionWindowOpen: false,
        },
      },
      summary: {
        controls: controls.length,
        requiredControls: controls.filter((control) => control.requiredForDryRun).length,
        alignedControls: controls.filter((control) => control.status === 'aligned').length,
        dryRunReadyControls: controls.filter((control) => control.status === 'dry-run-ready').length,
        operatorReadyControls: controls.filter((control) => control.status === 'operator-ready').length,
        lockedControls: controls.filter((control) => control.status === 'locked').length,
        blockedControls,
        gates: gates.length,
        passedGates: gates.filter((gate) => gate.status === 'pass').length,
        failedGates,
        receipts: receipts.length,
        preCanaryAlignmentStatus: alignmentSnapshot.status,
        preCanaryAlignmentReady: alignmentSnapshot.summary.alignmentReady,
        rolloutPlanDryRunLinked: controls.some((control) => control.id === 'rollout-plan-dry-run-gate' && control.status === 'aligned'),
        cohortDefined: controls.some((control) => control.id === 'canary-cohort-plan' && control.status === 'dry-run-ready'),
        flagDefaultOffDefined: controls.some((control) => control.id === 'feature-flag-default-off-plan' && control.status === 'dry-run-ready'),
        observationWindowDefined: controls.some((control) => control.id === 'observation-window-plan' && control.status === 'dry-run-ready'),
        rollbackTriggerDefined: controls.some((control) => control.id === 'rollback-trigger-plan' && control.status === 'dry-run-ready'),
        canaryPlanDryRunReady: status === 'dry-run-ready' && alignmentSnapshot.summary.alignmentReady,
        canaryStartAuthorized: false,
        canaryStarted: false,
        rolloutStarted: false,
        deployExecuted: false,
        promotionExecuted: false,
        remoteStateMutated: false,
        npmPublishExecuted: false,
        githubReleaseCreated: false,
        gitTagMoved: false,
        secretValuesSerialized: false,
      },
      preCanaryAlignment: {
        contractVersion: alignmentSnapshot.contractVersion,
        status: alignmentSnapshot.status,
        releaseCandidate: alignmentSnapshot.releaseCandidate,
        decision: alignmentSnapshot.decision,
        summary: alignmentSnapshot.summary,
        commands: alignmentSnapshot.commands,
      },
      controls,
      gates,
      receipts,
      commands: {
        run: 'npm run canary-plan-dry-run-hold --silent',
        runJson: 'npm run canary-plan-dry-run-hold:json --silent',
        check: 'npm run canary-plan-dry-run-hold:check --silent',
        requireDryRunReady: 'npm run canary-plan-dry-run-hold --silent -- --require-dry-run-ready',
        preCanaryAlignment: 'npm run pre-canary-go-no-go-alignment --silent -- --require-aligned',
        capabilityAutopilotRolloutPlan: 'npm run capability-autopilot:release-rollout --silent -- --require-pass',
        releaseExecutionHold: 'manual:hold-release-execution --no-publish --no-tag --no-canary-start',
        canaryPromotionHold: 'manual:hold-canary-promotion --no-next-cohort --no-auto-promote',
        focusedTests: [
          'npx jest tests/services/CanaryPlanDryRunHoldService.test.ts --runInBand',
          'npm run canary-plan-dry-run-hold:check --silent',
          'npm run canary-plan-dry-run-hold --silent -- --require-dry-run-ready',
        ],
        typecheck: 'npm run runtime:check --silent',
        nextPhase: 'Canary execution approval ledger',
      },
      policy: {
        canaryPlanOnly: true,
        dryRunOnly: true,
        consumesPreCanaryGoNoGoAlignment: true,
        noCanaryStarted: true,
        noRolloutStarted: true,
        noDeployExecuted: true,
        noPromotionExecuted: true,
        noNpmPublish: true,
        noGithubReleaseCreated: true,
        noGitTagMoved: true,
        noStableTagMoved: true,
        noLatestTagMoved: true,
        noAutomaticPromotion: true,
        noSkipCanary: true,
        explicitLaunchApprovalRequired: true,
        rollbackTriggerRequired: true,
        observationWindowRequired: true,
        noRemoteMutationByDefault: true,
        noNetworkRequiredByDefault: true,
        secretsSerialized: false,
      },
    };
  }

  public formatDryRunText(snapshot: CanaryPlanDryRunHoldSnapshot = this.buildSnapshot()): string {
    return [
      'Zavorth Canary Plan Dry-Run and Hold',
      `Status: ${snapshot.status}`,
      `Release candidate: ${snapshot.releaseCandidate.id}`,
      `Plan state: ${snapshot.plan.state}`,
      `Effective decision: ${snapshot.plan.effectiveDecision}`,
      `Cohort: ${snapshot.plan.cohortPercent}%/${snapshot.plan.maxCohortPercent}%`,
      `Feature flag: ${snapshot.plan.featureFlagKey}=${snapshot.plan.featureFlagDefault}`,
      `Observation window: ${snapshot.plan.observationWindowHours}h`,
      `Controls: ${snapshot.summary.alignedControls} aligned, ${snapshot.summary.dryRunReadyControls} dry-run-ready, ${snapshot.summary.operatorReadyControls} operator-ready, ${snapshot.summary.lockedControls} locked, ${snapshot.summary.blockedControls} blocked`,
      `Gates: ${snapshot.summary.passedGates}/${snapshot.summary.gates} pass`,
      `Receipts: ${snapshot.summary.receipts}`,
      `Pre-canary alignment ready: ${snapshot.summary.preCanaryAlignmentReady}`,
      `Canary plan dry-run ready: ${snapshot.summary.canaryPlanDryRunReady}`,
      `Canary start authorized: ${snapshot.summary.canaryStartAuthorized}`,
      `Promotion executed: ${snapshot.summary.promotionExecuted}`,
      `Remote state mutated: ${snapshot.summary.remoteStateMutated}`,
      '',
      'Dry-run controls:',
      ...snapshot.controls.map((control) =>
        `- ${control.status.toUpperCase()} ${control.id}: ${control.command}`,
      ),
      '',
      'Gate results:',
      ...snapshot.gates.map((gate) =>
        `- ${gate.status.toUpperCase()} ${gate.id}: ${gate.observed} / ${gate.threshold} - ${gate.nextAction}`,
      ),
      '',
      `Next: ${snapshot.commands.nextPhase}`,
    ].join('\n');
  }

  private controls(releaseCandidateId: string): CanaryPlanDryRunHoldControl[] {
    return [
      alignedControl({
        id: 'pre-canary-alignment-input',
        surface: 'pre-canary-alignment',
        command: 'npm run pre-canary-go-no-go-alignment --silent -- --require-aligned',
        evidence: `${releaseCandidateId} pre-canary go/no-go alignment is the input to canary dry-run planning.`,
      }),
      alignedControl({
        id: 'rollout-plan-dry-run-gate',
        surface: 'rollout-plan',
        command: 'npm run capability-autopilot:release-rollout --silent -- --require-pass',
        evidence: 'Capability Autopilot rollout plan is linked as a dry-run evidence gate.',
      }),
      dryRunControl({
        id: 'canary-cohort-plan',
        surface: 'cohort',
        command: 'dry-run:define-canary-cohort --id dry-run-canary-cohort --percent 5 --max-percent 10',
        evidence: 'Canary cohort is defined as 5 percent with a 10 percent hard cap.',
      }),
      dryRunControl({
        id: 'feature-flag-default-off-plan',
        surface: 'feature-flag',
        command: 'dry-run:stage-feature-flag --key zavorth.rc.1.1.canary --default off --cohort dry-run-canary-cohort',
        evidence: 'RC canary flag remains default-off and scoped to the planned cohort.',
      }),
      dryRunControl({
        id: 'observation-window-plan',
        surface: 'observation',
        command: 'dry-run:define-observation-window --hours 48 --minimum-hours 24',
        evidence: 'Canary observation window is 48 hours with a 24 hour minimum.',
      }),
      dryRunControl({
        id: 'health-budget-plan',
        surface: 'health-budget',
        command: 'dry-run:define-health-budgets --error-rate-percent 1 --p95-latency-ms 2500 --crash-free-percent 99.5',
        evidence: 'Health budget is defined before any launch authorization.',
      }),
      dryRunControl({
        id: 'rollback-trigger-plan',
        surface: 'rollback',
        command: 'dry-run:define-rollback-trigger --error-rate-percent 1 --p95-latency-ms 2500 --support-severity high --kill-switch required',
        evidence: 'Rollback trigger is bound to health budget, support severity, and kill switch readiness.',
      }),
      operatorControl({
        id: 'rollback-owner-call-tree',
        surface: 'rollback',
        command: 'manual:confirm-rollback-owner-call-tree --required-before-launch',
        evidence: 'Rollback call tree is operator-ready, not executed by the dry-run plan.',
      }),
      operatorControl({
        id: 'support-incident-bridge-plan',
        surface: 'support',
        command: 'manual:confirm-support-incident-bridge --required-before-launch',
        evidence: 'Support and incident bridge are prepared as a launch prerequisite.',
      }),
      dryRunControl({
        id: 'audit-receipt-plan',
        surface: 'audit',
        command: 'dry-run:create-canary-audit-receipt --no-write --no-upload',
        evidence: 'Audit receipt schema is prepared without writing or uploading evidence.',
      }),
      lockedControl({
        id: 'canary-launch-hold',
        surface: 'policy',
        command: 'policy:hold-canary-launch no-canary-start no-deploy-execution',
        evidence: 'Canary launch remains on hold until a future explicit launch approval.',
      }),
      lockedControl({
        id: 'promotion-hold',
        surface: 'promotion',
        command: 'policy:hold-canary-promotion no-next-cohort no-auto-promote',
        evidence: 'Canary promotion and next cohort expansion are locked.',
      }),
      lockedControl({
        id: 'global-rollout-hold',
        surface: 'policy',
        command: 'policy:no-global-rollout no-skip-canary no-auto-rollout',
        evidence: 'Global rollout, skip-canary, and auto-rollout are disabled.',
      }),
      lockedControl({
        id: 'publication-hold',
        surface: 'publication',
        command: 'policy:no-npm-publish no-github-release no-git-tag',
        evidence: 'Publication, GitHub release creation, and tag movement stay locked.',
      }),
    ];
  }

  private gates(input: {
    alignmentReady: boolean;
    alignmentSnapshot: ReturnType<PreCanaryGoNoGoAlignmentService['buildSnapshot']>;
    controls: CanaryPlanDryRunHoldControl[];
    receipts: CanaryPlanDryRunHoldReceipt[];
  }): CanaryPlanDryRunHoldGate[] {
    const required = input.controls.filter((control) => control.requiredForDryRun);
    const ready = required.filter((control) =>
      control.status === 'aligned'
      || control.status === 'dry-run-ready'
      || control.status === 'operator-ready'
      || control.status === 'locked',
    );
    const rolloutPlanLinked = input.controls.some((control) => control.id === 'rollout-plan-dry-run-gate' && control.status === 'aligned');
    const cohortFlagObservation = [
      'canary-cohort-plan',
      'feature-flag-default-off-plan',
      'observation-window-plan',
    ].every((id) => input.controls.some((control) => control.id === id && control.status === 'dry-run-ready'));
    const rollbackAndHealth = [
      'health-budget-plan',
      'rollback-trigger-plan',
    ].every((id) => input.controls.some((control) => control.id === id && control.status === 'dry-run-ready'));
    const ownerSupportAudit = [
      'rollback-owner-call-tree',
      'support-incident-bridge-plan',
      'audit-receipt-plan',
    ].every((id) => input.controls.some((control) => control.id === id && control.status !== 'blocked'));
    const canarySideEffectsBlocked = input.controls.every((control) =>
      control.canaryStarted === false
      && control.rolloutStarted === false
      && control.deployExecuted === false
      && control.mutatesRemoteState === false,
    );
    const promotionAndPublicationHeld = input.controls.every((control) =>
      control.promotionExecuted === false
      && control.publishesPackage === false,
    ) && input.alignmentSnapshot.summary.npmPublishExecuted === false
      && input.alignmentSnapshot.summary.githubReleaseCreated === false
      && input.alignmentSnapshot.summary.gitTagMoved === false;

    return [
      gate({
        id: 'pre-canary-alignment-ready',
        status: input.alignmentReady ? 'pass' : 'fail',
        title: 'Pre-canary go/no-go alignment is ready',
        observed: input.alignmentReady,
        threshold: true,
        receipt: 'canary-plan-dry-run.pre-canary-alignment-ready.receipt',
        nextAction: 'finish Phase 18 before building the canary dry-run plan',
      }),
      gate({
        id: 'rollout-plan-dry-run-linked',
        status: rolloutPlanLinked ? 'pass' : 'fail',
        title: 'Capability Autopilot rollout plan dry-run is linked',
        observed: rolloutPlanLinked,
        threshold: true,
        receipt: 'canary-plan-dry-run.rollout-plan-linked.receipt',
        nextAction: 'link capability autopilot release rollout plan before canary planning',
      }),
      gate({
        id: 'cohort-flag-observation-defined',
        status: cohortFlagObservation ? 'pass' : 'fail',
        title: 'Cohort, feature flag, and observation window are defined',
        observed: cohortFlagObservation,
        threshold: true,
        receipt: 'canary-plan-dry-run.cohort-flag-observation.receipt',
        nextAction: 'define canary cohort, default-off flag, and observation window',
      }),
      gate({
        id: 'rollback-and-health-triggers-defined',
        status: rollbackAndHealth ? 'pass' : 'fail',
        title: 'Rollback and health triggers are defined',
        observed: rollbackAndHealth,
        threshold: true,
        receipt: 'canary-plan-dry-run.rollback-health.receipt',
        nextAction: 'define health budgets and rollback triggers before launch approval',
      }),
      gate({
        id: 'owner-support-audit-covered',
        status: ownerSupportAudit ? 'pass' : 'fail',
        title: 'Owner, support, and audit coverage are prepared',
        observed: ownerSupportAudit,
        threshold: true,
        receipt: 'canary-plan-dry-run.owner-support-audit.receipt',
        nextAction: 'prepare rollback call tree, support bridge, and audit receipts',
      }),
      gate({
        id: 'canary-launch-side-effects-blocked',
        status: canarySideEffectsBlocked ? 'pass' : 'fail',
        title: 'Canary launch, rollout, deploy, and remote mutation are blocked',
        observed: canarySideEffectsBlocked,
        threshold: true,
        receipt: 'canary-plan-dry-run.side-effects-blocked.receipt',
        nextAction: 'remove launch, rollout, deploy, or remote mutation from dry-run plan',
      }),
      gate({
        id: 'promotion-and-publication-held',
        status: promotionAndPublicationHeld ? 'pass' : 'fail',
        title: 'Promotion and publication remain held',
        observed: promotionAndPublicationHeld,
        threshold: true,
        receipt: 'canary-plan-dry-run.promotion-publication-held.receipt',
        nextAction: 'restore promotion hold, no-publish, no-release, and no-tag guarantees',
      }),
      gate({
        id: 'dry-run-receipts-complete',
        status: input.receipts.length === input.controls.length && ready.length === required.length ? 'pass' : 'fail',
        title: 'Every canary dry-run control emits a receipt',
        observed: `${input.receipts.length}/${input.controls.length}`,
        threshold: `${input.controls.length}/${input.controls.length}`,
        receipt: 'canary-plan-dry-run.receipts-complete.receipt',
        nextAction: 'repair missing canary dry-run receipts or blocked controls',
      }),
    ];
  }

  private receipts(controls: CanaryPlanDryRunHoldControl[]): CanaryPlanDryRunHoldReceipt[] {
    return controls.map((control) => ({
      id: control.receipt,
      controlId: control.id,
      status: control.status,
      command: control.command,
      evidence: control.evidence,
      dryRunOnly: control.dryRunOnly,
      noCanaryStarted: true,
      noRolloutStarted: true,
      noDeployExecuted: true,
      noPromotionExecuted: true,
      noPackagePublished: true,
      noRemoteMutation: true,
      secretValuesSerialized: false,
    }));
  }
}

function alignedControl(input: {
  id: CanaryPlanDryRunHoldControl['id'];
  surface: CanaryPlanDryRunHoldControl['surface'];
  command: string;
  evidence: string;
}): CanaryPlanDryRunHoldControl {
  return buildControl(input, 'source-gate', 'aligned', true);
}

function dryRunControl(input: {
  id: CanaryPlanDryRunHoldControl['id'];
  surface: CanaryPlanDryRunHoldControl['surface'];
  command: string;
  evidence: string;
}): CanaryPlanDryRunHoldControl {
  const mode: CanaryPlanDryRunHoldControl['mode'] = input.surface === 'rollback'
    ? 'rollback-design'
    : input.surface === 'observation' || input.surface === 'health-budget'
      ? 'observation-design'
      : 'canary-design';
  return buildControl(input, mode, 'dry-run-ready', true);
}

function operatorControl(input: {
  id: CanaryPlanDryRunHoldControl['id'];
  surface: CanaryPlanDryRunHoldControl['surface'];
  command: string;
  evidence: string;
}): CanaryPlanDryRunHoldControl {
  return buildControl(input, 'operator-handoff', 'operator-ready', false);
}

function lockedControl(input: {
  id: CanaryPlanDryRunHoldControl['id'];
  surface: CanaryPlanDryRunHoldControl['surface'];
  command: string;
  evidence: string;
}): CanaryPlanDryRunHoldControl {
  return buildControl(input, 'policy-lock', 'locked', false);
}

function buildControl(
  input: {
    id: CanaryPlanDryRunHoldControl['id'];
    surface: CanaryPlanDryRunHoldControl['surface'];
    command: string;
    evidence: string;
  },
  mode: CanaryPlanDryRunHoldControl['mode'],
  status: CanaryPlanDryRunHoldControl['status'],
  dryRunOnly: boolean,
): CanaryPlanDryRunHoldControl {
  return {
    ...input,
    mode,
    status,
    receipt: `canary-plan-dry-run.${input.id}.receipt`,
    requiredForDryRun: true,
    dryRunOnly,
    canaryStarted: false,
    rolloutStarted: false,
    deployExecuted: false,
    promotionExecuted: false,
    publishesPackage: false,
    mutatesRemoteState: false,
    secretValuesSerialized: false,
  };
}

function gate(input: CanaryPlanDryRunHoldGate): CanaryPlanDryRunHoldGate {
  return input;
}
