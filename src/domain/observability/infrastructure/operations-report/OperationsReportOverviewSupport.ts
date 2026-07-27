import type { ProductObservabilitySnapshot } from '../../../../observability/ProductObservabilityService.js';
import type {
  OperationsReportOverviewReaders,
  OperationsReportOverviewSection,
  OperationsReportOverviewSnapshotLike,
  OperationsReportProductSupport,
  OperationsReportSnapshot,
} from './OperationsReportTypes.js';

export class OperationsReportOverviewSupport implements OperationsReportProductSupport {
  public buildProductExecutiveSummary(snapshot: ProductObservabilitySnapshot): string[] {
    const lines: string[] = [];
    if (snapshot.routes.strategies[0]) {
      lines.push(`Route mais frequente: ${snapshot.routes.strategies[0].label} (${snapshot.routes.strategies[0].count}).`);
    }
    if (snapshot.workflows.recent[0]) {
      const run = snapshot.workflows.recent[0];
      const resume = run.resume_stage_label ? `, resumption em ${run.resume_stage_label}` : '';
      lines.push(`Workflow em destaque: ${run.workflow} | ${run.status}${resume}.`);
    }
    if (snapshot.executors.top[0]) {
      const executor = snapshot.executors.top[0];
      lines.push(`Executor lider: ${executor.executor} (${executor.completed}/${executor.total} completed(s)).`);
    }
    if (snapshot.approvals.pending > 0 || snapshot.approvals.permissionPending > 0) {
      lines.push(
        `Approval queue: ${snapshot.approvals.pending} task(s) e ${snapshot.approvals.permissionPending} pending permission(s).`,
      );
    }
    return lines.slice(0, 4);
  }

  public buildProductObservabilitySummary(
    snapshot: ProductObservabilitySnapshot,
  ): NonNullable<OperationsReportSnapshot['productObservability']> {
    const topRoute = snapshot.routes.strategies[0];
    const topWorkflow = snapshot.workflows.recent[0];
    const topExecutor = snapshot.executors.top[0];
    const topArtifact = snapshot.artifacts.topKinds[0];

    return {
      routeHeadline: topRoute ? `${topRoute.label} lidera com ${topRoute.count} request(s) recentes`
        : null,
      workflowHeadline: topWorkflow
        ? `${topWorkflow.workflow} ${topWorkflow.status}${topWorkflow.resume_stage_label ? ` | resume em ${topWorkflow.resume_stage_label}` : ''}`
        : null,
      executorHeadline: topExecutor ? `${topExecutor.executor} with ${Math.round(topExecutor.success_rate * 100)}% rate across ${topExecutor.total} execution(s)`
        : null,
      approvalsHeadline:
        snapshot.approvals.pending > 0 || snapshot.approvals.permissionPending > 0
          ? `${snapshot.approvals.pending} task(s) and ${snapshot.approvals.permissionPending} pending permission(s)`
          : 'No relevant approval pending items',
      artifactHeadline: topArtifact ? `${snapshot.totals.artifacts} delivery item(s) na window; ${topArtifact.label}/${topArtifact.type} lidera`
        : (snapshot.totals.artifacts > 0 ? `${snapshot.totals.artifacts} delivery item(s) observadas` : 'without entregas recentes'),
      topRoutes: snapshot.routes.taskSubtypes
        .slice(0, 3)
        .map((entry) => `${entry.kind}/${entry.label}:${entry.count}`),
      recentWorkflows: snapshot.workflows.recent
        .slice(0, 3)
        .map((run) => `${run.workflow}:${run.status}${run.resume_stage_label ? `:${run.resume_stage_label}` : ''}`),
      topExecutors: snapshot.executors.top
        .slice(0, 3)
        .map((entry) => `${entry.executor}:${entry.completed}/${entry.total}`),
      insights: snapshot.insights.slice(0, 4),
    };
  }

  public async buildOverviewSections(
    readers: OperationsReportOverviewReaders,
  ): Promise<OperationsReportSnapshot['overviews']> {
    const [operational, trust, product] = await Promise.all([
      this.readOverviewSnapshot(readers.readOperationalOverviewSnapshot),
      this.readOverviewSnapshot(readers.readTrustOverviewSnapshot),
      this.readOverviewSnapshot(readers.readProductOverviewSnapshot),
    ]);

    return {
      operational: this.normalizeOverviewSection(operational),
      trust: this.normalizeOverviewSection(trust),
      product: this.normalizeOverviewSection(product),
    };
  }

  private async readOverviewSnapshot(
    reader?: (() => Promise<OperationsReportOverviewSnapshotLike> | OperationsReportOverviewSnapshotLike) | null,
  ): Promise<OperationsReportOverviewSnapshotLike> {
    if (!reader) {
      return null;
    }

    return Promise.resolve()
      .then(() => reader())
      .catch(() => null);
  }

  private normalizeOverviewSection(
    snapshot: OperationsReportOverviewSnapshotLike,
  ): OperationsReportOverviewSection | null {
    if (!snapshot) {
      return null;
    }

    const actions = Array.isArray(snapshot.actions)
      ? snapshot.actions
        .slice(0, 4)
        .map((action) => ({
          source: String(action?.source || 'overview'),
          label: String(action?.label || 'Action recomendada'),
          command: action?.command ? String(action.command) : null,
          reason: String(action?.reason || 'without detalhe.'),
        }))
      : [];

    return {
      generatedAt: snapshot.generatedAt ? String(snapshot.generatedAt) : null,
      posture: String(snapshot.summary?.posture || 'attention'),
      headline: String(snapshot.narrative?.headline || 'Overview canonical'),
      operatorSummary: String(snapshot.narrative?.operatorSummary || 'without summary canonical available.'),
      nextAction: snapshot.narrative?.nextAction ? String(snapshot.narrative.nextAction) : null,
      actions,
    };
  }
}
