import type {
  FinalCanaryReleaseClosureGate,
  FinalCanaryReleaseClosureItem,
  FinalCanaryReleaseClosureReceipt,
  FinalCanaryReleaseClosureSnapshot,
  FinalCanaryReleaseClosureStatus,
} from '../contracts/FinalCanaryReleaseClosureContract.js';
import { ZAVORTH_FINAL_CANARY_RELEASE_CLOSURE_CONTRACT_VERSION } from '../contracts/FinalCanaryReleaseClosureContract.js';

import { CanaryPromotionDecisionLedgerService } from './CanaryPromotionDecisionLedgerService.js';

type FinalCanaryReleaseClosureRuntime = {
  now?: () => Date;
  canaryPromotionDecisionLedgerService?: CanaryPromotionDecisionLedgerService;
};

export class FinalCanaryReleaseClosureService {
  private readonly now: () => Date;
  private readonly promotionDecisionLedger: CanaryPromotionDecisionLedgerService;

  constructor(runtime: FinalCanaryReleaseClosureRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.promotionDecisionLedger = runtime.canaryPromotionDecisionLedgerService
      || new CanaryPromotionDecisionLedgerService({ now: this.now });
  }

  public buildSnapshot(): FinalCanaryReleaseClosureSnapshot {
    const promotionDecisionLedgerSnapshot = this.promotionDecisionLedger.buildSnapshot();
    const items = this.items({
      releaseCandidateId: promotionDecisionLedgerSnapshot.releaseCandidate.id,
      canaryCohortId: promotionDecisionLedgerSnapshot.ledger.canaryCohortId,
      featureFlagKey: promotionDecisionLedgerSnapshot.ledger.featureFlagKey,
    });
    const receipts = this.receipts(items);
    const gates = this.gates({
      promotionDecisionLedgerReady: promotionDecisionLedgerSnapshot.summary.promotionDecisionLedgerReady,
      promotionDecisionLedgerSnapshot,
      items,
      receipts,
    });
    const failedGates = gates.filter((gate) => gate.status === 'fail').length;
    const blockedItems = items.filter((item) => item.status === 'blocked').length;
    const status: FinalCanaryReleaseClosureStatus = promotionDecisionLedgerSnapshot.status === 'blocked' || failedGates > 0 || blockedItems > 0
      ? 'blocked'
      : items.some((item) => item.status === 'closure-ready') ? 'closure-ready'
        : 'attention';

    const phaseChainComplete = this.phaseChainComplete(items) && promotionDecisionLedgerSnapshot.summary.promotionDecisionLedgerReady;
    const closureEvidenceComplete = this.closureEvidenceComplete(items);
    const manualHandoffsReady = this.manualHandoffsReady(items);

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_FINAL_CANARY_RELEASE_CLOSURE_CONTRACT_VERSION,
      status,
      releaseCandidate: {
        id: promotionDecisionLedgerSnapshot.releaseCandidate.id,
        packageName: promotionDecisionLedgerSnapshot.releaseCandidate.packageName,
        packageVersion: promotionDecisionLedgerSnapshot.releaseCandidate.packageVersion,
        channel: 'release-candidate',
        npmDistTag: 'rc',
        finalClosureOnly: true,
      },
      closure: {
        state: status === 'blocked' ? 'blocked' : 'closure-ready',
        phaseRange: '20-24',
        effectiveDecision: 'hold',
        finalSequenceDecision: 'closed-dry-run',
        canaryDryRunSequenceComplete: status === 'closure-ready' && phaseChainComplete,
        readyForSeparateManualReleaseDecision: status === 'closure-ready' && closureEvidenceComplete && manualHandoffsReady,
        manualReleaseDecisionRecorded: false,
        canaryCohortId: promotionDecisionLedgerSnapshot.ledger.canaryCohortId,
        featureFlagKey: promotionDecisionLedgerSnapshot.ledger.featureFlagKey,
        observationWindowHours: promotionDecisionLedgerSnapshot.ledger.observationWindowHours,
        selectedPromotionDecision: promotionDecisionLedgerSnapshot.ledger.selectedDecision,
        recommendedPromotionDecision: promotionDecisionLedgerSnapshot.ledger.recommendedDecision,
        noFurtherAutomatedStage: true,
        sequenceClosesAtStage24: true,
      },
      summary: {
        items: items.length,
        requiredItems: items.filter((item) => item.requiredForClosure).length,
        linkedItems: items.filter((item) => item.status === 'linked').length,
        closureReadyItems: items.filter((item) => item.status === 'closure-ready').length,
        operatorReadyItems: items.filter((item) => item.status === 'operator-ready').length,
        lockedItems: items.filter((item) => item.status === 'locked').length,
        blockedItems,
        gates: gates.length,
        passedGates: gates.filter((gate) => gate.status === 'pass').length,
        failedGates,
        receipts: receipts.length,
        promotionDecisionLedgerStatus: promotionDecisionLedgerSnapshot.status,
        promotionDecisionLedgerReady: promotionDecisionLedgerSnapshot.summary.promotionDecisionLedgerReady,
        heldReleaseExecutionGateLinked: items.some((item) => item.id === 'held-release-execution-gate' && item.status === 'linked'),
        previewEngine0Linked: items.some((item) => item.id === 'gate-20-approval-ledger-link' && item.status === 'closure-ready'),
        previewEngine1Linked: items.some((item) => item.id === 'gate-21-launch-rehearsal-link' && item.status === 'closure-ready'),
        previewEngine2Linked: items.some((item) => item.id === 'gate-22-monitoring-rollback-link' && item.status === 'closure-ready'),
        previewEngine3Linked: items.some((item) => item.id === 'gate-23-promotion-decision-link' && item.status === 'closure-ready'),
        phaseChainComplete,
        closureEvidenceComplete,
        manualHandoffsReady,
        finalCanaryReleaseClosureReady: status === 'closure-ready' && promotionDecisionLedgerSnapshot.summary.promotionDecisionLedgerReady,
        manualReleaseDecisionRecorded: false,
        releaseExecuted: false,
        canaryStarted: false,
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
      promotionDecisionLedger: {
        contractVersion: promotionDecisionLedgerSnapshot.contractVersion,
        status: promotionDecisionLedgerSnapshot.status,
        releaseCandidate: promotionDecisionLedgerSnapshot.releaseCandidate,
        ledger: promotionDecisionLedgerSnapshot.ledger,
        summary: promotionDecisionLedgerSnapshot.summary,
        commands: promotionDecisionLedgerSnapshot.commands,
      },
      items,
      gates,
      receipts,
      commands: {
        run: 'npm run final-canary-release-closure --silent',
        runJson: 'npm run final-canary-release-closure:json --silent',
        check: 'npm run final-canary-release-closure:check --silent',
        requireClosureReady: 'npm run final-canary-release-closure --silent -- --require-closure-ready',
        promotionDecisionLedger: 'npm run canary-promotion-decision-ledger --silent -- --require-ledger-ready',
        releaseExecutionHeld: 'npm run capability-autopilot:release-execution --silent -- --no-execution-approval --no-tag-approval --no-publish-approval --no-canary-launch-approval',
        chainValidation: 'dry-run:validate-canary-chain --gates 20-24 --no-execute',
        manualReleaseDecisionHandoff: 'manual:open-release-decision-outside-dry-run-chain --requires-signed-evidence',
        focusedTests: [
          'npx jest tests/services/FinalCanaryReleaseClosureService.test.ts --runInBand',
          'npm run final-canary-release-closure:check --silent',
          'npm run final-canary-release-closure --silent -- --require-closure-ready',
        ],
        typecheck: 'npm run runtime:check --silent',
        completion: 'Canary dry-run sequence complete at Preview engine4',
      },
      policy: {
        finalClosureOnly: true,
        consumesCanaryPromotionDecisionLedger: true,
        closesCanaryDryRunSequence: true,
        sequenceClosesAtStage24: true,
        noFurtherAutomatedStage: true,
        noManualReleaseDecisionRecordedByDefault: true,
        noReleaseExecuted: true,
        noCanaryStarted: true,
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
        separateManualReleaseDecisionRequired: true,
        signedMonitoringEvidenceRequiredForFuturePromotion: true,
        auditClosureRequired: true,
        incidentCommanderRequired: true,
        supportBridgeRequired: true,
        noRemoteMutationByDefault: true,
        noNetworkRequiredByDefault: true,
        secretsSerialized: false,
      },
    };
  }

