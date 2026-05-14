import type {
  CapabilityFallbackOption,
  CapabilityReceipt,
  OriginalIntentEnvelope,
} from '../contracts/CapabilityAutopilotContract.js';
import type { ExecutionResult } from '../contracts/ExecutionContract.js';
import type { Plan, PlanStep } from '../contracts/PlanContract.js';
import type { Task } from '../contracts/TaskContract.js';
import type { TaskSource } from '../contracts/PlatformContract.js';
import type { GatewayDecision } from '../execution/ExecutionGateway.js';
import type {
  CapabilityFallbackHandoffResult,
  CapabilityFallbackHandoffStatus,
} from './CapabilityAutopilotFallbackHandoffService.js';
import type { CapabilityAutopilotExecutionGatewayLike } from './CapabilityAutopilotExecutionGatewayRunnerService.js';

export type CapabilityFallbackResumeRunStatus =
  | 'blocked'
  | 'dry_run'
  | 'completed'
  | 'failed';

export type CapabilityFallbackResumeRunInput = {
  handoff: CapabilityFallbackHandoffResult;
  dryRun?: boolean;
  requestedBy?: string | null;
  requireReadyHandoff?: boolean;
  additionalInstructions?: string[];
};

export type CapabilityFallbackResumeRunResult = {
  generatedAt: string;
  status: CapabilityFallbackResumeRunStatus;
  capabilityId: string;
  selectedFallback: CapabilityFallbackOption | null;
  dryRun: boolean;
  task: Task | null;
  plan: Plan | null;
  gatewayDecision: GatewayDecision | null;
  executionResult: ExecutionResult | null;
  receipt: CapabilityReceipt | null;
  resumeIntent: OriginalIntentEnvelope | null;
  summary: string;
  technicalSummary: string;
  metadata: Record<string, unknown>;
};

export type CapabilityAutopilotFallbackResumeRunRuntime = {
  now?: () => Date;
  gateway: CapabilityAutopilotExecutionGatewayLike;
};

export class CapabilityAutopilotFallbackResumeRunService {
  private readonly now: () => Date;
  private readonly gateway: CapabilityAutopilotExecutionGatewayLike;

  constructor(runtime: CapabilityAutopilotFallbackResumeRunRuntime) {
    if (!runtime.gateway) {
      throw new Error('CapabilityAutopilotFallbackResumeRunService exige gateway.');
    }
    this.now = runtime.now || (() => new Date());
    this.gateway = runtime.gateway;
  }

  public async resumeReadyFallback(
    input: CapabilityFallbackResumeRunInput,
  ): Promise<CapabilityFallbackResumeRunResult> {
    const generatedAt = this.now().toISOString();
    const dryRun = input.dryRun !== false;
    const selectedFallback = input.handoff.selectedFallback;
    const resumeIntent = input.handoff.resumeIntent || input.handoff.validationResult?.resumeIntent || null;
    const receipt = input.handoff.receipt || input.handoff.validationResult?.receipt || null;
    const readinessBlock = this.getReadinessBlock(input.handoff.status, input.requireReadyHandoff !== false);

    if (readinessBlock) {
      return this.blockedResult({
        generatedAt,
        dryRun,
        handoff: input.handoff,
        receipt,
        resumeIntent,
        selectedFallback,
        summary: readinessBlock,
        technicalSummary: `fallback_resume=blocked; handoff_status=${input.handoff.status}`,
      });
    }

    if (!selectedFallback) {
      return this.blockedResult({
        generatedAt,
        dryRun,
        handoff: input.handoff,
        receipt,
        resumeIntent,
        selectedFallback,
        summary: 'Nao ha fallback selecionado para retomar.',
        technicalSummary: 'fallback_resume=blocked; reason=no_selected_fallback',
      });
    }

    if (!resumeIntent) {
      return this.blockedResult({
        generatedAt,
        dryRun,
        handoff: input.handoff,
        receipt,
        resumeIntent,
        selectedFallback,
        summary: 'Nao ha pedido original preservado para retomar.',
        technicalSummary: 'fallback_resume=blocked; reason=missing_resume_intent',
      });
    }

    const executorName = selectedFallback.executorName || resumeIntent.requestedExecutorName || null;
    if (!executorName) {
      return this.blockedResult({
        generatedAt,
        dryRun,
        handoff: input.handoff,
        receipt,
        resumeIntent,
        selectedFallback,
        summary: 'Fallback escolhido nao informa executor para a retomada.',
        technicalSummary: 'fallback_resume=blocked; reason=missing_executor',
      });
    }

    const task = this.buildTask({
      generatedAt,
      handoff: input.handoff,
      resumeIntent,
      selectedFallback,
      executorName,
      requestedBy: input.requestedBy || null,
    });
    const plan = this.buildPlan({
      generatedAt,
      handoff: input.handoff,
      resumeIntent,
      selectedFallback,
      executorName,
      additionalInstructions: input.additionalInstructions || [],
    });

    const gatewayDecision = await this.gateway.submit(task, plan, dryRun);
    const executionResult = gatewayDecision.execution_result;
    const status = this.resolveStatus(gatewayDecision, executionResult, dryRun);
    const nextReceipt = this.appendResumeTimeline(receipt, {
      generatedAt,
      status,
      selectedFallback,
      gatewayDecision,
      executionResult,
      dryRun,
    });

    return {
      generatedAt,
      status,
      capabilityId: input.handoff.capabilityId,
      selectedFallback,
      dryRun,
      task,
      plan,
      gatewayDecision,
      executionResult,
      receipt: nextReceipt,
      resumeIntent,
      summary: this.buildSummary(status, selectedFallback, gatewayDecision, executionResult, dryRun),
      technicalSummary: [
        `fallback_resume=${status}`,
        `executor=${executorName}`,
        `dryRun=${dryRun}`,
        `gatewayAllowed=${gatewayDecision.allowed}`,
        executionResult ? `executionSuccess=${executionResult.success}` : null,
      ].filter(Boolean).join('; '),
      metadata: {
        phase: 'capability-autopilot-phase-66',
        autoFallbackExecuted: false,
        explicitSelectionRequired: true,
        handoffStatus: input.handoff.status,
        fallbackId: selectedFallback.id,
        executorName,
        traceId: gatewayDecision.correlation.traceId,
        executionId: executionResult?.execution_id || null,
      },
    };
  }

