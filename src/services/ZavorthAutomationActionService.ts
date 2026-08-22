import { Database } from '../storage/Database.js';
import { LogRepository } from '../storage/LogRepository.js';
import { SchedulerRepository, type ScheduledTask } from '../storage/SchedulerRepository.js';
import { ZavorthAutomationControlPlaneService, type ZavorthAutomationControlPlaneSnapshot } from './ZavorthAutomationControlPlaneService.js';
import { ZavorthAutomationIntentService } from './ZavorthAutomationIntentService.js';
import { ZavorthAutomationDeliveryService } from './ZavorthAutomationDeliveryService.js';
import { MaintenanceAutomationService } from './MaintenanceAutomationService.js';
import { OperationsActionService } from './OperationsActionService.js';
import { SchedulerService } from './SchedulerService.js';
import { ZavorthMutationPlaneService } from './ZavorthMutationPlaneService.js';
import { TrustDecisionService, type TrustDecision } from './TrustDecisionService.js';
import { RuntimeProfileService } from './RuntimeProfileService.js';
import { PermissionService } from './PermissionService.js';
import { ZavorthScheduledTaskSurfaceService } from './ZavorthScheduledTaskSurfaceService.js';
import type { ZavorthMutationPlan } from '../contracts/ZavorthMutationPlaneContract.js';
import {
  CanonicalExecutionPipelineService,
  type CanonicalExecutionPipelineEvent,
  type CanonicalExecutionPipelineLink,
} from './CanonicalExecutionPipelineService.js';
import type { ExecutionLifecycleRecord } from '../contracts/ExecutionLifecycleContract.js';

type AutomationActionDeps = {
  controlPlaneService?: Pick<ZavorthAutomationControlPlaneService, 'buildSnapshot'> | null;
  intentService?: Pick<ZavorthAutomationIntentService, 'buildPlan'> | null;
  loadSchedulerService?: () => Promise<Pick<
    SchedulerService,
    | 'scheduleTask'
    | 'findTaskByPrefix'
    | 'getTask'
    | 'listTasks'
    | 'pauseTask'
    | 'resumeTask'
    | 'removeTask'
    | 'updateTaskRuntimeMetadata'
  >>;
  loadMaintenanceService?: () => Promise<Pick<
    MaintenanceAutomationService,
    'enable' | 'disable' | 'triggerNow' | 'getStatus'
  >>;
  mutationPlaneService?: Pick<ZavorthMutationPlaneService, 'createPlan' | 'readPlan' | 'attachApproval' | 'approvePlan' | 'markApplied' | 'markBlocked'>;
  trustDecisionService?: Pick<TrustDecisionService, 'evaluate'>;
  permissionService?: Pick<PermissionService, 'getRequest'>;
  runtimeProfileService?: Pick<RuntimeProfileService, 'getProfile' | 'supportsRecurringAutomation'>;
  canonicalExecutionPipeline?: CanonicalExecutionPipelineService;
};

type AutomationActionId =
  | 'create'
  | 'pause'
  | 'resume'
  | 'remove'
  | 'reapprove'
  | 'maintenance-on'
  | 'maintenance-off'
  | 'maintenance-run';

export type ZavorthAutomationActionExecution = {
  generatedAt: string;
  actionId: string;
  status: 'completed' | 'blocked' | 'waiting_approval';
  ok: boolean;
  summary: string;
  details: string[];
  snapshot: ZavorthAutomationControlPlaneSnapshot;
  task: ScheduledTask | null;
  maintenance: ReturnType<MaintenanceAutomationService['getStatus']> | null;
  traceId?: string | null;
  runId?: string | null;
  sessionId?: string | null;
  approvalId?: string | null;
  artifactId?: string | null;
  execution?: CanonicalExecutionPipelineLink;
  execution_lifecycle?: ExecutionLifecycleRecord[];
  mutationPlan?: ZavorthMutationPlan | null;
  trustDecision?: TrustDecision | null;
};

