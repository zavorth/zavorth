import type {
  CanaryLaunchRehearsalGate,
  CanaryLaunchRehearsalReceipt,
  CanaryLaunchRehearsalSnapshot,
  CanaryLaunchRehearsalStatus,
  CanaryLaunchRehearsalStep,
} from '../contracts/CanaryLaunchRehearsalContract.js';
import { ZAVORTH_CANARY_LAUNCH_REHEARSAL_CONTRACT_VERSION } from '../contracts/CanaryLaunchRehearsalContract.js';
import { CanaryExecutionApprovalLedgerService } from './CanaryExecutionApprovalLedgerService.js';

type CanaryLaunchRehearsalRuntime = {
  now?: () => Date;
  canaryExecutionApprovalLedgerService?: CanaryExecutionApprovalLedgerService;
};

export class CanaryLaunchRehearsalService {
  private readonly now: () => Date;
  private readonly approvalLedger: CanaryExecutionApprovalLedgerService;

  constructor(runtime: CanaryLaunchRehearsalRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.approvalLedger = runtime.canaryExecutionApprovalLedgerService
      || new CanaryExecutionApprovalLedgerService({ now: this.now });
  }

  public buildSnapshot(): CanaryLaunchRehearsalSnapshot {
    const approvalLedgerSnapshot = this.approvalLedger.buildSnapshot();
    const steps = this.steps({
      releaseCandidateId: approvalLedgerSnapshot.releaseCandidate.id,
      canaryCohortId: approvalLedgerSnapshot.ledger.canaryCohortId,
      featureFlagKey: approvalLedgerSnapshot.ledger.featureFlagKey,
    });
    const receipts = this.receipts(steps);
    const gates = this.gates({
      approvalLedgerReady: approvalLedgerSnapshot.summary.approvalLedgerReady,
      approvalLedgerSnapshot,
      steps,
      receipts,
    });
    const failedGates = gates.filter((gate) => gate.status === 'fail').length;
    const blockedSteps = steps.filter((step) => step.status === 'blocked').length;
    const status: CanaryLaunchRehearsalStatus = approvalLedgerSnapshot.status === 'blocked' || failedGates > 0 || blockedSteps > 0
      ? 'blocked'
      : steps.some((step) => step.status === 'rehearsal-ready')
        ? 'rehearsal-ready'
        : 'attention';

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_CANARY_LAUNCH_REHEARSAL_CONTRACT_VERSION,
      status,
      releaseCandidate: {
        id: approvalLedgerSnapshot.releaseCandidate.id,
        packageName: approvalLedgerSnapshot.releaseCandidate.packageName,
        packageVersion: approvalLedgerSnapshot.releaseCandidate.packageVersion,
        channel: 'release-candidate',
        npmDistTag: 'rc',
        launchRehearsalOnly: true,
      },
      rehearsal: {
        state: status === 'blocked' ? 'blocked' : 'rehearsal-ready',
        effectiveDecision: 'hold',
        signaturePathRehearsed: steps.some((step) => step.id === 'signed-ledger-path-rehearsal' && step.status === 'rehearsal-ready'),
        signedLedgerFixture: 'unsigned-fixture',
        launchCommandRendered: steps.some((step) => step.id === 'launch-command-shape-rehearsal' && step.status === 'rehearsal-ready'),
        launchAuthorized: false,
        executable: false,
        canaryCohortId: approvalLedgerSnapshot.ledger.canaryCohortId,
        featureFlagKey: approvalLedgerSnapshot.ledger.featureFlagKey,
        observationWindowHours: approvalLedgerSnapshot.ledger.observationWindowHours,
        prelaunchSmokeMode: 'dry-run',
        rollbackCheckpointMode: 'dry-run',
        auditSinkMode: 'dry-run',
      },
      summary: {
        steps: steps.length,
        requiredSteps: steps.filter((step) => step.requiredForRehearsal).length,
        linkedSteps: steps.filter((step) => step.status === 'linked').length,
        rehearsalReadySteps: steps.filter((step) => step.status === 'rehearsal-ready').length,
        operatorReadySteps: steps.filter((step) => step.status === 'operator-ready').length,
        lockedSteps: steps.filter((step) => step.status === 'locked').length,
        blockedSteps,
        gates: gates.length,
        passedGates: gates.filter((gate) => gate.status === 'pass').length,
        failedGates,
        receipts: receipts.length,
        approvalLedgerStatus: approvalLedgerSnapshot.status,
        approvalLedgerReady: approvalLedgerSnapshot.summary.approvalLedgerReady,
        heldReleaseExecutionGateLinked: steps.some((step) => step.id === 'held-release-execution-gate' && step.status === 'linked'),
        signaturePathRehearsed: steps.some((step) => step.id === 'signed-ledger-path-rehearsal' && step.status === 'rehearsal-ready'),
        launchCommandRehearsed: steps.some((step) => step.id === 'launch-command-shape-rehearsal' && step.status === 'rehearsal-ready'),
        prelaunchSmokeRehearsed: steps.some((step) => step.id === 'prelaunch-smoke-rehearsal' && step.status === 'rehearsal-ready'),
        featureFlagRehearsed: steps.some((step) => step.id === 'feature-flag-activation-rehearsal' && step.status === 'rehearsal-ready'),
        cohortRoutingRehearsed: steps.some((step) => step.id === 'canary-cohort-routing-rehearsal' && step.status === 'rehearsal-ready'),
        rollbackCheckpointRehearsed: steps.some((step) => step.id === 'rollback-checkpoint-rehearsal' && step.status === 'rehearsal-ready'),
        killSwitchRehearsed: steps.some((step) => step.id === 'kill-switch-rehearsal' && step.status === 'rehearsal-ready'),
        auditSinkRehearsed: steps.some((step) => step.id === 'audit-sink-rehearsal' && step.status === 'rehearsal-ready'),
        observabilityHandoffReady: steps.some((step) => step.id === 'observability-handoff-rehearsal' && step.status === 'operator-ready'),
        supportBridgeReady: steps.some((step) => step.id === 'support-bridge-handoff-rehearsal' && step.status === 'operator-ready'),
        launchRehearsalReady: status === 'rehearsal-ready' && approvalLedgerSnapshot.summary.approvalLedgerReady,
        signatureRecorded: false,
        launchAuthorized: false,
        executionApproved: false,
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
      approvalLedger: {
        contractVersion: approvalLedgerSnapshot.contractVersion,
        status: approvalLedgerSnapshot.status,
        releaseCandidate: approvalLedgerSnapshot.releaseCandidate,
        ledger: approvalLedgerSnapshot.ledger,
        summary: approvalLedgerSnapshot.summary,
        commands: approvalLedgerSnapshot.commands,
      },
      steps,
      gates,
      receipts,
      commands: {
        run: 'npm run canary-launch-rehearsal --silent',
        runJson: 'npm run canary-launch-rehearsal:json --silent',
        check: 'npm run canary-launch-rehearsal:check --silent',
        requireRehearsed: 'npm run canary-launch-rehearsal --silent -- --require-rehearsed',
        approvalLedger: 'npm run canary-execution-approval-ledger --silent -- --require-ledger-ready',
        releaseExecutionHeld: 'npm run capability-autopilot:release-execution --silent -- --no-execution-approval --no-tag-approval --no-publish-approval --no-canary-launch-approval',
        launchCommandDryRun: 'dry-run:render-canary-launch-command --no-execute',
        rollbackDryRun: 'dry-run:rollback-checkpoint --no-write',
        focusedTests: [
          'npx jest tests/services/CanaryLaunchRehearsalService.test.ts --runInBand',
          'npm run canary-launch-rehearsal:check --silent',
          'npm run canary-launch-rehearsal --silent -- --require-rehearsed',
        ],
        typecheck: 'npm run runtime:check --silent',
        nextStage: 'Canary monitoring and rollback gate',
      },
      policy: {
        launchRehearsalOnly: true,
        consumesCanaryExecutionApprovalLedger: true,
        noSignatureRecordedByDefault: true,
        noLaunchAuthorizedByDefault: true,
        noCanaryStarted: true,
        noRolloutStarted: true,
        noDeployExecuted: true,
        noPromotionExecuted: true,
        noNpmPublish: true,
        noGithubReleaseCreated: true,
        noGitTagMoved: true,
        noStableTagMoved: true,
        noLatestTagMoved: true,
        noAutomaticExecution: true,
        noAutomaticPromotion: true,
        signedLedgerRequiredForRealLaunch: true,
        launchRehearsalRequiredBeforeRealCanary: true,
        rollbackCheckpointRequired: true,
        auditSinkRequired: true,
        observabilityHandoffRequired: true,
        supportBridgeRequired: true,
        noRemoteMutationByDefault: true,
        noNetworkRequiredByDefault: true,
        secretsSerialized: false,
      },
    };
  }

