import type { PermissionRequest } from '../../contracts/PermissionRequest.js';
import { FinalResponseFormattingService } from '../../services/FinalResponseFormattingService.js';
import type { TelegramPermissionPresentationPolicy } from './TelegramPermissionPresentationTypes.js';

export class TelegramPermissionDecisionPresentationService {
  private readonly formatter = new FinalResponseFormattingService();

  constructor(private readonly policy: TelegramPermissionPresentationPolicy) {}

  public formatPermissionDecisionMessage(
    permission: PermissionRequest,
    action: 'approve' | 'reject' | 'edit',
  ): string {
    const shortId = this.policy.shortPermissionId(permission);
    const scopeLabel = this.policy.describePermissionScope(permission.scope);

    if (permission.executor === 'external_executor' && permission.kind === 'workspace_access') {
      const resolvedPath = String(
        permission.resolved_value || permission.requested_value || 'caminho nao informado',
      ).trim();
      const accessLabel = this.policy.describePermissionAccessLevel(permission);
      if (action === 'approve') {
        return this.formatter.formatPermissionDecision({
          title: 'Acesso do ExternalExecutor liberado.',
          shortId,
          summaryLines: [
            `Pasta liberada: ${resolvedPath}`,
            `Nivel: ${accessLabel}`,
            `Escopo: ${scopeLabel}`,
          ],
          nextStep: 'Perfeito. Vou retomar a mesma tarefa agora com esse caminho liberado.',
        });
      }

      if (action === 'reject') {
        return this.formatter.formatPermissionDecision({
          title: 'Pedido de acesso do ExternalExecutor recusado.',
          shortId,
          summaryLines: [
            `Pasta recusada: ${resolvedPath}`,
            `Nivel pedido: ${accessLabel}`,
            `Escopo: ${scopeLabel}`,
          ],
        });
      }
    }

    if (permission.executor === 'file_delivery' && permission.kind === 'workspace_access') {
      const resolvedPath = String(
        permission.resolved_value || permission.requested_value || 'caminho nao informado',
      ).trim();
      const accessLabel = this.policy.describePermissionAccessLevel(permission);
      const isInspection = permission.metadata?.permission_source === 'file_inspection';
      if (action === 'approve') {
        return this.formatter.formatPermissionDecision({
          title: isInspection ? 'Acesso local de inspecao liberado.' : 'Acesso local do Zavorth liberado.',
          shortId,
          summaryLines: [
            `Pasta liberada: ${resolvedPath}`,
            `Nivel: ${accessLabel}`,
            `Escopo: ${scopeLabel}`,
          ],
          nextStep: isInspection
            ? 'Perfeito. Vou retomar a comparacao ou inspecao agora.'
            : 'Perfeito. Vou retomar o pedido de listagem ou envio agora.',
        });
      }

      if (action === 'reject') {
        return this.formatter.formatPermissionDecision({
          title: isInspection ? 'Pedido de acesso para inspecao recusado.' : 'Pedido de acesso local recusado.',
          shortId,
          summaryLines: [
            `Pasta recusada: ${resolvedPath}`,
            `Nivel pedido: ${accessLabel}`,
            `Escopo: ${scopeLabel}`,
          ],
        });
      }
    }

    if (permission.executor === 'external_executor' && permission.kind === 'agent_binding') {
      const role = this.policy.getExternalExecutorAgentRole(permission);
      const resolvedAgentId = String(
        permission.resolved_value || permission.requested_value || 'agent nao informado',
      ).trim();
      if (action === 'approve') {
        return this.formatter.formatPermissionDecision({
          title: 'Agent do ExternalExecutor aprovado.',
          shortId,
          summaryLines: [
            `Agent: ${resolvedAgentId}`,
            `Papel: ${role}`,
            `Escopo: ${scopeLabel}`,
          ],
          nextStep: 'Perfeito. Vou retomar a mesma tarefa agora com esse agent.',
        });
      }

      if (action === 'reject') {
        return this.formatter.formatPermissionDecision({
          title: 'Pedido de agent do ExternalExecutor recusado.',
          shortId,
          summaryLines: [
            `Agent sugerido: ${resolvedAgentId}`,
            `Papel: ${role}`,
            `Escopo: ${scopeLabel}`,
          ],
        });
      }
    }

    if (permission.executor === 'zavorthBridge' && permission.kind === 'ui_permission') {
      return this.formatter.formatPermissionDecision({
        title: action === 'approve' ? 'Permissao do ZavorthBridge aprovada.' : 'Permissao do ZavorthBridge rejeitada.',
        shortId,
        summaryLines: [`Escopo: ${scopeLabel}`],
      });
    }

    if (permission.executor === 'aistudio' && permission.kind === 'builtin_tool_access') {
      const tools = this.policy.describeAiStudioPermissionValues(permission);
      if (action === 'approve') {
        return this.formatter.formatPermissionDecision({
          title: 'Tools do Google AI Studio liberadas.',
          shortId,
          summaryLines: [
            `Tools: ${tools}`,
            `Escopo: ${scopeLabel}`,
          ],
          nextStep: 'Perfeito. Vou retomar a mesma tarefa agora com essas tools liberadas.',
        });
      }

      if (action === 'reject') {
        return this.formatter.formatPermissionDecision({
          title: 'Pedido de tools do Google AI Studio recusado.',
          shortId,
          summaryLines: [
            `Tools recusadas: ${tools}`,
            `Escopo: ${scopeLabel}`,
          ],
        });
      }
    }

    if (permission.executor === 'aistudio' && permission.kind === 'service_access') {
      const services = this.policy.describeAiStudioPermissionValues(permission);
      if (action === 'approve') {
        return this.formatter.formatPermissionDecision({
          title: 'Servico do Google AI Studio liberado.',
          shortId,
          summaryLines: [
            `Servico(s): ${services}`,
            `Escopo: ${scopeLabel}`,
          ],
          nextStep: 'Perfeito. Vou retomar a mesma tarefa agora com esse acesso liberado.',
        });
      }

      if (action === 'reject') {
        return this.formatter.formatPermissionDecision({
          title: 'Pedido de servico do Google AI Studio recusado.',
          shortId,
          summaryLines: [
            `Servico(s) recusados: ${services}`,
            `Escopo: ${scopeLabel}`,
          ],
        });
      }
    }

    const prefix = action === 'approve' ? 'Aprovado' : action === 'reject' ? 'Rejeitado' : 'Atualizado';
    return this.formatter.formatPermissionDecision({
      title: `${prefix}: ${this.policy.describePermissionSubject(permission)}.`,
      shortId,
      summaryLines: [`Escopo atual: ${scopeLabel}`],
    });
  }
}
