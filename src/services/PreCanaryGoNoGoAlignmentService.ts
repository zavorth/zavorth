import type {
  PreCanaryGoNoGoAlignmentControl,
  PreCanaryGoNoGoAlignmentGate,
  PreCanaryGoNoGoAlignmentReceipt,
  PreCanaryGoNoGoAlignmentSnapshot,
  PreCanaryGoNoGoAlignmentStatus,
} from '../contracts/PreCanaryGoNoGoAlignmentContract.js';
import { ZAVORTH_PRE_CANARY_GO_NO_GO_ALIGNMENT_CONTRACT_VERSION } from '../contracts/PreCanaryGoNoGoAlignmentContract.js';

import { ReleaseCandidateDistributionRehearsalService } from './ReleaseCandidateDistributionRehearsalService.js';

type PreCanaryGoNoGoAlignmentRuntime = {
  now?: () => Date;
  releaseCandidateDistributionRehearsalService?: ReleaseCandidateDistributionRehearsalService;
};

export class PreCanaryGoNoGoAlignmentService {
  private readonly now: () => Date;
  private readonly distribution: ReleaseCandidateDistributionRehearsalService;

  constructor(runtime: PreCanaryGoNoGoAlignmentRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.distribution = runtime.releaseCandidateDistributionRehearsalService
      || new ReleaseCandidateDistributionRehearsalService({ now: this.now });
  }

