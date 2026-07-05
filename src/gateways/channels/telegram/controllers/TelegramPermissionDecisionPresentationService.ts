import type { PermissionRequest } from '../../../../contracts/PermissionRequest.js';
import { FinalResponseFormattingService } from '../../../../services/FinalResponseFormattingService.js';
import type { TelegramPermissionPresentationPolicy } from '../../../../gateways/channels/telegram/controllers/TelegramPermissionPresentationTypes.js';

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
        permission.resolved_value || permission.requested_value || 'path not provided',
      ).trim();
      const accessLabel = this.policy.describePermissionAccessLevel(permission);
      if (action === 'approve') {
        return this.formatter.formatPermissionDecision({
          title: 'ExternalExecutor access approved.',
          shortId,
          summaryLines: [
            `Allowed folder: ${resolvedPath}`,
            `Level: ${accessLabel}`,
            `Scope: ${scopeLabel}`,
          ],
          nextStep: 'Done. I will resume the same task now with this path allowed.',
        });
      }

      if (action === 'reject') {
        return this.formatter.formatPermissionDecision({
          title: 'ExternalExecutor access request rejected.',
          shortId,
          summaryLines: [
            `Rejected folder: ${resolvedPath}`,
            `Requested level: ${accessLabel}`,
            `Scope: ${scopeLabel}`,
          ],
        });
      }
    }

    if (permission.executor === 'file_delivery' && permission.kind === 'workspace_access') {
      const resolvedPath = String(
        permission.resolved_value || permission.requested_value || 'path not provided',
      ).trim();
      const accessLabel = this.policy.describePermissionAccessLevel(permission);
      const isInspection = permission.metadata?.permission_source === 'file_inspection';
      if (action === 'approve') {
        return this.formatter.formatPermissionDecision({
          title: isInspection ? 'Local inspection access approved.' : 'Local Zavorth access approved.',
          shortId,
          summaryLines: [
            `Allowed folder: ${resolvedPath}`,
            `Level: ${accessLabel}`,
            `Scope: ${scopeLabel}`,
          ],
          nextStep: isInspection
            ? 'Done. I will resume the comparison or inspection now.'
            : 'Done. I will resume the listing or delivery request now.',
        });
      }

      if (action === 'reject') {
        return this.formatter.formatPermissionDecision({
          title: isInspection ? 'Inspection access request rejected.' : 'Local access request rejected.',
          shortId,
          summaryLines: [
            `Rejected folder: ${resolvedPath}`,
            `Requested level: ${accessLabel}`,
            `Scope: ${scopeLabel}`,
          ],
        });
      }
    }

    if (permission.executor === 'external_executor' && permission.kind === 'agent_binding') {
      const role = this.policy.getExternalExecutorAgentRole(permission);
      const resolvedAgentId = String(
        permission.resolved_value || permission.requested_value || 'agent not provided',
      ).trim();
      if (action === 'approve') {
        return this.formatter.formatPermissionDecision({
          title: 'ExternalExecutor agent approved.',
          shortId,
          summaryLines: [
            `Agent: ${resolvedAgentId}`,
            `Role: ${role}`,
            `Scope: ${scopeLabel}`,
          ],
          nextStep: 'Done. I will resume the same task now with this agent.',
        });
      }

      if (action === 'reject') {
        return this.formatter.formatPermissionDecision({
          title: 'ExternalExecutor agent request rejected.',
          shortId,
          summaryLines: [
            `Suggested agent: ${resolvedAgentId}`,
            `Role: ${role}`,
            `Scope: ${scopeLabel}`,
          ],
        });
      }
    }

    if (permission.executor === 'zavorthBridge' && permission.kind === 'ui_permission') {
      return this.formatter.formatPermissionDecision({
        title: action === 'approve' ? 'ZavorthBridge permission approved.' : 'ZavorthBridge permission rejected.',
        shortId,
        summaryLines: [`Scope: ${scopeLabel}`],
      });
    }

    if (permission.executor === 'aistudio' && permission.kind === 'builtin_tool_access') {
      const tools = this.policy.describeAiStudioPermissionValues(permission);
      if (action === 'approve') {
        return this.formatter.formatPermissionDecision({
          title: 'Google AI Studio tools approved.',
          shortId,
          summaryLines: [
            `Tools: ${tools}`,
            `Scope: ${scopeLabel}`,
          ],
          nextStep: 'Done. I will resume the same task now with those tools allowed.',
        });
      }

      if (action === 'reject') {
        return this.formatter.formatPermissionDecision({
          title: 'Google AI Studio tools request rejected.',
          shortId,
          summaryLines: [
            `Rejected tools: ${tools}`,
            `Scope: ${scopeLabel}`,
          ],
        });
      }
    }

    if (permission.executor === 'aistudio' && permission.kind === 'service_access') {
      const services = this.policy.describeAiStudioPermissionValues(permission);
      if (action === 'approve') {
        return this.formatter.formatPermissionDecision({
          title: 'Google AI Studio service approved.',
          shortId,
          summaryLines: [
            `Service(s): ${services}`,
            `Scope: ${scopeLabel}`,
          ],
          nextStep: 'Done. I will resume the same task now with this access allowed.',
        });
      }

      if (action === 'reject') {
        return this.formatter.formatPermissionDecision({
          title: 'Google AI Studio service request rejected.',
          shortId,
          summaryLines: [
            `Rejected service(s): ${services}`,
            `Scope: ${scopeLabel}`,
          ],
        });
      }
    }

    const prefix = action === 'approve' ? 'Approved' : action === 'reject' ? 'Rejected' : 'Updated';
    return this.formatter.formatPermissionDecision({
      title: `${prefix}: ${this.policy.describePermissionSubject(permission)}.`,
      shortId,
      summaryLines: [`Current scope: ${scopeLabel}`],
    });
  }
}