  public formatClosureText(snapshot: FinalCanaryReleaseClosureSnapshot = this.buildSnapshot()): string {
    return [
      'Zavorth Final Canary Release Closure',
      `Status: ${snapshot.status}`,
      `Release candidate: ${snapshot.releaseCandidate.id}`,
      `Closure state: ${snapshot.closure.state}`,
      `Gate range: ${snapshot.closure.phaseRange}`,
      `Effective decision: ${snapshot.closure.effectiveDecision}`,
      `Final sequence decision: ${snapshot.closure.finalSequenceDecision}`,
      `Canary dry-run sequence complete: ${snapshot.closure.canaryDryRunSequenceComplete}`,
      `Ready for separate manual release decision: ${snapshot.closure.readyForSeparateManualReleaseDecision}`,
      `Manual release decision recorded: ${snapshot.closure.manualReleaseDecisionRecorded}`,
      `No further automated release state: ${snapshot.closure.noFurtherAutomatedStage}`,
      `Sequence closes at Preview engine4: ${snapshot.closure.sequenceClosesAtStage24}`,
      `Items: ${snapshot.summary.linkedItems} linked, ${snapshot.summary.closureReadyItems} closure-ready, ${snapshot.summary.operatorReadyItems} operator-ready, ${snapshot.summary.lockedItems} locked, ${snapshot.summary.blockedItems} blocked`,
      `Gates: ${snapshot.summary.passedGates}/${snapshot.summary.gates} pass`,
      `Receipts: ${snapshot.summary.receipts}`,
      `Promotion decision ledger ready: ${snapshot.summary.promotionDecisionLedgerReady}`,
      `Gate chain complete: ${snapshot.summary.phaseChainComplete}`,
      `Closure evidence complete: ${snapshot.summary.closureEvidenceComplete}`,
      `Manual handoffs ready: ${snapshot.summary.manualHandoffsReady}`,
      `Final closure ready: ${snapshot.summary.finalCanaryReleaseClosureReady}`,
      `Release executed: ${snapshot.summary.releaseExecuted}`,
      `Canary started: ${snapshot.summary.canaryStarted}`,
      `Canary expanded: ${snapshot.summary.canaryExpanded}`,
      `Rollback executed: ${snapshot.summary.rollbackExecuted}`,
      `Remote state mutated: ${snapshot.summary.remoteStateMutated}`,
      '',
      'Final closure items:',
      ...snapshot.items.map((item) =>
        `- ${item.status.toUpperCase()} ${item.id}: ${item.command}`,
      ),
      '',
      'Gate results:',
      ...snapshot.gates.map((gate) =>
        `- ${gate.status.toUpperCase()} ${gate.id}: ${gate.observed} / ${gate.threshold} - ${gate.nextAction}`,
      ),
      '',
      `Completion: ${snapshot.commands.completion}`,
    ].join('\n');
  }

