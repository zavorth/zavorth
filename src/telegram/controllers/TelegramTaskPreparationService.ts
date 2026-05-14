import { ParsedCommand } from '../CommandParser.js';
import { Task } from '../../contracts/TaskContract.js';
import type { TaskSource } from '../../contracts/PlatformContract.js';
import { RouteIntent } from '../../orchestrator/IntentRouter.js';
import { RiskClassification } from '../../orchestrator/RiskClassifier.js';
import { TenantContextService, type TenantContext } from '../../services/TenantContextService.js';
import { WorkspaceProfileService } from '../../services/WorkspaceProfileService.js';
import { WorkspaceOperationalMemoryService } from '../../runtime/context/WorkspaceOperationalMemoryService.js';
import {
  WorkspaceRoutingAdvisor,
  type WorkspaceRoutingAdvice,
} from '../../runtime/context/WorkspaceRoutingAdvisor.js';
import type { TelegramWorkspaceLearnedRoute } from './TelegramTaskWorkflowRoutingService.js';
import type { TelegramTaskSurfaceSecurityPosture } from './TelegramTaskSurfaceSecurityService.js';

export type TelegramTaskPreparationInput = {
  chatId: string;
  userId: string;
  text: string;
  inlineData?: Array<{ mimeType: string; data: string }>;
  parsed: ParsedCommand;
  source?: TaskSource;
  surfaceMetadata?: {
    platform?: string | null;
    sourceUserId?: string | null;
    runtimeUserId?: string | null;
    chatId?: string | null;
    sessionId?: string | null;
    threadId?: string | null;
    publicServerMode?: boolean | null;
    forceApprovalForExecution?: boolean | null;
    transport?: string | null;
    tenant?: TenantContext | null;
  } | null;
  composer_payload?: Record<string, any> | null;
};

type TelegramTaskPreparationServiceDeps = {
  getDefaultWorkspace: (commandType: string) => string;
  workspaceProfileService: WorkspaceProfileService;
  workspaceOperationalMemoryService: WorkspaceOperationalMemoryService;
  requiresHighRiskPin: (task: Task) => boolean;
  resolveWorkspaceLearnedRoute: (
    parsed: ParsedCommand,
    route: RouteIntent,
    advice: WorkspaceRoutingAdvice,
  ) => TelegramWorkspaceLearnedRoute;
  buildWorkspaceRouteOutcome: (
    task: Task,
    route: RouteIntent,
    advice: WorkspaceRoutingAdvice,
    learnedRoute: TelegramWorkspaceLearnedRoute,
  ) => Record<string, any>;
};

export type TelegramPreparedTaskState = {
  classification: RiskClassification;
  workspaceRoutingAdvice: WorkspaceRoutingAdvice;
  learnedRoute: TelegramWorkspaceLearnedRoute;
  surfaceForceApproval: boolean;
};

export class TelegramTaskPreparationService {
  private readonly workspaceRoutingAdvisor = new WorkspaceRoutingAdvisor();

  constructor(private readonly deps: TelegramTaskPreparationServiceDeps) {}

  public buildSurfaceMetadata(input: TelegramTaskPreparationInput): Record<string, any> {
    const source = String(input.source || 'telegram').trim() || 'telegram';
    const sourceUserId = String(input.surfaceMetadata?.sourceUserId || input.userId || '').trim();
    const runtimeUserId = String(input.surfaceMetadata?.runtimeUserId || input.userId || '').trim();
    const sessionId = String(input.surfaceMetadata?.sessionId || '').trim() || null;
    const chatId = String(input.surfaceMetadata?.chatId || input.chatId || '').trim() || null;
    const threadId = String(input.surfaceMetadata?.threadId || '').trim() || null;

    return {
      ...TenantContextService.buildTaskMetadataFromContext(input.surfaceMetadata?.tenant || null),
      runtime_user_id: runtimeUserId || input.userId,
      source_user_id: sourceUserId || input.userId,
      surface_identity: {
        source,
        source_user_id: sourceUserId || input.userId,
        runtime_user_id: runtimeUserId || input.userId,
        chat_id: chatId,
        session_id: sessionId,
        thread_id: threadId,
      },
      telegram_thread_id: threadId,
      surface_policy: {
        public_server_mode: input.surfaceMetadata?.publicServerMode === true,
        force_approval_for_execution: input.surfaceMetadata?.forceApprovalForExecution === true,
        transport: input.surfaceMetadata?.transport || null,
      },
      composer_payload: input.composer_payload || null,
    };
  }