export class ZavorthAutomationActionService {
  private readonly controlPlaneService: Pick<ZavorthAutomationControlPlaneService, 'buildSnapshot'>;
  private readonly intentService: Pick<ZavorthAutomationIntentService, 'buildPlan'>;
  private readonly loadSchedulerService: () => Promise<Pick<
    SchedulerService,
    | 'scheduleTask'
    | 'findTaskByPrefix'
    | 'getTask'
    | 'listTasks'
    | 'pauseTask'
    | 'resumeTask'
    | 'removeTask'
    | 'updateTaskRuntimeMetadata'
  >>;
  private readonly loadMaintenanceService: () => Promise<Pick<
    MaintenanceAutomationService,
    'enable' | 'disable' | 'triggerNow' | 'getStatus'
  >>;
  private readonly mutationPlane: Pick<ZavorthMutationPlaneService, 'createPlan' | 'readPlan' | 'attachApproval' | 'approvePlan' | 'markApplied' | 'markBlocked'>;
  private readonly trustDecision: Pick<TrustDecisionService, 'evaluate'>;
  private readonly permissionService: Pick<PermissionService, 'getRequest'>;
  private readonly runtimeProfile: Pick<RuntimeProfileService, 'getProfile' | 'supportsRecurringAutomation'>;
  private readonly canonicalExecution: CanonicalExecutionPipelineService;

  constructor(runtime: AutomationActionDeps = {}) {
    this.controlPlaneService = runtime.controlPlaneService || new ZavorthAutomationControlPlaneService();
    this.intentService = runtime.intentService || new ZavorthAutomationIntentService();
    this.loadSchedulerService =
      runtime.loadSchedulerService
      || (async () => {
        const db = await Database.getInstance();
        return new SchedulerService(
          new SchedulerRepository(db),
          { deliveryService: new ZavorthAutomationDeliveryService() },
        );
      });
    this.loadMaintenanceService =
      runtime.loadMaintenanceService
      || (async () => {
        const logRepo = new LogRepository();
        await logRepo.init();
        return new MaintenanceAutomationService(new OperationsActionService(logRepo), logRepo);
      });
    this.mutationPlane = runtime.mutationPlaneService || new ZavorthMutationPlaneService();
    this.trustDecision = runtime.trustDecisionService || new TrustDecisionService();
    this.permissionService = runtime.permissionService || new PermissionService();
    this.runtimeProfile = runtime.runtimeProfileService || new RuntimeProfileService();
    this.canonicalExecution = runtime.canonicalExecutionPipeline || new CanonicalExecutionPipelineService();
  }

  public async execute(input: {
    actionId: AutomationActionId;
    intentText?: string | null;
    taskId?: string | null;
    requestedBy?: string | null;
    sourceSurface?: 'telegram' | 'app' | 'email' | 'webhook' | null;
  }): Promise<ZavorthAutomationActionExecution> {
    if (this.requiresMutationPlan(input.actionId)) {
      return this.previewMutation(input);
    }
    return this.executeDirect(input);
  }

