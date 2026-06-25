import type {
  ZavorthFunctionalClosureDecision,
  ZavorthFunctionalClosureItem,
  ZavorthFunctionalClosureItemStatus,
  ZavorthFunctionalClosurePriority,
  ZavorthFunctionalClosureReceipt,
  ZavorthFunctionalClosureSnapshot,
} from '../contracts/native/ZavorthFunctionalClosureContract.js';
import { ZavorthFunctionalClosureService } from './ZavorthFunctionalClosureService.js';
import type {
  ZavorthSemanticFunctionalClosureCertificationSnapshot,
  ZavorthSemanticFunctionalClosureCertificationStatus,
  ZavorthSemanticFunctionalClosureClaim,
  ZavorthSemanticFunctionalClosureClaimKind,
  ZavorthSemanticFunctionalClosureClaimPriority,
  ZavorthSemanticFunctionalClosureClaimStatus,
  ZavorthSemanticFunctionalClosureScenario,
} from '../contracts/ZavorthSemanticFunctionalClosureCertificationContract.js';
import { ZAVORTH_SEMANTIC_FUNCTIONAL_CLOSURE_CERTIFICATION_CONTRACT_VERSION } from '../contracts/ZavorthSemanticFunctionalClosureCertificationContract.js';

type Runtime = {
  now?: () => Date;
  rootDir?: string;
  closureService?: Pick<ZavorthFunctionalClosureService, 'buildSnapshot'>;
};

type ClaimInput = {
  idSeed?: string;
  kind: ZavorthSemanticFunctionalClosureClaimKind;
  status: ZavorthSemanticFunctionalClosureClaimStatus;
  priority: ZavorthSemanticFunctionalClosureClaimPriority;
  phase?: number;
  itemId?: string;
  closurePriority?: ZavorthFunctionalClosurePriority;
  decision?: ZavorthFunctionalClosureDecision;
  sourceStatus?: ZavorthSemanticFunctionalClosureClaim['sourceStatus'];
  risk?: ZavorthSemanticFunctionalClosureClaim['risk'];
  expectedBehavior: string;
  zavorthEquivalent: string;
  evidence: string[];
  receiptIds?: string[];
  notes?: string[];
};

const RECEIPT_PREFIX = 'zavorth.semantic.s9.functional-closure';

