import type {
  PermissionRequest,
  PermissionStatus,
} from '../../contracts/PermissionRequest.js';
import { FinalResponseFormattingService } from '../../services/FinalResponseFormattingService.js';
import type { TelegramPermissionPresentationPolicy } from './TelegramPermissionPresentationTypes.js';

export class TelegramPermissionReadPresentationService {
  private readonly formatter = new FinalResponseFormattingService();

  constructor(private readonly policy: TelegramPermissionPresentationPolicy) {}

  public formatPermissionList(
    permissions: PermissionRequest[],
    status: PermissionStatus | 'all',
  ): string {
    const statusLabel = this.policy.describePermissionStatus(status);
    return this.formatter.formatPermissionList(
      `${statusLabel} - ${permissions.length} item(ns)`,
      permissions.map((permission) => {
        const scopeInfo =
          permission.scope === 'workspace' && permission.workspace ? ` @ ${permission.workspace}` : '';
        const marker =
          permission.status === 'approved' ? 'OK' : permission.status === 'rejected' ? 'X' : '...';
        const details = [
          `Escopo: ${this.policy.describePermissionScope(permission.scope)}`,
          permission.executor === 'external_executor' && permission.kind === 'agent_binding'
            ? `Papel: ${this.policy.getExternalExecutorAgentRole(permission)}`
            : null,
          permission.kind === 'workspace_access'
            ? `Acesso: ${this.policy.describePermissionAccessLevel(permission)}`
            : null,
          permission.kind === 'command_access'
            ? `Regra de comando: ${this.policy.describePermissionCommandMatchType(permission)}`
            : null,
          `Pedido: ${permission.requested_value || 'n/a'}`,
          permission.resolved_value ? `Resolvido: ${permission.resolved_value}` : null,
        ].filter((value): value is string => Boolean(value));

        return {
          marker,
          headline: `${this.policy.shortPermissionId(permission)} - ${this.policy.describePermissionSubject(permission)}${scopeInfo}`,
          details,
        };
      }),
      `Nao ha pedidos de permissao em ${status === 'all' ? 'qualquer estado' : `estado ${status}`}.`,
    );
  }

  public formatPermissionDetails(permission: PermissionRequest): string {
    return this.formatter.formatPermissionDetails(permission.permission_id, [
      {
        title: 'Resumo',
        lines: [
          `Status: ${this.policy.describePermissionStatus(permission.status)}`,
          `Escopo: ${this.policy.describePermissionScope(permission.scope)}`,
          `Categoria: ${this.policy.describePermissionSubject(permission)}`,
          `Executor interno: ${permission.executor}`,
          `Tipo interno: ${permission.kind}`,
          `Workspace: ${permission.workspace || 'N/A'}`,
          `Papel: ${
            permission.executor === 'external_executor' && permission.kind === 'agent_binding'
              ? this.policy.getExternalExecutorAgentRole(permission)
              : 'N/A'
          }`,
          `Tarefa anexada: ${permission.task_id || 'Nenhuma'}`,
        ],
      },
      {
        title: 'Valores',
        lines: [
          `Valor solicitado: ${permission.requested_value || 'N/A'}`,
          `Valor resolvido: ${permission.resolved_value || 'N/A'}`,
          permission.kind === 'workspace_access'
            ? `Acesso: ${this.policy.describePermissionAccessLevel(permission)}`
            : null,
          permission.kind === 'command_access'
            ? `Regra de comando: ${this.policy.describePermissionCommandMatchType(permission)}`
            : null,
        ],
      },
      {
        title: 'Historico',
        lines: [
          `Motivo: ${permission.reason || 'N/A'}`,
          permission.decision_note ? `Nota da decisao: ${permission.decision_note}` : null,
          `Criada em: ${permission.created_at}`,
          permission.updated_at
            ? `Decidida em: ${permission.updated_at} por ${permission.decided_by}`
            : null,
        ],
      },
    ]);
  }
}
