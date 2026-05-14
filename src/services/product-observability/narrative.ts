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
      input.scope.sourceSurface ? `superficie ${input.scope.sourceSurface}` : null,
      input.scope.executor ? `executor ${input.scope.executor}` : null,
      input.scope.workflow ? `workflow ${input.scope.workflow}` : null,
    ].filter((value): value is string => Boolean(value));
    if (parts.length > 0) {
      lines.push(`Leitura filtrada para ${parts.join(' | ')}.`);
    }
  } else if (input.workspaceStats[0]) {
    lines.push(`Workspace mais ativo recente: ${input.workspaceStats[0].label} (${input.workspaceStats[0].count} evento(s)).`);
  }
  if (input.routeStrategies[0]) {
    lines.push(`Rota dominante da janela: ${input.routeStrategies[0].label} (${input.routeStrategies[0].count} pedido(s)).`);
  }
  const resumable = input.workflowOverviews.find((run) => Boolean(run.resume_stage_label));
  if (resumable) {
    lines.push(`Workflow com retomada pronta: ${resumable.workflow} em ${resumable.resume_stage_label}.`);
  }
  const recoveredWorkflow = input.workflowOverviews.find((run) => run.recovered_from_interruption);
  if (recoveredWorkflow) {
    lines.push(
      `Workflow retomado com sucesso recentemente: ${recoveredWorkflow.workflow}${recoveredWorkflow.last_interrupted_stage_label ? ` depois de ${recoveredWorkflow.last_interrupted_stage_label}` : ''}.`,
    );
  }
  if (input.executorStats[0]) {
    const topExecutor = input.executorStats[0];
    lines.push(`Executor mais efetivo recente: ${topExecutor.executor} (${topExecutor.completed}/${topExecutor.total} concluido(s)).`);
  }
  if (input.routeLearning.topSuccessful[0]) {
    const topRoute = input.routeLearning.topSuccessful[0];
    lines.push(
      `Melhor rota recente: ${topRoute.executor} para ${topRoute.kind}/${topRoute.subtype} `
      + `(${topRoute.completed}/${topRoute.total} concluido(s))`
      + `${topRoute.gatedArtifactful > 0 ? `, com ${topRoute.gatedArtifactful} entrega(s) apos aprovacao` : ''}`
      + `${topRoute.workflowRecoveryArtifactful > 0 ? `, com ${topRoute.workflowRecoveryArtifactful} retomada(s) entregue(s)` : ''}.`,
    );
  }
  if (input.routeLearning.highestOperatorCost[0]) {
    const costlyRoute = input.routeLearning.highestOperatorCost[0];
    lines.push(
      `Maior custo operacional recente: ${costlyRoute.executor} em ${costlyRoute.kind}/${costlyRoute.subtype}`
      + `${costlyRoute.average_approval_wait_ms > 0 ? `, espera media ${formatDurationMs(costlyRoute.average_approval_wait_ms)}` : ''}`
      + `${costlyRoute.average_post_approval_recovery_ms > 0 ? `, retomada media ${formatDurationMs(costlyRoute.average_post_approval_recovery_ms)}` : ''}.`,
    );
  }
  if (
    input.operatorCost.averageApprovalWaitMs > 0
    || input.operatorCost.averageRecoveryMs > 0
    || input.operatorCost.averageArtifactDeliveryMs > 0
  ) {
    lines.push(
      `Custo medio para o operador na janela:`
      + `${input.operatorCost.averageApprovalWaitMs > 0 ? ` aprovacao em ${formatDurationMs(input.operatorCost.averageApprovalWaitMs)}` : ''}`
      + `${input.operatorCost.averageRecoveryMs > 0 ? `${input.operatorCost.averageApprovalWaitMs > 0 ? ',' : ''} retomada em ${formatDurationMs(input.operatorCost.averageRecoveryMs)}` : ''}`
      + `${input.operatorCost.averageArtifactDeliveryMs > 0 ? `${input.operatorCost.averageApprovalWaitMs > 0 || input.operatorCost.averageRecoveryMs > 0 ? ',' : ''} entrega final em ${formatDurationMs(input.operatorCost.averageArtifactDeliveryMs)}` : ''}.`,
    );
  }
  if (input.approvalExecutorStats[0]) {
    const friction = input.approvalExecutorStats[0];
    if (friction.pending + friction.rejected + friction.high_risk + friction.permissions > 0) {
      lines.push(`Maior friccao operacional recente: ${friction.executor} (${friction.pending} pendente(s), ${friction.rejected} rejeicao(oes)).`);
    }
  }
  if (input.approvedPolicyLearning[0]) {
    lines.push(`Politica mais liberada recentemente: ${input.approvedPolicyLearning[0].kind} para ${input.approvedPolicyLearning[0].executor}.`);
  }
  if (input.surfaceSources[0]) {
    lines.push(`Superficie mais ativa recente: ${input.surfaceSources[0].label} (${input.surfaceSources[0].count} evento(s)).`);
  }
  if (input.workflowResumeStages[0]) {
    lines.push(`Etapa que mais segura workflows: ${input.workflowResumeStages[0].workflow} em ${input.workflowResumeStages[0].stage_label}.`);
  }
  if (input.totals.artifacts > 0) {
    lines.push(`Entregas observadas na janela: ${input.totals.artifacts}.`);
  }
  if (input.approvals.permissionPending > 0) {
    lines.push(`Ainda existem ${input.approvals.permissionPending} permissao(oes) pendente(s) no periodo observado.`);
  }
  return lines.slice(0, 10);
}
