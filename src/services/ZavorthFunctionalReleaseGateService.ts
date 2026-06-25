import type {
  ZavorthFunctionalClosureItem,
  ZavorthFunctionalClosurePriority,
  ZavorthFunctionalReleaseGateSnapshot,
} from '../contracts/native/ZavorthFunctionalClosureContract.js';

type Runtime = {
  now?: () => Date;
};

type PrioritySummary = {
  total: number;
  closed: number;
  blocking: number;
};

export class ZavorthFunctionalReleaseGateService {
  private readonly now: () => Date;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public buildSnapshot(items: ZavorthFunctionalClosureItem[]): ZavorthFunctionalReleaseGateSnapshot {
    const blockers = [
      ...this.blockersForPriority(items, 'P0'),
      ...this.blockersForPriority(items, 'P1'),
      ...this.blockersForPriority(items, 'P2'),
    ];
    const p0 = this.prioritySummary(items, 'P0');
    const p1 = this.prioritySummary(items, 'P1');
    const p2 = this.prioritySummary(items, 'P2');

    return {
      status: blockers.length === 0 ? 'passed' : 'failed',
      generatedAt: this.now().toISOString(),
      p0,
      p1,
      p2,
      blockers,
      releaseAllowed: blockers.length === 0,
      policy: {
        p0MustBeReceiptBacked: true,
        p1MustHaveFunctionalPackOrOwnerDecision: true,
        p2MustHaveOptionalPackOrNonGoalDecision: true,
        blockOnAnyFail: true,
      },
    };
  }

  private prioritySummary(
    items: ZavorthFunctionalClosureItem[],
    priority: ZavorthFunctionalClosurePriority,
  ): PrioritySummary {
    const scoped = items.filter((item) => item.priority === priority);
    const blocking = this.blockersForPriority(items, priority).length;
    return {
      total: scoped.length,
      closed: scoped.length - blocking,
      blocking,
    };
  }

  private blockersForPriority(
    items: ZavorthFunctionalClosureItem[],
    priority: ZavorthFunctionalClosurePriority,
  ): string[] {
    return items
      .filter((item) => item.priority === priority)
      .flatMap((item) => this.itemBlockers(item));
  }

  private itemBlockers(item: ZavorthFunctionalClosureItem): string[] {
    const blockers: string[] = [];
    if (item.status === 'fail') {
      blockers.push(`${item.id} failed its functional proof.`);
    }
    if (item.receiptIds.length === 0) {
      blockers.push(`${item.id} has no receipt-backed proof.`);
    }
    if (item.priority === 'P0' && !['implemented', 'replaced', 'rejected', 'owner-waived'].includes(item.decision)) {
      blockers.push(`${item.id} has invalid P0 decision ${item.decision}.`);
    }
    if (item.priority === 'P1' && !['implemented', 'replaced', 'optional-pack', 'rejected', 'owner-waived'].includes(item.decision)) {
      blockers.push(`${item.id} has invalid P1 decision ${item.decision}.`);
    }
    if (item.priority === 'P2' && !['optional-pack', 'rejected', 'owner-waived', 'implemented', 'replaced'].includes(item.decision)) {
      blockers.push(`${item.id} has invalid P2 decision ${item.decision}.`);
    }
    return blockers;
  }
}
