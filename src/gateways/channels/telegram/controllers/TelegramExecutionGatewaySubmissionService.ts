import { config } from '../../../../config/index.js';
import { Plan } from '../../../../contracts/PlanContract.js';
import { PermissionRequest } from '../../../../contracts/PermissionRequest.js';
import { Task } from '../../../../contracts/TaskContract.js';
import { ExecutionGateway } from '../../../../execution/ExecutionGateway.js';
import { PermissionService } from '../../../../services/PermissionService.js';
import { TenantContextService } from '../../../../services/TenantContextService.js';
import { TaskManager } from '../../../../orchestrator/TaskManager.js';
import { TelegramExecutionGatewayPlanService } from '../../../../gateways/channels/telegram/controllers/TelegramExecutionGatewayPlanService.js';
import {
  EXTERNAL_EXECUTOR_ID,
  EXTERNAL_EXECUTOR_LABEL,
  LEGACY_EXTERNAL_EXECUTOR_ID,
  buildExternalMetadataPatch,
  getRuntimeAdapterBindingsFromMetadata,
  getExternalPermissionIdsFromMetadata,
  isExternalExecutor,
  isExternalPathAccessRequiredError,
  isExternalWorkspaceMismatchError,
} from '../../../../channels/commands/ExternalExecutorIdentity.js';

type PersistTaskFn = (task: Task) => void;
type PersistedPolicyApplier = (task: Task, executor: string) => Promise<void>;
type PermissionMessageFormatter = (permission: PermissionRequest) => string;
type ExternalExecutorPermissionFactory = (task: Task, result: unknown) => Promise<PermissionRequest>;
type AiStudioPermissionFactory = (task: Task, result: unknown) => Promise<PermissionRequest>;
type StoreExecutionResultFn = (task: Task, result: unknown) => void;
type FormatExecutionOutputFn = (label: string, workspace: string, result: unknown) => string;
type PlannedTaskFallbackFn = (task: Task) => Promise<{ output: string; success: boolean }>;

export type TelegramExecutionGatewaySubmissionServiceDeps = {
  executionGateway: ExecutionGateway;
  permissionService: PermissionService;
  taskManager: TaskManager;
  persistTask: PersistTaskFn;
  applyPersistedPermissionPolicies: PersistedPolicyApplier;
  formatPermissionCreatedMessage: PermissionMessageFormatter;
  createExternalExecutorPermissionRequest: ExternalExecutorPermissionFactory;
  createAiStudioPermissionRequest: AiStudioPermissionFactory;
  storeExecutionResult: StoreExecutionResultFn;
  formatExecutionOutput: FormatExecutionOutputFn;
  executePlannedTask: PlannedTaskFallbackFn;
  gatewayPlanService: TelegramExecutionGatewayPlanService;
};

export class TelegramExecutionGatewaySubmissionService {
  constructor(private readonly deps: TelegramExecutionGatewaySubmissionServiceDeps) {}

  public async executeViaGateway(
    task: Task,
    isDryRun: boolean,
    payload: string,
  ): Promise<{ output: string; success: boolean }> {
    const plan = this.deps.gatewayPlanService.buildExplicitExecutionPlan(task, isDryRun, payload);
    return this.submitPlanViaGateway(task, plan, isDryRun);
  }

  public async executeStoredGatewayPlan(task: Task, isDryRun: boolean): Promise<{ output: string; success: boolean }> {
    const plan = task.metadata?.gateway_plan as Plan | undefined;
    if (!plan) {
      return this.deps.executePlannedTask(task);
    }

    return this.submitPlanViaGateway(task, plan, isDryRun);
  }

