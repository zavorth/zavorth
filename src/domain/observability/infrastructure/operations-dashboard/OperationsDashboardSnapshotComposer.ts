import type { OperationsHealthSnapshot } from '../../../../observability/OperationsHealthService.js';
import {
  buildCockpitActions,
  buildCockpitAlerts,
  buildCockpitHighlights,
  buildCockpitHeadline,
  buildCockpitSummary,
  resolveCockpitStatus,
} from './index.js';
import type {
  OperationsCockpitSnapshot,
  RuntimeStats,
} from './OperationsCockpitTypes.js';
import { formatUptime } from './OperationsCockpitTextHelpers.js';

export class OperationsCockpitSnapshotComposer {
  public constructor(private readonly deps: { now: () => Date }) {}

  public composeSnapshot(
    operations: OperationsHealthSnapshot,
    stats: RuntimeStats,
  ): OperationsCockpitSnapshot {
    const alerts = buildCockpitAlerts(operations);
    const actions = buildCockpitActions(operations);
    const summary = buildCockpitSummary(this.deps.now, operations);
    const status = resolveCockpitStatus(operations, alerts, summary);

    return {
      generatedAt: this.deps.now().toISOString(),
      status,
      headline: buildCockpitHeadline(status, summary, alerts),
      highlights: buildCockpitHighlights(this.deps.now, operations, summary),
      runtime: {
        uptimeLabel: formatUptime(stats.uptime_seconds),
        memoryLabel: `${stats.ram_mb_rss} MB RSS`,
        heapLabel: `${stats.ram_mb_heap} MB heap`,
        platformLabel: `${stats.platform} / ${stats.cpu_arch}`,
        sampledAt: typeof stats.timestamp === 'string' ? stats.timestamp : null,
      },
      summary,
      actions,
      alerts,
      operations,
    };
  }
}
