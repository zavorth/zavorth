import { config } from '../../../../config/index.js';
import {
  PermissionAccessLevel,
  PermissionCommandMatchType,
  PermissionScope,
} from '../../../../contracts/PermissionRequest.js';
import { Task } from '../../../../contracts/TaskContract.js';

import { PermissionService } from '../../../../services/PermissionService.js';
import { TenantContextService } from '../../../../services/TenantContextService.js';
import { TelegramPermissionPolicyService } from '../../../../gateways/channels/telegram/controllers/TelegramPermissionPolicyService.js';

export type TelegramPersistedPermissionPolicyServiceDeps = {
  permissionService: PermissionService;
  permissionPolicy: TelegramPermissionPolicyService;
  persistTask: (task: Task) => void;
};

export class TelegramPersistedPermissionPolicyService {
  constructor(private readonly deps: TelegramPersistedPermissionPolicyServiceDeps) {}

  public async applyPersistedPermissionPolicies(task: Task, executor: string): Promise<void> {
    const workspace = task.workspace || config.defaultWorkspace;
    const tenantMetadataMatch = TenantContextService.buildPermissionMetadataMatchFromTask(task);
    const allowedPathPolicies = await this.deps.permissionService.listApprovedRequests(
      executor,
      'workspace_access',
      workspace,
      tenantMetadataMatch as any,
    );
    const allowedCommandPolicies = await this.deps.permissionService.listApprovedRequests(
      executor,
      'command_access',
      workspace,
      tenantMetadataMatch as any,
    );

    const taskLocalAllowedPaths = Array.isArray(task.metadata?.extra_allowed_paths)
      ? task.metadata.extra_allowed_paths.filter(
          (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0,
        )
      : [];
    const taskLocalAllowedCommands = Array.isArray(task.metadata?.extra_allowed_commands)
      ? task.metadata.extra_allowed_commands.filter(
          (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0,
        )
      : [];
    const taskLocalAllowedPathPolicies = Array.isArray(task.metadata?.extra_allowed_path_policies)
      ? task.metadata.extra_allowed_path_policies
          .map((policy: unknown) => this.deps.permissionPolicy.normalizePathPolicy(policy))
          .filter(Boolean)
      : [];
    const taskLocalAllowedCommandPolicies = Array.isArray(task.metadata?.extra_allowed_command_policies)
      ? task.metadata.extra_allowed_command_policies
          .map((policy: unknown) => this.deps.permissionPolicy.normalizeCommandPolicy(policy))
          .filter(Boolean)
      : [];

    const persistedPathPolicies = allowedPathPolicies
      .map((policy) =>
        this.deps.permissionPolicy.normalizePathPolicy({
          path: String(policy.resolved_value || policy.requested_value || '').trim(),
          access_level: this.deps.permissionPolicy.getPermissionAccessLevel(policy),
          scope: policy.scope,
          permission_id: policy.permission_id,
        }),
      )
      .filter(Boolean);
    const persistedCommandPolicies = allowedCommandPolicies
      .map((policy) =>
        this.deps.permissionPolicy.normalizeCommandPolicy({
          command: String(policy.resolved_value || policy.requested_value || '').trim(),
          match_type: this.deps.permissionPolicy.getPermissionCommandMatchType(policy),
          scope: policy.scope,
          permission_id: policy.permission_id,
        }),
      )
      .filter(Boolean);

    const extraAllowedPathPolicies = this.deps.permissionPolicy.mergePathPolicies(
      ...taskLocalAllowedPaths.map((pathValue) => ({
        path: pathValue,
        access_level: 'read_only' as PermissionAccessLevel,
        scope: 'once' as PermissionScope,
      })),
      ...taskLocalAllowedPathPolicies,
      ...persistedPathPolicies,
    );
    const extraAllowedCommandPolicies = this.deps.permissionPolicy.mergeCommandPolicies(
      ...taskLocalAllowedCommands.map((commandValue) => ({
        command: commandValue,
        match_type: 'exact' as PermissionCommandMatchType,
        scope: 'once' as PermissionScope,
      })),
      ...taskLocalAllowedCommandPolicies,
      ...persistedCommandPolicies,
    );

    const extraAllowedPaths = Array.from(
      new Set([...taskLocalAllowedPaths, ...extraAllowedPathPolicies.map((policy) => policy.path)]),
    );
    const extraAllowedCommands = Array.from(
      new Set([
        ...taskLocalAllowedCommands,
        ...extraAllowedCommandPolicies.map((policy) => policy.command),
      ]),
    );

    const nextMetadata: Record<string, any> = {
      ...(task.metadata || {}),
      extra_allowed_paths: extraAllowedPaths,
      extra_allowed_commands: extraAllowedCommands,
      extra_allowed_path_policies: extraAllowedPathPolicies,
      extra_allowed_command_policies: extraAllowedCommandPolicies,
    };

    if (executor === 'external_executor') {
      const currentRole = this.deps.permissionPolicy.resolveExternalExecutorAgentRole(task);
      const bindings = await this.deps.permissionService.listApprovedRequests(
        'external_executor',
        'agent_binding',
        workspace,
        tenantMetadataMatch as any,
      );
      const agentBindings: Record<string, string> = {};
      const permissionIds: Record<string, string> = {};

      for (const binding of bindings) {
        const role = this.deps.permissionPolicy.getExternalExecutorAgentRole(binding);
        const agentId = String(binding.resolved_value || binding.requested_value || '').trim();
        if (!agentId || agentBindings[role]) {
          continue;
        }

        agentBindings[role] = agentId;
        permissionIds[role] = binding.permission_id;
      }

      nextMetadata.external_executor_agent_role = currentRole;
      nextMetadata.external_executor_agent_bindings = agentBindings;
      nextMetadata.external_executor_permission_ids = permissionIds;

      const resolvedAgentId =
        agentBindings[currentRole] || (currentRole === 'default' ? agentBindings.default : null);
      if (resolvedAgentId) {
        nextMetadata.external_executor_agent_id = resolvedAgentId;
        nextMetadata.external_executor_permission_id =
          permissionIds[currentRole] || permissionIds.default || null;
      }
    }

    if (executor === 'aistudio') {
      const approvedToolPolicies = await this.deps.permissionService.listApprovedRequests(
        'aistudio',
        'builtin_tool_access',
        workspace,
        tenantMetadataMatch as any,
      );
      const approvedServicePolicies = await this.deps.permissionService.listApprovedRequests(
        'aistudio',
        'service_access',
        workspace,
        tenantMetadataMatch as any,
      );

      const taskLocalAllowedTools = Array.isArray(task.metadata?.aistudio_allowed_tools)
        ? task.metadata.aistudio_allowed_tools.filter(
            (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0,
          )
        : [];
      const taskLocalAllowedServices = Array.isArray(task.metadata?.aistudio_allowed_services)
        ? task.metadata.aistudio_allowed_services.filter(
            (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0,
          )
        : [];

      nextMetadata.aistudio_allowed_tools = this.deps.permissionPolicy.mergeNormalizedValues(
        taskLocalAllowedTools,
        ...approvedToolPolicies.map((policy) =>
          this.deps.permissionPolicy.extractAiStudioPermissionValues(policy),
        ),
      );
      nextMetadata.aistudio_allowed_services = this.deps.permissionPolicy.mergeNormalizedValues(
        taskLocalAllowedServices,
        ...approvedServicePolicies.map((policy) =>
          this.deps.permissionPolicy.extractAiStudioPermissionValues(policy),
        ),
      );
    }

    task.metadata = nextMetadata;
    this.deps.persistTask(task);
  }
}