  public async apply(input: {
    planId: string;
    requestedBy?: string | null;
  }): Promise<ZavorthAutomationActionExecution> {
    let plan = this.mutationPlane.readPlan(input.planId);
    if (!plan || plan.domain !== 'automation') {
      throw new Error(`Automation plan not found: ${input.planId || 'not provided'}.`);
    }
    if (!this.runtimeProfile.supportsRecurringAutomation()) {
      const blocked = this.mutationPlane.markBlocked(plan.id, 'Core profile does not apply recurring loops.');
      const snapshot = await this.controlPlaneService.buildSnapshot();
      const payload = plan.payload || {};
      return this.withExecutionLifecycle({
        actionId: plan.actionId as AutomationActionId,
        intentText: String(payload.intentText || payload.prompt || ''),
        taskId: String(payload.taskId || ''),
        requestedBy: input.requestedBy || String(payload.requestedBy || ''),
        sourceSurface: String(payload.sourceSurface || 'app') as 'telegram' | 'app' | 'email' | 'webhook',
      }, {
        generatedAt: new Date().toISOString(),
        actionId: plan.actionId,
        status: 'blocked',
        ok: false,
        summary: 'Core profile does not apply recurring automations. Switch to ops/full before apply.',
        details: ['The plan remains recorded for audit, but was blocked in core.'],
        snapshot,
        task: null,
        maintenance: null,
        mutationPlan: blocked,
        trustDecision: null,
      });
    }
    if (plan.approval.required && plan.status !== 'approved' && plan.approval.status !== 'approved') {
      const permission = plan.approval.permissionId
        ? await this.permissionService.getRequest(plan.approval.permissionId)
        : null;
      if (permission?.status === 'approved') {
        plan = this.mutationPlane.approvePlan(plan.id, {
          permissionId: permission.permission_id,
          approvedBy: permission.decided_by || input.requestedBy || null,
          scope: permission.scope === 'persistent' ? 'host' : permission.scope === 'session' ? 'session' : 'once',
        });
      }
    }
    if (plan.approval.required && plan.status !== 'approved' && plan.approval.status !== 'approved') {
      throw new Error(`Plan ${plan.id} is still waiting for approval.`);
    }

    const payload = plan.payload || {};
    const execution = await this.executeDirect({
      actionId: plan.actionId as AutomationActionId,
      intentText: String(payload.intentText || payload.prompt || ''),
      taskId: String(payload.taskId || ''),
      requestedBy: input.requestedBy || String(payload.requestedBy || ''),
      sourceSurface: String(payload.sourceSurface || 'app') as 'telegram' | 'app' | 'email' | 'webhook',
    });
    const applied = this.mutationPlane.markApplied(plan.id, execution.summary, [execution.actionId]);
    return this.withExecutionLifecycle({
      actionId: plan.actionId as AutomationActionId,
      intentText: String(payload.intentText || payload.prompt || ''),
      taskId: String(payload.taskId || ''),
      requestedBy: input.requestedBy || String(payload.requestedBy || ''),
      sourceSurface: String(payload.sourceSurface || 'app') as 'telegram' | 'app' | 'email' | 'webhook',
    }, {
      ...execution,
      mutationPlan: applied,
      details: [
        ...execution.details,
        `Mutation plan applied exactly from saved payload: ${applied.id}.`,
      ],
    });
  }

