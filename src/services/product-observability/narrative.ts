import type {
  ApprovalExecutorStat,
  ApprovedPolicyStat,
  ExecutorStat,
  ProductObservabilitySnapshot,
  SurfaceSourceStat,
  WeightedCount,
  WorkflowOverview,
  WorkflowResumeStageStat,
} from './types.js';
import { formatDurationMs } from './shared.js';

export function buildInsights(input: {
  scope: ProductObservabilitySnapshot['scope'];
  routeStrategies: WeightedCount[];
  workspaceStats: WeightedCount[];
  surfaceSources: SurfaceSourceStat[];
  workflowOverviews: WorkflowOverview[];
  executorStats: ExecutorStat[];
  approvalExecutorStats: ApprovalExecutorStat[];
  routeLearning: ProductObservabilitySnapshot['learning']['routes'];
  approvedPolicyLearning: ApprovedPolicyStat[];
  workflowResumeStages: WorkflowResumeStageStat[];
  approvals: ProductObservabilitySnapshot['approvals'];
  operatorCost: ProductObservabilitySnapshot['operatorCost'];
  totals: ProductObservabilitySnapshot['totals'];
}): string[] {
  const lines: string[] = [];
  if (input.scope.scoped) {
    const parts = [
      input.scope.workspace ? `workspace ${input.scope.workspace}` : null,
      input.scope.sourceSurface ? `surface ${input.scope.sourceSurface}` : null,
      input.scope.executor ? `executor ${input.scope.executor}` : null,
      input.scope.workflow ? `workflow ${input.scope.workflow}` : null,
    ].filter((value): value is string => Boolean(value));
    if (parts.length > 0) {
      lines.push(`Leitura filtrada for ${parts.join(' | ')}.`);
    }
  } else if (input.workspaceStats[0]) {
    lines.push(`Workspace mais active recente: ${input.workspaceStats[0].label} (${input.workspaceStats[0].count} evento(s)).`);
  }
  if (input.routeStrategies[0]) {
    lines.push(`Route dominante da window: ${input.routeStrategies[0].label} (${input.routeStrategies[0].count} request(s)).`);
  }
  const resumable = input.workflowOverviews.find((run) => Boolean(run.resume_stage_label));
  if (resumable) {
    lines.push(`Workflow ready for resumption: ${resumable.workflow} in ${resumable.resume_stage_label}.`);
  }
  const recoveredWorkflow = input.workflowOverviews.find((run) => run.recovered_from_interruption);
  if (recoveredWorkflow) {
    lines.push(
      `Workflow resumed successfully recently: ${recoveredWorkflow.workflow}${recoveredWorkflow.last_interrupted_stage_label ? ` after ${recoveredWorkflow.last_interrupted_stage_label}` : ''}.`,
    );
  }
  if (input.executorStats[0]) {
    const topExecutor = input.executorStats[0];
    lines.push(`Most effective recent executor: ${topExecutor.executor} (${topExecutor.completed}/${topExecutor.total} completed).`);
  }
  if (input.routeLearning.topSuccessful[0]) {
    const topRoute = input.routeLearning.topSuccessful[0];
    lines.push(
      `Melhor rota recente: ${topRoute.executor} for ${topRoute.kind}/${topRoute.subtype} `
      + `(${topRoute.completed}/${topRoute.total} completed(s))`
      + `${topRoute.gatedArtifactful > 0 ? `, com ${topRoute.gatedArtifactful} delivery/deliveries after approval` : ''}`
      + `${topRoute.workflowRecoveryArtifactful > 0 ? `, com ${topRoute.workflowRecoveryArtifactful} resumption(s) entregue(s)` : ''}.`,
    );
  }
  if (input.routeLearning.highestOperatorCost[0]) {
    const costlyRoute = input.routeLearning.highestOperatorCost[0];
    lines.push(
      `Highest recent operational cost: ${costlyRoute.executor} in ${costlyRoute.kind}/${costlyRoute.subtype}`
      + `${costlyRoute.average_approval_wait_ms > 0 ? `, espera media ${formatDurationMs(costlyRoute.average_approval_wait_ms)}` : ''}`
      + `${costlyRoute.average_post_approval_recovery_ms > 0 ? `, average resume time ${formatDurationMs(costlyRoute.average_post_approval_recovery_ms)}` : ''}.`,
    );
  }
  if (
    input.operatorCost.averageApprovalWaitMs > 0
    || input.operatorCost.averageRecoveryMs > 0
    || input.operatorCost.averageArtifactDeliveryMs > 0
  ) {
    lines.push(
      `Custo medio for o operador na window:`
      + `${input.operatorCost.averageApprovalWaitMs > 0 ? ` approval in ${formatDurationMs(input.operatorCost.averageApprovalWaitMs)}` : ''}`
      + `${input.operatorCost.averageRecoveryMs > 0 ? `${input.operatorCost.averageApprovalWaitMs > 0 ? ',' : ''} resumption in ${formatDurationMs(input.operatorCost.averageRecoveryMs)}` : ''}`
      + `${input.operatorCost.averageArtifactDeliveryMs > 0 ? `${input.operatorCost.averageApprovalWaitMs > 0 || input.operatorCost.averageRecoveryMs > 0 ? ',' : ''} entrega final in ${formatDurationMs(input.operatorCost.averageArtifactDeliveryMs)}` : ''}.`,
    );
  }
  if (input.approvalExecutorStats[0]) {
    const friction = input.approvalExecutorStats[0];
    if (friction.pending + friction.rejected + friction.high_risk + friction.permissions > 0) {
      lines.push(`Maior operational friction recente: ${friction.executor} (${friction.pending} pending(s), ${friction.rejected} rejection(s)).`);
    }
  }
  if (input.approvedPolicyLearning[0]) {
    lines.push(`Politica mais liberada recentemente: ${input.approvedPolicyLearning[0].kind} for ${input.approvedPolicyLearning[0].executor}.`);
  }
  if (input.surfaceSources[0]) {
    lines.push(`surface mais active recente: ${input.surfaceSources[0].label} (${input.surfaceSources[0].count} evento(s)).`);
  }
  if (input.workflowResumeStages[0]) {
    lines.push(`Stage that keeps the most workflows safe: ${input.workflowResumeStages[0].workflow} in ${input.workflowResumeStages[0].stage_label}.`);
  }
  if (input.totals.artifacts > 0) {
    lines.push(`Entregas observadas na window: ${input.totals.artifacts}.`);
  }
  if (input.approvals.permissionPending > 0) {
    lines.push(`There are still ${input.approvals.permissionPending} pending permission(s) in the observed period.`);
  }
  return lines.slice(0, 10);
}
