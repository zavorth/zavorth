import { config } from '../../config/index.js';
import { Plan } from '../../contracts/PlanContract.js';
import { PermissionRequest } from '../../contracts/PermissionRequest.js';
import { Task } from '../../contracts/TaskContract.js';
import { ExecutionGateway } from '../../execution/ExecutionGateway.js';
import { PermissionService } from '../../services/PermissionService.js';
import { TenantContextService } from '../../services/TenantContextService.js';
import { TaskManager } from '../../orchestrator/TaskManager.js';
import { TelegramExecutionGatewayPlanService } from './TelegramExecutionGatewayPlanService.js';
import {
  EXTERNAL_EXECUTOR_ID,
  EXTERNAL_EXECUTOR_LABEL,
  LEGACY_EXTERNAL_EXECUTOR_ID,
  buildExternalMetadataPatch,
  getExternalAgentBindingsFromMetadata,
  getExternalPermissionIdsFromMetadata,
  isExternalExecutor,
  isExternalPathAccessRequiredError,
  isExternalWorkspaceMismatchError,
} from '../ExternalExecutorIdentity.js';

type PersistTaskFn = (task: Task) => void;
type PersistedPolicyApplier = (task: Task, executor: string) => Promise<void>;
type PermissionMessageFormatter = (permission: PermissionRequest) => string;
type ExternalExecutorPermissionFactory = (task: Task, result: any) => Promise<PermissionRequest>;
type AiStudioPermissionFactory = (task: Task, result: any) => Promise<PermissionRequest>;
type StoreExecutionResultFn = (task: Task, result: any) => void;
type FormatExecutionOutputFn = (label: string, workspace: string, result: any) => string;
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

  public async executeStoredGatewayPlan(
    task: Task,
    isDryRun: boolean,
  ): Promise<{ output: string; success: boolean }> {
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
            notes: Array.from(new Set([...(plan.notes || []), 'Aprovacao explicita ja registrada no Telegram.'])),
          }
        : plan;
    const executor = this.deps.gatewayPlanService.resolveGatewayExecutorName(
      effectivePlan.executor_recommendation || task.executor_used || 'local',
    );

    await this.deps.applyPersistedPermissionPolicies(task, executor);

    if (isExternalExecutor(executor)) {
      const workspace = effectivePlan.workspace_recommendation || task.workspace || config.defaultWorkspace;
      const agentRole = this.deps.gatewayPlanService.resolveExternalAgentRole(task);
      const tenantMetadata = TenantContextService.buildPermissionMetadataMatchFromTask(task);
      const approvedBindings = [
        ...(await this.deps.permissionService.listApprovedRequests(
          EXTERNAL_EXECUTOR_ID,
          'agent_binding',
          workspace,
          { agent_role: agentRole, ...tenantMetadata },
        )),
        ...(await this.deps.permissionService.listApprovedRequests(
          LEGACY_EXTERNAL_EXECUTOR_ID,
          'agent_binding',
          workspace,
          { agent_role: agentRole, ...tenantMetadata },
        )),
      ];
      const approvedBinding = approvedBindings[0] || null;
      if (approvedBinding?.resolved_value) {
        const agentBindings = getExternalAgentBindingsFromMetadata(task.metadata);
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
          ? 'Eu ja registrei a aprovacao anterior, entao isso indica que ainda existe outra confirmacao pendente no fluxo.'
          : `Use /approve ${task.task_id} para liberar a execucao deste plano.`;
      return {
        output: `Ainda falta uma confirmacao antes de executar.\nMotivo: ${decision.reason}\n${followup}`,
        success: false,
      };
    }

    if (!decision.allowed || !decision.execution_result) {
      return {
        output: `ExecutionGateway bloqueou a execucao.\nMotivo: ${decision.reason}`,
        success: false,
      };
    }

    task.executor_used = effectivePlan.executor_recommendation;
    this.deps.storeExecutionResult(task, decision.execution_result);

    if (
      isExternalExecutor(executor) &&
      (
        isExternalWorkspaceMismatchError(decision.execution_result?.error_code) ||
        isExternalPathAccessRequiredError(decision.execution_result?.error_code)
      )
    ) {
      const permission = await this.deps.createExternalExecutorPermissionRequest(task, decision.execution_result);
      const intro =
        isExternalPathAccessRequiredError(decision.execution_result?.error_code)
          ? `O ${EXTERNAL_EXECUTOR_LABEL} precisa de acesso extra a uma pasta ou caminho especifico antes de continuar.`
          : `O ${EXTERNAL_EXECUTOR_LABEL} parou porque o agent atual esta preso a outro workspace.`;
      return {
        output: [intro, '', this.deps.formatPermissionCreatedMessage(permission)].join('\n'),
        success: false,
      };
    }

    if (
      executor === 'aistudio' &&
      (
        decision.execution_result?.error_code === 'AISTUDIO_BUILTIN_TOOL_PERMISSION_REQUIRED' ||
        decision.execution_result?.error_code === 'AISTUDIO_SERVICE_ACCESS_REQUIRED'
      )
    ) {
      const permission = await this.deps.createAiStudioPermissionRequest(task, decision.execution_result);
      const intro =
        decision.execution_result?.error_code === 'AISTUDIO_BUILTIN_TOOL_PERMISSION_REQUIRED'
          ? 'O Google AI Studio quer usar tool(s) oficiais do Gemini API antes de continuar.'
          : 'O Google AI Studio pediu acesso a um servico externo durante a geracao.';
      return {
        output: [intro, '', this.deps.formatPermissionCreatedMessage(permission)].join('\n'),
        success: false,
      };
    }

    if (
      executor === 'aistudio' &&
      decision.execution_result?.error_code === 'AISTUDIO_EXTERNAL_SERVICE_UNSUPPORTED'
    ) {
      return {
        output: [
          'O Google AI Studio pediu um servico externo, mas este Zavorth suporta apenas tools nativas do Gemini API no /aistudio.',
          '',
          'Tools suportadas hoje:',
          '- google_search',
          '- code_execution',
          '',
          `Motivo: ${decision.execution_result?.error_message || 'Servico externo nao suportado neste host.'}`,
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
          'Jules iniciou a sessao, mas o plano dele ainda precisa de aprovacao externa.',
          '',
          decision.execution_result.error_message || 'Aguardando aprovacao do plano no Jules.',
          decision.execution_result.metadata?.jules_session_id
            ? `SessionId: ${decision.execution_result.metadata.jules_session_id}`
            : '',
        ].filter(Boolean).join('\n'),
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
          'Jules iniciou a sessao e ela segue em andamento no servico remoto.',
          '',
          decision.execution_result.error_message || 'Sessao Jules em andamento.',
          decision.execution_result.metadata?.jules_session_id
            ? `SessionId: ${decision.execution_result.metadata.jules_session_id}`
            : '',
        ].filter(Boolean).join('\n'),
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