  public buildSnapshot(): PreCanaryGoNoGoAlignmentSnapshot {
    const distributionSnapshot = this.distribution.buildSnapshot();
    const controls = this.controls(distributionSnapshot.releaseCandidate.id);
    const receipts = this.receipts(controls);
    const gates = this.gates({
      distributionReady: distributionSnapshot.summary.rehearsalReady,
      distributionSnapshot,
      controls,
      receipts,
    });
    const failedGates = gates.filter((gate) => gate.status === 'fail').length;
    const blockedControls = controls.filter((control) => control.status === 'blocked').length;
    const status: PreCanaryGoNoGoAlignmentStatus = distributionSnapshot.status === 'blocked' || failedGates > 0 || blockedControls > 0
      ? 'blocked'
      : controls.some((control) => control.status === 'operator-ready')
        ? 'aligned'
        : 'attention';

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_PRE_CANARY_GO_NO_GO_ALIGNMENT_CONTRACT_VERSION,
      status,
      releaseCandidate: {
        id: distributionSnapshot.releaseCandidate.id,
        packageName: distributionSnapshot.releaseCandidate.packageName,
        packageVersion: distributionSnapshot.releaseCandidate.packageVersion,
        channel: 'release-candidate',
        npmDistTag: 'rc',
        preCanaryAlignmentOnly: true,
      },
      decision: {
        state: status === 'blocked' ? 'blocked' : 'ready-for-decision',
        effectiveDecision: 'hold',
        approvalRecorded: false,
        goDecisionRecorded: false,
        noGoDecisionRecorded: false,
        approvalReceiptId: null,
        approverId: null,
        rollbackOwner: null,
        incidentOwner: null,
        requiredFields: [
          'decision',
          'approverId',
          'approvalReceiptId',
          'rollbackOwner',
          'incidentOwner',
        ],
      },
      summary: {
        controls: controls.length,
        requiredControls: controls.filter((control) => control.requiredForAlignment).length,
        alignedControls: controls.filter((control) => control.status === 'aligned').length,
        operatorReadyControls: controls.filter((control) => control.status === 'operator-ready').length,
        lockedControls: controls.filter((control) => control.status === 'locked').length,
        blockedControls,
        gates: gates.length,
        passedGates: gates.filter((gate) => gate.status === 'pass').length,
        failedGates,
        receipts: receipts.length,
        distributionRehearsalStatus: distributionSnapshot.status,
        distributionRehearsed: distributionSnapshot.summary.rehearsalReady,
        preCanaryRuntimeGateLinked: controls.some((control) => control.id === 'release-candidate-pre-canary-gate-link' && control.status === 'aligned'),
        releaseAdoptionGateLinked: controls.some((control) => control.id === 'release-adoption-readiness-link' && control.status === 'aligned'),
        publicAdoptionGateLinked: controls.some((control) => control.id === 'public-adoption-pilot-link' && control.status === 'aligned'),
        rollbackPreviewLinked: controls.some((control) => control.id === 'rollback-command-confirmation' && control.status === 'aligned'),
        alignmentReady: status === 'aligned' && distributionSnapshot.summary.rehearsalReady,
        canaryStartAuthorized: false,
        canaryStarted: false,
        rolloutStarted: false,
        deployExecuted: false,
        remoteStateMutated: false,
        npmPublishExecuted: false,
        githubReleaseCreated: false,
        gitTagMoved: false,
        secretValuesSerialized: false,
      },
      distributionRehearsal: {
        contractVersion: distributionSnapshot.contractVersion,
        status: distributionSnapshot.status,
        releaseCandidate: distributionSnapshot.releaseCandidate,
        summary: distributionSnapshot.summary,
        commands: distributionSnapshot.commands,
      },
      controls,
      gates,
      receipts,
      commands: {
        run: 'npm run pre-canary-go-no-go-alignment --silent',
        runJson: 'npm run pre-canary-go-no-go-alignment:json --silent',
        check: 'npm run pre-canary-go-no-go-alignment:check --silent',
        requireAligned: 'npm run pre-canary-go-no-go-alignment --silent -- --require-aligned',
        distributionRehearsal: 'npm run release-candidate-distribution-rehearsal --silent -- --require-rehearsed',
        releaseAdoptionReadiness: 'npm run release-adoption-readiness:check --silent',
        releaseCandidatePreCanary: 'npm run release-candidate-pre-canary:check --silent',
        publicAdoptionPilot: 'npm run public-adoption-pilot-loop:check --silent',
        rollbackPreview: 'npm run release:rollback-preview',
        focusedTests: [
          'npx jest tests/services/PreCanaryGoNoGoAlignmentService.test.ts --runInBand',
          'npm run pre-canary-go-no-go-alignment:check --silent',
          'npm run pre-canary-go-no-go-alignment --silent -- --require-aligned',
        ],
        typecheck: 'npm run runtime:check --silent',
        nextStage: 'Canary plan dry-run and hold',
      },
      policy: {
        alignmentOnly: true,
        consumesDistributionRehearsal: true,
        noCanaryStarted: true,
        noRolloutStarted: true,
        noDeployExecuted: true,
        noNpmPublish: true,
        noGithubReleaseCreated: true,
        noGitTagMoved: true,
        noStableTagMoved: true,
        noLatestTagMoved: true,
        noAutomaticPromotion: true,
        explicitApprovalRequired: true,
        approverRequired: true,
        rollbackOwnerRequired: true,
        incidentOwnerRequired: true,
        noRemoteMutationByDefault: true,
        noNetworkRequiredByDefault: true,
        secretsSerialized: false,
      },
    };
  }

  public formatAlignmentText(snapshot: PreCanaryGoNoGoAlignmentSnapshot = this.buildSnapshot()): string {
    return [
      'Zavorth Pre-Canary Go/No-Go Alignment',
      `Status: ${snapshot.status}`,
      `Release candidate: ${snapshot.releaseCandidate.id}`,
      `Decision state: ${snapshot.decision.state}`,
      `Effective decision: ${snapshot.decision.effectiveDecision}`,
      `Controls: ${snapshot.summary.alignedControls} aligned, ${snapshot.summary.operatorReadyControls} operator-ready, ${snapshot.summary.lockedControls} locked, ${snapshot.summary.blockedControls} blocked`,
      `Gates: ${snapshot.summary.passedGates}/${snapshot.summary.gates} pass`,
      `Receipts: ${snapshot.summary.receipts}`,
      `Distribution rehearsed: ${snapshot.summary.distributionRehearsed}`,
      `Alignment ready: ${snapshot.summary.alignmentReady}`,
      `Canary start authorized: ${snapshot.summary.canaryStartAuthorized}`,
      `Remote state mutated: ${snapshot.summary.remoteStateMutated}`,
      '',
      'Alignment controls:',
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

  private controls(releaseCandidateId: string): PreCanaryGoNoGoAlignmentControl[] {
    return [
      alignedControl({
        id: 'distribution-rehearsal-input',
        surface: 'release-candidate',
        command: 'npm run release-candidate-distribution-rehearsal --silent -- --require-rehearsed',
        evidence: `${releaseCandidateId} distribution rehearsal is the input to pre-canary alignment.`,
      }),
      alignedControl({
        id: 'release-adoption-readiness-link',
        surface: 'release-adoption',
        command: 'npm run release-adoption-readiness:check --silent',
        evidence: 'Release/adoption readiness gate is linked before any pre-canary decision.',
      }),
      alignedControl({
        id: 'release-candidate-pre-canary-gate-link',
        surface: 'pre-canary',
        command: 'npm run release-candidate-pre-canary:check --silent',
        evidence: 'Existing runtime pre-canary gate is linked as a governance input.',
      }),
      alignedControl({
        id: 'public-adoption-pilot-link',
        surface: 'public-adoption',
        command: 'npm run public-adoption-pilot-loop:check --silent',
        evidence: 'Public adoption pilot loop is linked without enabling implicit collection.',
      }),
      alignedControl({
        id: 'rollback-command-confirmation',
        surface: 'rollback',
        command: 'npm run release:rollback-preview',
        evidence: 'Rollback preview command is identified before a go/no-go decision can be recorded.',
      }),
      operatorControl({
        id: 'approver-role-assignment',
        surface: 'approval',
        command: 'manual:assign-release-approver --required',
        evidence: 'A human approver role is required, but no approval is recorded by this phase.',
      }),
      operatorControl({
        id: 'rollback-owner-assignment',
        surface: 'rollback',
        command: 'manual:assign-rollback-owner --required',
        evidence: 'A rollback owner role is required before a go decision can be entered.',
      }),
      operatorControl({
        id: 'incident-owner-assignment',
        surface: 'incident',
        command: 'manual:assign-incident-owner --required',
        evidence: 'An incident owner role is required before a go decision can be entered.',
      }),
      operatorControl({
        id: 'decision-ledger-template',
        surface: 'approval',
        command: 'manual:create-pre-canary-decision-ledger --decision go|no-go',
        evidence: 'Decision ledger schema is ready; the effective decision remains hold until approval is recorded.',
      }),
      lockedControl({
        id: 'canary-start-lock',
        surface: 'policy',
        command: 'policy:no-canary-start no-rollout-start no-deploy-execution',
        evidence: 'Pre-canary alignment cannot start canary, rollout, or deploy.',
      }),
      lockedControl({
        id: 'auto-promote-lock',
        surface: 'policy',
        command: 'policy:no-auto-promote no-latest-tag no-stable-tag',
        evidence: 'Automatic promotion, latest tag movement, and stable tag movement stay disabled.',
      }),
      lockedControl({
        id: 'remote-mutation-lock',
        surface: 'policy',
        command: 'policy:no-remote-mutation no-npm-publish no-github-release',
        evidence: 'No npm publish, GitHub release, or remote mutation is allowed by this alignment.',
      }),
    ];
  }

  private gates(input: {
    distributionReady: boolean;
    distributionSnapshot: ReturnType<ReleaseCandidateDistributionRehearsalService['buildSnapshot']>;
    controls: PreCanaryGoNoGoAlignmentControl[];
    receipts: PreCanaryGoNoGoAlignmentReceipt[];
  }): PreCanaryGoNoGoAlignmentGate[] {
    const required = input.controls.filter((control) => control.requiredForAlignment);
    const ready = required.filter((control) =>
      control.status === 'aligned' || control.status === 'operator-ready' || control.status === 'locked',
    );
    const preCanaryLinks = [
      'release-adoption-readiness-link',
      'release-candidate-pre-canary-gate-link',
      'public-adoption-pilot-link',
    ].every((id) => input.controls.some((control) => control.id === id && control.status === 'aligned'));
    const ownerControls = [
      'approver-role-assignment',
      'rollback-owner-assignment',
      'incident-owner-assignment',
      'decision-ledger-template',
    ].every((id) => input.controls.some((control) => control.id === id && control.status === 'operator-ready'));
    const rollbackIncidentCovered = [
      'rollback-command-confirmation',
      'rollback-owner-assignment',
      'incident-owner-assignment',
    ].every((id) => input.controls.some((control) => control.id === id && control.status !== 'blocked'));
    const noCanarySideEffects = input.controls.every((control) =>
      control.canaryStarted === false
      && control.rolloutStarted === false
      && control.deployExecuted === false
      && control.mutatesRemoteState === false,
    );
    const noPublicationRegression = Boolean(
      input.distributionSnapshot.summary.npmPublishExecuted === false
      && input.distributionSnapshot.summary.githubReleaseCreated === false
      && input.distributionSnapshot.summary.gitTagMoved === false
      && input.distributionSnapshot.summary.remoteStateMutated === false,
    );

    return [
      gate({
        id: 'distribution-rehearsal-ready',
        status: input.distributionReady ? 'pass' : 'fail',
        title: 'Distribution rehearsal is ready for pre-canary alignment',
        observed: input.distributionReady,
        threshold: true,
        receipt: 'pre-canary-go-no-go.distribution-rehearsal-ready.receipt',
        nextAction: 'finish Intent model7 distribution rehearsal before go/no-go alignment',
      }),
      gate({
        id: 'pre-canary-runtime-gates-linked',
        status: preCanaryLinks ? 'pass' : 'fail',
        title: 'Pre-canary runtime gates are linked',
        observed: preCanaryLinks,
        threshold: true,
        receipt: 'pre-canary-go-no-go.runtime-gates-linked.receipt',
        nextAction: 'link release adoption, runtime pre-canary, and public adoption pilot gates',
      }),
      gate({
        id: 'go-no-go-decision-ledger-ready',
        status: ownerControls ? 'pass' : 'fail',
        title: 'Go/no-go ledger and required roles are ready',
        observed: ownerControls,
        threshold: true,
        receipt: 'pre-canary-go-no-go.decision-ledger-ready.receipt',
        nextAction: 'prepare approver, rollback owner, incident owner, and decision ledger',
      }),
      gate({
        id: 'rollback-incident-ownership-covered',
        status: rollbackIncidentCovered ? 'pass' : 'fail',
        title: 'Rollback and incident ownership are covered',
        observed: rollbackIncidentCovered,
        threshold: true,
        receipt: 'pre-canary-go-no-go.rollback-incident-covered.receipt',
        nextAction: 'connect rollback preview, rollback owner, and incident owner before any go decision',
      }),
      gate({
        id: 'canary-side-effects-blocked',
        status: noCanarySideEffects ? 'pass' : 'fail',
        title: 'Canary, rollout, deploy, and remote mutation side effects are blocked',
        observed: noCanarySideEffects,
        threshold: true,
        receipt: 'pre-canary-go-no-go.side-effects-blocked.receipt',
        nextAction: 'remove canary, rollout, deploy, or remote mutation from alignment',
      }),
      gate({
        id: 'no-publication-regression',
        status: noPublicationRegression ? 'pass' : 'fail',
        title: 'Distribution rehearsal no-publication policy still holds',
        observed: noPublicationRegression,
        threshold: true,
        receipt: 'pre-canary-go-no-go.no-publication-regression.receipt',
        nextAction: 'restore no-publish/no-release/no-tag guarantees before alignment',
      }),
      gate({
        id: 'alignment-receipts-complete',
        status: input.receipts.length === input.controls.length && ready.length === required.length ? 'pass' : 'fail',
        title: 'Every pre-canary alignment control emits a receipt',
        observed: `${input.receipts.length}/${input.controls.length}`,
        threshold: `${input.controls.length}/${input.controls.length}`,
        receipt: 'pre-canary-go-no-go.receipts-complete.receipt',
        nextAction: 'repair missing alignment receipts or blocked controls',
      }),
    ];
  }

  private receipts(controls: PreCanaryGoNoGoAlignmentControl[]): PreCanaryGoNoGoAlignmentReceipt[] {
    return controls.map((control) => ({
      id: control.receipt,
      controlId: control.id,
      status: control.status,
      command: control.command,
      evidence: control.evidence,
      noCanaryStarted: true,
      noRolloutStarted: true,
      noDeployExecuted: true,
      noPackagePublished: true,
      noRemoteMutation: true,
      secretValuesSerialized: false,
    }));
  }
}

function alignedControl(input: {
  id: PreCanaryGoNoGoAlignmentControl['id'];
  surface: PreCanaryGoNoGoAlignmentControl['surface'];
  command: string;
  evidence: string;
}): PreCanaryGoNoGoAlignmentControl {
  return buildControl(input, 'evidence-gate', 'aligned', false);
}

function operatorControl(input: {
  id: PreCanaryGoNoGoAlignmentControl['id'];
  surface: PreCanaryGoNoGoAlignmentControl['surface'];
  command: string;
  evidence: string;
}): PreCanaryGoNoGoAlignmentControl {
  return buildControl(input, input.id === 'decision-ledger-template' ? 'decision-ledger' : 'owner-assignment', 'operator-ready', true);
}

function lockedControl(input: {
  id: PreCanaryGoNoGoAlignmentControl['id'];
  surface: PreCanaryGoNoGoAlignmentControl['surface'];
  command: string;
  evidence: string;
}): PreCanaryGoNoGoAlignmentControl {
  return buildControl(input, 'policy-lock', 'locked', false);
}

function buildControl(
  input: {
    id: PreCanaryGoNoGoAlignmentControl['id'];
    surface: PreCanaryGoNoGoAlignmentControl['surface'];
    command: string;
    evidence: string;
  },
  mode: PreCanaryGoNoGoAlignmentControl['mode'],
  status: PreCanaryGoNoGoAlignmentControl['status'],
  requiresHumanDecision: boolean,
): PreCanaryGoNoGoAlignmentControl {
  return {
    ...input,
    mode,
    status,
    receipt: `pre-canary-go-no-go.${input.id}.receipt`,
    requiredForAlignment: true,
    requiresHumanDecision,
    canaryStarted: false,
    rolloutStarted: false,
    deployExecuted: false,
    publishesPackage: false,
    mutatesRemoteState: false,
    secretValuesSerialized: false,
  };
}

function gate(input: PreCanaryGoNoGoAlignmentGate): PreCanaryGoNoGoAlignmentGate {
  return input;
}
