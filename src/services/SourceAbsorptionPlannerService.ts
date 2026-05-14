import type {
  SourceAbsorptionPlannerItem,
  SourceAbsorptionPlannerSnapshot,
  SourceAbsorptionTarget,
  SourceSurfaceCategory,
  SourceSurfaceLedgerEntry,
} from '../contracts/SourceSurfaceLedgerContract.js';

type SourceAbsorptionPlannerRuntime = {
  now?: () => Date;
};

export class SourceAbsorptionPlannerService {
  private readonly now: () => Date;

  constructor(runtime: SourceAbsorptionPlannerRuntime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public buildPlan(entries: SourceSurfaceLedgerEntry[]): SourceAbsorptionPlannerSnapshot {
    const items = entries.map((entry) => this.planItem(entry))
      .sort((left, right) => {
        if (left.phase !== right.phase) return left.phase - right.phase;
        return left.sourcePath.localeCompare(right.sourcePath);
      });

    return {
      generatedAt: this.now().toISOString(),
      summary: {
        items: items.length,
        byPhase: countBy(items, (item) => String(item.phase)),
        byTarget: countByTarget(items),
        ownerDecisionRequired: items.filter((item) => item.ownerDecisionRequired).length,
      },
      items,
    };
  }

  private planItem(entry: SourceSurfaceLedgerEntry): SourceAbsorptionPlannerItem {
    const target = classifyTarget(entry);
    return {
      entryId: entry.id,
      category: entry.category,
      sourcePath: entry.sourcePath,
      priority: entry.priority,
      decision: entry.decision,
      ownerDecisionRequired: entry.ownerDecisionRequired,
      target,
      phase: phaseForTarget(entry.category, target),
      reason: reasonForTarget(entry.category, target, entry.ownerDecisionRequired),
    };
  }
}

function classifyTarget(entry: SourceSurfaceLedgerEntry): SourceAbsorptionTarget {
  if (entry.decision === 'implemented') return 'already-implemented';
  if (entry.decision === 'rejected') return 'rejected';

  switch (entry.category) {
    case 'native_app':
      return 'native-capability';
    case 'internal_package':
      return 'core';
    case 'script_group':
    case 'github_workflow':
    case 'support_surface':
    case 'dependency_patch':
      return entry.decision === 'waived' && !entry.ownerDecisionRequired ? 'non-goal' : 'qa-gate';
    case 'runtime_dependency':
      return 'dependency-pack';
    case 'skill':
      return 'optional-pack';
    case 'src_module':
    case 'src_singleton_file':
      return entry.priority === 'P0' ? 'core' : 'optional-pack';
    case 'root_directory':
    case 'root_file':
      return entry.priority === 'P0' ? 'core' : 'non-goal';
    default:
      return 'non-goal';
  }
}

function phaseForTarget(category: SourceSurfaceCategory, target: SourceAbsorptionTarget): number {
  if (target === 'already-implemented' || target === 'rejected' || target === 'non-goal') return 0;
  if (category === 'internal_package') return 1;
  if (category === 'runtime_dependency') return 2;
  if (target === 'dependency-pack') return 3;
  if (category === 'native_app') return 6;
  if (target === 'qa-gate') return 7;
  if (category === 'skill') return 8;
  return 9;
}

function reasonForTarget(
  category: SourceSurfaceCategory,
  target: SourceAbsorptionTarget,
  ownerDecisionRequired: boolean,
): string {
  if (ownerDecisionRequired) {
    return `${category} requires owner decision before functional absorption.`;
  }
  switch (target) {
    case 'already-implemented':
      return `${category} is already implemented and should stay under regression proof.`;
    case 'rejected':
      return `${category} is explicitly rejected by the ledger.`;
    case 'core':
      return `${category} should become or remain a Zavorth-native core contract/check.`;
    case 'optional-pack':
      return `${category} should be absorbed as an optional policy-gated pack.`;
    case 'dependency-pack':
      return `${category} should be absorbed only through a typed optional runtime dependency pack.`;
    case 'native-capability':
      return `${category} should be represented by native capability contracts before wrappers.`;
    case 'qa-gate':
      return `${category} should become a local QA/security/release gate.`;
    case 'non-goal':
      return `${category} remains waived unless a later product need promotes it.`;
    default:
      return `${category} has no planned absorption target.`;
  }
}

function countBy<T>(items: T[], key: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const value = key(item);
    counts[value] = (counts[value] || 0) + 1;
  }
  return counts;
}

function countByTarget(items: SourceAbsorptionPlannerItem[]): Record<SourceAbsorptionTarget, number> {
  const counts = {
    core: 0,
    'optional-pack': 0,
    'qa-gate': 0,
    'dependency-pack': 0,
    'native-capability': 0,
    'non-goal': 0,
    'already-implemented': 0,
    rejected: 0,
  };
  for (const item of items) {
    counts[item.target] += 1;
  }
  return counts;
}
