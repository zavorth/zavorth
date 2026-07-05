import type {
  PermissionRequest,
  PermissionStatus,
} from '../../../../contracts/PermissionRequest.js';
import { FinalResponseFormattingService } from '../../../../services/FinalResponseFormattingService.js';
import type { TelegramPermissionPresentationPolicy } from '../../../../gateways/channels/telegram/controllers/TelegramPermissionPresentationTypes.js';

export class TelegramPermissionReadPresentationService {
  private readonly formatter = new FinalResponseFormattingService();

  constructor(private readonly policy: TelegramPermissionPresentationPolicy) {}

  public formatPermissionList(
    permissions: PermissionRequest[],
    status: PermissionStatus | 'all',
  ): string {
    const statusLabel = this.policy.describePermissionStatus(status);
    return this.formatter.formatPermissionList(
      `${statusLabel} - ${permissions.length} item(s)`,
      permissions.map((permission) => {
        const scopeInfo =
          permission.scope === 'workspace' && permission.workspace ? ` @ ${permission.workspace}` : '';
        const marker =
          permission.status === 'approved' ? 'OK' : permission.status === 'rejected' ? 'X' : '...';
        const details = [
          `Scope: ${this.policy.describePermissionScope(permission.scope)}`,
          permission.executor === 'external_executor' && permission.kind === 'agent_binding'
            ? `Role: ${this.policy.getExternalExecutorAgentRole(permission)}`
            : null,
          permission.kind === 'workspace_access'
            ? `Access: ${this.policy.describePermissionAccessLevel(permission)}`
            : null,
          permission.kind === 'command_access'
            ? `Command rule: ${this.policy.describePermissionCommandMatchType(permission)}`
            : null,
          `Requested: ${permission.requested_value || 'n/a'}`,
          permission.resolved_value ? `Resolved: ${permission.resolved_value}` : null,
        ].filter((value): value is string => Boolean(value));

        return {
          marker,
          headline: `${this.policy.shortPermissionId(permission)} - ${this.policy.describePermissionSubject(permission)}${scopeInfo}`,
          details,
        };
      }),
      `No permission requests found for ${status === 'all' ? 'any status' : `status ${status}`}.`,
    );
  }

  public formatPermissionDetails(permission: PermissionRequest): string {
    return this.formatter.formatPermissionDetails(permission.permission_id, [
      {
        title: 'Summary',
        lines: [
          `Status: ${this.policy.describePermissionStatus(permission.status)}`,
          `Scope: ${this.policy.describePermissionScope(permission.scope)}`,
          `Category: ${this.policy.describePermissionSubject(permission)}`,
          `Internal executor: ${permission.executor}`,
          `Internal type: ${permission.kind}`,
          `Workspace: ${permission.workspace || 'N/A'}`,
          `Role: ${
            permission.executor === 'external_executor' && permission.kind === 'agent_binding'
              ? this.policy.getExternalExecutorAgentRole(permission)
              : 'N/A'
          }`,
          `Attached task: ${permission.task_id || 'None'}`,
        ],
      },
      {
        title: 'Values',
        lines: [
          `Requested value: ${permission.requested_value || 'N/A'}`,
          `Resolved value: ${permission.resolved_value || 'N/A'}`,
          permission.kind === 'workspace_access'
            ? `Access: ${this.policy.describePermissionAccessLevel(permission)}`
            : null,
          permission.kind === 'command_access'
            ? `Command rule: ${this.policy.describePermissionCommandMatchType(permission)}`
            : null,
        ],
      },
      {
        title: 'History',
        lines: [
          `Reason: ${permission.reason || 'N/A'}`,
          permission.decision_note ? `Decision note: ${permission.decision_note}` : null,
          `Created at: ${permission.created_at}`,
          permission.updated_at
            ? `Decided at: ${permission.updated_at} by ${permission.decided_by}`
            : null,
        ],
      },
    ]);
  }
}