  private async executeDirect(input: {
    actionId: AutomationActionId;
    intentText?: string | null;
    promptText?: string | null;
    scheduleText?: string | null;
    delivery?: 'telegram' | 'app' | 'email' | 'webhook' | null;
    deliveryTarget?: string | null;
    taskId?: string | null;
    requestedBy?: string | null;
    sourceSurface?: 'telegram' | 'app' | 'email' | 'webhook' | null;
  }): Promise<ZavorthAutomationActionExecution> {
    const scheduler = await this.loadSchedulerService();
    const maintenance = await this.loadMaintenanceService();
    const requestedBy = String(input.requestedBy || '').trim() || 'operator';
    let status: ZavorthAutomationActionExecution['status'] = 'completed';
    let summary = 'Automation action executed.';
    const details: string[] = [];
    let task: ScheduledTask | null = null;
    let maintenanceStatus: ReturnType<MaintenanceAutomationService['getStatus']> | null = null;

    if (input.actionId === 'create') {
      const plan = this.intentService.buildPlan({
        intentText: String(input.intentText || ''),
        promptText: input.promptText,
        scheduleText: input.scheduleText,
        delivery: input.delivery,
        deliveryTarget: input.deliveryTarget,
        defaultDelivery: input.sourceSurface || 'app',
      });
      if (plan.posture !== 'ready' || !plan.schedule || !plan.prompt) {
        status = 'blocked';
        summary = plan.summary;
        details.push(...plan.reasons);
      } else {
        const surface = this.mapActionSurface(input.sourceSurface);
        const registered = await new ZavorthScheduledTaskSurfaceService({
          schedulerService: scheduler,
        }).register({
          intent: plan.intentText,
          command: plan.prompt,
          schedule: plan.schedule,
          requestedBy,
          surface,
          delivery: plan.delivery,
          deliveryTarget: plan.deliveryTarget,
          approvalId: `automation-${input.actionId}-${requestedBy}`,
          approvedBy: requestedBy,
          allowedTools: ['scheduled_task_dispatch'],
          maxCommands: 1,
          maxMutations: 0,
          maxNetworkRequests: plan.delivery === 'webhook' ? 1 : 0,
        });
        task = registered.persistence?.task as ScheduledTask | null;
        if (!registered.ok || !task) {
          status = 'blocked';
          summary = registered.summary;
          details.push(...registered.details);
        } else {
          summary = `Governed automation created: ${plan.scheduleLabel} -> ${plan.prompt}.`;
          details.push(
            `Delivery: ${plan.delivery}${plan.deliveryTarget ? ` (${plan.deliveryTarget})` : ''}.`,
            `Task: ${task.id.split('-')[0]}.`,
            'Persistence: ZavorthScheduledTaskPersistenceService.',
          );
        }
        if (!task && status !== 'blocked') {
          status = 'blocked';
          summary = 'Governed persistence did not return a task.';
        }
      }
    } else if (input.actionId === 'pause') {
      task = await this.resolveTask(scheduler, input.taskId);
      if (!task) {
        status = 'blocked';
        summary = 'Automation not found for pause.';
      } else {
        const lifecycle = await new ZavorthScheduledTaskSurfaceService({ schedulerService: scheduler }).lifecycle({
          action: 'pause',
          taskId: task.id,
          requestedBy,
          surface: this.mapActionSurface(input.sourceSurface),
          approvalId: `automation-pause-${requestedBy}`,
          approvedBy: requestedBy,
        });
        task = lifecycle.persistence?.task as ScheduledTask | null || task;
        status = lifecycle.ok ? 'completed' : 'blocked';
        summary = lifecycle.ok ? `Automation ${task?.id.split('-')[0]} paused.` : lifecycle.summary;
        details.push(...lifecycle.details);
      }
    } else if (input.actionId === 'resume') {
      task = await this.resolveTask(scheduler, input.taskId);
      if (!task) {
        status = 'blocked';
        summary = 'Automation not found for resume.';
      } else {
        const lifecycle = await new ZavorthScheduledTaskSurfaceService({ schedulerService: scheduler }).lifecycle({
          action: 'resume',
          taskId: task.id,
          requestedBy,
          surface: this.mapActionSurface(input.sourceSurface),
          approvalId: `automation-resume-${requestedBy}`,
          approvedBy: requestedBy,
        });
        task = lifecycle.persistence?.task as ScheduledTask | null || task;
        status = lifecycle.ok ? 'completed' : 'blocked';
        summary = lifecycle.ok ? `Automation ${task?.id.split('-')[0]} resumed.` : lifecycle.summary;
        details.push(...lifecycle.details);
      }
    } else if (input.actionId === 'remove') {
      task = await this.resolveTask(scheduler, input.taskId);
      if (!task) {
        status = 'blocked';
        summary = 'Automation not found for removal.';
      } else {
        const lifecycle = await new ZavorthScheduledTaskSurfaceService({ schedulerService: scheduler }).lifecycle({
          action: 'revoke',
          taskId: task.id,
          requestedBy,
          surface: this.mapActionSurface(input.sourceSurface),
          approvalId: `automation-revoke-${requestedBy}`,
          approvedBy: requestedBy,
        });
        task = lifecycle.persistence?.task as ScheduledTask | null || task;
        status = lifecycle.ok ? 'completed' : 'blocked';
        summary = lifecycle.ok ? `Automation ${task.id.split('-')[0]} removed.` : lifecycle.summary;
        details.push(...lifecycle.details);
      }
    } else if (input.actionId === 'reapprove') {
      task = await this.resolveTask(scheduler, input.taskId);
      if (!task) {
        status = 'blocked';
        summary = 'Automation not found for reapproval.';
      } else {
        const lifecycle = await new ZavorthScheduledTaskSurfaceService({ schedulerService: scheduler }).lifecycle({
          action: 'reapprove',
          taskId: task.id,
          requestedBy,
          surface: this.mapActionSurface(input.sourceSurface),
          approvalId: `automation-reapprove-${requestedBy}`,
          approvedBy: requestedBy,
        });
        task = lifecycle.persistence?.task as ScheduledTask | null || task;
        status = lifecycle.ok ? 'completed' : 'blocked';
        summary = lifecycle.ok ? `Automation ${task.id.split('-')[0]} reapproved.` : lifecycle.summary;
        details.push(...lifecycle.details);
      }
    } else if (input.actionId === 'maintenance-on') {
      maintenanceStatus = maintenance.enable(requestedBy, 'Scheduled runs: recurring maintenance enabled by the control plane.');
      summary = 'Recurring maintenance enabled.';
    } else if (input.actionId === 'maintenance-off') {
      maintenanceStatus = maintenance.disable(requestedBy, 'Scheduled runs: recurring maintenance disabled by the control plane.');
      summary = 'Recurring maintenance disabled.';
    } else if (input.actionId === 'maintenance-run') {
      maintenanceStatus = maintenance.triggerNow(requestedBy, 'Scheduled runs: recurring maintenance triggered manually.');
      summary = 'Recurring maintenance triggered.';
    }

    const snapshot = await this.controlPlaneService.buildSnapshot();
    return this.withExecutionLifecycle(input, {
      generatedAt: new Date().toISOString(),
      actionId: input.actionId,
      status,
      ok: status !== 'blocked',
      summary,
      details,
      snapshot,
      task,
      maintenance: maintenanceStatus,
      mutationPlan: null,
      trustDecision: null,
    });
  }