  public formatRehearsalText(snapshot: CanaryLaunchRehearsalSnapshot = this.buildSnapshot()): string {
    return [
      'Zavorth Canary Launch Rehearsal',
      `Status: ${snapshot.status}`,
      `Release candidate: ${snapshot.releaseCandidate.id}`,
      `Rehearsal state: ${snapshot.rehearsal.state}`,
      `Effective decision: ${snapshot.rehearsal.effectiveDecision}`,
      `Signed ledger fixture: ${snapshot.rehearsal.signedLedgerFixture}`,
      `Launch command rendered: ${snapshot.rehearsal.launchCommandRendered}`,
      `Canary cohort: ${snapshot.rehearsal.canaryCohortId}`,
      `Feature flag: ${snapshot.rehearsal.featureFlagKey}`,
      `Steps: ${snapshot.summary.linkedSteps} linked, ${snapshot.summary.rehearsalReadySteps} rehearsal-ready, ${snapshot.summary.operatorReadySteps} operator-ready, ${snapshot.summary.lockedSteps} locked, ${snapshot.summary.blockedSteps} blocked`,
      `Gates: ${snapshot.summary.passedGates}/${snapshot.summary.gates} pass`,
      `Receipts: ${snapshot.summary.receipts}`,
      `Approval ledger ready: ${snapshot.summary.approvalLedgerReady}`,
      `Launch rehearsal ready: ${snapshot.summary.launchRehearsalReady}`,
      `Signature recorded: ${snapshot.summary.signatureRecorded}`,
      `Launch authorized: ${snapshot.summary.launchAuthorized}`,
      `Canary started: ${snapshot.summary.canaryStarted}`,
      `Remote state mutated: ${snapshot.summary.remoteStateMutated}`,
      '',
      'Launch rehearsal steps:',
      ...snapshot.steps.map((step) =>
        `- ${step.status.toUpperCase()} ${step.id}: ${step.command}`,
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

  private steps(input: {
    releaseCandidateId: string;
    canaryCohortId: string;
    featureFlagKey: string;
  }): CanaryLaunchRehearsalStep[] {
    return [
      linkedStep({
        id: 'approval-ledger-input',
        surface: 'approval-ledger',
        command: 'npm run canary-execution-approval-ledger --silent -- --require-ledger-ready',
        evidence: `${input.releaseCandidateId} approval ledger is the input to launch rehearsal.`,
      }),
      linkedStep({
        id: 'held-release-execution-gate',
        surface: 'release-execution',
        command: 'npm run capability-autopilot:release-execution --silent -- --no-execution-approval --no-tag-approval --no-publish-approval --no-canary-launch-approval',
        evidence: 'Release execution path is rehearsed in explicit hold mode.',
      }),
      rehearsalStep({
        id: 'signed-ledger-path-rehearsal',
        surface: 'signature',
        command: 'dry-run:verify-signed-ledger-path --fixture unsigned-fixture --no-signature-recorded',
        evidence: 'Signed-ledger path is rehearsed with an unsigned fixture; no signature is recorded.',
      }),
      rehearsalStep({
        id: 'launch-command-shape-rehearsal',
        surface: 'launch-command',
        command: `dry-run:render-canary-launch-command --flag ${input.featureFlagKey} --cohort ${input.canaryCohortId} --no-execute`,
        evidence: 'Launch command shape is rendered without executing.',
      }),
      rehearsalStep({
        id: 'prelaunch-smoke-rehearsal',
        surface: 'smoke',
        command: 'dry-run:prelaunch-smoke --no-network --no-traffic',
        evidence: 'Prelaunch smoke is rehearsed without network or traffic.',
      }),
      rehearsalStep({
        id: 'feature-flag-activation-rehearsal',
        surface: 'feature-flag',
        command: `dry-run:feature-flag-activate --key ${input.featureFlagKey} --default off --no-write`,
        evidence: 'Feature flag activation is rehearsed while the flag remains default-off.',
      }),
      rehearsalStep({
        id: 'canary-cohort-routing-rehearsal',
        surface: 'cohort',
        command: `dry-run:route-canary-cohort --cohort ${input.canaryCohortId} --percent 5 --no-traffic`,
        evidence: 'Canary cohort routing is rehearsed without sending traffic.',
      }),
      rehearsalStep({
        id: 'rollback-checkpoint-rehearsal',
        surface: 'rollback',
        command: 'dry-run:rollback-checkpoint --no-write',
        evidence: 'Rollback checkpoint handoff is rehearsed without writing a checkpoint.',
      }),
      rehearsalStep({
        id: 'kill-switch-rehearsal',
        surface: 'kill-switch',
        command: `dry-run:kill-switch --flag ${input.featureFlagKey} --required --no-toggle`,
        evidence: 'Kill switch path is rehearsed without toggling production state.',
      }),
      rehearsalStep({
        id: 'audit-sink-rehearsal',
        surface: 'audit',
        command: 'dry-run:audit-sink --no-upload --no-write',
        evidence: 'Audit sink handoff is rehearsed without upload or write.',
      }),
      operatorStep({
        id: 'observability-handoff-rehearsal',
        surface: 'observability',
        command: 'manual:confirm-observability-handoff --required-before-launch',
        evidence: 'Observation handoff is operator-ready for a future launch.',
      }),
      operatorStep({
        id: 'support-bridge-handoff-rehearsal',
        surface: 'support',
        command: 'manual:confirm-support-bridge-handoff --required-before-launch',
        evidence: 'Support bridge handoff is operator-ready for a future launch.',
      }),
      lockedStep({
        id: 'canary-launch-lock',
        surface: 'policy',
        command: 'policy:no-canary-start no-launch-authorized no-deploy',
        evidence: 'Launch remains locked during rehearsal.',
      }),
      lockedStep({
        id: 'publication-lock',
        surface: 'publication',
        command: 'policy:no-npm-publish no-github-release no-git-tag',
        evidence: 'Publication and tag movement remain locked.',
      }),
      lockedStep({
        id: 'promotion-lock',
        surface: 'promotion',
        command: 'policy:no-canary-promotion no-next-cohort no-auto-promote',
        evidence: 'Promotion remains locked until monitoring evidence exists.',
      }),
    ];
  }

  private gates(input: {
    approvalLedgerReady: boolean;
    approvalLedgerSnapshot: ReturnType<CanaryExecutionApprovalLedgerService['buildSnapshot']>;
    steps: CanaryLaunchRehearsalStep[];
    receipts: CanaryLaunchRehearsalReceipt[];
  }): CanaryLaunchRehearsalGate[] {
    const required = input.steps.filter((step) => step.requiredForRehearsal);
    const ready = required.filter((step) =>
      step.status === 'linked'
      || step.status === 'rehearsal-ready'
      || step.status === 'operator-ready'
      || step.status === 'locked',
    );
    const releaseExecutionLinked = input.steps.some((step) => step.id === 'held-release-execution-gate' && step.status === 'linked');
    const signedLedgerAndLaunch = [
      'signed-ledger-path-rehearsal',
      'launch-command-shape-rehearsal',
    ].every((id) => input.steps.some((step) => step.id === id && step.status === 'rehearsal-ready'));
    const cohortFlagSmoke = [
      'prelaunch-smoke-rehearsal',
      'feature-flag-activation-rehearsal',
      'canary-cohort-routing-rehearsal',
    ].every((id) => input.steps.some((step) => step.id === id && step.status === 'rehearsal-ready'));
    const rollbackKillSwitchAudit = [
      'rollback-checkpoint-rehearsal',
      'kill-switch-rehearsal',
      'audit-sink-rehearsal',
    ].every((id) => input.steps.some((step) => step.id === id && step.status === 'rehearsal-ready'));
    const observationSupport = [
      'observability-handoff-rehearsal',
      'support-bridge-handoff-rehearsal',
    ].every((id) => input.steps.some((step) => step.id === id && step.status === 'operator-ready'));
    const launchSideEffectsBlocked = input.steps.every((step) =>
      step.signatureRecorded === false
      && step.launchAuthorized === false
      && step.canaryStarted === false
      && step.rolloutStarted === false
      && step.deployExecuted === false
      && step.mutatesRemoteState === false,
    );
    const publicationAndPromotionHeld = input.steps.every((step) =>
      step.promotionExecuted === false
      && step.publishesPackage === false,
    ) && input.approvalLedgerSnapshot.summary.npmPublishExecuted === false
      && input.approvalLedgerSnapshot.summary.githubReleaseCreated === false
      && input.approvalLedgerSnapshot.summary.gitTagMoved === false;

    return [
      gate({
        id: 'approval-ledger-ready',
        status: input.approvalLedgerReady ? 'pass' : 'fail',
        title: 'Canary execution approval ledger is ready',
        observed: input.approvalLedgerReady,
        threshold: true,
        receipt: 'canary-launch-rehearsal.approval-ledger-ready.receipt',
        nextAction: 'finish Preview engine0 before launch rehearsal',
      }),
      gate({
        id: 'held-release-execution-gate-linked',
        status: releaseExecutionLinked ? 'pass' : 'fail',
        title: 'Held release execution gate is linked',
        observed: releaseExecutionLinked,
        threshold: true,
        receipt: 'canary-launch-rehearsal.release-execution-linked.receipt',
        nextAction: 'link release execution in explicit hold mode',
      }),
      gate({
        id: 'signed-ledger-and-launch-command-rehearsed',
        status: signedLedgerAndLaunch ? 'pass' : 'fail',
        title: 'Signed-ledger path and launch command shape are rehearsed',
        observed: signedLedgerAndLaunch,
        threshold: true,
        receipt: 'canary-launch-rehearsal.signature-launch.receipt',
        nextAction: 'rehearse signed-ledger path and launch command shape without recording signature',
      }),
      gate({
        id: 'cohort-flag-smoke-rehearsed',
        status: cohortFlagSmoke ? 'pass' : 'fail',
        title: 'Cohort routing, feature flag activation, and smoke are rehearsed',
        observed: cohortFlagSmoke,
        threshold: true,
        receipt: 'canary-launch-rehearsal.cohort-flag-smoke.receipt',
        nextAction: 'rehearse dry-run smoke, flag activation, and cohort routing',
      }),
      gate({
        id: 'rollback-kill-switch-audit-rehearsed',
        status: rollbackKillSwitchAudit ? 'pass' : 'fail',
        title: 'Rollback checkpoint, kill switch, and audit sink are rehearsed',
        observed: rollbackKillSwitchAudit,
        threshold: true,
        receipt: 'canary-launch-rehearsal.rollback-kill-audit.receipt',
        nextAction: 'rehearse rollback checkpoint, kill switch, and audit sink paths',
      }),
      gate({
        id: 'observation-support-handoff-ready',
        status: observationSupport ? 'pass' : 'fail',
        title: 'Observation and support handoffs are ready',
        observed: observationSupport,
        threshold: true,
        receipt: 'canary-launch-rehearsal.observation-support.receipt',
        nextAction: 'prepare observability and support handoffs before any launch',
      }),
      gate({
        id: 'launch-side-effects-blocked',
        status: launchSideEffectsBlocked ? 'pass' : 'fail',
        title: 'Signature, launch, rollout, deploy, and remote mutation are blocked',
        observed: launchSideEffectsBlocked,
        threshold: true,
        receipt: 'canary-launch-rehearsal.side-effects-blocked.receipt',
        nextAction: 'remove signature write, launch authorization, deploy, rollout, or remote mutation from rehearsal',
      }),
      gate({
        id: 'publication-and-promotion-held',
        status: publicationAndPromotionHeld ? 'pass' : 'fail',
        title: 'Publication and promotion remain held',
        observed: publicationAndPromotionHeld,
        threshold: true,
        receipt: 'canary-launch-rehearsal.publication-promotion-held.receipt',
        nextAction: 'restore no-publish/no-release/no-tag and no-promotion guarantees',
      }),
      gate({
        id: 'rehearsal-receipts-complete',
        status: input.receipts.length === input.steps.length && ready.length === required.length ? 'pass' : 'fail',
        title: 'Every launch rehearsal step emits a receipt',
        observed: `${input.receipts.length}/${input.steps.length}`,
        threshold: `${input.steps.length}/${input.steps.length}`,
        receipt: 'canary-launch-rehearsal.receipts-complete.receipt',
        nextAction: 'repair missing launch rehearsal receipts or blocked steps',
      }),
    ];
  }

  private receipts(steps: CanaryLaunchRehearsalStep[]): CanaryLaunchRehearsalReceipt[] {
    return steps.map((step) => ({
      id: step.receipt,
      stepId: step.id,
      status: step.status,
      command: step.command,
      evidence: step.evidence,
      dryRunOnly: step.dryRunOnly,
      signatureRecorded: false,
      launchAuthorized: false,
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

function linkedStep(input: {
  id: CanaryLaunchRehearsalStep['id'];
  surface: CanaryLaunchRehearsalStep['surface'];
  command: string;
  evidence: string;
}): CanaryLaunchRehearsalStep {
  return buildStep(input, 'source-gate', 'linked', true);
}

function rehearsalStep(input: {
  id: CanaryLaunchRehearsalStep['id'];
  surface: CanaryLaunchRehearsalStep['surface'];
  command: string;
  evidence: string;
}): CanaryLaunchRehearsalStep {
  const mode: CanaryLaunchRehearsalStep['mode'] = input.surface === 'signature'
    ? 'signature-path-rehearsal'
    : input.surface === 'rollback' || input.surface === 'kill-switch'
      ? 'rollback-rehearsal'
      : input.surface === 'audit'
        ? 'observation-handoff'
        : 'launch-command-rehearsal';
  return buildStep(input, mode, 'rehearsal-ready', true);
}

function operatorStep(input: {
  id: CanaryLaunchRehearsalStep['id'];
  surface: CanaryLaunchRehearsalStep['surface'];
  command: string;
  evidence: string;
}): CanaryLaunchRehearsalStep {
  const mode: CanaryLaunchRehearsalStep['mode'] = input.surface === 'observability'
    ? 'observation-handoff'
    : 'operator-handoff';
  return buildStep(input, mode, 'operator-ready', false);
}

function lockedStep(input: {
  id: CanaryLaunchRehearsalStep['id'];
  surface: CanaryLaunchRehearsalStep['surface'];
  command: string;
  evidence: string;
}): CanaryLaunchRehearsalStep {
  return buildStep(input, 'policy-lock', 'locked', false);
}

function buildStep(
  input: {
    id: CanaryLaunchRehearsalStep['id'];
    surface: CanaryLaunchRehearsalStep['surface'];
    command: string;
    evidence: string;
  },
  mode: CanaryLaunchRehearsalStep['mode'],
  status: CanaryLaunchRehearsalStep['status'],
  dryRunOnly: boolean,
): CanaryLaunchRehearsalStep {
  return {
    ...input,
    mode,
    status,
    receipt: `canary-launch-rehearsal.${input.id}.receipt`,
    requiredForRehearsal: true,
    dryRunOnly,
    signatureRecorded: false,
    launchAuthorized: false,
    canaryStarted: false,
    rolloutStarted: false,
    deployExecuted: false,
    promotionExecuted: false,
    publishesPackage: false,
    mutatesRemoteState: false,
    secretValuesSerialized: false,
  };
}

function gate(input: CanaryLaunchRehearsalGate): CanaryLaunchRehearsalGate {
  return input;
}