  public async submitPlanViaGateway(
    task: Task,
    plan: Plan,
    isDryRun: boolean,
  ): Promise<{ output: string; success: boolean }> {
    const effectivePlan =
      !isDryRun && task.approval_status === 'approved'
        ? {
            ...plan,
            requires_approval: false,
            notes: Array.from(new Set([...(plan.notes || []), 'Explicit approval already recorded in Telegram.'])),
          }
        : plan;
    const executor = this.deps.gatewayPlanService.resolveGatewayExecutorName(
      effectivePlan.executor_recommendation || task.executor_used || 'local',
    );

    await this.deps.applyPersistedPermissionPolicies(task, executor);

    if (isExternalExecutor(executor)) {
      const workspace = effectivePlan.workspace_recommendation || task.workspace || config.defaultWorkspace;
      const agentRole = this.deps.gatewayPlanService.resolveRuntimeAdapterRole(task);
      const tenantMetadata = TenantContextService.buildPermissionMetadataMatchFromTask(task);
      const approvedBindings = [
        ...(await this.deps.permissionService.listApprovedRequests(EXTERNAL_EXECUTOR_ID, 'agent_binding', workspace, {
          agent_role: agentRole,
          ...tenantMetadata,
        })),
        ...(await this.deps.permissionService.listApprovedRequests(
          LEGACY_EXTERNAL_EXECUTOR_ID,
          'agent_binding',
          workspace,
          { agent_role: agentRole, ...tenantMetadata },
        )),
      ];
      const approvedBinding = approvedBindings[0] || null;
      if (approvedBinding?.resolved_value) {
        const agentBindings = getRuntimeAdapterBindingsFromMetadata(task.metadata);
        const permissionIds = getExternalPermissionIdsFromMetadata(task.metadata);
        task.metadata = {
          ...(task.metadata || {}),
          ...buildExternalMetadataPatch({
            agentRole,
            agentId: approvedBinding.resolved_value,
            agentBindings: {
              ...agentBindings,
              [agentRole]: approvedBinding.resolved_value,
            },
            permissionIds: {
              ...permissionIds,
              [agentRole]: approvedBinding.permission_id,
            },
            permissionId: approvedBinding.permission_id,
          }),
        };
        this.deps.persistTask(task);
      }
    }

    const decision = await this.deps.executionGateway.submit(task, effectivePlan, isDryRun);

    if (decision.requires_confirmation) {
      const followup =
        task.approval_status === 'approved'
          ? 'I already recorded the previous approval, so this indicates that another confirmation is still pending in the flow.'
          : 'Use /approve, /approve 1, or tap Approve — not a long id.';
      return {
        output: `One confirmation is still required before execution.\nReason: ${decision.reason}\n${followup}`,
        success: false,
      };
    }

    if (!decision.allowed || !decision.execution_result) {
      return {
        output: `ExecutionGateway blocked execution.\nReason: ${decision.reason}`,
        success: false,
      };
    }

    task.executor_used = effectivePlan.executor_recommendation;
    this.deps.storeExecutionResult(task, decision.execution_result);

    if (
      isExternalExecutor(executor) &&
      (isExternalWorkspaceMismatchError(decision.execution_result?.error_code) ||
        isExternalPathAccessRequiredError(decision.execution_result?.error_code))
    ) {
      const permission = await this.deps.createExternalExecutorPermissionRequest(task, decision.execution_result);
      const intro = isExternalPathAccessRequiredError(decision.execution_result?.error_code) ? `${EXTERNAL_EXECUTOR_LABEL} needs extra access to a specific folder or path before continuing.`
        : `${EXTERNAL_EXECUTOR_LABEL} stopped because the current agent is pinned to another workspace.`;
      return {
        output: [intro, '', this.deps.formatPermissionCreatedMessage(permission)].join('\n'),
        success: false,
      };
    }

    if (
      executor === 'aistudio' &&
      (decision.execution_result?.error_code === 'AISTUDIO_BUILTIN_TOOL_PERMISSION_REQUIRED' ||
        decision.execution_result?.error_code === 'AISTUDIO_SERVICE_ACCESS_REQUIRED')
    ) {
      const permission = await this.deps.createAiStudioPermissionRequest(task, decision.execution_result);
      const intro =
        decision.execution_result?.error_code === 'AISTUDIO_BUILTIN_TOOL_PERMISSION_REQUIRED'
          ? 'Google AI Studio wants to use official Gemini API tool(s) before continuing.'
          : 'Google AI Studio requested access to an external service during generation.';
      return {
        output: [intro, '', this.deps.formatPermissionCreatedMessage(permission)].join('\n'),
        success: false,
      };
    }

    if (executor === 'aistudio' && decision.execution_result?.error_code === 'AISTUDIO_EXTERNAL_SERVICE_UNSUPPORTED') {
      return {
        output: [
          'Google AI Studio requested an external service, but this Zavorth supports only native Gemini API tools in /aistudio.',
          '',
          'Supported tools today:',
          '- google_search',
          '- code_execution',
          '',
          `Reason: ${decision.execution_result?.error_message || 'External service is not supported on this host.'}`,
        ].join('\n'),
        success: false,
      };
    }

    if (executor === 'jules' && decision.execution_result?.error_code === 'JULES_AWAITING_APPROVAL') {
      task.metadata = {
        ...(task.metadata || {}),
        jules_session_id: decision.execution_result.metadata?.jules_session_id || task.metadata?.jules_session_id,
        jules_requires_approval: true,
        jules_pending: false,
      };
      task.requires_approval = true;
      this.deps.taskManager.advanceState(task, 'waiting_approval');
      this.deps.persistTask(task);
      return {
        output: [
          'Jules started the session, but its plan still needs external approval.',
          '',
          decision.execution_result.error_message || 'Waiting for plan approval in Jules.',
          decision.execution_result.metadata?.jules_session_id ? `SessionId: ${decision.execution_result.metadata.jules_session_id}`
            : '',
        ]
          .filter(Boolean)
          .join('\n'),
        success: false,
      };
    }

    if (executor === 'jules' && decision.execution_result?.error_code === 'JULES_PENDING') {
      task.metadata = {
        ...(task.metadata || {}),
        jules_session_id: decision.execution_result.metadata?.jules_session_id || task.metadata?.jules_session_id,
        jules_requires_approval: false,
        jules_pending: true,
      };
      this.deps.taskManager.advanceState(task, 'delivery_pending');
      this.deps.persistTask(task);
      return {
        output: [
          'Jules started the session and it is still running in the remote service.',
          '',
          decision.execution_result.error_message || 'Jules session is running.',
          decision.execution_result.metadata?.jules_session_id ? `SessionId: ${decision.execution_result.metadata.jules_session_id}`
            : '',
        ]
          .filter(Boolean)
          .join('\n'),
        success: false,
      };
    }

    return {
      output: this.deps.formatExecutionOutput(
        this.deps.gatewayPlanService.getExecutionLabel(effectivePlan.executor_recommendation),
        effectivePlan.workspace_recommendation || task.workspace || config.defaultWorkspace,
        decision.execution_result,
      ),
      success: decision.execution_result.success,
    };
  }
}
