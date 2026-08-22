import { config } from '../../../config/index.js';
import type { PermissionRequest } from '../../../contracts/PermissionRequest.js';
import type { Task } from '../../../contracts/TaskContract.js';
import { TenantContextService } from '../../../services/TenantContextService.js';
import type { ZavorthBridgePromptCompletionResult, ZavorthBridgePromptStartResult } from '../../../services/ZavorthBridgePromptService.js';
import { persistTask } from '../../../gateways/channels/telegram/TelegramTaskSupport.js';
import {
  EXTERNAL_EXECUTOR_ID,
  EXTERNAL_EXECUTOR_LABEL,
  buildExternalMetadataPatch,
  externalizeExecutorText,
  getRuntimeAdapterBindingsFromMetadata,
  getExternalExecutorAgentId,
  getExternalMetadataValue,
  isExternalPathAccessRequiredError,
} from '../../../gateways/channels/telegram/ExternalExecutorIdentity.js';

export type TelegramCommandToken = {
  commandType: string;
  commandArgs: string;
};

type PermissionMetadataValue = unknown;

type CreatePermissionInput = {
  task_id?: string | null;
  executor: string;
  kind: string;
  scope?: unknown;
  workspace?: string | null;
  requested_value?: string | null;
  resolved_value?: string | null;
  reason: string;
  requested_by?: string | null;
  metadata?: Record<string, PermissionMetadataValue>;
};

type PermissionServiceLike = {
  createRequest(input: CreatePermissionInput): Promise<PermissionRequest>;
};

type TaskManagerLike = {
  advanceState(task: Task, state: string): void;
};

type ExternalExecutorMetadata = {
  workspace_wsl?: string;
  agent_id?: string;
  requested_access_path_wsl?: string;
  requested_access_reason?: string;
};

type ExternalExecutorResult = {
  error_code?: string;
  error_message?: string;
  metadata?: ExternalExecutorMetadata;
};

type AiStudioMetadata = {
  requested_services?: string[];
  requested_services_display?: string;
  service_request_reason?: string;
  requested_tools?: string[];
  requested_tools_display?: string;
  suggested_scope?: string;
  suggested_model?: string;
  agent_id?: string;
  workspace_wsl?: string;
};

type AiStudioResult = {
  error_code?: string;
  error_message?: string;
  metadata?: AiStudioMetadata;
};

type ExternalExecutorPermissionDeps = {
  taskManager: TaskManagerLike;
  permissionService: PermissionServiceLike;
  resolveRuntimeAdapterRole(task: Task): string;
  resolveApprovedExternalAccessPath(result: ExternalExecutorResult): string;
  toWslPath(targetPath: string): string;
};

type AiStudioPermissionDeps = {
  taskManager: TaskManagerLike;
  permissionService: PermissionServiceLike;
};

type ZavorthBridgePermissionDeps = {
  permissionService: PermissionServiceLike;
};

export function parseTelegramCommand(text: string): TelegramCommandToken | null {
  const trimmed = String(text || '').trim();
  if (!trimmed.startsWith('/')) {
    return null;
  }

  const match = trimmed.match(/^\/([^\s@]+)(?:@([^\s]+))?(?:\s+([\s\S]+))?$/);
  if (!match) {
    return null;
  }

  return {
    commandType: `/${match[1].toLowerCase()}`,
    commandArgs: (match[3] || '').trim(),
  };
}

export function isFunCommand(commandType: string): boolean {
  return ['/roll', '/coinflip', '/8ball', '/joke', '/roulette'].includes(commandType);
}

export function isGroupAdminCommand(commandType: string): boolean {
  return new Set([
    '/ban',
    '/kick',
    '/mute',
    '/unmute',
    '/warn',
    '/warns',
    '/clearwarns',
    '/stats',
    '/setwelcome',
    '/setbye',
    '/antispam',
    '/filter',
  ]).has(commandType);
}

export function isSafeGroupCommand(commandType: string): boolean {
  return new Set([
    '/start',
    '/help',
    '/menu',
    '/zavorth',
    '/settings',
    '/capabilities',
    '/integrations',
    '/status',
    '/zavorthControl',
  ]).has(commandType);
}

