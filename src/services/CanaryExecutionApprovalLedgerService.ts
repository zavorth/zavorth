import type {
  CanaryExecutionApprovalLedgerEntry,
  CanaryExecutionApprovalLedgerGate,
  CanaryExecutionApprovalLedgerReceipt,
  CanaryExecutionApprovalLedgerSnapshot,
  CanaryExecutionApprovalLedgerStatus,
} from '../contracts/CanaryExecutionApprovalLedgerContract.js';
import { ZAVORTH_CANARY_EXECUTION_APPROVAL_LEDGER_CONTRACT_VERSION } from '../contracts/CanaryExecutionApprovalLedgerContract.js';

import { CanaryPlanDryRunHoldService } from './CanaryPlanDryRunHoldService.js';

type CanaryExecutionApprovalLedgerRuntime = {
  now?: () => Date;
  canaryPlanDryRunHoldService?: CanaryPlanDryRunHoldService;
};

export class CanaryExecutionApprovalLedgerService {
  private readonly now: () => Date;
  private readonly canaryPlan: CanaryPlanDryRunHoldService;

  constructor(runtime: CanaryExecutionApprovalLedgerRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.canaryPlan = runtime.canaryPlanDryRunHoldService
      || new CanaryPlanDryRunHoldService({ now: this.now });
  }

