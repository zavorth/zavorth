import type {
  CanaryPromotionDecisionEntry,
  CanaryPromotionDecisionGate,
  CanaryPromotionDecisionLedgerSnapshot,
  CanaryPromotionDecisionLedgerStatus,
  CanaryPromotionDecisionReceipt,
} from '../contracts/CanaryPromotionDecisionLedgerContract.js';
import { ZAVORTH_CANARY_PROMOTION_DECISION_LEDGER_CONTRACT_VERSION } from '../contracts/CanaryPromotionDecisionLedgerContract.js';
import { CanaryMonitoringRollbackGateService } from './CanaryMonitoringRollbackGateService.js';

type CanaryPromotionDecisionLedgerRuntime = {
  now?: () => Date;
  canaryMonitoringRollbackGateService?: CanaryMonitoringRollbackGateService;
};

export class CanaryPromotionDecisionLedgerService {
  private readonly now: () => Date;
  private readonly monitoringRollbackGate: CanaryMonitoringRollbackGateService;

  constructor(runtime: CanaryPromotionDecisionLedgerRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.monitoringRollbackGate = runtime.canaryMonitoringRollbackGateService
      || new CanaryMonitoringRollbackGateService({ now: this.now });
  }

  public buildSnapshot(): CanaryPromotionDecisionLedgerSnapshot {
    const monitoringRollbackGateSnapshot = this.monitoringRollbackGate.buildSnapshot();
    const entries = this.entries({
      releaseCandidateId: monitoringRollbackGateSnapshot.releaseCandidate.id,
      canaryCohortId: monitoringRollbackGateSnapshot.monitoring.canaryCohortId,
      featureFlagKey: monitoringRollbackGateSnapshot.monitoring.featureFlagKey,
      observationWindowHours: monitoringRollbackGateSnapshot.monitoring.observationWindowHours,
    });
    const receipts = this.receipts(entries);
    const gates = this.gates({
      monitoringRollbackGateReady: monitoringRollbackGateSnapshot.summary.monitoringRollbackGateReady,
      monitoringRollbackGateSnapshot,
      entries,
      receipts,
    });
    const failedGates = gates.filter((gate) => gate.status === 'fail').length;
    const blockedEntries = entries.filter((entry) => entry.status === 'blocked').length;
    const status: CanaryPromotionDecisionLedgerStatus = monitoringRollbackGateSnapshot.status === 'blocked' || failedGates > 0 || blockedEntries > 0
      ? 'blocked'
      : entries.some((entry) => entry.status === 'decision-ready')
        ? 'decision-ledger-ready'
        : 'attention';

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_CANARY_PROMOTION_DECISION_LEDGER_CONTRACT_VERSION,
      status,
      releaseCandidate: {
        id: monitoringRollbackGateSnapshot.releaseCandidate.id,
        packageName: monitoringRollbackGateSnapshot.releaseCandidate.packageName,
        packageVersion: monitoringRollbackGateSnapshot.releaseCandidate.packageVersion,
        channel: 'release-candidate',
        npmDistTag: 'rc',
        promotionDecisionLedgerOnly: true,
      },
      ledger: {
        state: status === 'blocked' ? 'blocked' : 'ready-for-signed-evidence',
        effectiveDecision: 'hold',
        selectedDecision: 'hold',
        availableDecisions: ['expand', 'pause', 'rollback'],
        recommendedDecision: 'await-live-evidence',
        canaryCohortId: monitoringRollbackGateSnapshot.monitoring.canaryCohortId,
        featureFlagKey: monitoringRollbackGateSnapshot.monitoring.featureFlagKey,
        observationWindowHours: monitoringRollbackGateSnapshot.monitoring.observationWindowHours,
        currentCanaryPercent: 5,
        nextCohortPercent: 10,
        signedMonitoringEvidenceRequired: true,
        signedMonitoringEvidenceRecorded: false,
        promotionAuthorized: false,
        rollbackRecommended: false,
        pauseRecommended: false,
        promotable: false,
      },
      summary: {
        entries: entries.length,
        requiredEntries: entries.filter((entry) => entry.requiredForDecisionLedger).length,
        linkedEntries: entries.filter((entry) => entry.status === 'linked').length,
        decisionReadyEntries: entries.filter((entry) => entry.status === 'decision-ready').length,
        operatorReadyEntries: entries.filter((entry) => entry.status === 'operator-ready').length,
        lockedEntries: entries.filter((entry) => entry.status === 'locked').length,
        blockedEntries,
        gates: gates.length,
        passedGates: gates.filter((gate) => gate.status === 'pass').length,
        failedGates,
        receipts: receipts.length,
        monitoringRollbackGateStatus: monitoringRollbackGateSnapshot.status,
        monitoringRollbackGateReady: monitoringRollbackGateSnapshot.summary.monitoringRollbackGateReady,
        heldReleaseExecutionGateLinked: entries.some((entry) => entry.id === 'held-release-execution-gate' && entry.status === 'linked'),
        decisionOptionsExplicit: this.decisionOptionsExplicit(entries),
        signedMonitoringEvidenceSlotReady: entries.some((entry) => entry.id === 'signed-monitoring-evidence-slot' && entry.status === 'decision-ready'),
        promotionApproverReady: entries.some((entry) => entry.id === 'promotion-approver-slot' && entry.status === 'decision-ready'),
        manualOperatorReady: entries.some((entry) => entry.id === 'manual-operator-slot' && entry.status === 'operator-ready'),
        auditDecisionLedgerReady: entries.some((entry) => entry.id === 'audit-decision-ledger' && entry.status === 'decision-ready'),
        operatorHandoffsReady: this.operatorHandoffsReady(entries),
        promotionDecisionLedgerReady: status === 'decision-ledger-ready' && monitoringRollbackGateSnapshot.summary.monitoringRollbackGateReady,
        signedEvidenceRecorded: false,
        promotionAuthorized: false,
        canaryExpanded: false,
        rollbackExecuted: false,
        pauseExecuted: false,
        rolloutStarted: false,
        remoteStateMutated: false,
        npmPublishExecuted: false,
        githubReleaseCreated: false,
        gitTagMoved: false,
        secretValuesSerialized: false,
      },
      monitoringRollbackGate: {
        contractVersion: monitoringRollbackGateSnapshot.contractVersion,
        status: monitoringRollbackGateSnapshot.status,
        releaseCandidate: monitoringRollbackGateSnapshot.releaseCandidate,
        monitoring: monitoringRollbackGateSnapshot.monitoring,
        summary: monitoringRollbackGateSnapshot.summary,
        commands: monitoringRollbackGateSnapshot.commands,
      },
      entries,
      gates,
      receipts,
      commands: {
        run: 'npm run canary-promotion-decision-ledger --silent',
        runJson: 'npm run canary-promotion-decision-ledger:json --silent',
        check: 'npm run canary-promotion-decision-ledger:check --silent',
        requireLedgerReady: 'npm run canary-promotion-decision-ledger --silent -- --require-ledger-ready',
        monitoringRollbackGate: 'npm run canary-monitoring-rollback-gate --silent -- --require-gate-ready',
        releaseExecutionHeld: 'npm run capability-autopilot:release-execution --silent -- --no-execution-approval --no-tag-approval --no-publish-approval --no-canary-launch-approval',
        promotionDecisionDryRun: `dry-run:canary-promotion-decision --cohort ${monitoringRollbackGateSnapshot.monitoring.canaryCohortId} --from 5 --to 10 --no-execute`,
        rollbackDecisionDryRun: 'dry-run:canary-rollback-decision --checkpoint required --no-execute',
        focusedTests: [
          'npx jest tests/services/CanaryPromotionDecisionLedgerService.test.ts --runInBand',
          'npm run canary-promotion-decision-ledger:check --silent',
          'npm run canary-promotion-decision-ledger --silent -- --require-ledger-ready',
        ],
        typecheck: 'npm run runtime:check --silent',
        nextPhase: 'Final canary release closure',
      },
      policy: {
        promotionDecisionLedgerOnly: true,
        consumesCanaryMonitoringRollbackGate: true,
        noSignedEvidenceRecordedByDefault: true,
        noPromotionAuthorizedByDefault: true,
        noCanaryExpanded: true,
        noRollbackExecuted: true,
        noPauseExecuted: true,
        noRolloutStarted: true,
        noNpmPublish: true,
        noGithubReleaseCreated: true,
        noGitTagMoved: true,
        noStableTagMoved: true,
        noLatestTagMoved: true,
        noAutomaticExecution: true,
        noAutomaticPromotion: true,
        signedMonitoringEvidenceRequired: true,
        manualPromotionApprovalRequired: true,
        rollbackDecisionRequiredBeforeRollback: true,
        pauseDecisionRequiredBeforePause: true,
        finalClosureRequiredBeforeRelease: true,
        auditDecisionLedgerRequired: true,
        incidentCommanderRequired: true,
        supportBridgeRequired: true,
        noRemoteMutationByDefault: true,
        noNetworkRequiredByDefault: true,
        secretsSerialized: false,
      },
    };
  }

  public formatLedgerText(snapshot: CanaryPromotionDecisionLedgerSnapshot = this.buildSnapshot()): string {
    return [
      'Zavorth Canary Promotion Decision Ledger',
      `Status: ${snapshot.status}`,
      `Release candidate: ${snapshot.releaseCandidate.id}`,
      `Ledger state: ${snapshot.ledger.state}`,
      `Effective decision: ${snapshot.ledger.effectiveDecision}`,
      `Selected decision: ${snapshot.ledger.selectedDecision}`,
      `Recommended decision: ${snapshot.ledger.recommendedDecision}`,
      `Available decisions: ${snapshot.ledger.availableDecisions.join(', ')}`,
      `Canary cohort: ${snapshot.ledger.canaryCohortId}`,
      `Feature flag: ${snapshot.ledger.featureFlagKey}`,
      `Current canary percent: ${snapshot.ledger.currentCanaryPercent}`,
      `Next cohort percent: ${snapshot.ledger.nextCohortPercent}`,
      `Signed monitoring evidence recorded: ${snapshot.ledger.signedMonitoringEvidenceRecorded}`,
      `Promotion authorized: ${snapshot.ledger.promotionAuthorized}`,
      `Promotable: ${snapshot.ledger.promotable}`,
      `Entries: ${snapshot.summary.linkedEntries} linked, ${snapshot.summary.decisionReadyEntries} decision-ready, ${snapshot.summary.operatorReadyEntries} operator-ready, ${snapshot.summary.lockedEntries} locked, ${snapshot.summary.blockedEntries} blocked`,
      `Gates: ${snapshot.summary.passedGates}/${snapshot.summary.gates} pass`,
      `Receipts: ${snapshot.summary.receipts}`,
      `Monitoring rollback gate ready: ${snapshot.summary.monitoringRollbackGateReady}`,
      `Promotion decision ledger ready: ${snapshot.summary.promotionDecisionLedgerReady}`,
      `Canary expanded: ${snapshot.summary.canaryExpanded}`,
      `Rollback executed: ${snapshot.summary.rollbackExecuted}`,
      `Pause executed: ${snapshot.summary.pauseExecuted}`,
      `Remote state mutated: ${snapshot.summary.remoteStateMutated}`,
      '',
      'Promotion decision entries:',
      ...snapshot.entries.map((entry) =>
        `- ${entry.status.toUpperCase()} ${entry.id}: ${entry.command}`,
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

  private entries(input: {
    releaseCandidateId: string;
    canaryCohortId: string;
    featureFlagKey: string;
    observationWindowHours: number;
  }): CanaryPromotionDecisionEntry[] {
    return [
      linkedEntry({
        id: 'monitoring-rollback-gate-input',
        surface: 'monitoring-gate',
        command: 'npm run canary-monitoring-rollback-gate --silent -- --require-gate-ready',
        evidence: `${input.releaseCandidateId} monitoring rollback gate is the promotion decision input.`,
      }),
      linkedEntry({
        id: 'held-release-execution-gate',
        surface: 'release-execution',
        command: 'npm run capability-autopilot:release-execution --silent -- --no-execution-approval --no-tag-approval --no-publish-approval --no-canary-launch-approval',
        evidence: 'Release execution remains linked in explicit hold mode.',
      }),
      decisionEntry({
        id: 'signed-monitoring-evidence-slot',
        surface: 'evidence',
        command: `manual:attach-signed-monitoring-evidence --window-hours ${input.observationWindowHours} --not-recorded`,
        evidence: 'Signed monitoring evidence slot is prepared, but no evidence is recorded.',
      }),
      decisionEntry({
        id: 'promotion-approver-slot',
        surface: 'approval',
        command: 'manual:assign-promotion-approver --required-before-expand',
        evidence: 'Promotion approver slot is ready before any expansion.',
      }),
      operatorEntry({
        id: 'manual-operator-slot',
        surface: 'approval',
        command: 'manual:assign-canary-decision-operator --required',
        evidence: 'Manual operator slot is ready for future decision execution.',
      }),
      decisionEntry({
        id: 'expand-decision-path',
        surface: 'promotion',
        command: `dry-run:decision-expand --cohort ${input.canaryCohortId} --from 5 --to 10 --requires-signed-evidence --no-execute`,
        evidence: 'Expand decision path is modeled without execution.',
      }),
      decisionEntry({
        id: 'pause-decision-path',
        surface: 'pause',
        command: `dry-run:decision-pause --cohort ${input.canaryCohortId} --keep-flag ${input.featureFlagKey} --no-toggle`,
        evidence: 'Pause decision path is modeled without toggling state.',
      }),
      decisionEntry({
        id: 'rollback-decision-path',
        surface: 'rollback',
        command: 'dry-run:decision-rollback --checkpoint required --requires-rollback-owner --no-execute',
        evidence: 'Rollback decision path is modeled without execution.',
      }),
      decisionEntry({
        id: 'cohort-expansion-command-shape',
        surface: 'cohort',
        command: `dry-run:render-cohort-expansion --cohort ${input.canaryCohortId} --from 5 --to 10 --no-traffic`,
        evidence: 'Cohort expansion command shape is rendered without sending traffic.',
      }),
      decisionEntry({
        id: 'rollback-command-shape',
        surface: 'rollback',
        command: 'dry-run:render-rollback-command --checkpoint required --no-execute',
        evidence: 'Rollback command shape is rendered without executing.',
      }),
      decisionEntry({
        id: 'audit-decision-ledger',
        surface: 'audit',
        command: 'dry-run:audit-promotion-decision-ledger --include-expand-pause-rollback --no-upload',
        evidence: 'Decision audit ledger is prepared without upload.',
      }),
      operatorEntry({
        id: 'incident-commander-handoff',
        surface: 'incident',
        command: 'manual:confirm-incident-commander-decision-watch --required-before-expand',
        evidence: 'Incident commander handoff is ready for future decision execution.',
      }),
      operatorEntry({
        id: 'support-bridge-handoff',
        surface: 'support',
        command: 'manual:confirm-support-bridge-decision-watch --required-before-expand',
        evidence: 'Support bridge handoff is ready for future decision execution.',
      }),
      lockedEntry({
        id: 'promotion-execution-lock',
        surface: 'promotion',
        command: 'policy:no-canary-expand no-next-cohort no-auto-promote',
        evidence: 'Promotion execution remains locked until evidence and approval are real.',
      }),
      lockedEntry({
        id: 'publication-lock',
        surface: 'publication',
        command: 'policy:no-npm-publish no-github-release no-git-tag',
        evidence: 'Publication and tag movement remain locked.',
      }),
      lockedEntry({
        id: 'remote-mutation-lock',
        surface: 'policy',
        command: 'policy:no-remote-mutation no-promotion-execute no-rollback-execute no-pause-execute',
        evidence: 'Decision ledger does not mutate remote state.',
      }),
    ];
  }

  private gates(input: {
    monitoringRollbackGateReady: boolean;
    monitoringRollbackGateSnapshot: ReturnType<CanaryMonitoringRollbackGateService['buildSnapshot']>;
    entries: CanaryPromotionDecisionEntry[];
    receipts: CanaryPromotionDecisionReceipt[];
  }): CanaryPromotionDecisionGate[] {
    const required = input.entries.filter((entry) => entry.requiredForDecisionLedger);
    const ready = required.filter((entry) =>
      entry.status === 'linked'
      || entry.status === 'decision-ready'
      || entry.status === 'operator-ready'
      || entry.status === 'locked',
    );
    const releaseExecutionLinked = input.entries.some((entry) => entry.id === 'held-release-execution-gate' && entry.status === 'linked');
    const decisionOptionsExplicit = this.decisionOptionsExplicit(input.entries);
    const approvalAndEvidenceReady = [
      'signed-monitoring-evidence-slot',
      'promotion-approver-slot',
      'audit-decision-ledger',
    ].every((id) => input.entries.some((entry) => entry.id === id && entry.status === 'decision-ready'));
    const operatorHandoffsReady = this.operatorHandoffsReady(input.entries);
    const promotionSideEffectsBlocked = input.entries.every((entry) =>
      entry.signedEvidenceRecorded === false
      && entry.promotionAuthorized === false
      && entry.canaryExpanded === false
      && entry.mutatesRemoteState === false,
    ) && input.monitoringRollbackGateSnapshot.summary.promotionExecuted === false;
    const rollbackAndPauseBlocked = input.entries.every((entry) =>
      entry.rollbackExecuted === false
      && entry.pauseExecuted === false
      && entry.mutatesRemoteState === false,
    ) && input.monitoringRollbackGateSnapshot.summary.rollbackExecuted === false;
    const publicationHeld = input.entries.every((entry) => entry.publishesPackage === false)
      && input.monitoringRollbackGateSnapshot.summary.npmPublishExecuted === false
      && input.monitoringRollbackGateSnapshot.summary.githubReleaseCreated === false
      && input.monitoringRollbackGateSnapshot.summary.gitTagMoved === false;
    const remoteMutationBlocked = input.entries.every((entry) => entry.mutatesRemoteState === false)
      && input.monitoringRollbackGateSnapshot.summary.remoteStateMutated === false;

    return [
      gate({
        id: 'monitoring-rollback-gate-ready',
        status: input.monitoringRollbackGateReady ? 'pass' : 'fail',
        title: 'Canary monitoring and rollback gate is ready',
        observed: input.monitoringRollbackGateReady,
        threshold: true,
        receipt: 'canary-promotion-decision.monitoring-rollback-gate-ready.receipt',
        nextAction: 'finish Phase 22 before promotion decision ledger',
      }),
      gate({
        id: 'held-release-execution-gate-linked',
        status: releaseExecutionLinked ? 'pass' : 'fail',
        title: 'Held release execution gate is linked',
        observed: releaseExecutionLinked,
        threshold: true,
        receipt: 'canary-promotion-decision.release-execution-linked.receipt',
        nextAction: 'link release execution in explicit hold mode',
      }),
      gate({
        id: 'decision-options-explicit',
        status: decisionOptionsExplicit ? 'pass' : 'fail',
        title: 'Expand, pause, and rollback decision paths are explicit',
        observed: decisionOptionsExplicit,
        threshold: true,
        receipt: 'canary-promotion-decision.options-explicit.receipt',
        nextAction: 'define expand, pause, and rollback paths',
      }),
      gate({
        id: 'approval-and-evidence-slots-ready',
        status: approvalAndEvidenceReady ? 'pass' : 'fail',
        title: 'Signed evidence, approver, and audit slots are ready',
        observed: approvalAndEvidenceReady,
        threshold: true,
        receipt: 'canary-promotion-decision.approval-evidence.receipt',
        nextAction: 'prepare signed monitoring evidence, promotion approver, and audit ledger',
      }),
      gate({
        id: 'operator-handoffs-ready',
        status: operatorHandoffsReady ? 'pass' : 'fail',
        title: 'Manual operator, incident commander, and support bridge handoffs are ready',
        observed: operatorHandoffsReady,
        threshold: true,
        receipt: 'canary-promotion-decision.operator-handoffs.receipt',
        nextAction: 'prepare manual operator, incident commander, and support bridge handoffs',
      }),
      gate({
        id: 'promotion-side-effects-blocked',
        status: promotionSideEffectsBlocked ? 'pass' : 'fail',
        title: 'Signed evidence recording, promotion authorization, expansion, and remote mutation are blocked',
        observed: promotionSideEffectsBlocked,
        threshold: true,
        receipt: 'canary-promotion-decision.promotion-side-effects-blocked.receipt',
        nextAction: 'remove promotion authorization, expansion, evidence write, or remote mutation from ledger',
      }),
      gate({
        id: 'rollback-and-pause-side-effects-blocked',
        status: rollbackAndPauseBlocked ? 'pass' : 'fail',
        title: 'Rollback and pause execution are blocked',
        observed: rollbackAndPauseBlocked,
        threshold: true,
        receipt: 'canary-promotion-decision.rollback-pause-blocked.receipt',
        nextAction: 'remove rollback or pause execution from decision ledger',
      }),
      gate({
        id: 'publication-held',
        status: publicationHeld ? 'pass' : 'fail',
        title: 'Publication remains held',
        observed: publicationHeld,
        threshold: true,
        receipt: 'canary-promotion-decision.publication-held.receipt',
        nextAction: 'restore no-publish/no-release/no-tag guarantees',
      }),
      gate({
        id: 'remote-mutation-blocked',
        status: remoteMutationBlocked ? 'pass' : 'fail',
        title: 'Remote mutation remains blocked',
        observed: remoteMutationBlocked,
        threshold: true,
        receipt: 'canary-promotion-decision.remote-mutation-blocked.receipt',
        nextAction: 'remove remote writes from decision ledger',
      }),
      gate({
        id: 'decision-receipts-complete',
        status: input.receipts.length === input.entries.length && ready.length === required.length ? 'pass' : 'fail',
        title: 'Every promotion decision entry emits a receipt',
        observed: `${input.receipts.length}/${input.entries.length}`,
        threshold: `${input.entries.length}/${input.entries.length}`,
        receipt: 'canary-promotion-decision.receipts-complete.receipt',
        nextAction: 'repair missing promotion decision receipts or blocked entries',
      }),
    ];
  }

  private receipts(entries: CanaryPromotionDecisionEntry[]): CanaryPromotionDecisionReceipt[] {
    return entries.map((entry) => ({
      id: entry.receipt,
      entryId: entry.id,
      status: entry.status,
      command: entry.command,
      evidence: entry.evidence,
      dryRunOnly: entry.dryRunOnly,
      signedEvidenceRecorded: false,
      noPromotionAuthorized: true,
      noCanaryExpanded: true,
      noRollbackExecuted: true,
      noPauseExecuted: true,
      noPackagePublished: true,
      noRemoteMutation: true,
      secretValuesSerialized: false,
    }));
  }

  private decisionOptionsExplicit(entries: CanaryPromotionDecisionEntry[]): boolean {
    return [
      'expand-decision-path',
      'pause-decision-path',
      'rollback-decision-path',
    ].every((id) => entries.some((entry) => entry.id === id && entry.status === 'decision-ready'));
  }

  private operatorHandoffsReady(entries: CanaryPromotionDecisionEntry[]): boolean {
    return [
      'manual-operator-slot',
      'incident-commander-handoff',
      'support-bridge-handoff',
    ].every((id) => entries.some((entry) => entry.id === id && entry.status === 'operator-ready'));
  }
}

function linkedEntry(input: {
  id: CanaryPromotionDecisionEntry['id'];
  surface: CanaryPromotionDecisionEntry['surface'];
  command: string;
  evidence: string;
}): CanaryPromotionDecisionEntry {
  return buildEntry(input, 'source-gate', 'linked', true);
}

function decisionEntry(input: {
  id: CanaryPromotionDecisionEntry['id'];
  surface: CanaryPromotionDecisionEntry['surface'];
  command: string;
  evidence: string;
}): CanaryPromotionDecisionEntry {
  return buildEntry(input, input.surface === 'evidence' ? 'evidence-slot' : 'decision-path', 'decision-ready', true);
}

function operatorEntry(input: {
  id: CanaryPromotionDecisionEntry['id'];
  surface: CanaryPromotionDecisionEntry['surface'];
  command: string;
  evidence: string;
}): CanaryPromotionDecisionEntry {
  return buildEntry(input, 'operator-handoff', 'operator-ready', false);
}

function lockedEntry(input: {
  id: CanaryPromotionDecisionEntry['id'];
  surface: CanaryPromotionDecisionEntry['surface'];
  command: string;
  evidence: string;
}): CanaryPromotionDecisionEntry {
  return buildEntry(input, 'policy-lock', 'locked', false);
}

function buildEntry(
  input: {
    id: CanaryPromotionDecisionEntry['id'];
    surface: CanaryPromotionDecisionEntry['surface'];
    command: string;
    evidence: string;
  },
  mode: CanaryPromotionDecisionEntry['mode'],
  status: CanaryPromotionDecisionEntry['status'],
  dryRunOnly: boolean,
): CanaryPromotionDecisionEntry {
  return {
    ...input,
    mode,
    status,
    receipt: `canary-promotion-decision.${input.id}.receipt`,
    requiredForDecisionLedger: true,
    dryRunOnly,
    signedEvidenceRecorded: false,
    promotionAuthorized: false,
    canaryExpanded: false,
    rollbackExecuted: false,
    pauseExecuted: false,
    publishesPackage: false,
    mutatesRemoteState: false,
    secretValuesSerialized: false,
  };
}

function gate(input: CanaryPromotionDecisionGate): CanaryPromotionDecisionGate {
  return input;
}