  private getReadinessBlock(
    handoffStatus: CapabilityFallbackHandoffStatus,
    requireReadyHandoff: boolean,
  ): string | null {
    if (!requireReadyHandoff) {
      return null;
    }
    if (handoffStatus === 'ready_to_resume') {
      return null;
    }
    if (handoffStatus === 'permission_requested' || handoffStatus === 'waiting_permission') {
      return 'Fallback ainda aguarda permissao antes da retomada.';
    }
    if (handoffStatus === 'permission_rejected') {
      return 'Permissao rejeitada para o fallback; nao devo retomar.';
    }
    if (handoffStatus === 'needs_repair') {
      return 'Fallback ainda precisa de reparo antes da retomada.';
    }
    return 'Fallback ainda nao esta pronto para retomar.';
  }

  private buildTask(input: {
    generatedAt: string;
    handoff: CapabilityFallbackHandoffResult;
    resumeIntent: OriginalIntentEnvelope;
    selectedFallback: CapabilityFallbackOption;
    executorName: string;
    requestedBy: string | null;
  }): Task {
    const workspace = this.resolveWorkspace(input.resumeIntent);
    const taskId = this.safeId(`${input.resumeIntent.taskId || input.resumeIntent.intentId}-fallback-resume`);

    return {
      task_id: taskId,
      created_at: input.generatedAt,
      updated_at: input.generatedAt,
      source: this.resolveTaskSource(input.resumeIntent),
      chat_id: input.resumeIntent.sessionId || input.resumeIntent.taskId || 'capability-autopilot',
      user_id: input.requestedBy || input.resumeIntent.userId || 'capability-autopilot',
      raw_message: input.resumeIntent.rawText,
      normalized_message: input.resumeIntent.normalizedText,
      command_type: input.resumeIntent.commandType || 'capability_autopilot_fallback_resume',
      intent: input.resumeIntent.task?.intent || 'fallback_resume',
      target: input.selectedFallback.capabilityId || input.selectedFallback.executorName || input.handoff.capabilityId,
      workspace,
      risk_level: input.resumeIntent.plan?.risk_level || input.resumeIntent.task?.risk_level || 5,
      status: 'approved',
      requires_planning: false,
      requires_approval: false,
      approval_status: 'approved',
      planner_used: 'capability-autopilot-fallback-resume',
      executor_used: input.executorName,
      fallback_used: true,
      parent_task_id: input.resumeIntent.taskId || input.resumeIntent.task?.task_id || null,
      actions_planned: [],
      actions_executed: [],
      target_files: workspace ? [workspace] : [],
      artifacts: [],
      stdout_summary: null,
      stderr_summary: null,
      diff_summary: null,
      result_summary: null,
      error_summary: null,
      rollback_available: false,
      metadata: {
        phase: 'capability-autopilot-phase-66',
        capability_autopilot: true,
        fallback_resume: true,
        capability_id: input.handoff.capabilityId,
        selected_fallback_id: input.selectedFallback.id,
        selected_fallback_label: input.selectedFallback.label,
        original_intent_id: input.resumeIntent.intentId,
        original_requested_capability_id: input.resumeIntent.metadata?.previousCapabilityId || null,
        requested_executor_name: input.executorName,
        extra_allowed_paths: workspace ? [workspace] : [],
        resume_metadata: input.resumeIntent.metadata || {},
      },
    };
  }