  public buildSnapshot(): CanaryExecutionApprovalLedgerSnapshot {
    const canaryPlanSnapshot = this.canaryPlan.buildSnapshot();
    const entries = this.entries(canaryPlanSnapshot.releaseCandidate.id);
    const receipts = this.receipts(entries);
    const gates = this.gates({
      canaryPlanReady: canaryPlanSnapshot.summary.canaryPlanDryRunReady,
      canaryPlanSnapshot,
      entries,
      receipts,
    });
    const failedGates = gates.filter((gate) => gate.status === 'fail').length;
    const blockedEntries = entries.filter((entry) => entry.status === 'blocked').length;
    const status: CanaryExecutionApprovalLedgerStatus = canaryPlanSnapshot.status === 'blocked' || failedGates > 0 || blockedEntries > 0
      ? 'blocked'
      : entries.some((entry) => entry.status === 'approval-ready') ? 'ledger-ready'
        : 'attention';

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_CANARY_EXECUTION_APPROVAL_LEDGER_CONTRACT_VERSION,
      status,
      releaseCandidate: {
        id: canaryPlanSnapshot.releaseCandidate.id,
        packageName: canaryPlanSnapshot.releaseCandidate.packageName,
        packageVersion: canaryPlanSnapshot.releaseCandidate.packageVersion,
        channel: 'release-candidate',
        npmDistTag: 'rc',
        approvalLedgerOnly: true,
      },
      ledger: {
        state: status === 'blocked' ? 'blocked' : 'ready-for-signature',
        effectiveDecision: 'hold',
        readyForSignature: status === 'ledger-ready',
        signed: false,
        launchAuthorized: false,
        executionApproved: false,
        approvalReceiptId: null,
        requiredSignatures: [
          'releaseApprover',
          'manualOperator',
          'rollbackOwner',
          'incidentCommander',
          'auditOwner',
        ],
        requiredArtifacts: [
          'approvalReceipt',
          'rollbackCheckpoint',
          'auditSink',
          'supportBridge',
          'observabilityZavorthControl',
        ],
        ledgerId: 'canary-execution-approval-ledger',
        canaryCohortId: canaryPlanSnapshot.plan.canaryCohortId,
        featureFlagKey: canaryPlanSnapshot.plan.featureFlagKey,
        observationWindowHours: canaryPlanSnapshot.plan.observationWindowHours,
      },
      summary: {
        entries: entries.length,
        requiredEntries: entries.filter((entry) => entry.requiredForLedger).length,
        linkedEntries: entries.filter((entry) => entry.status === 'linked').length,
        approvalReadyEntries: entries.filter((entry) => entry.status === 'approval-ready').length,
        operatorReadyEntries: entries.filter((entry) => entry.status === 'operator-ready').length,
        lockedEntries: entries.filter((entry) => entry.status === 'locked').length,
        blockedEntries,
        gates: gates.length,
        passedGates: gates.filter((gate) => gate.status === 'pass').length,
        failedGates,
        receipts: receipts.length,
        canaryPlanStatus: canaryPlanSnapshot.status,
        canaryPlanDryRunReady: canaryPlanSnapshot.summary.canaryPlanDryRunReady,
        releaseExecutionGateLinked: entries.some((entry) => entry.id === 'release-execution-gate-hold' && entry.status === 'linked'),
        requiredSignatureSlotsReady: this.requiredSignatureSlotsReady(entries),
        rollbackCheckpointReady: entries.some((entry) => entry.id === 'rollback-checkpoint-template' && entry.status === 'approval-ready'),
        auditSinkReady: entries.some((entry) => entry.id === 'audit-sink-template' && entry.status === 'approval-ready'),
        supportBridgeReady: entries.some((entry) => entry.id === 'support-bridge-template' && entry.status === 'approval-ready'),
        observabilityZavorthControlReady: entries.some((entry) => entry.id === 'observability-zavorthControl-template' && entry.status === 'approval-ready'),
        approvalLedgerReady: status === 'ledger-ready' && canaryPlanSnapshot.summary.canaryPlanDryRunReady,
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
      canaryPlan: {
        contractVersion: canaryPlanSnapshot.contractVersion,
        status: canaryPlanSnapshot.status,
        releaseCandidate: canaryPlanSnapshot.releaseCandidate,
        plan: canaryPlanSnapshot.plan,
        summary: canaryPlanSnapshot.summary,
        commands: canaryPlanSnapshot.commands,
      },
      entries,
      gates,
      receipts,
      commands: {
        run: 'npm run canary-execution-approval-ledger --silent',
        runJson: 'npm run canary-execution-approval-ledger:json --silent',
        check: 'npm run canary-execution-approval-ledger:check --silent',
        requireLedgerReady: 'npm run canary-execution-approval-ledger --silent -- --require-ledger-ready',
        canaryPlanDryRun: 'npm run canary-plan-dry-run-hold --silent -- --require-dry-run-ready',
        releaseExecutionGate: 'npm run capability-autopilot:release-execution --silent -- --no-execution-approval --no-tag-approval --no-publish-approval --no-canary-launch-approval',
        approvalLedgerSign: 'manual:sign-canary-execution-approval-ledger --requires-release-approver-manual-operator-rollback-owner-incident-commander-audit-owner',
        launchHold: 'policy:hold-canary-launch --until-signed-ledger-and-launch-rehearsal',
        focusedTests: [
          'npx jest tests/services/CanaryExecutionApprovalLedgerService.test.ts --runInBand',
          'npm run canary-execution-approval-ledger:check --silent',
          'npm run canary-execution-approval-ledger --silent -- --require-ledger-ready',
        ],
        typecheck: 'npm run runtime:check --silent',
        nextAction: 'Canary launch rehearsal',
      },
      policy: {
        approvalLedgerOnly: true,
        consumesCanaryPlanDryRun: true,
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
        explicitSignatureRequired: true,
        rollbackCheckpointRequired: true,
        auditSinkRequired: true,
        supportBridgeRequired: true,
        observabilityZavorthControlRequired: true,
        noRemoteMutationByDefault: true,
        noNetworkRequiredByDefault: true,
        secretsSerialized: false,
      },
    };
  }

  public formatLedgerText(snapshot: CanaryExecutionApprovalLedgerSnapshot = this.buildSnapshot()): string {
    return [
      'Zavorth Canary Execution Approval Ledger',
      `Status: ${snapshot.status}`,
      `Release candidate: ${snapshot.releaseCandidate.id}`,
      `Ledger state: ${snapshot.ledger.state}`,
      `Effective decision: ${snapshot.ledger.effectiveDecision}`,
      `Ready for signature: ${snapshot.ledger.readyForSignature}`,
      `Signed: ${snapshot.ledger.signed}`,
      `Launch authorized: ${snapshot.ledger.launchAuthorized}`,
      `Entries: ${snapshot.summary.linkedEntries} linked, ${snapshot.summary.approvalReadyEntries} approval-ready, ${snapshot.summary.operatorReadyEntries} operator-ready, ${snapshot.summary.lockedEntries} locked, ${snapshot.summary.blockedEntries} blocked`,
      `Gates: ${snapshot.summary.passedGates}/${snapshot.summary.gates} pass`,
      `Receipts: ${snapshot.summary.receipts}`,
      `Canary plan dry-run ready: ${snapshot.summary.canaryPlanDryRunReady}`,
      `Approval ledger ready: ${snapshot.summary.approvalLedgerReady}`,
      `Signature recorded: ${snapshot.summary.signatureRecorded}`,
      `Canary started: ${snapshot.summary.canaryStarted}`,
      `Remote state mutated: ${snapshot.summary.remoteStateMutated}`,
      '',
      'Approval ledger entries:',
      ...snapshot.entries.map((entry) =>
        `- ${entry.status.toUpperCase()} ${entry.id}: ${entry.command}`,
      ),
      '',
      'Gate results:',
      ...snapshot.gates.map((gate) =>
        `- ${gate.status.toUpperCase()} ${gate.id}: ${gate.observed} / ${gate.threshold} - ${gate.nextAction}`,
      ),
      '',
      `Next: ${snapshot.commands.nextAction}`,
    ].join('\n');
  }