  private async previewMutation(input: {
    actionId: AutomationActionId;
    intentText?: string | null;
    taskId?: string | null;
    requestedBy?: string | null;
    sourceSurface?: 'telegram' | 'app' | 'email' | 'webhook' | null;
  }): Promise<ZavorthAutomationActionExecution> {
    const requestedBy = String(input.requestedBy || '').trim() || 'operator';
    const payload = await this.buildMutationPayload(input);
    const plan = this.mutationPlane.createPlan({
      domain: 'automation',
      actionId: input.actionId,
      title: this.buildMutationTitle(input.actionId, payload),
      summary: 'Recurring automation or mutable maintenance requires approval and budget before apply.',
      requestedBy,
      sourceSurface: input.sourceSurface || 'app',
      riskLevel: 'medium',
      approvalRequired: true,
      approvalReason: 'Automation can create a recurring loop or trigger maintenance.',
      resourceImpact: {
        ramMb: 64,
        diskMb: 100,
        processCount: 0,
        externalExposure: payload.delivery === 'webhook' ? 'network' : 'local',
        recurring: input.actionId === 'create' || input.actionId === 'resume' || input.actionId === 'maintenance-on',
        notes: [
          'runtime max 10 min',
          'concurrency global ops=1/full=2 e per-task=1',
          'auto-pause after 3 consecutive failures',
          'outbox limited by TTL/bytes and idempotency key',
        ],
      },
      retentionPolicy: {
        ttlMs: 7 * 24 * 60 * 60 * 1000,
        maxBytes: 100 * 1024 * 1024,
        cleanupOnSuccess: false,
        cleanupOnBoot: false,
        notes: ['Outbox retained for 7 days or 100 MB.'],
      },
      validationPlan: [
        'validate schedule/prompt before creating task.',
        'Confirm ops/full profile before applying a recurring loop.',
        'Persist budget_json and guardrail_json.',
        'Register delivery in outbox idempotently when there is an external destination.',
      ],
      rollbackPlan: [
        'Pause/remove created automation if apply fails.',
      ],
      payload,
    });
    const decision = await this.trustDecision.evaluate({
      domain: 'automation',
      actionId: input.actionId,
      planId: plan.id,
      requestedBy,
      sourceSurface: input.sourceSurface || 'app',
      riskLevel: 'medium',
      approvalRequired: true,
      capabilityId: 'recurring-automation',
      reason: 'Recurring automation requires canonical approval.',
      payload,
      resourceImpact: plan.resourceImpact,
    });
    const mutationPlan = decision.permission
      ? this.mutationPlane.attachApproval(plan.id, {
        permissionId: decision.permission.permission_id,
        status: decision.permission.status === 'approved' ? 'approved' : 'pending',
        reason: decision.reason,
      })
      : plan;
    const snapshot = await this.controlPlaneService.buildSnapshot();
    return this.withExecutionLifecycle(input, {
      generatedAt: new Date().toISOString(),
      actionId: input.actionId,
      status: decision.decision === 'blocked' ? 'blocked' : 'waiting_approval',
      ok: false,
      summary: decision.decision === 'blocked'
        ? decision.reason
        : `Automation preview created; apply after approval with plan ${mutationPlan.id}.`,
      details: [
        `Plan: ${mutationPlan.id}.`,
        decision.permission ? `Permission: ${decision.permission.permission_id}.` : 'Pending permission was not created.',
      ],
      snapshot,
      task: null,
      maintenance: null,
      mutationPlan,
      trustDecision: decision,
    });
  }