  private buildPlan(input: {
    generatedAt: string;
    handoff: CapabilityFallbackHandoffResult;
    resumeIntent: OriginalIntentEnvelope;
    selectedFallback: CapabilityFallbackOption;
    executorName: string;
    additionalInstructions: string[];
  }): Plan {
    const workspace = this.resolveWorkspace(input.resumeIntent);
    const instructions = this.resolveInstructions(input.resumeIntent, input.additionalInstructions);
    const steps = instructions.map((instruction, index) =>
      this.planStep({
        index,
        instruction,
        executorName: input.executorName,
        workspace,
      }),
    );

    return {
      plan_id: this.safeId(`${input.resumeIntent.intentId}-fallback-resume-plan`),
      task_id: this.safeId(`${input.resumeIntent.taskId || input.resumeIntent.intentId}-fallback-resume`),
      objective: input.resumeIntent.executionRequest?.objective ||
        input.resumeIntent.plan?.objective ||
        `Retomar pedido original via ${input.selectedFallback.label}.`,
      context: [
        'Retomada governada apos fallback explicito do Capability Autopilot.',
        `fallback=${input.selectedFallback.label}`,
        `handoff=${input.handoff.status}`,
        `original=${input.resumeIntent.rawText}`,
      ].join(' | '),
      assumptions: [
        'O fallback ja foi escolhido explicitamente pelo usuario.',
        'A capability alternativa passou pelo handoff/readiness antes desta retomada.',
        'ExecutionGateway continua responsavel por policy, hooks, modo operacional e telemetry.',
      ],
      executor_recommendation: input.executorName,
      workspace_recommendation: workspace,
      risk_level: input.resumeIntent.plan?.risk_level || input.resumeIntent.task?.risk_level || 5,
      requires_approval: false,
      steps,
      validation_steps: [
        'Registrar resultado da retomada no receipt do Capability Autopilot.',
      ],
      success_condition: 'Pedido original retomado pelo executor alternativo governado.',
      rollback_condition: null,
      notes: [
        `fallbackId=${input.selectedFallback.id}`,
        `capabilityId=${input.handoff.capabilityId}`,
        `resumeIntentId=${input.resumeIntent.intentId}`,
      ],
    };
  }

  private resolveInstructions(
    resumeIntent: OriginalIntentEnvelope,
    additionalInstructions: string[],
  ): string[] {
    const fromRequest = resumeIntent.executionRequest?.instructions || [];
    const base = fromRequest.length > 0
      ? fromRequest
      : [resumeIntent.normalizedText || resumeIntent.rawText];
    return [...base, ...additionalInstructions]
      .map((entry) => String(entry || '').trim())
      .filter(Boolean);
  }

  private planStep(input: {
    index: number;
    instruction: string;
    executorName: string;
    workspace: string | null;
  }): PlanStep {
    return {
      step_id: `resume-${input.index + 1}`,
      type: 'exec',
      description: input.instruction,
      tool: input.executorName,
      args: {
        fallbackResume: true,
      },
      command: null,
      file_targets: input.workspace ? [input.workspace] : [],
      expected_output: 'Executor alternativo processa a instrucao preservada.',
      sensitive: false,
    };
  }

  private resolveStatus(
    gatewayDecision: GatewayDecision,
    executionResult: ExecutionResult | null,
    dryRun: boolean,
  ): CapabilityFallbackResumeRunStatus {
    if (!gatewayDecision.allowed) {
      return 'blocked';
    }
    if (dryRun) {
      return 'dry_run';
    }
    if (executionResult?.success) {
      return 'completed';
    }
    return 'failed';
  }