  private entries(releaseCandidateId: string): CanaryExecutionApprovalLedgerEntry[] {
    return [
      linkedEntry({
        id: 'canary-plan-dry-run-input',
        surface: 'canary-plan',
        command: 'npm run canary-plan-dry-run-hold --silent -- --require-dry-run-ready',
        evidence: `${releaseCandidateId} canary dry-run plan is the input to the execution approval ledger.`,
      }),
      linkedEntry({
        id: 'release-execution-gate-hold',
        surface: 'release-execution',
        command: 'npm run capability-autopilot:release-execution --silent -- --no-execution-approval --no-tag-approval --no-publish-approval --no-canary-launch-approval',
        evidence: 'Release execution gate is linked as evidence, but no execution approval is recorded by default.',
      }),
      approvalEntry({
        id: 'release-approver-slot',
        surface: 'approval',
        command: 'manual:assign-release-approver-signature-slot --required',
        evidence: 'Release approver signature slot is prepared without recording a signature.',
      }),
      operatorEntry({
        id: 'manual-operator-slot',
        surface: 'operator',
        command: 'manual:assign-manual-operator --required',
        evidence: 'Manual operator slot is prepared for a future signed execution handoff.',
      }),
      operatorEntry({
        id: 'rollback-owner-slot',
        surface: 'rollback',
        command: 'manual:assign-rollback-owner --required',
        evidence: 'Rollback owner slot is prepared for future launch approval.',
      }),
      operatorEntry({
        id: 'incident-commander-slot',
        surface: 'support',
        command: 'manual:assign-incident-commander --required',
        evidence: 'Incident commander slot is prepared for launch readiness.',
      }),
      approvalEntry({
        id: 'approval-receipt-template',
        surface: 'approval',
        command: 'manual:prepare-approval-receipt-template --no-signature',
        evidence: 'Approval receipt schema is ready; signature remains absent.',
      }),
      approvalEntry({
        id: 'rollback-checkpoint-template',
        surface: 'rollback',
        command: 'manual:prepare-rollback-checkpoint-template --no-execution',
        evidence: 'Rollback checkpoint schema is ready before any canary launch.',
      }),
      approvalEntry({
        id: 'audit-sink-template',
        surface: 'audit',
        command: 'manual:prepare-audit-sink-template --no-upload',
        evidence: 'Audit sink schema is ready without external upload.',
      }),
      approvalEntry({
        id: 'support-bridge-template',
        surface: 'support',
        command: 'manual:prepare-support-bridge-template --no-notify',
        evidence: 'Support bridge template is ready without notifying live channels.',
      }),
      approvalEntry({
        id: 'observability-zavorthControl-template',
        surface: 'observability',
        command: 'manual:prepare-observability-zavorthControl-template --no-live-attach',
        evidence: 'Observability zavorthControl template is ready without attaching live telemetry.',
      }),
      lockedEntry({
        id: 'execution-launch-hold',
        surface: 'policy',
        command: 'policy:no-canary-launch no-release-execution no-deploy',
        evidence: 'Execution and launch remain held until a signed ledger and launch rehearsal exist.',
      }),
      lockedEntry({
        id: 'publication-hold',
        surface: 'publication',
        command: 'policy:no-npm-publish no-github-release no-git-tag',
        evidence: 'Publication and tag movement remain held by policy.',
      }),
      lockedEntry({
        id: 'promotion-hold',
        surface: 'promotion',
        command: 'policy:no-canary-promotion no-next-cohort no-auto-promote',
        evidence: 'Canary promotion remains held until monitoring evidence exists.',
      }),
    ];
  }