  private items(input: {
    releaseCandidateId: string;
    canaryCohortId: string;
    featureFlagKey: string;
  }): FinalCanaryReleaseClosureItem[] {
    return [
      linkedItem({
        id: 'promotion-decision-ledger-input',
        surface: 'promotion-ledger',
        command: 'npm run canary-promotion-decision-ledger --silent -- --require-ledger-ready',
        evidence: `${input.releaseCandidateId} promotion decision ledger is the final closure input.`,
      }),
      linkedItem({
        id: 'held-release-execution-gate',
        surface: 'release-execution',
        command: 'npm run capability-autopilot:release-execution --silent -- --no-execution-approval --no-tag-approval --no-publish-approval --no-canary-launch-approval',
        evidence: 'Release execution remains linked in explicit hold mode.',
      }),
      closureItem({
        id: 'gate-20-approval-ledger-link',
        surface: 'release-chain',
        command: 'dry-run:verify-gate-20-approval-ledger-link --no-network',
        evidence: 'Preview engine0 approval ledger is part of the closed canary chain.',
      }),
      closureItem({
        id: 'gate-21-launch-rehearsal-link',
        surface: 'release-chain',
        command: 'dry-run:verify-gate-21-launch-rehearsal-link --no-network',
        evidence: 'Preview engine1 launch rehearsal is part of the closed canary chain.',
      }),
      closureItem({
        id: 'gate-22-monitoring-rollback-link',
        surface: 'release-chain',
        command: 'dry-run:verify-gate-22-monitoring-rollback-link --no-network',
        evidence: 'Preview engine2 monitoring rollback gate is part of the closed canary chain.',
      }),
      closureItem({
        id: 'gate-23-promotion-decision-link',
        surface: 'release-chain',
        command: 'dry-run:verify-gate-23-promotion-decision-link --no-network',
        evidence: 'Preview engine3 promotion decision ledger is part of the closed canary chain.',
      }),
      closureItem({
        id: 'side-effect-zeroing-evidence',
        surface: 'evidence',
        command: 'dry-run:verify-zero-live-side-effects --gates 20-24 --no-execute',
        evidence: 'All live side effects remain zero across the canary closure chain.',
      }),
      closureItem({
        id: 'signed-evidence-requirement-record',
        surface: 'evidence',
        command: 'manual:record-signed-evidence-requirement --not-satisfied-in-dry-run',
        evidence: 'Future promotion still requires signed monitoring evidence.',
      }),
      closureItem({
        id: 'release-handoff-package',
        surface: 'release-handoff',
        command: `dry-run:prepare-manual-release-handoff --cohort ${input.canaryCohortId} --flag ${input.featureFlagKey} --no-execute`,
        evidence: 'Manual release handoff package is prepared without execution.',
      }),
      closureItem({
        id: 'audit-closure-record',
        surface: 'audit',
        command: 'dry-run:audit-final-canary-closure --gates 20-24 --no-upload',
        evidence: 'Final canary closure audit record is prepared without upload.',
      }),
      operatorItem({
        id: 'manual-release-decision-handoff',
        surface: 'release-handoff',
        command: 'manual:open-release-decision-outside-dry-run-chain --requires-signed-evidence',
        evidence: 'Future release decision is explicitly outside this dry-run release chain.',
      }),
      operatorItem({
        id: 'incident-commander-handoff',
        surface: 'incident',
        command: 'manual:confirm-incident-commander-final-closure --required-before-real-release',
        evidence: 'Incident commander handoff is ready for a future real release decision.',
      }),
      operatorItem({
        id: 'support-bridge-handoff',
        surface: 'support',
        command: 'manual:confirm-support-bridge-final-closure --required-before-real-release',
        evidence: 'Support bridge handoff is ready for a future real release decision.',
      }),
      lockedItem({
        id: 'publication-lock',
        surface: 'publication',
        command: 'policy:no-npm-publish no-github-release no-git-tag',
        evidence: 'Publication and tag movement remain locked at closure.',
      }),
      lockedItem({
        id: 'promotion-lock',
        surface: 'promotion',
        command: 'policy:no-canary-expand no-next-cohort no-auto-promote',
        evidence: 'Canary promotion remains locked at closure.',
      }),
      lockedItem({
        id: 'remote-mutation-lock',
        surface: 'policy',
        command: 'policy:no-remote-mutation no-release-execute no-rollback-execute no-pause-execute',
        evidence: 'Final closure does not mutate remote state.',
      }),
    ];
  }