  private withExecutionLifecycle(
    input: {
      actionId: AutomationActionId;
      intentText?: string | null;
      taskId?: string | null;
      requestedBy?: string | null;
      sourceSurface?: 'telegram' | 'app' | 'email' | 'webhook' | null;
    },
    execution: ZavorthAutomationActionExecution,
  ): ZavorthAutomationActionExecution {
    const requestedBy = String(input.requestedBy || '').trim() || 'operator';
    const surface = input.sourceSurface || 'app';
    const planId = execution.mutationPlan?.id || null;
    const permissionId = execution.trustDecision?.permission?.permission_id
      || execution.mutationPlan?.approval?.permissionId
      || null;
    const taskId = execution.task?.id || input.taskId || null;
    const runId = planId || taskId || `automation:${execution.actionId}`;
    const status = this.canonicalExecution.mapAutomationStatus(execution.status);
    const events: CanonicalExecutionPipelineEvent[] = [{
      engine: 'automation',
      kind: planId ? 'plan' : 'execution',
      id: planId || taskId || `automation:${execution.actionId}`,
      status,
      summary: execution.summary,
      objective: input.intentText || execution.summary,
      requestedBy,
      surface,
      runId,
      approvalId: permissionId,
      metadata: {
        actionId: execution.actionId,
        taskId,
        mutationPlanId: planId,
      },
    }];
    if (permissionId) {
      events.push({
        engine: 'automation',
        kind: 'approval',
        id: permissionId,
        status: execution.status === 'waiting_approval' ? 'approval_required' : status,
        summary: execution.status === 'waiting_approval'
          ? 'Automation action is waiting for canonical approval.'
          : 'Automation approval linked to canonical run.',
        requestedBy,
        surface,
        runId,
        approvalId: permissionId,
        parentId: runId,
      });
    }
    const link = this.canonicalExecution.buildLink(events);
    return {
      ...execution,
      traceId: link.traceId,
      runId: link.runId,
      sessionId: link.sessionId,
      approvalId: link.approvalId,
      artifactId: link.artifactId,
      execution: link,
      execution_lifecycle: link.lifecycle,
    };
  }