  private gates(input: {
    canaryPlanReady: boolean;
    canaryPlanSnapshot: ReturnType<CanaryPlanDryRunHoldService['buildSnapshot']>;
    entries: CanaryExecutionApprovalLedgerEntry[];
    receipts: CanaryExecutionApprovalLedgerReceipt[];
  }): CanaryExecutionApprovalLedgerGate[] {
    const required = input.entries.filter((entry) => entry.requiredForLedger);
    const ready = required.filter((entry) =>
      entry.status === 'linked'
      || entry.status === 'approval-ready'
      || entry.status === 'operator-ready'
      || entry.status === 'locked',
    );
    const releaseExecutionLinked = input.entries.some((entry) => entry.id === 'release-execution-gate-hold' && entry.status === 'linked');
    const signatureSlotsReady = this.requiredSignatureSlotsReady(input.entries);
    const rollbackAndAuditReady = [
      'rollback-checkpoint-template',
      'audit-sink-template',
    ].every((id) => input.entries.some((entry) => entry.id === id && entry.status === 'approval-ready'));
    const supportObservabilityReady = [
      'support-bridge-template',
      'observability-zavorthControl-template',
    ].every((id) => input.entries.some((entry) => entry.id === id && entry.status === 'approval-ready'));
    const launchSideEffectsBlocked = input.entries.every((entry) =>
      entry.launchAuthorized === false
      && entry.canaryStarted === false
      && entry.rolloutStarted === false
      && entry.deployExecuted === false
      && entry.mutatesRemoteState === false,
    );
    const publicationAndPromotionHeld = input.entries.every((entry) =>
      entry.promotionExecuted === false
      && entry.publishesPackage === false,
    ) && input.canaryPlanSnapshot.summary.npmPublishExecuted === false
      && input.canaryPlanSnapshot.summary.githubReleaseCreated === false
      && input.canaryPlanSnapshot.summary.gitTagMoved === false;

    return [
      gate({
        id: 'canary-plan-dry-run-ready',
        status: input.canaryPlanReady ? 'pass' : 'fail',
        title: 'Canary dry-run plan is ready for approval ledger',
        observed: input.canaryPlanReady,
        threshold: true,
        receipt: 'canary-execution-approval.canary-plan-ready.receipt',
        nextAction: 'finish Intent model9 before preparing execution approval ledger',
      }),
      gate({
        id: 'release-execution-gate-linked',
        status: releaseExecutionLinked ? 'pass' : 'fail',
        title: 'Release execution gate is linked but held',
        observed: releaseExecutionLinked,
        threshold: true,
        receipt: 'canary-execution-approval.release-execution-linked.receipt',
        nextAction: 'link release execution gate as evidence while keeping execution held',
      }),
      gate({
        id: 'required-signature-slots-ready',
        status: signatureSlotsReady ? 'pass' : 'fail',
        title: 'Required signature slots are ready',
        observed: signatureSlotsReady,
        threshold: true,
        receipt: 'canary-execution-approval.signature-slots-ready.receipt',
        nextAction: 'prepare release approver, manual operator, rollback owner, incident commander, and audit owner slots',
      }),
      gate({
        id: 'rollback-and-audit-ledgers-ready',
        status: rollbackAndAuditReady ? 'pass' : 'fail',
        title: 'Rollback checkpoint and audit sink ledgers are ready',
        observed: rollbackAndAuditReady,
        threshold: true,
        receipt: 'canary-execution-approval.rollback-audit-ready.receipt',
        nextAction: 'prepare rollback checkpoint and audit sink templates',
      }),
      gate({
        id: 'support-observability-ledgers-ready',
        status: supportObservabilityReady ? 'pass' : 'fail',
        title: 'Support bridge and observability ledger templates are ready',
        observed: supportObservabilityReady,
        threshold: true,
        receipt: 'canary-execution-approval.support-observability-ready.receipt',
        nextAction: 'prepare support bridge and observability zavorthControl templates',
      }),
      gate({
        id: 'launch-side-effects-blocked',
        status: launchSideEffectsBlocked ? 'pass' : 'fail',
        title: 'Launch, rollout, deploy, and remote mutation are blocked',
        observed: launchSideEffectsBlocked,
        threshold: true,
        receipt: 'canary-execution-approval.launch-side-effects-blocked.receipt',
        nextAction: 'remove launch, rollout, deploy, or remote mutation from approval ledger',
      }),
      gate({
        id: 'publication-and-promotion-held',
        status: publicationAndPromotionHeld ? 'pass' : 'fail',
        title: 'Publication and promotion remain held',
        observed: publicationAndPromotionHeld,
        threshold: true,
        receipt: 'canary-execution-approval.publication-promotion-held.receipt',
        nextAction: 'restore no-publish/no-release/no-tag and no-promotion guarantees',
      }),
      gate({
        id: 'ledger-receipts-complete',
        status: input.receipts.length === input.entries.length && ready.length === required.length ? 'pass' : 'fail',
        title: 'Every approval ledger entry emits a receipt',
        observed: `${input.receipts.length}/${input.entries.length}`,
        threshold: `${input.entries.length}/${input.entries.length}`,
        receipt: 'canary-execution-approval.receipts-complete.receipt',
        nextAction: 'repair missing approval ledger receipts or blocked entries',
      }),
    ];
  }

