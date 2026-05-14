import { config } from '../config/index.js';
import type { PermissionRequest } from '../contracts/PermissionRequest.js';
import type { Task } from '../contracts/TaskContract.js';
import { TenantContextService } from '../services/TenantContextService.js';
import type { ZavorthBridgePromptCompletionResult, ZavorthBridgePromptStartResult } from '../services/ZavorthBridgePromptService.js';
import { persistTask } from './TelegramTaskSupport.js';
import {
  EXTERNAL_EXECUTOR_ID,
  EXTERNAL_EXECUTOR_LABEL,
  buildExternalMetadataPatch,
  externalizeExecutorText,
  getExternalAgentBindingsFromMetadata,
  getExternalExecutorAgentId,
  getExternalMetadataValue,
  isExternalPathAccessRequiredError,
} from './ExternalExecutorIdentity.js';

export type TelegramCommandToken = {
  commandType: string;
  commandArgs: string;
};

type PermissionServiceLike = {
  createRequest(input: Record<string, any>): Promise<PermissionRequest>;
};

type TaskManagerLike = {
  advanceState(task: Task, state: string): void;
};

type ExternalExecutorPermissionDeps = {
  taskManager: TaskManagerLike;
  permissionService: PermissionServiceLike;
  resolveExternalAgentRole(task: Task): string;
  resolveApprovedExternalAccessPath(result: any): string;
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
    '/regras',
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
    '/dashboard',
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
  result: any,
): Promise<PermissionRequest> {
  if (isExternalPathAccessRequiredError(result?.error_code)) {
    return createExternalPathAccessPermissionRequest(deps, task, result);
  }

  const workspace = task.workspace || config.defaultWorkspace;
  const workspaceWsl = String(result.metadata?.workspace_wsl || '').trim() || workspace.replace(/\\/g, '/');
  const agentRole = deps.resolveExternalAgentRole(task);
  const agentBindings = getExternalAgentBindingsFromMetadata(task.metadata);
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
        ? `O ${EXTERNAL_EXECUTOR_LABEL} sinalizou WORKSPACE_MISMATCH. O Zavorth precisa aprovar ou ajustar qual agent_id deve atender este workspace.`
        : `O ${EXTERNAL_EXECUTOR_LABEL} sinalizou WORKSPACE_MISMATCH. O Zavorth precisa aprovar ou ajustar qual agent_id deve atender este workspace no papel ${agentRole}.`,
    requested_by: task.user_id,
    metadata: {
      ...TenantContextService.buildPermissionMetadataFromTask(task),
      workspace_windows: workspace,
      workspace_wsl: workspaceWsl,
      agent_role: agentRole,
      current_agent_id: result.metadata?.agent_id || getExternalExecutorAgentId(),
      suggested_agent_id: suggestedAgentId,
      suggested_command: `external agents bind ${suggestedAgentId} --workspace "${workspaceWsl}" --non-interactive`,
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
  result: any,
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
    reason: `O ${EXTERNAL_EXECUTOR_LABEL} precisa acessar o caminho especifico "${requestedPath}" para concluir esta tarefa.`,
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
  result: any,
): Promise<PermissionRequest> {
  const workspace = task.workspace || config.defaultWorkspace;
  const errorCode = String(result?.error_code || '').trim();

  if (errorCode === 'AISTUDIO_SERVICE_ACCESS_REQUIRED') {
    const services = Array.isArray(result?.metadata?.requested_services)
      ? result.metadata.requested_services.filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0)
      : [];
    const requestedValue = services.join(', ') || String(result?.metadata?.requested_services_display || '').trim() || 'servico-nao-informado';
    const permission = await deps.permissionService.createRequest({
      task_id: task.task_id,
      executor: 'aistudio',
      kind: 'service_access',
      scope: 'once',
      workspace,
      requested_value: requestedValue,
      resolved_value: requestedValue,
      reason: String(result?.metadata?.service_request_reason || result?.error_message || 'O Google AI Studio pediu um servico externo durante a execucao.').trim(),
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
  const requestedValue = tools.join(', ') || String(result?.metadata?.requested_tools_display || '').trim() || 'tool-nao-informada';
  const permission = await deps.permissionService.createRequest({
    task_id: task.task_id,
    executor: 'aistudio',
    kind: 'builtin_tool_access',
    scope: 'once',
    workspace,
    requested_value: requestedValue,
    resolved_value: requestedValue,
    reason: String(result?.error_message || 'O Google AI Studio precisa usar tools oficiais antes de continuar.').trim(),
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
    reason: completion.errorMessage || 'O ZavorthBridge exibiu uma solicitacao de permissao na UI e o Zavorth precisa de confirmacao do operador.',
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