  private async buildMutationPayload(input: {
    actionId: string;
    intentText?: string | null;
    promptText?: string | null;
    scheduleText?: string | null;
    delivery?: string | null;
    deliveryTarget?: string | null;
    taskId?: string | null;
    requestedBy?: string | null;
    sourceSurface?: string | null;
  }): Promise<Record<string, unknown>> {
    if (input.actionId === 'create') {
      const plan = this.intentService.buildPlan({
        intentText: String(input.intentText || ''),
        promptText: input.promptText,
        scheduleText: input.scheduleText,
        delivery: this.normalizeSurfaceDelivery(input.delivery),
        deliveryTarget: input.deliveryTarget,
        defaultDelivery: (input.sourceSurface || 'app') as 'telegram' | 'app' | 'email' | 'webhook',
      });
      return {
        intentText: plan.intentText,
        prompt: plan.prompt,
        schedule: plan.schedule,
        scheduleLabel: plan.scheduleLabel,
        delivery: plan.delivery,
        deliveryTarget: plan.deliveryTarget,
        budget: this.buildDefaultBudgetPayload(),
        guardrails: this.buildDefaultGuardrailPayload(plan.prompt, plan.schedule || 'pending', input.requestedBy || 'operator'),
        outboxRetention: {
          ttlMs: 7 * 24 * 60 * 60 * 1000,
          maxBytes: 100 * 1024 * 1024,
          idempotencyRequired: plan.delivery === 'email' || plan.delivery === 'webhook',
        },
        posture: plan.posture,
        reasons: plan.reasons,
        requestedBy: input.requestedBy || null,
        sourceSurface: input.sourceSurface || null,
      };
    }
    return {
      taskId: input.taskId || null,
      budget: this.buildDefaultBudgetPayload(),
      guardrails: this.buildDefaultGuardrailPayload(String(input.taskId || 'task'), 'existing', input.requestedBy || 'operator'),
      outboxRetention: {
        ttlMs: 7 * 24 * 60 * 60 * 1000,
        maxBytes: 100 * 1024 * 1024,
        idempotencyRequired: false,
      },
      requestedBy: input.requestedBy || null,
      sourceSurface: input.sourceSurface || null,
    };
  }

  private buildMutationTitle(actionId: string, payload: Record<string, unknown>): string {
    if (actionId === 'create') {
      return `Create automation ${payload.scheduleLabel || payload.schedule || 'recurring'}`;
    }
    if (actionId === 'resume') {
      return `Resume automation ${payload.taskId || 'not provided'}`;
    }
    if (actionId === 'maintenance-on') {
      return 'Enable recurring maintenance';
    }
    if (actionId === 'maintenance-run') {
      return 'Trigger recurring maintenance now';
    }
    return `Automation ${actionId}`;
  }

  private requiresMutationPlan(actionId: string): boolean {
    return actionId === 'create' || actionId === 'resume' || actionId === 'maintenance-on' || actionId === 'maintenance-run';
  }

  private mapActionSurface(surface: 'telegram' | 'app' | 'email' | 'webhook' | null | undefined): 'telegram' | 'web' | 'api' {
    if (surface === 'telegram') return 'telegram';
    if (surface === 'webhook') return 'api';
    return 'web';
  }

  private normalizeSurfaceDelivery(value: string | null | undefined): 'telegram' | 'app' | 'email' | 'webhook' | null {
    if (value === 'telegram' || value === 'app' || value === 'email' || value === 'webhook') {
      return value;
    }
    return null;
  }

  private buildDefaultBudgetPayload(): Record<string, unknown> {
    return {
      maxRuntimeMs: 10 * 60 * 1000,
      maxMemoryMb: 256,
      retries: 2,
      backoffMs: 30 * 1000,
      maxConcurrentRuns: this.runtimeProfile.getProfile() === 'full' ? 2 : 1,
      maxPerTaskConcurrentRuns: 1,
      maintenanceWindows: [
        {
          label: 'default-nightly-maintenance',
          start: '04:00',
          end: '06:00',
          timezone: 'local',
          heavyTasksOnly: true,
        },
      ],
    };
  }

  private buildDefaultGuardrailPayload(command: string, schedule: string, userId: string): Record<string, unknown> {
    return {
      autoPauseAfterConsecutiveFailures: 3,
      idempotencyKeySeed: `task:${command}:${schedule}:${userId}`,
      outboxTtlMs: 7 * 24 * 60 * 60 * 1000,
      outboxMaxBytes: 100 * 1024 * 1024,
      pauseCreatesInboxNotice: true,
    };
  }

  private async resolveTask(
    scheduler: Pick<SchedulerService, 'findTaskByPrefix'>,
    taskId: string | null | undefined,
  ): Promise<ScheduledTask | null> {
    const normalized = String(taskId || '').trim();
    if (!normalized) {
      return null;
    }
    return scheduler.findTaskByPrefix(normalized);
  }
}
