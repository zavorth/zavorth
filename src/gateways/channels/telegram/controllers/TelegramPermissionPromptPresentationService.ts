import type { PermissionRequest } from '@zavorth/contracts/PermissionRequest.js';
import { FinalResponseFormattingService } from '@zavorth/services/FinalResponseFormattingService.js';
import type { TelegramPermissionPresentationPolicy } from '../../../../gateways/channels/telegram/controllers/TelegramPermissionPresentationTypes.js';

export class TelegramPermissionPromptPresentationService {
  private readonly formatter = new FinalResponseFormattingService();

  constructor(private readonly policy: TelegramPermissionPresentationPolicy) {}

  public formatPermissionCreatedMessage(permission: PermissionRequest): string {
    const shortId = this.policy.shortPermissionId(permission);
    const summaryLines: string[] = [];
    const actionLines: string[] = [];
    const manualLines: string[] = [];
    const technicalLines: string[] = [];
    let intro = 'Zavorth needs your decision before continuing this task.';

    if (permission.executor === 'external_executor' && permission.kind === 'agent_binding') {
      intro = 'I need your decision to unblock this ExternalExecutor workflow.';
      summaryLines.push('ExternalExecutor is blocked because the current agent is not authorized for this project.');
      summaryLines.push(`Current project: ${permission.workspace || 'not specified'}`);
      summaryLines.push(
        `Suggested agent: ${permission.resolved_value || permission.requested_value || 'not specified'}`,
      );
      summaryLines.push(`Role: ${this.policy.getExternalExecutorAgentRole(permission)}`);
      summaryLines.push(`Reason: ${permission.reason}`);
      actionLines.push('"Use in this project": authorizes this agent only for the current workspace.');
      actionLines.push('"Save for future requests": reuses this agent for future requests of the same class.');
      actionLines.push('"Reject": cancels this unlock and stops the task.');
    } else if (permission.executor === 'external_executor' && permission.kind === 'workspace_access') {
      intro = 'I need your approval to open this folder in ExternalExecutor and continue the task.';
      const requestedPath = permission.resolved_value || permission.requested_value || 'not specified';
      summaryLines.push('ExternalExecutor stopped because it needs to read a path outside the approved workspace.');
      summaryLines.push(`Current project: ${permission.workspace || 'not specified'}`);
      summaryLines.push(`Requested folder: ${requestedPath}`);
      summaryLines.push(`Access level to be granted: ${this.policy.describePermissionAccessLevel(permission)}`);
      summaryLines.push(`Reason: ${permission.reason}`);
      actionLines.push(
        '"Allow read-only for this task only": grants read/list access to this folder for this execution only.',
      );
      actionLines.push(
        '"Allow read-only for this project": reuses this folder for read/list in future tasks in this workspace.',
      );
      actionLines.push('"Reject": blocks this access and ends the current attempt.');
    } else if (permission.executor === 'file_delivery' && permission.kind === 'workspace_access') {
      intro = 'I found the path you requested, but I need your approval to continue.';
      const requestedPath = permission.resolved_value || permission.requested_value || 'not specified';
      if (permission.metadata?.permission_source === 'file_inspection') {
        summaryLines.push(
          'Zavorth found the requested path, but it is not yet authorized for comparison or local inspection.',
        );
      } else {
        summaryLines.push(
          'Zavorth found the requested path, but it is not yet authorized for local reading and delivery.',
        );
      }
      summaryLines.push(`Requested folder: ${requestedPath}`);
      summaryLines.push(`Access level to be granted: ${this.policy.describePermissionAccessLevel(permission)}`);
      summaryLines.push(`Reason: ${permission.reason}`);
      if (permission.metadata?.permission_source === 'file_inspection') {
        actionLines.push(
          '"Allow read-only for this task only": grants read/list for this folder for this comparison or inspection only.',
        );
        actionLines.push(
          '"Allow read-only for this project": reuses this folder for future comparisons and inspections in this Zavorth.',
        );
      } else {
        actionLines.push(
          '"Allow read-only for this task only": grants read/list for this folder for the current request only.',
        );
        actionLines.push(
          '"Allow read-only for this project": reuses this folder for read/list in future requests in this Zavorth.',
        );
      }
      actionLines.push('"Reject": blocks this access and ends the current attempt.');
    } else if (permission.executor === 'aistudio' && permission.kind === 'builtin_tool_access') {
      intro = 'Google AI Studio needs these tools before continuing this task.';
      summaryLines.push('Google AI Studio wants to use official Gemini API tools before continuing.');
      summaryLines.push(`Current project: ${permission.workspace || 'not specified'}`);
      summaryLines.push(`Requested tools: ${this.policy.describeAiStudioPermissionValues(permission)}`);
      summaryLines.push(`Reason: ${permission.reason}`);
      if (permission.metadata?.suggested_model) {
        summaryLines.push(`Suggested model: ${permission.metadata.suggested_model}`);
      }
      actionLines.push('"Allow for this task only": authorizes these tools for this execution only.');
      actionLines.push('"Allow for this project": reuses these tools for future tasks in this workspace.');
      actionLines.push('"Reject": blocks this usage and ends the current attempt.');
    } else if (permission.executor === 'aistudio' && permission.kind === 'service_access') {
      intro = 'Google AI Studio requested extra access before continuing this task.';
      summaryLines.push('Google AI Studio requested access to an external service during generation.');
      summaryLines.push(`Current project: ${permission.workspace || 'not specified'}`);
      summaryLines.push(`Requested service(s): ${this.policy.describeAiStudioPermissionValues(permission)}`);
      summaryLines.push(`Reason: ${permission.reason}`);
      if (permission.metadata?.service_request_reason) {
        summaryLines.push(`Model request: ${permission.metadata.service_request_reason}`);
      }
      if (permission.metadata?.suggested_model) {
        summaryLines.push(`Suggested model: ${permission.metadata.suggested_model}`);
      }
      actionLines.push('"Allow for this task only": authorizes this service for this execution only.');
      actionLines.push('"Allow for this project": reuses this service for future tasks in this workspace.');
      actionLines.push('"Reject": blocks this access and ends the current attempt.');
    } else {
      summaryLines.push(`Category: ${this.policy.describePermissionSubject(permission)}`);
      summaryLines.push(`Scope: ${this.policy.describePermissionScope(permission.scope)}`);
      summaryLines.push(`Reason: ${permission.reason}`);
    }

    if (permission.workspace) {
      summaryLines.push(`Workspace: ${permission.workspace}`);
    }
    if (permission.executor === 'zavorthBridge' && permission.kind === 'ui_permission') {
      intro = 'ZavorthBridge is waiting for your decision in this conversation.';
      summaryLines.push(
        'Recommended approval: use "Approve conversation" to avoid repeating this prompt in the same ZavorthBridge chat.',
      );
    }
    if (
      permission.executor === 'zavorthBridge' &&
      permission.kind === 'ui_permission' &&
      permission.metadata?.permission_prompt_summary
    ) {
      summaryLines.push(`Prompt detected: ${permission.metadata.permission_prompt_summary}`);
    }
    if (
      permission.requested_value &&
      !(
        (permission.executor === 'external_executor' &&
          ['agent_binding', 'workspace_access'].includes(permission.kind)) ||
        (permission.executor === 'file_delivery' && permission.kind === 'workspace_access')
      )
    ) {
      summaryLines.push(`Request: ${permission.requested_value}`);
    }
    if (
      permission.resolved_value &&
      !(
        (permission.executor === 'external_executor' &&
          ['agent_binding', 'workspace_access'].includes(permission.kind)) ||
        (permission.executor === 'file_delivery' && permission.kind === 'workspace_access')
      )
    ) {
      summaryLines.push(`Current suggestion: ${permission.resolved_value}`);
    }
    if (permission.metadata?.suggested_command) {
      technicalLines.push(`Technical suggestion: ${permission.metadata.suggested_command}`);
    }
    if (permission.kind === 'command_access') {
      summaryLines.push(`Command rule: ${this.policy.describePermissionCommandMatchType(permission)}`);
    }

    // Primary next action: buttons on the card + ordinal slash (newest pending = 1).
    // Never ask users to free-text "Approve" or paste a long UUID as primary path.
    manualLines.push('Use the Approve / Reject buttons on this card when available.');
    manualLines.push('Or ordinal slash: /perm approve 1 · /perm reject 1');
    if (permission.executor === 'external_executor' && permission.kind === 'workspace_access') {
      manualLines.push(
        `Advanced once: /perm approve ${shortId} scope=once access=${this.policy.getPermissionAccessLevel(permission)}`,
      );
      manualLines.push(
        `Advanced workspace: /perm approve ${shortId} scope=workspace access=${this.policy.getPermissionAccessLevel(permission)}`,
      );
    } else if (permission.executor === 'file_delivery' && permission.kind === 'workspace_access') {
      manualLines.push(
        `Advanced once: /perm approve ${shortId} scope=once access=${this.policy.getPermissionAccessLevel(permission)}`,
      );
      manualLines.push(
        `Advanced project: /perm approve ${shortId} scope=workspace access=${this.policy.getPermissionAccessLevel(permission)}`,
      );
    } else if (permission.executor === 'aistudio' && permission.kind === 'builtin_tool_access') {
      manualLines.push(`Advanced once: /perm approve ${shortId} scope=once`);
      manualLines.push(`Advanced project: /perm approve ${shortId} scope=workspace`);
    } else if (permission.executor === 'aistudio' && permission.kind === 'service_access') {
      manualLines.push(`Advanced once: /perm approve ${shortId} scope=once`);
      manualLines.push(`Advanced project: /perm approve ${shortId} scope=workspace`);
    } else if (permission.executor === 'zavorthBridge' && permission.kind === 'ui_permission') {
      manualLines.push(`Advanced session: /perm approve ${shortId} scope=session`);
      manualLines.push(`Advanced once: /perm approve ${shortId} scope=once`);
    } else if (permission.executor === 'external_executor' && permission.kind === 'agent_binding') {
      manualLines.push(`Advanced project: /perm approve ${shortId} scope=workspace`);
      manualLines.push(`Advanced persistent: /perm approve ${shortId} scope=persistent`);
    } else if (permission.kind === 'command_access') {
      manualLines.push(
        `Advanced: /perm approve ${shortId} match=${this.policy.getPermissionCommandMatchType(permission)}`,
      );
    }
    manualLines.push(`Adjust first: /perm edit ${shortId} resolved=new_value scope=workspace`);

    return this.formatter.formatPermissionPrompt({
      title: `Approval required - ${this.policy.describePermissionSubject(permission)}`,
      shortId,
      intro,
      summaryLines,
      actionLines,
      manualLines: ['Next action (buttons preferred; slash as fallback).', ...manualLines],
      technicalLines,
    });
  }
}