  private gates(input: {
    promotionDecisionLedgerReady: boolean;
    promotionDecisionLedgerSnapshot: ReturnType<CanaryPromotionDecisionLedgerService['buildSnapshot']>;
    items: FinalCanaryReleaseClosureItem[];
    receipts: FinalCanaryReleaseClosureReceipt[];
  }): FinalCanaryReleaseClosureGate[] {
    const required = input.items.filter((item) => item.requiredForClosure);
    const ready = required.filter((item) =>
      item.status === 'linked'
      || item.status === 'closure-ready'
      || item.status === 'operator-ready'
      || item.status === 'locked',
    );
    const releaseExecutionLinked = input.items.some((item) => item.id === 'held-release-execution-gate' && item.status === 'linked');
    const phaseChainComplete = this.phaseChainComplete(input.items) && input.promotionDecisionLedgerReady;
    const closureEvidenceComplete = this.closureEvidenceComplete(input.items);
    const manualHandoffsReady = this.manualHandoffsReady(input.items);
    const liveSideEffectsBlocked = input.items.every((item) =>
      item.manualReleaseDecisionRecorded === false
      && item.releaseExecuted === false
      && item.canaryStarted === false
      && item.canaryExpanded === false
      && item.mutatesRemoteState === false,
    ) && input.promotionDecisionLedgerSnapshot.summary.canaryExpanded === false
      && input.promotionDecisionLedgerSnapshot.summary.remoteStateMutated === false;
    const publicationAndPromotionHeld = input.items.every((item) =>
      item.publishesPackage === false
      && item.createsRelease === false
      && item.movesTag === false
      && item.canaryExpanded === false,
    ) && input.promotionDecisionLedgerSnapshot.summary.npmPublishExecuted === false
      && input.promotionDecisionLedgerSnapshot.summary.githubReleaseCreated === false
      && input.promotionDecisionLedgerSnapshot.summary.gitTagMoved === false;
    const rollbackAndPauseHeld = input.items.every((item) =>
      item.rollbackExecuted === false
      && item.pauseExecuted === false,
    ) && input.promotionDecisionLedgerSnapshot.summary.rollbackExecuted === false
      && input.promotionDecisionLedgerSnapshot.summary.pauseExecuted === false;
    const remoteMutationBlocked = input.items.every((item) => item.mutatesRemoteState === false)
      && input.promotionDecisionLedgerSnapshot.summary.remoteStateMutated === false;

    return [
      gate({
        id: 'promotion-decision-ledger-ready',
        status: input.promotionDecisionLedgerReady ? 'pass' : 'fail',
        title: 'Canary promotion decision ledger is ready',
        observed: input.promotionDecisionLedgerReady,
        threshold: true,
        receipt: 'final-canary-release-closure.promotion-decision-ledger-ready.receipt',
        nextAction: 'finish Preview engine3 before final closure',
      }),
      gate({
        id: 'held-release-execution-gate-linked',
        status: releaseExecutionLinked ? 'pass' : 'fail',
        title: 'Held release execution gate is linked',
        observed: releaseExecutionLinked,
        threshold: true,
        receipt: 'final-canary-release-closure.release-execution-linked.receipt',
        nextAction: 'link release execution in explicit hold mode',
      }),
      gate({
        id: 'release-chain-complete',
        status: phaseChainComplete ? 'pass' : 'fail',
        title: 'Canary dry-run release chain is complete.',
        observed: phaseChainComplete,
        threshold: true,
        receipt: 'final-canary-release-closure.release-chain-complete.receipt',
        nextAction: 'restore Preview engine0, 21, 22, or 23 closure links',
      }),
      gate({
        id: 'closure-evidence-complete',
        status: closureEvidenceComplete ? 'pass' : 'fail',
        title: 'Side-effect, signed-evidence, handoff package, and audit closure evidence are complete',
        observed: closureEvidenceComplete,
        threshold: true,
        receipt: 'final-canary-release-closure.evidence-complete.receipt',
        nextAction: 'prepare final closure evidence package',
      }),
      gate({
        id: 'manual-handoffs-ready',
        status: manualHandoffsReady ? 'pass' : 'fail',
        title: 'Manual release, incident commander, and support handoffs are ready',
        observed: manualHandoffsReady,
        threshold: true,
        receipt: 'final-canary-release-closure.manual-handoffs.receipt',
        nextAction: 'prepare manual release, incident, and support handoffs',
      }),
      gate({
        id: 'live-side-effects-blocked',
        status: liveSideEffectsBlocked ? 'pass' : 'fail',
        title: 'Manual decision, release execution, canary start, expansion, and remote mutation are blocked',
        observed: liveSideEffectsBlocked,
        threshold: true,
        receipt: 'final-canary-release-closure.side-effects-blocked.receipt',
        nextAction: 'remove real release, canary, expansion, or remote mutation side effects from closure',
      }),
      gate({
        id: 'publication-and-promotion-held',
        status: publicationAndPromotionHeld ? 'pass' : 'fail',
        title: 'Publication, release creation, tag movement, and promotion remain held',
        observed: publicationAndPromotionHeld,
        threshold: true,
        receipt: 'final-canary-release-closure.publication-promotion-held.receipt',
        nextAction: 'restore no-publish/no-release/no-tag and no-promotion guarantees',
      }),
      gate({
        id: 'rollback-and-pause-held',
        status: rollbackAndPauseHeld ? 'pass' : 'fail',
        title: 'Rollback and pause execution remain held',
        observed: rollbackAndPauseHeld,
        threshold: true,
        receipt: 'final-canary-release-closure.rollback-pause-held.receipt',
        nextAction: 'remove rollback or pause execution from final closure',
      }),
      gate({
        id: 'remote-mutation-blocked',
        status: remoteMutationBlocked ? 'pass' : 'fail',
        title: 'Remote mutation remains blocked',
        observed: remoteMutationBlocked,
        threshold: true,
        receipt: 'final-canary-release-closure.remote-mutation-blocked.receipt',
        nextAction: 'remove remote writes from final closure',
      }),
      gate({
        id: 'closure-receipts-complete',
        status: input.receipts.length === input.items.length && ready.length === required.length ? 'pass' : 'fail',
        title: 'Every final closure item emits a receipt',
        observed: `${input.receipts.length}/${input.items.length}`,
        threshold: `${input.items.length}/${input.items.length}`,
        receipt: 'final-canary-release-closure.receipts-complete.receipt',
        nextAction: 'repair missing final closure receipts or blocked items',
      }),
    ];
  }