export class ZavorthSemanticFunctionalClosureCertificationService {
  private readonly now: () => Date;
  private readonly closureService: Pick<ZavorthFunctionalClosureService, 'buildSnapshot'>;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.closureService = runtime.closureService || new ZavorthFunctionalClosureService({
      now: this.now,
      rootDir: runtime.rootDir,
    });
  }

  public async buildSnapshot(): Promise<ZavorthSemanticFunctionalClosureCertificationSnapshot> {
    const closure = await this.closureService.buildSnapshot();
    const scenarios = this.buildScenarios(closure);
    const claims = this.buildClaims(closure, scenarios);
    const gaps = claims.filter((claim) => claim.status === 'gap').length;
    const status: ZavorthSemanticFunctionalClosureCertificationStatus =
      closure.status === 'passed'
      && gaps === 0
      && scenarios.every((scenario) => scenario.status === 'passed')
      && closure.summary.releaseAllowed
      && closure.summary.machineReadableReceipt
      && closure.summary.liveExternalIoPerformed === false
      && closure.summary.secretValuesSerialized === false
        ? 'passed'
        : 'failed';

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_SEMANTIC_FUNCTIONAL_CLOSURE_CERTIFICATION_CONTRACT_VERSION,
      status,
      semanticPhase: 'S9',
      statement: 'Full functional closure semantics certify every absorbed or intentionally optional capability family as machine-readable, release-gated and receipt-backed.',
      closureStatus: closure.status,
      closureContractVersion: closure.contractVersion,
      runtime: closure.runtime,
      claims,
      scenarios,
      summary: {
        semanticClaims: claims.length,
        covered: countStatus(claims, 'covered'),
        ownerGated: countStatus(claims, 'owner-gated'),
        rejected: countStatus(claims, 'rejected'),
        gaps,
        p0Claims: countPriority(claims, 'P0'),
        p1Claims: countPriority(claims, 'P1'),
        p2Claims: countPriority(claims, 'P2'),
        receiptBackedClaims: claims.filter((claim) => claim.receiptIds.length > 0).length,
        itemClaimsCertified: claims.filter((claim) => claim.kind === 'closure-item-coverage').length,
        receiptClaimsCertified: claims.filter((claim) => claim.kind === 'closure-receipt-coverage').length,
        priorityPoliciesCertified: claims.filter((claim) => claim.kind === 'priority-closure-policy').length,
        decisionPoliciesCertified: claims.filter((claim) => claim.kind === 'decision-closure-policy').length,
        scenariosPassed: scenarios.filter((scenario) => scenario.status === 'passed').length,
        closureItems: closure.summary.items,
        closureReceipts: closure.summary.receipts,
        p0Items: closure.summary.p0Items,
        p1Items: closure.summary.p1Items,
        p2Items: closure.summary.p2Items,
        passedItems: closure.summary.passed,
        warnedItems: closure.summary.warned,
        failedItems: closure.summary.failed,
        implemented: closure.summary.implemented,
        replaced: closure.summary.replaced,
        optionalPacks: closure.summary.optionalPacks,
        ownerWaived: closure.summary.ownerWaived,
        rejectedItems: closure.summary.rejected,
        releaseAllowed: closure.summary.releaseAllowed,
        releaseBlockers: closure.releaseGate.blockers.length,
        ledgerUpdatesPreviewOnly: true,
        ledgerUpdatesApplied: false,
        machineReadableReceipt: true,
        liveExternalIoPerformed: false,
        secretValuesSerialized: false,
        sourceCodeCopied: false,
      },
      policy: {
        semanticClaimRequiredForEveryClosureItem: true,
        semanticClaimRequiredForEveryClosureReceipt: true,
        allP0ClosedWithProof: true,
        allP1ClosedWithPackOrOwnerDecision: true,
        allP2ClosedWithOptionalPathOrNonGoal: true,
        optionalPacksExplicit: true,
        ledgerUpdatesRequireReceipts: true,
        ledgerUpdatesPreviewOnlyByDefault: true,
        releaseGateBlocksP0Regression: true,
        releaseGateMustPass: true,
        dashboardMustBeMachineReadable: true,
        noLiveIoInClosureCommand: true,
        artifactFirstReceipts: true,
        noSecretValuesSerialized: true,
        defaultLedgerMutationRejected: true,
        releaseWithBlockersRejected: true,
        unreceiptedClosureRejected: true,
        gapsBlockRelease: true,
      },
      commands: {
        inspect: 'npm run semantic-functional-closure-certification --silent',
        inspectJson: 'npm run semantic-functional-closure-certification:json --silent',
        check: 'npm run semantic-functional-closure-certification:check --silent',
        qa: 'npm run qa:semantic-functional-closure-certification --silent',
        releaseGate: 'npm run semantic-functional-closure-certification -- --release-gate --require-pass',
        nextStep: 'Semantic functional closure complete',
      },
    };
  }

  public formatSnapshotText(snapshot: ZavorthSemanticFunctionalClosureCertificationSnapshot): string {
    const lines = [
      'Zavorth Semantic Functional Closure Certification - S9',
      `Status: ${snapshot.status}`,
      `Contract: ${snapshot.contractVersion}`,
      `Closure status: ${snapshot.closureStatus}`,
      `Claims: ${snapshot.summary.semanticClaims}`,
      `Covered/owner-gated/rejected/gaps: ${snapshot.summary.covered}/${snapshot.summary.ownerGated}/${snapshot.summary.rejected}/${snapshot.summary.gaps}`,
      `P0/P1/P2 claims: ${snapshot.summary.p0Claims}/${snapshot.summary.p1Claims}/${snapshot.summary.p2Claims}`,
      `Receipt-backed claims: ${snapshot.summary.receiptBackedClaims}`,
      `Item/receipt claims: ${snapshot.summary.itemClaimsCertified}/${snapshot.summary.receiptClaimsCertified}`,
      `Priority/decision policies: ${snapshot.summary.priorityPoliciesCertified}/${snapshot.summary.decisionPoliciesCertified}`,
      `Scenarios passed: ${snapshot.summary.scenariosPassed}/${snapshot.scenarios.length}`,
      `Closure items P0/P1/P2: ${snapshot.summary.p0Items}/${snapshot.summary.p1Items}/${snapshot.summary.p2Items}`,
      `Closure passed/warned/failed: ${snapshot.summary.passedItems}/${snapshot.summary.warnedItems}/${snapshot.summary.failedItems}`,
      `Release allowed: ${snapshot.summary.releaseAllowed}`,
      `Release blockers: ${snapshot.summary.releaseBlockers}`,
      `Machine-readable receipt: ${snapshot.summary.machineReadableReceipt}`,
      `Live external I/O performed: ${snapshot.summary.liveExternalIoPerformed}`,
      `Secret values serialized: ${snapshot.summary.secretValuesSerialized}`,
      'Claim groups:',
      ...snapshot.claims.map((claim) =>
        `- ${claim.status} ${claim.priority} ${claim.id}: ${claim.expectedBehavior} -> ${claim.zavorthEquivalent}`,
      ),
      `Next: ${snapshot.commands.nextStep}`,
    ];
    return lines.join('\n');
  }

  public formatReleaseGateText(snapshot: ZavorthSemanticFunctionalClosureCertificationSnapshot): string {
    return [
      `Zavorth Semantic Functional Closure Release Gate: ${snapshot.status}`,
      `Release allowed: ${snapshot.summary.releaseAllowed}`,
      `Gaps: ${snapshot.summary.gaps}`,
      `Release blockers: ${snapshot.summary.releaseBlockers}`,
      `P0/P1/P2 items: ${snapshot.summary.p0Items}/${snapshot.summary.p1Items}/${snapshot.summary.p2Items}`,
    ].join('\n');
  }

  private buildClaims(
    closure: ZavorthFunctionalClosureSnapshot,
    scenarios: ZavorthSemanticFunctionalClosureScenario[],
  ): ZavorthSemanticFunctionalClosureClaim[] {
    return [
      ...closure.items.map((item) => this.itemClaim(item)),
      ...closure.receipts.map((receipt) => this.receiptClaim(receipt)),
      ...this.priorityPolicyClaims(closure),
      ...this.decisionPolicyClaims(closure),
      this.dashboardClaim(closure),
      this.ledgerUpdateClaim(closure),
      this.releaseGateClaim(closure),
      this.machineReadableClaim(closure),
      this.liveIoClaim(closure),
      this.artifactReceiptClaim(closure),
      ...this.scenarioClaims(scenarios),
      ...this.unsafeClosureClaims(closure),
    ];
  }

  private itemClaim(item: ZavorthFunctionalClosureItem): ZavorthSemanticFunctionalClosureClaim {
    return this.claim({
      kind: 'closure-item-coverage',
      status: itemStatus(item.status),
      priority: item.priority,
      phase: item.phase,
      itemId: item.id,
      closurePriority: item.priority,
      decision: item.decision,
      sourceStatus: item.status,
      risk: item.risk,
      expectedBehavior: `${item.label} is represented as a functional closure item with command, decision and receipts.`,
      zavorthEquivalent: 'ZavorthFunctionalClosureItem in the Certification matrix machine-readable closure snapshot.',
      evidence: [
        `phase=${item.phase}`,
        `category=${item.category}`,
        `priority=${item.priority}`,
        `decision=${item.decision}`,
        `status=${item.status}`,
        `receiptCount=${item.receiptCount}`,
        `risk=${item.risk}`,
        `command=${item.command}`,
        `observed=${item.observed}`,
      ],
      receiptIds: item.receiptIds,
      notes: item.notes,
    });
  }

  private receiptClaim(receipt: ZavorthFunctionalClosureReceipt): ZavorthSemanticFunctionalClosureClaim {
    return this.claim({
      kind: 'closure-receipt-coverage',
      idSeed: receipt.id,
      status: itemStatus(receipt.status),
      priority: receipt.priority,
      phase: receipt.phase,
      itemId: receipt.itemId,
      closurePriority: receipt.priority,
      decision: receipt.decision,
      sourceStatus: receipt.status,
      expectedBehavior: `${receipt.itemId} closure receipt is machine-readable, artifact-first and policy-safe.`,
      zavorthEquivalent: 'ZavorthFunctionalClosureReceipt emitted for each closure item.',
      evidence: [
        `phase=${receipt.phase}`,
        `status=${receipt.status}`,
        `decision=${receipt.decision}`,
        `machineReadable=${receipt.machineReadable}`,
        `artifactFirst=${receipt.artifactFirst}`,
        `receiptBacked=${receipt.receiptBacked}`,
        `liveExternalIoPerformed=${receipt.liveExternalIoPerformed}`,
        `secretValuesSerialized=${receipt.secretValuesSerialized}`,
        `command=${receipt.command}`,
      ],
      receiptIds: [receipt.id],
      notes: [receipt.reason],
    });
  }

  private priorityPolicyClaims(closure: ZavorthFunctionalClosureSnapshot): ZavorthSemanticFunctionalClosureClaim[] {
    return (['P0', 'P1', 'P2'] as ZavorthFunctionalClosurePriority[]).map((priority) => {
      const items = closure.items.filter((item) => item.priority === priority);
      const failed = items.filter((item) => item.status === 'fail').length;
      const allReceiptBacked = items.every((item) => item.receiptCount > 0);
      return this.claim({
        kind: 'priority-closure-policy',
        status: failed === 0 && allReceiptBacked ? 'covered' : 'gap',
        priority,
        closurePriority: priority,
        expectedBehavior: `${priority} closure items are closed with receipts and no blocking failures.`,
        zavorthEquivalent: 'ZavorthFunctionalReleaseGate priority counters and closure item receipts.',
        evidence: [
          `items=${items.length}`,
          `failed=${failed}`,
          `receiptBacked=${items.filter((item) => item.receiptCount > 0).length}`,
          `gateClosed=${gateClosedForPriority(closure, priority)}`,
        ],
        receiptIds: items.flatMap((item) => item.receiptIds),
        notes: [`${priority} closure policy is checked by the semantic S9 release gate.`],
      });
    });
  }

  private decisionPolicyClaims(closure: ZavorthFunctionalClosureSnapshot): ZavorthSemanticFunctionalClosureClaim[] {
    const decisions = [...new Set(closure.items.map((item) => item.decision))].sort() as ZavorthFunctionalClosureDecision[];
    return decisions.map((decision) => {
      const items = closure.items.filter((item) => item.decision === decision);
      return this.claim({
        kind: 'decision-closure-policy',
        status: items.every((item) => item.status !== 'fail' && item.receiptCount > 0) ? 'covered' : 'gap',
        priority: decision === 'implemented' ? 'P0' : 'P1',
        decision,
        expectedBehavior: `Decision ${decision} is explicit, receipt-backed and release-safe in the final closure ledger.`,
        zavorthEquivalent: 'Closure item decision plus ledger decision updater preview.',
        evidence: [
          `items=${items.length}`,
          `statuses=${items.map((item) => item.status).join(',')}`,
          `receiptCount=${items.reduce((sum, item) => sum + item.receiptCount, 0)}`,
        ],
        receiptIds: items.flatMap((item) => item.receiptIds),
        notes: ['Decision-level certification prevents hidden implicit adoption.'],
      });
    });
  }

  private dashboardClaim(closure: ZavorthFunctionalClosureSnapshot): ZavorthSemanticFunctionalClosureClaim {
    return this.claim({
      kind: 'dashboard-policy',
      status: closure.dashboard.status !== 'fail'
        && closure.dashboard.categoryRows.length === closure.items.length
        && closure.dashboard.receiptRows.length === closure.items.length
          ? 'covered'
          : 'gap',
      priority: 'P1',
      sourceStatus: closure.dashboard.status,
      expectedBehavior: 'Functional closure dashboard exposes category, risk and receipt rows for every closure item.',
      zavorthEquivalent: 'ZavorthFunctionalClosureDashboardSnapshot with report and machine-readable rows.',
      evidence: [
        `dashboardStatus=${closure.dashboard.status}`,
        `categoryRows=${closure.dashboard.categoryRows.length}`,
        `riskRows=${closure.dashboard.riskRows.length}`,
        `receiptRows=${closure.dashboard.receiptRows.length}`,
        `reportLength=${closure.dashboard.report.length}`,
      ],
      receiptIds: [`${RECEIPT_PREFIX}.dashboard.${closure.generatedAt}`],
      notes: ['Dashboard is a view over the closure ledger, not a separate source of truth.'],
    });
  }

  private ledgerUpdateClaim(closure: ZavorthFunctionalClosureSnapshot): ZavorthSemanticFunctionalClosureClaim {
    return this.claim({
      kind: 'ledger-update-policy',
      status: closure.ledgerDecisionUpdater.previewOnly
        && closure.ledgerDecisionUpdater.updatesApplied === false
        && closure.ledgerDecisionUpdater.blockedUpdates === 0
          ? 'covered'
          : 'gap',
      priority: 'P0',
      sourceStatus: closure.ledgerDecisionUpdater.status,
      expectedBehavior: 'Ledger decision updates are preview-only by default and require receipts before mutation.',
      zavorthEquivalent: 'ZavorthLedgerDecisionUpdaterSnapshot with updatesApplied=false and receipt-backed updates.',
      evidence: [
        `previewOnly=${closure.ledgerDecisionUpdater.previewOnly}`,
        `updatesApplied=${closure.ledgerDecisionUpdater.updatesApplied}`,
        `updates=${closure.ledgerDecisionUpdater.updates.length}`,
        `blockedUpdates=${closure.ledgerDecisionUpdater.blockedUpdates}`,
        `receiptBackedUpdates=${closure.ledgerDecisionUpdater.receiptBackedUpdates}`,
      ],
      receiptIds: closure.ledgerDecisionUpdater.updates.flatMap((update) => update.receiptIds),
      notes: ['S9 never mutates ledger decisions as a side effect.'],
    });
  }

  private releaseGateClaim(closure: ZavorthFunctionalClosureSnapshot): ZavorthSemanticFunctionalClosureClaim {
    return this.claim({
      kind: 'release-gate-policy',
      status: closure.releaseGate.status === 'passed'
        && closure.releaseGate.releaseAllowed
        && closure.releaseGate.blockers.length === 0
          ? 'covered'
          : 'gap',
      priority: 'P0',
      sourceStatus: closure.releaseGate.status,
      expectedBehavior: 'Functional release gate passes only when P0/P1/P2 closure policies have no blockers.',
      zavorthEquivalent: 'ZavorthFunctionalReleaseGateSnapshot with priority counters and releaseAllowed.',
      evidence: [
        `status=${closure.releaseGate.status}`,
        `releaseAllowed=${closure.releaseGate.releaseAllowed}`,
        `p0=${closure.releaseGate.p0.closed}/${closure.releaseGate.p0.total}/${closure.releaseGate.p0.blocking}`,
        `p1=${closure.releaseGate.p1.closed}/${closure.releaseGate.p1.total}/${closure.releaseGate.p1.blocking}`,
        `p2=${closure.releaseGate.p2.closed}/${closure.releaseGate.p2.total}/${closure.releaseGate.p2.blocking}`,
        `blockers=${closure.releaseGate.blockers.length}`,
      ],
      receiptIds: closure.receipts.map((receipt) => receipt.id),
      notes: ['Release gate is the S9 go/no-go proof.'],
    });
  }

  private machineReadableClaim(closure: ZavorthFunctionalClosureSnapshot): ZavorthSemanticFunctionalClosureClaim {
    return this.claim({
      kind: 'machine-readable-policy',
      status: closure.summary.machineReadableReceipt
        && closure.receipts.every((receipt) => receipt.machineReadable)
          ? 'covered'
          : 'gap',
      priority: 'P0',
      expectedBehavior: 'Functional closure emits machine-readable receipts for every capability family.',
      zavorthEquivalent: 'Closure summary machineReadableReceipt plus per-item receipt machineReadable flags.',
      evidence: [
        `machineReadableReceipt=${closure.summary.machineReadableReceipt}`,
        `machineReadableReceipts=${closure.receipts.filter((receipt) => receipt.machineReadable).length}`,
        `receipts=${closure.receipts.length}`,
      ],
      receiptIds: closure.receipts.map((receipt) => receipt.id),
      notes: ['Machine-readable closure is what makes the final claim auditable.'],
    });
  }

  private liveIoClaim(closure: ZavorthFunctionalClosureSnapshot): ZavorthSemanticFunctionalClosureClaim {
    return this.claim({
      kind: 'live-io-policy',
      status: closure.summary.liveExternalIoPerformed === false
        && closure.summary.secretValuesSerialized === false
        && closure.receipts.every((receipt) => receipt.liveExternalIoPerformed === false)
        && closure.receipts.every((receipt) => receipt.secretValuesSerialized === false)
          ? 'covered'
          : 'gap',
      priority: 'P0',
      expectedBehavior: 'Functional closure command performs no live external I/O and serializes no secret values.',
      zavorthEquivalent: 'Closure summary and receipt policy flags.',
      evidence: [
        `summaryLiveExternalIoPerformed=${closure.summary.liveExternalIoPerformed}`,
        `summarySecretValuesSerialized=${closure.summary.secretValuesSerialized}`,
        `receiptLiveExternalIo=${closure.receipts.some((receipt) => receipt.liveExternalIoPerformed)}`,
        `receiptSecretValues=${closure.receipts.some((receipt) => receipt.secretValuesSerialized)}`,
      ],
      receiptIds: closure.receipts.map((receipt) => receipt.id),
      notes: ['S9 closes local evidence; live activation remains separate.'],
    });
  }

  private artifactReceiptClaim(closure: ZavorthFunctionalClosureSnapshot): ZavorthSemanticFunctionalClosureClaim {
    return this.claim({
      kind: 'artifact-receipt-policy',
      status: closure.policy.artifactFirstReceipts
        && closure.receipts.every((receipt) => receipt.artifactFirst)
        && closure.summary.receiptBackedItems === closure.summary.items
          ? 'covered'
          : 'gap',
      priority: 'P0',
      expectedBehavior: 'Every closure item is artifact-first and receipt-backed.',
      zavorthEquivalent: 'Closure receipts plus receiptBackedItems summary.',
      evidence: [
        `artifactFirstReceipts=${closure.policy.artifactFirstReceipts}`,
        `receiptBackedItems=${closure.summary.receiptBackedItems}`,
        `items=${closure.summary.items}`,
        `receipts=${closure.summary.receipts}`,
      ],
      receiptIds: closure.receipts.map((receipt) => receipt.id),
      notes: ['No closure item is accepted without a receipt.'],
    });
  }

  private scenarioClaims(
    scenarios: ZavorthSemanticFunctionalClosureScenario[],
  ): ZavorthSemanticFunctionalClosureClaim[] {
    return scenarios.map((scenario) => this.claim({
      kind: scenario.id === 'ledger-updater-preview-only'
        ? 'ledger-update-policy'
        : scenario.id === 'release-gate-allows-without-live-io'
          ? 'release-gate-policy'
          : scenario.id === 'optional-packs-are-explicit'
            ? 'decision-closure-policy'
            : 'priority-closure-policy',
      status: scenario.status === 'passed' ? 'covered' : 'gap',
      priority: scenario.id === 'all-p0-closed-with-receipts' ? 'P0' : 'P1',
      expectedBehavior: scenarioBehavior(scenario.id),
      zavorthEquivalent: scenarioEquivalent(scenario.id),
      evidence: scenario.evidence,
      receiptIds: scenario.receiptIds,
      notes: ['Scenario proves final closure behavior without mutating ledger or running live I/O.'],
    }));
  }

  private unsafeClosureClaims(closure: ZavorthFunctionalClosureSnapshot): ZavorthSemanticFunctionalClosureClaim[] {
    return [
      this.claim({
        kind: 'unsafe-closure-policy',
        status: closure.ledgerDecisionUpdater.updatesApplied === false ? 'rejected' : 'gap',
        priority: 'P0',
        expectedBehavior: 'The architecture must reject default ledger mutation during semantic closure.',
        zavorthEquivalent: 'Ledger updater previewOnly and updatesApplied=false.',
        evidence: [
          `previewOnly=${closure.ledgerDecisionUpdater.previewOnly}`,
          `updatesApplied=${closure.ledgerDecisionUpdater.updatesApplied}`,
        ],
        receiptIds: [`${RECEIPT_PREFIX}.reject.default-ledger-mutation`],
        notes: ['Rejected here means intentionally blocked by policy.'],
      }),
      this.claim({
        kind: 'unsafe-closure-policy',
        status: closure.releaseGate.blockers.length === 0 ? 'rejected' : 'gap',
        priority: 'P0',
        expectedBehavior: 'The architecture must reject release when closure blockers exist.',
        zavorthEquivalent: 'Release gate blocks fail/blocking closure rows.',
        evidence: [
          `blockers=${closure.releaseGate.blockers.length}`,
          `releaseAllowed=${closure.releaseGate.releaseAllowed}`,
        ],
        receiptIds: [`${RECEIPT_PREFIX}.reject.release-with-blockers`],
        notes: ['Rejected here means release-with-blockers is intentionally impossible.'],
      }),
      this.claim({
        kind: 'unsafe-closure-policy',
        status: closure.summary.receiptBackedItems === closure.summary.items ? 'rejected' : 'gap',
        priority: 'P0',
        expectedBehavior: 'The architecture must reject unreceipted functional closure items.',
        zavorthEquivalent: 'Receipt-backed items must equal all closure items.',
        evidence: [
          `receiptBackedItems=${closure.summary.receiptBackedItems}`,
          `items=${closure.summary.items}`,
        ],
        receiptIds: [`${RECEIPT_PREFIX}.reject.unreceipted-closure-item`],
        notes: ['Rejected here means unreceipted closure is intentionally not accepted.'],
      }),
      this.claim({
        kind: 'unsafe-closure-policy',
        status: closure.summary.liveExternalIoPerformed === false
          && closure.summary.secretValuesSerialized === false
            ? 'rejected'
            : 'gap',
        priority: 'P0',
        expectedBehavior: 'The architecture must reject live external I/O and secret serialization in final semantic closure.',
        zavorthEquivalent: 'Closure command only aggregates local receipts and metadata.',
        evidence: [
          `liveExternalIoPerformed=${closure.summary.liveExternalIoPerformed}`,
          `secretValuesSerialized=${closure.summary.secretValuesSerialized}`,
        ],
        receiptIds: [`${RECEIPT_PREFIX}.reject.live-io-or-secret-serialization`],
        notes: ['Rejected here means S9 remains a local certification path.'],
      }),
    ];
  }

  private buildScenarios(closure: ZavorthFunctionalClosureSnapshot): ZavorthSemanticFunctionalClosureScenario[] {
    const p0Items = closure.items.filter((item) => item.priority === 'P0');
    const optionalItems = closure.items.filter((item) => item.decision === 'optional-pack');
    return [
      {
        id: 'all-p0-closed-with-receipts',
        status: p0Items.every((item) => item.status === 'pass' && item.receiptCount > 0)
          && closure.releaseGate.p0.blocking === 0
            ? 'passed'
            : 'failed',
        evidence: [
          `p0Items=${p0Items.length}`,
          `p0ReceiptBacked=${p0Items.filter((item) => item.receiptCount > 0).length}`,
          `p0Blocking=${closure.releaseGate.p0.blocking}`,
        ],
        receiptIds: p0Items.flatMap((item) => item.receiptIds),
        liveExternalIoPerformed: false,
        secretValuesSerialized: false,
        updatesApplied: false,
        releaseAllowed: closure.releaseGate.releaseAllowed,
      },
      {
        id: 'optional-packs-are-explicit',
        status: optionalItems.length > 0
          && optionalItems.every((item) => item.status === 'pass' && item.receiptCount > 0)
            ? 'passed'
            : 'failed',
        evidence: [
          `optionalPacks=${optionalItems.length}`,
          `optionalItemIds=${optionalItems.map((item) => item.id).join(',')}`,
          `optionalStatuses=${optionalItems.map((item) => item.status).join(',')}`,
        ],
        receiptIds: optionalItems.flatMap((item) => item.receiptIds),
        liveExternalIoPerformed: false,
        secretValuesSerialized: false,
        updatesApplied: false,
        releaseAllowed: closure.releaseGate.releaseAllowed,
      },
      {
        id: 'ledger-updater-preview-only',
        status: closure.ledgerDecisionUpdater.previewOnly
          && closure.ledgerDecisionUpdater.updatesApplied === false
          && closure.ledgerDecisionUpdater.blockedUpdates === 0
            ? 'passed'
            : 'failed',
        evidence: [
          `previewOnly=${closure.ledgerDecisionUpdater.previewOnly}`,
          `updatesApplied=${closure.ledgerDecisionUpdater.updatesApplied}`,
          `updates=${closure.ledgerDecisionUpdater.updates.length}`,
          `blockedUpdates=${closure.ledgerDecisionUpdater.blockedUpdates}`,
        ],
        receiptIds: closure.ledgerDecisionUpdater.updates.flatMap((update) => update.receiptIds),
        liveExternalIoPerformed: false,
        secretValuesSerialized: false,
        updatesApplied: false,
        releaseAllowed: closure.releaseGate.releaseAllowed,
      },
      {
        id: 'release-gate-allows-without-live-io',
        status: closure.releaseGate.releaseAllowed
          && closure.releaseGate.blockers.length === 0
          && closure.summary.liveExternalIoPerformed === false
          && closure.summary.secretValuesSerialized === false
            ? 'passed'
            : 'failed',
        evidence: [
          `releaseAllowed=${closure.releaseGate.releaseAllowed}`,
          `blockers=${closure.releaseGate.blockers.length}`,
          `liveExternalIoPerformed=${closure.summary.liveExternalIoPerformed}`,
          `secretValuesSerialized=${closure.summary.secretValuesSerialized}`,
        ],
        receiptIds: closure.receipts.map((receipt) => receipt.id),
        liveExternalIoPerformed: false,
        secretValuesSerialized: false,
        updatesApplied: false,
        releaseAllowed: closure.releaseGate.releaseAllowed,
      },
    ];
  }

  private claim(input: ClaimInput): ZavorthSemanticFunctionalClosureClaim {
    const id = `${input.kind}:${slug([
      input.idSeed ? `seed-${smallHash(input.idSeed)}` : undefined,
      input.phase,
      input.itemId,
      input.closurePriority,
      input.decision,
      input.expectedBehavior,
    ].filter(Boolean).join('-'))}`;
    return {
      id,
      kind: input.kind,
      status: input.status,
      priority: input.priority,
      ...(input.phase !== undefined ? { phase: input.phase } : {}),
      ...(input.itemId ? { itemId: input.itemId } : {}),
      ...(input.closurePriority ? { closurePriority: input.closurePriority } : {}),
      ...(input.decision ? { decision: input.decision } : {}),
      ...(input.sourceStatus ? { sourceStatus: input.sourceStatus } : {}),
      ...(input.risk ? { risk: input.risk } : {}),
      expectedBehavior: input.expectedBehavior,
      zavorthEquivalent: input.zavorthEquivalent,
      evidence: input.evidence,
      receiptIds: input.receiptIds || [`${RECEIPT_PREFIX}.${id}`],
      notes: input.notes || [],
    };
  }
}

