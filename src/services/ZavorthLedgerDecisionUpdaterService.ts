import type {
  ZavorthFunctionalClosureItem,
  ZavorthLedgerDecisionUpdaterSnapshot,
} from '../contracts/native/ZavorthFunctionalClosureContract.js';

type Runtime = {
  now?: () => Date;
};

export class ZavorthLedgerDecisionUpdaterService {
  private readonly now: () => Date;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public buildSnapshot(items: ZavorthFunctionalClosureItem[]): ZavorthLedgerDecisionUpdaterSnapshot {
    const updates = items.map((item) => {
      const receiptBacked = item.receiptIds.length > 0;
      return {
        itemId: item.id,
        gate: item.gate,
        currentDecision: item.decision,
        proposedDecision: item.decision,
        canUpdate: receiptBacked && item.status !== 'fail',
        receiptBacked,
        receiptIds: item.receiptIds.slice(),
        reason: receiptBacked ? `Decision ${item.decision} is backed by ${item.receiptIds.length} receipt(s).`
          : 'Decision cannot be updated because no receipt exists.',
      };
    });
    const blockedUpdates = updates.filter((update) => !update.canUpdate).length;

    return {
      status: blockedUpdates === 0 ? 'pass' : 'warn',
      generatedAt: this.now().toISOString(),
      updatesApplied: false,
      previewOnly: true,
      updates,
      blockedUpdates,
      receiptBackedUpdates: updates.filter((update) => update.receiptBacked).length,
      policy: {
        neverUpdateWithoutReceipt: true,
        previewOnlyByDefault: true,
        ownerDecisionPreserved: true,
      },
    };
  }
}
