import { Task } from '@zavorth/contracts/TaskContract.js';
import {
  PermissionAccessLevel,
  PermissionCommandMatchType,
  PermissionRequest,
  PermissionScope,
  PermissionStatus,
} from '@zavorth/contracts/PermissionRequest.js';

export type TelegramPermissionDescriptorNormalization = {
  normalizePermissionAccessLevel(value: unknown): PermissionAccessLevel;
  normalizePermissionCommandMatchType(value: unknown): PermissionCommandMatchType;
};

export class TelegramPermissionDescriptorService {
  constructor(private readonly normalization: TelegramPermissionDescriptorNormalization) {}

  public describePermissionStatus(status: PermissionStatus | 'all'): string {
    switch (status) {
      case 'pending':
        return 'pending';
      case 'approved':
        return 'approved';
      case 'rejected':
        return 'rejected';
      case 'expired':
        return 'expired';
      case 'all':
      default:
        return 'all statuses';
    }
  }

  public describePermissionSubject(permission: PermissionRequest): string {
    if (permission.executor === 'external_executor' && permission.kind === 'agent_binding') {
      return 'ExternalExecutor Agent';
    }
    if (permission.executor === 'external_executor' && permission.kind === 'workspace_access') {
      return 'Extra folder access for ExternalExecutor';
    }
    if (permission.executor === 'file_delivery' && permission.kind === 'workspace_access') {
      return permission.metadata?.permission_source === 'file_inspection'
        ? 'Local file inspection'
        : 'Local read for file delivery';
    }
    if (permission.executor === 'aistudio' && permission.kind === 'builtin_tool_access') {
      return 'Tools do Google AI Studio';
    }
    if (permission.executor === 'aistudio' && permission.kind === 'service_access') {
      return 'Servico externo do Google AI Studio';
    }
    if (permission.executor === 'zavorthBridge' && permission.kind === 'ui_permission') {
      return 'Permissao visivel do ZavorthBridge';
    }
    if (permission.kind === 'command_access') {
      return 'Comando sensivel';
    }
    if (permission.kind === 'workspace_access') {
      return 'Acesso a pasta';
    }
    return `${permission.executor} / ${permission.kind}`;
  }

  public describePermissionScope(scope: PermissionScope): string {
    switch (scope) {
      case 'once':
        return 'somente esta tarefa';
      case 'session':
        return 'somente esta conversa';
      case 'workspace':
        return 'neste projeto';
      case 'persistent':
        return 'persistente';
      default:
        return scope;
    }
  }

  public resolveExternalExecutorAgentRole(task: Task): string {
    const role =
      task.metadata?.external_executor_agent_role ||
      task.metadata?.target_agent ||
      task.metadata?.external_executor_stage_role;

    return String(role || 'default').trim().toLowerCase();
  }

  public resolveExternalExecutorAgentRoleFromInput(assignments: Record<string, string>): string {
    const role = assignments.role || assignments.agent_role || assignments.phase || '';
    return String(role || 'default').trim().toLowerCase();
  }

  public getExternalExecutorAgentRole(permission: PermissionRequest): string {
    return String(permission.metadata?.agent_role || 'default').trim().toLowerCase();
  }

  public extractAiStudioPermissionValues(permission: PermissionRequest): string[] {
    const metadataValues =
      permission.kind === 'builtin_tool_access'
        ? permission.metadata?.requested_tools
        : permission.kind === 'service_access'
          ? permission.metadata?.requested_services
          : [];

    const explicitValues = Array.isArray(metadataValues)
      ? metadataValues.filter(
          (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0,
        )
      : [];
    const fallbackValues = this.parseCommaSeparatedValues(
      String(permission.resolved_value || permission.requested_value || ''),
    );

    return this.mergeNormalizedValues(explicitValues, fallbackValues);
  }

  public describeAiStudioPermissionValues(permission: PermissionRequest): string {
    const values = this.extractAiStudioPermissionValues(permission);
    return values.length > 0 ? values.join(', ') : 'nao informado';
  }

  public getPermissionAccessLevel(permission: PermissionRequest): PermissionAccessLevel {
    return this.normalization.normalizePermissionAccessLevel(
      permission.metadata?.access_level || permission.metadata?.access || permission.metadata?.mode,
    );
  }

  public describePermissionAccessLevel(permission: PermissionRequest): string {
    return this.getPermissionAccessLevel(permission) === 'read_write'
      ? 'leitura e escrita'
      : 'somente leitura e listagem';
  }

  public getPermissionCommandMatchType(permission: PermissionRequest): PermissionCommandMatchType {
    return this.normalization.normalizePermissionCommandMatchType(
      permission.metadata?.match_type || permission.metadata?.match || permission.metadata?.rule,
    );
  }

  public describePermissionCommandMatchType(permission: PermissionRequest): string {
    return this.getPermissionCommandMatchType(permission) === 'prefix'
      ? 'prefixo de comando'
      : 'comando exato';
  }

  public mergeNormalizedValues(...collections: Array<Iterable<string> | null | undefined>): string[] {
    const values = new Set<string>();
    for (const collection of collections) {
      if (!collection) {
        continue;
      }

      for (const value of collection) {
        const normalized = String(value || '').trim().toLowerCase();
        if (normalized) {
          values.add(normalized);
        }
      }
    }

    return Array.from(values);
  }

  private parseCommaSeparatedValues(value: string): string[] {
    return String(value || '')
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean);
  }
}
