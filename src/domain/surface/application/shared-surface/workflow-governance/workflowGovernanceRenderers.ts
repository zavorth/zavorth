import type { PermissionRequest } from '../../../../../contracts/PermissionRequest.js';
import type { SelfmodOptimizationAnalysis } from '../../../../../contracts/SelfmodOptimizationContract.js';

type PermissionListStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'all';

type SelfModificationPreviewResult = {
  success: boolean;
  mode: 'file' | 'goal';
  previewId?: string;
  relativePath?: string;
  summary: string;
  diffSummary?: string;
  validationPlan?: string[];
  changeCount?: number;
  resourceImpact?: string;
  optimizationAnalysis?: SelfmodOptimizationAnalysis;
};

type SelfModificationApplyResult = {
  success: boolean;
  mode: 'file' | 'goal';
  previewId: string;
  summary: string;
  relativePath?: string;
  diffSummary?: string;
  changeId?: string;
  changeCount?: number;
};

type SelfModificationRollbackResult = {
  success: boolean;
  changeId: string;
  summary: string;
  restoredFiles: number;
};

export function formatPermissionListReply(
  permissions: PermissionRequest[],
  status: PermissionListStatus,
): string {
  const lines = [
    'Permissoes do Zavorth',
    '',
    `Status: ${status}.`,
    `Total visivel: ${permissions.length}.`,
  ];

  if (permissions.length === 0) {
    lines.push('', 'Nenhuma permissao encontrada nesse filtro.');
    return lines.join('\n');
  }

  lines.push('', 'Itens em foco:');
  for (const permission of permissions.slice(0, 8)) {
    lines.push(
      `- ${permission.permission_id} | ${permission.status} | ${permission.executor}/${permission.kind}`,
      `  ${permission.reason}`,
    );
  }
  return lines.join('\n');
}

export function formatPermissionDetailsReply(permission: PermissionRequest): string {
  return [
    'Detalhe da permissao',
    '',
    `ID: ${permission.permission_id}`,
    `Status: ${permission.status} | scope: ${permission.scope}.`,
    `Executor: ${permission.executor} | kind: ${permission.kind}.`,
    `Workspace: ${permission.workspace || 'n/d'}.`,
    `Valor pedido: ${permission.requested_value || 'n/d'}.`,
    `Valor resolvido: ${permission.resolved_value || 'n/d'}.`,
    `Solicitado por: ${permission.requested_by || 'n/d'} | decidido por: ${permission.decided_by || 'n/d'}.`,
    `Motivo: ${permission.reason}`,
    permission.decision_note ? `Nota: ${permission.decision_note}` : null,
  ].filter(Boolean).join('\n');
}

export function formatPermissionDecisionReply(
  permission: PermissionRequest,
  action: 'approve' | 'reject',
): string {
  return [
    action === 'approve' ? 'Permissao aprovada.' : 'Permissao rejeitada.',
    '',
    `ID: ${permission.permission_id}`,
    `Status: ${permission.status}.`,
    `Executor: ${permission.executor} | kind: ${permission.kind}.`,
    permission.decision_note ? `Nota: ${permission.decision_note}` : null,
    `Comandos uteis agora: /perm show ${permission.permission_id} | /perm list ${permission.status}.`,
  ].filter(Boolean).join('\n');
}

export function renderSelfModificationUsage(): string {
  return [
    'Uso do selfmod guardado:',
    'selfmod <arquivo_relativo> -- <instrucao>',
    'selfmod preview <arquivo_relativo> -- <instrucao>',
    'selfmod goal -- <objetivo>',
    'selfmod apply <preview_id>',
    'selfmod rollback <change_id>',
  ].join('\n');
}

export function formatSelfModificationPreviewReply(result: SelfModificationPreviewResult): string {
  const lines = [
    result.success ? 'Preview de auto-modificacao pronto.' : 'Preview de auto-modificacao bloqueado.',
    '',
    result.summary,
    result.previewId ? `Preview: ${result.previewId}.` : null,
    result.relativePath ? `Arquivo: ${result.relativePath}.` : null,
    result.changeCount ? `Mudancas planejadas: ${result.changeCount}.` : null,
    result.resourceImpact ? `Impacto estimado: ${result.resourceImpact}.` : null,
    ...formatSelfmodOptimizationAnalysis(result.optimizationAnalysis),
    result.previewId ? `Proximo passo: selfmod apply ${result.previewId}` : null,
    result.validationPlan?.length
      ? `Validacao: ${result.validationPlan.slice(0, 4).join(' | ')}`
      : null,
    result.diffSummary ? ['', result.diffSummary] : null,
  ].flat().filter(Boolean) as string[];
  return lines.join('\n');
}

export function formatSelfmodOptimizationAnalysis(
  analysis?: SelfmodOptimizationAnalysis,
): Array<string | null> {
  if (!analysis) {
    return [];
  }

  const rollbackPercent = Math.round(analysis.rollbackConfidence * 100);
  return [
    `Delta de recursos: ${analysis.resourceDelta.summary}.`,
    analysis.resourceDelta.notes.length
      ? `Notas de impacto: ${analysis.resourceDelta.notes.slice(0, 2).join(' | ')}`
      : null,
    `Risco de runtime: ${analysis.runtimeRisk.level} (score ${analysis.runtimeRisk.score}).`,
    analysis.runtimeRisk.reasons.length
      ? `Por que isso pesa: ${analysis.runtimeRisk.reasons.slice(0, 2).join(' | ')}`
      : null,
    analysis.companionImpact.companionIds.length
      ? `Impacto em companions: ${analysis.companionImpact.summary}`
      : null,
    analysis.companionImpact.recommendedActions.length
      ? `Acoes sugeridas: ${analysis.companionImpact.recommendedActions.slice(0, 2).join(' | ')}`
      : null,
    `Confianca de rollback: ${rollbackPercent}% (${analysis.rollbackConfidenceLabel}).`,
    analysis.patternSignals.length
      ? `Memoria de padrao: ${analysis.patternSignals.slice(0, 2).map((entry) => entry.summary).join(' | ')}`
      : null,
    analysis.opportunities.length
      ? `Otimizacoes sugeridas: ${analysis.opportunities.slice(0, 2).map((entry) => entry.title).join(' | ')}`
      : null,
  ];
}

export function formatSelfModificationApplyReply(result: SelfModificationApplyResult): string {
  return [
    result.success ? 'Auto-modificacao aplicada.' : 'Auto-modificacao nao aplicada.',
    '',
    result.summary,
    `Preview: ${result.previewId}.`,
    result.relativePath ? `Arquivo: ${result.relativePath}.` : null,
    result.changeId ? `Change ID: ${result.changeId}.` : null,
    result.changeCount ? `Arquivos alterados: ${result.changeCount}.` : null,
    result.changeId ? `Rollback: selfmod rollback ${result.changeId}` : null,
    result.diffSummary ? ['', result.diffSummary] : null,
  ].flat().filter(Boolean).join('\n');
}

export function formatSelfModificationRollbackReply(result: SelfModificationRollbackResult): string {
  return [
    result.success ? 'Rollback de selfmod concluido.' : 'Rollback de selfmod nao concluido.',
    '',
    result.summary,
    `Change ID: ${result.changeId}.`,
    `Arquivos restaurados: ${result.restoredFiles}.`,
  ].join('\n');
}