  private appendResumeTimeline(
    receipt: CapabilityReceipt | null,
    input: {
      generatedAt: string;
      status: CapabilityFallbackResumeRunStatus;
      selectedFallback: CapabilityFallbackOption;
      gatewayDecision: GatewayDecision;
      executionResult: ExecutionResult | null;
      dryRun: boolean;
    },
  ): CapabilityReceipt | null {
    if (!receipt) {
      return null;
    }
    const timelineStatus = input.status === 'completed' || input.status === 'dry_run'
      ? 'completed'
      : (input.status === 'blocked' ? 'blocked' : 'failed');

    return {
      ...receipt,
      generatedAt: input.generatedAt,
      stage: input.status === 'completed' ? 'completed' : 'resume',
      timeline: [
        ...receipt.timeline,
        {
          at: input.generatedAt,
          stage: 'resume',
          status: timelineStatus,
          summary: this.buildTimelineSummary(input.status, input.selectedFallback, input.dryRun),
          detail: [
            `gatewayAllowed=${input.gatewayDecision.allowed}`,
            `reason=${input.gatewayDecision.reason}`,
            input.executionResult ? `executionId=${input.executionResult.execution_id}` : null,
            input.executionResult?.error_code ? `errorCode=${input.executionResult.error_code}` : null,
          ].filter(Boolean).join('; '),
        },
      ],
      metadata: {
        ...(receipt.metadata || {}),
        phase: 'capability-autopilot-phase-66',
        fallbackResumeRunRecorded: true,
        fallbackResumeDryRun: input.dryRun,
      },
    };
  }

  private buildTimelineSummary(
    status: CapabilityFallbackResumeRunStatus,
    selectedFallback: CapabilityFallbackOption,
    dryRun: boolean,
  ): string {
    if (status === 'dry_run') {
      return `Retomada via ${selectedFallback.label} validada em dry-run.`;
    }
    if (status === 'completed') {
      return `Pedido retomado via ${selectedFallback.label}.`;
    }
    if (status === 'blocked') {
      return `ExecutionGateway bloqueou retomada via ${selectedFallback.label}.`;
    }
    return `Retomada via ${selectedFallback.label} falhou.`;
  }

  private buildSummary(
    status: CapabilityFallbackResumeRunStatus,
    selectedFallback: CapabilityFallbackOption,
    gatewayDecision: GatewayDecision,
    executionResult: ExecutionResult | null,
    dryRun: boolean,
  ): string {
    if (status === 'dry_run') {
      return `Retomada via '${selectedFallback.label}' validada em dry-run.`;
    }
    if (status === 'completed') {
      return `Pedido original retomado via '${selectedFallback.label}'.`;
    }
    if (status === 'blocked') {
      return `Retomada via '${selectedFallback.label}' bloqueada: ${gatewayDecision.reason}`;
    }
    return `Retomada via '${selectedFallback.label}' falhou: ${executionResult?.error_message || gatewayDecision.reason}`;
  }

  private blockedResult(input: {
    generatedAt: string;
    dryRun: boolean;
    handoff: CapabilityFallbackHandoffResult;
    receipt: CapabilityReceipt | null;
    resumeIntent: OriginalIntentEnvelope | null;
    selectedFallback: CapabilityFallbackOption | null;
    summary: string;
    technicalSummary: string;
  }): CapabilityFallbackResumeRunResult {
    return {
      generatedAt: input.generatedAt,
      status: 'blocked',
      capabilityId: input.handoff.capabilityId,
      selectedFallback: input.selectedFallback,
      dryRun: input.dryRun,
      task: null,
      plan: null,
      gatewayDecision: null,
      executionResult: null,
      receipt: input.receipt,
      resumeIntent: input.resumeIntent,
      summary: input.summary,
      technicalSummary: input.technicalSummary,
      metadata: {
        phase: 'capability-autopilot-phase-66',
        autoFallbackExecuted: false,
        explicitSelectionRequired: true,
        handoffStatus: input.handoff.status,
      },
    };
  }

  private resolveWorkspace(resumeIntent: OriginalIntentEnvelope): string | null {
    const workspace =
      resumeIntent.workspace ||
      resumeIntent.executionRequest?.workspace ||
      resumeIntent.task?.workspace ||
      resumeIntent.plan?.workspace_recommendation ||
      null;
    const normalized = String(workspace || '').trim();
    return normalized || null;
  }

  private resolveTaskSource(resumeIntent: OriginalIntentEnvelope): TaskSource {
    const surface = resumeIntent.surface;
    if (surface === 'telegram' || surface === 'web' || surface === 'cli' || surface === 'system') {
      return surface;
    }
    return 'bridge';
  }

  private safeId(value: string): string {
    return String(value || 'capability-autopilot')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_.-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'capability-autopilot';
  }
}