export function truncateForTelegram(content: string, maxLength: number): string {
  const text = String(content || '').trim();
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}\n[...]`;
}

export async function createExternalExecutorPermissionRequest(
  deps: ExternalExecutorPermissionDeps,
  task: Task,
  result: ExternalExecutorResult,
): Promise<PermissionRequest> {
  if (isExternalPathAccessRequiredError(result?.error_code)) {
    return createExternalPathAccessPermissionRequest(deps, task, result);
  }

  const workspace = task.workspace || config.defaultWorkspace;
  const workspaceWsl = String(result.metadata?.workspace_wsl || '').trim() || workspace.replace(/\\/g, '/');
  const agentRole = deps.resolveRuntimeAdapterRole(task);
  const agentBindings = getRuntimeAdapterBindingsFromMetadata(task.metadata);
  const suggestedAgentId = String(
    getExternalMetadataValue(task.metadata, 'agentId') ||
    agentBindings[agentRole] ||
    (agentRole === 'default' ? getExternalExecutorAgentId() : agentRole) ||
    getExternalExecutorAgentId(),
  ).trim();
  const permission = await deps.permissionService.createRequest({
    task_id: task.task_id,
    executor: EXTERNAL_EXECUTOR_ID,
    kind: 'agent_binding',
    scope: 'workspace',
    workspace,
    requested_value: workspaceWsl,
    resolved_value: suggestedAgentId,
    reason:
      agentRole === 'default'
        ? `${EXTERNAL_EXECUTOR_LABEL} signaled WORKSPACE_MISMATCH. Zavorth must approve or adjust which agent_id should serve this workspace.`
        : `${EXTERNAL_EXECUTOR_LABEL} signaled WORKSPACE_MISMATCH. Zavorth must approve or adjust which agent_id should serve this workspace for role ${agentRole}.`,
    requested_by: task.user_id,
    metadata: {
      ...TenantContextService.buildPermissionMetadataFromTask(task),
      workspace_windows: workspace,
      workspace_wsl: workspaceWsl,
      agent_role: agentRole,
      current_agent_id: result.metadata?.agent_id || getExternalExecutorAgentId(),
      suggested_agent_id: suggestedAgentId,
      suggested_command: `runtime adapters bind ${suggestedAgentId} --workspace "${workspaceWsl}" --non-interactive`,
    },
  });

  task.requires_approval = true;
  task.approval_status = 'pending';
  task.metadata = {
    ...(task.metadata || {}),
    pendingPermissionId: permission.permission_id,
  };
  persistTask(deps.taskManager, task);
  deps.taskManager.advanceState(task, 'waiting_approval');
  return permission;
}

async function createExternalPathAccessPermissionRequest(
  deps: ExternalExecutorPermissionDeps,
  task: Task,
  result: ExternalExecutorResult,
): Promise<PermissionRequest> {
  const workspace = task.workspace || config.defaultWorkspace;
  const requestedPath = deps.resolveApprovedExternalAccessPath(result);
  const requestedPathWsl =
    String(result.metadata?.requested_access_path_wsl || '').trim() || deps.toWslPath(requestedPath);
  const permission = await deps.permissionService.createRequest({
    task_id: task.task_id,
    executor: EXTERNAL_EXECUTOR_ID,
    kind: 'workspace_access',
    scope: 'once',
    workspace,
    requested_value: requestedPath,
    resolved_value: requestedPath,
    reason: `The ${EXTERNAL_EXECUTOR_LABEL} needs to access the specific path "${requestedPath}" to complete this task.`,
    requested_by: task.user_id,
    metadata: {
      ...TenantContextService.buildPermissionMetadataFromTask(task),
      workspace_windows: workspace,
      workspace_wsl: String(result.metadata?.workspace_wsl || '').trim() || deps.toWslPath(workspace),
      requested_access_path_windows: requestedPath,
      requested_access_path_wsl: requestedPathWsl,
      requested_access_reason: result.metadata?.requested_access_reason || externalizeExecutorText(result.error_message) || null,
      current_agent_id: result.metadata?.agent_id || getExternalExecutorAgentId(),
      access_level: 'read_only',
    },
  });

  task.requires_approval = true;
  task.approval_status = 'pending';
  task.metadata = {
    ...(task.metadata || {}),
    pendingPermissionId: permission.permission_id,
    ...buildExternalMetadataPatch({
      requestedAccessPath: requestedPath,
    }),
  };
  persistTask(deps.taskManager, task);
  deps.taskManager.advanceState(task, 'waiting_approval');
  return permission;
}

export async function createAiStudioPermissionRequest(
  deps: AiStudioPermissionDeps,
  task: Task,
  result: AiStudioResult,
): Promise<PermissionRequest> {
  const workspace = task.workspace || config.defaultWorkspace;
  const errorCode = String(result?.error_code || '').trim();

  if (errorCode === 'AISTUDIO_SERVICE_ACCESS_REQUIRED') {
    const services = Array.isArray(result?.metadata?.requested_services)
      ? result.metadata.requested_services.filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0)
      : [];
    const requestedValue = services.join(', ') || String(result?.metadata?.requested_services_display || '').trim() || 'service-not-informed';
    const permission = await deps.permissionService.createRequest({
      task_id: task.task_id,
      executor: 'aistudio',
      kind: 'service_access',
      scope: 'once',
      workspace,
      requested_value: requestedValue,
      resolved_value: requestedValue,
      reason: String(result?.metadata?.service_request_reason || result?.error_message || 'Google AI Studio requested an external service during execution.').trim(),
      requested_by: task.user_id,
      metadata: {
        ...TenantContextService.buildPermissionMetadataFromTask(task),
        requested_services: services,
        suggested_scope: result?.metadata?.suggested_scope || 'once',
        suggested_model: result?.metadata?.suggested_model || config.aiStudioModel,
      },
    });

    task.requires_approval = true;
    task.approval_status = 'pending';
    task.metadata = {
      ...(task.metadata || {}),
      pendingPermissionId: permission.permission_id,
    };
    persistTask(deps.taskManager, task);
    deps.taskManager.advanceState(task, 'waiting_approval');
    return permission;
  }

  const tools = Array.isArray(result?.metadata?.requested_tools)
    ? result.metadata.requested_tools.filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0)
    : [];
  const requestedValue = tools.join(', ') || String(result?.metadata?.requested_tools_display || '').trim() || 'tool-not-informed';
  const permission = await deps.permissionService.createRequest({
    task_id: task.task_id,
    executor: 'aistudio',
    kind: 'builtin_tool_access',
    scope: 'once',
    workspace,
    requested_value: requestedValue,
    resolved_value: requestedValue,
    reason: String(result?.error_message || 'Google AI Studio needs to use official tools before continuing.').trim(),
    requested_by: task.user_id,
    metadata: {
      ...TenantContextService.buildPermissionMetadataFromTask(task),
      requested_tools: tools,
      suggested_scope: result?.metadata?.suggested_scope || 'once',
      suggested_model: result?.metadata?.suggested_model || config.aiStudioModel,
    },
  });

  task.requires_approval = true;
  task.approval_status = 'pending';
  task.metadata = {
    ...(task.metadata || {}),
    pendingPermissionId: permission.permission_id,
  };
  persistTask(deps.taskManager, task);
  deps.taskManager.advanceState(task, 'waiting_approval');
  return permission;
}

export async function createZavorthBridgePermissionRequest(
  deps: ZavorthBridgePermissionDeps,
  task: Task,
  startResult: ZavorthBridgePromptStartResult,
  completion: ZavorthBridgePromptCompletionResult,
): Promise<PermissionRequest> {
  return deps.permissionService.createRequest({
    task_id: task.task_id,
    executor: 'zavorthBridge',
    kind: 'ui_permission',
    scope: 'once',
    workspace: task.workspace || config.defaultWorkspace,
    requested_value: 'approve-visible-step-once',
    resolved_value: 'approve-visible-step-once',
    reason: completion.errorMessage || 'ZavorthBridge displayed a permission request in the UI and Zavorth needs operator confirmation.',
    requested_by: task.user_id,
    metadata: {
      ...TenantContextService.buildPermissionMetadataFromTask(task),
      artifact_path: completion.artifactPath,
      start_result: startResult,
      window_title: startResult.windowTitle,
      companion_instance_id: startResult.companionInstanceId,
      companion_process_id: startResult.processId,
    },
  });
}