  private receipts(items: FinalCanaryReleaseClosureItem[]): FinalCanaryReleaseClosureReceipt[] {
    return items.map((item) => ({
      id: item.receipt,
      itemId: item.id,
      status: item.status,
      command: item.command,
      evidence: item.evidence,
      dryRunOnly: item.dryRunOnly,
      manualReleaseDecisionRecorded: false,
      noReleaseExecuted: true,
      noCanaryStarted: true,
      noCanaryExpanded: true,
      noRollbackExecuted: true,
      noPauseExecuted: true,
      noPackagePublished: true,
      noReleaseCreated: true,
      noTagMoved: true,
      noRemoteMutation: true,
      secretValuesSerialized: false,
    }));
  }

  private phaseChainComplete(items: FinalCanaryReleaseClosureItem[]): boolean {
    return [
      'gate-20-approval-ledger-link',
      'gate-21-launch-rehearsal-link',
      'gate-22-monitoring-rollback-link',
      'gate-23-promotion-decision-link',
    ].every((id) => items.some((item) => item.id === id && item.status === 'closure-ready'));
  }

  private closureEvidenceComplete(items: FinalCanaryReleaseClosureItem[]): boolean {
    return [
      'side-effect-zeroing-evidence',
      'signed-evidence-requirement-record',
      'release-handoff-package',
      'audit-closure-record',
    ].every((id) => items.some((item) => item.id === id && item.status === 'closure-ready'));
  }