  private requiredSignatureSlotsReady(entries: CanaryExecutionApprovalLedgerEntry[]): boolean {
    return [
      'release-approver-slot',
      'manual-operator-slot',
      'rollback-owner-slot',
      'incident-commander-slot',
      'audit-sink-template',
    ].every((id) => entries.some((entry) =>
      entry.id === id
      && (entry.status === 'approval-ready' || entry.status === 'operator-ready'),
    ));
  }

  private receipts(entries: CanaryExecutionApprovalLedgerEntry[]): CanaryExecutionApprovalLedgerReceipt[] {
    return entries.map((entry) => ({
      id: entry.receipt,
      entryId: entry.id,
      status: entry.status,
      command: entry.command,
      evidence: entry.evidence,
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

function linkedEntry(input: {
  id: CanaryExecutionApprovalLedgerEntry['id'];
  surface: CanaryExecutionApprovalLedgerEntry['surface'];
  command: string;
  evidence: string;
}): CanaryExecutionApprovalLedgerEntry {
  return buildEntry(input, 'source-gate', 'linked', false);
}

function approvalEntry(input: {
  id: CanaryExecutionApprovalLedgerEntry['id'];
  surface: CanaryExecutionApprovalLedgerEntry['surface'];
  command: string;
  evidence: string;
}): CanaryExecutionApprovalLedgerEntry {
  const mode: CanaryExecutionApprovalLedgerEntry['mode'] = input.surface === 'rollback'
    ? 'checkpoint-ledger'
    : input.surface === 'audit' || input.surface === 'observability'
      ? 'audit-ledger'
      : 'approval-ledger';
  return buildEntry(input, mode, 'approval-ready', true);
}

function operatorEntry(input: {
  id: CanaryExecutionApprovalLedgerEntry['id'];
  surface: CanaryExecutionApprovalLedgerEntry['surface'];
  command: string;
  evidence: string;
}): CanaryExecutionApprovalLedgerEntry {
  return buildEntry(input, 'operator-assignment', 'operator-ready', true);
}

function lockedEntry(input: {
  id: CanaryExecutionApprovalLedgerEntry['id'];
  surface: CanaryExecutionApprovalLedgerEntry['surface'];
  command: string;
  evidence: string;
}): CanaryExecutionApprovalLedgerEntry {
  return buildEntry(input, 'policy-lock', 'locked', false);
}

function buildEntry(
  input: {
    id: CanaryExecutionApprovalLedgerEntry['id'];
    surface: CanaryExecutionApprovalLedgerEntry['surface'];
    command: string;
    evidence: string;
  },
  mode: CanaryExecutionApprovalLedgerEntry['mode'],
  status: CanaryExecutionApprovalLedgerEntry['status'],
  requiresHumanSignature: boolean,
): CanaryExecutionApprovalLedgerEntry {
  return {
    ...input,
    mode,
    status,
    receipt: `canary-execution-approval.${input.id}.receipt`,
    requiredForLedger: true,
    requiresHumanSignature,
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

function gate(input: CanaryExecutionApprovalLedgerGate): CanaryExecutionApprovalLedgerGate {
  return input;
}