function itemStatus(status: ZavorthFunctionalClosureItemStatus): ZavorthSemanticFunctionalClosureClaimStatus {
  if (status === 'pass') return 'covered';
  if (status === 'warn') return 'owner-gated';
  return 'gap';
}

function gateClosedForPriority(
  closure: ZavorthFunctionalClosureSnapshot,
  priority: ZavorthFunctionalClosurePriority,
): string {
  const gate = priority === 'P0' ? closure.releaseGate.p0 : priority === 'P1' ? closure.releaseGate.p1 : closure.releaseGate.p2;
  return `${gate.closed}/${gate.total}/blocking=${gate.blocking}`;
}

function scenarioBehavior(id: ZavorthSemanticFunctionalClosureScenario['id']): string {
  switch (id) {
    case 'all-p0-closed-with-receipts':
      return 'Every P0 functional closure item must be passing and receipt-backed.';
    case 'optional-packs-are-explicit':
      return 'Optional capability packs must remain explicit decisions with receipts.';
    case 'ledger-updater-preview-only':
      return 'Ledger decision updater must remain preview-only during final semantic closure.';
    case 'release-gate-allows-without-live-io':
      return 'Release gate must pass without live external I/O or secret serialization.';
    default:
      return 'Functional closure scenario must pass.';
  }
}

function scenarioEquivalent(id: ZavorthSemanticFunctionalClosureScenario['id']): string {
  switch (id) {
    case 'all-p0-closed-with-receipts':
      return 'Release gate P0 counters plus closure item receipt ids.';
    case 'optional-packs-are-explicit':
      return 'Optional-pack closure item decisions for channel and skill ecosystem capacity.';
    case 'ledger-updater-preview-only':
      return 'ZavorthLedgerDecisionUpdaterSnapshot previewOnly policy.';
    case 'release-gate-allows-without-live-io':
      return 'ZavorthFunctionalReleaseGateSnapshot plus closure local-only flags.';
    default:
      return 'Zavorth semantic functional closure scenario receipt.';
  }
}

function countStatus(
  claims: ZavorthSemanticFunctionalClosureClaim[],
  status: ZavorthSemanticFunctionalClosureClaimStatus,
): number {
  return claims.filter((claim) => claim.status === status).length;
}

function countPriority(
  claims: ZavorthSemanticFunctionalClosureClaim[],
  priority: ZavorthSemanticFunctionalClosureClaimPriority,
): number {
  return claims.filter((claim) => claim.priority === priority).length;
}

function smallHash(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function slug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 96);
}