  private manualHandoffsReady(items: FinalCanaryReleaseClosureItem[]): boolean {
    return [
      'manual-release-decision-handoff',
      'incident-commander-handoff',
      'support-bridge-handoff',
    ].every((id) => items.some((item) => item.id === id && item.status === 'operator-ready'));
  }
}

function linkedItem(input: {
  id: FinalCanaryReleaseClosureItem['id'];
  surface: FinalCanaryReleaseClosureItem['surface'];
  command: string;
  evidence: string;
}): FinalCanaryReleaseClosureItem {
  return buildItem(input, 'source-gate', 'linked', true);
}

function closureItem(input: {
  id: FinalCanaryReleaseClosureItem['id'];
  surface: FinalCanaryReleaseClosureItem['surface'];
  command: string;
  evidence: string;
}): FinalCanaryReleaseClosureItem {
  const mode: FinalCanaryReleaseClosureItem['mode'] = input.surface === 'release-handoff'
    ? 'release-handoff'
    : 'closure-evidence';
  return buildItem(input, mode, 'closure-ready', true);
}

function operatorItem(input: {
  id: FinalCanaryReleaseClosureItem['id'];
  surface: FinalCanaryReleaseClosureItem['surface'];
  command: string;
  evidence: string;
}): FinalCanaryReleaseClosureItem {
  return buildItem(input, 'operator-handoff', 'operator-ready', false);
}

function lockedItem(input: {
  id: FinalCanaryReleaseClosureItem['id'];
  surface: FinalCanaryReleaseClosureItem['surface'];
  command: string;
  evidence: string;
}): FinalCanaryReleaseClosureItem {
  return buildItem(input, 'policy-lock', 'locked', false);
}

function buildItem(
  input: {
    id: FinalCanaryReleaseClosureItem['id'];
    surface: FinalCanaryReleaseClosureItem['surface'];
    command: string;
    evidence: string;
  },
  mode: FinalCanaryReleaseClosureItem['mode'],
  status: FinalCanaryReleaseClosureItem['status'],
  dryRunOnly: boolean,
): FinalCanaryReleaseClosureItem {
  return {
    ...input,
    mode,
    status,
    receipt: `final-canary-release-closure.${input.id}.receipt`,
    requiredForClosure: true,
    dryRunOnly,
    manualReleaseDecisionRecorded: false,
    releaseExecuted: false,
    canaryStarted: false,
    canaryExpanded: false,
    rollbackExecuted: false,
    pauseExecuted: false,
    publishesPackage: false,
    createsRelease: false,
    movesTag: false,
    mutatesRemoteState: false,
    secretValuesSerialized: false,
  };
}

function gate(input: FinalCanaryReleaseClosureGate): FinalCanaryReleaseClosureGate {
  return input;
}