  public async prepareTaskState(params: {
    task: Task;
    input: TelegramTaskPreparationInput;
    parsed: ParsedCommand;
    route: RouteIntent;
    userId: string;
    classification: RiskClassification;
    surfaceSecurity: TelegramTaskSurfaceSecurityPosture;
  }): Promise<TelegramPreparedTaskState> {
    const { task, input, parsed, route, userId, surfaceSecurity } = params;
    let classification = params.classification;
    const surfaceForceApproval = input.surfaceMetadata?.forceApprovalForExecution === true;
    const publicServerMode = input.surfaceMetadata?.publicServerMode === true;

    task.intent = route.intent;
    task.workspace = route.workspace_hint || task.workspace || this.deps.getDefaultWorkspace(parsed.command_type);

    const workspaceProfile = await this.deps.workspaceProfileService.getProfile(task.workspace);
    if (workspaceProfile) {
      task.metadata = {
        ...(task.metadata || {}),
        workspace_profile: this.deps.workspaceProfileService.buildTaskMetadata(workspaceProfile),
        workspace_profile_summary: workspaceProfile.summary,
        workspace_profile_notes: this.deps.workspaceProfileService.buildPlanNotes(workspaceProfile),
      };
    }

    const workspaceOperationalMemory = await this.deps.workspaceOperationalMemoryService.getMemory(task.workspace, userId);
    if (workspaceOperationalMemory) {
      task.metadata = {
        ...(task.metadata || {}),
        workspace_operational_memory:
          this.deps.workspaceOperationalMemoryService.buildTaskMetadata(workspaceOperationalMemory),
        workspace_operational_memory_summary: workspaceOperationalMemory.summary,
        workspace_operational_notes:
          this.deps.workspaceOperationalMemoryService.buildPlanNotes(workspaceOperationalMemory),
      };
    }

    const workspaceRoutingAdvice = this.workspaceRoutingAdvisor.recommend({
      parsed,
      route,
      surface_source: String(task.source || 'telegram').trim().toLowerCase() || 'telegram',
      workspaceProfile,
      workspaceOperationalMemory,
    });
    const learnedRoute = this.deps.resolveWorkspaceLearnedRoute(parsed, route, workspaceRoutingAdvice);

    if (surfaceSecurity.requiresApproval) {
      classification = {
        risk_level: Math.max(classification.risk_level, 2),
        reason: surfaceSecurity.reason || classification.reason,
        requires_approval: true,
      };
    }

    task.risk_level = classification.risk_level;
    task.requires_approval = classification.requires_approval;
    task.metadata = {
      ...(task.metadata || {}),
      requiresHighRiskPin: this.deps.requiresHighRiskPin(task),
      untrustedContent: surfaceSecurity.untrustedContent,
      untrusted_content_reason: surfaceSecurity.reason,
      surface_external_link_count: surfaceSecurity.externalLinkCount,
      surface_attachment_count: surfaceSecurity.attachmentCount,
      surface_force_approval: surfaceForceApproval,
      public_server_mode: publicServerMode,
      route_capability_id: route.target || null,
      route_dispatch_mode: route.dispatch_mode || null,
      route_executor_preference: route.executor_preference || null,
      route_reason: route.routing_reason || null,
      route_task_kind: workspaceRoutingAdvice.task_kind,
      route_task_subtype: workspaceRoutingAdvice.task_subtype,
      workspace_learned_route: learnedRoute,
      workspace_routing_advice: workspaceRoutingAdvice,
      workspace_workflow_recommendation: workspaceRoutingAdvice.workflow_recommendation,
      workspace_response_style: workspaceRoutingAdvice.response_style,
      workspace_llm_recommendation: workspaceRoutingAdvice.llm_recommendation,
      workspace_command_name: parsed.workspace_command_name || null,
      workspace_route_outcome: this.deps.buildWorkspaceRouteOutcome(
        task,
        route,
        workspaceRoutingAdvice,
        learnedRoute,
      ),
    };
    task.requires_planning = route.requires_planning;
    task.executor_used = route.executor_preference;

    return {
      classification,
      workspaceRoutingAdvice,
      learnedRoute,
      surfaceForceApproval,
    };
  }
}
