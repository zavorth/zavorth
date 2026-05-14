import type {
  CapabilityEvidence,
  CapabilityRepairCommand,
  CapabilityRepairStep,
  OriginalIntentEnvelope,
} from '../contracts/CapabilityAutopilotContract.js';
import type { ExecutionResult } from '../contracts/ExecutionContract.js';
import type { Plan, PlanStep } from '../contracts/PlanContract.js';
import type { Task } from '../contracts/TaskContract.js';
import type { TaskSource } from '../contracts/PlatformContract.js';
import type { GatewayDecision } from '../execution/ExecutionGateway.js';
import type {
  CapabilityRepairStepRunner,
  CapabilityRepairStepRunnerInput,
  CapabilityRepairStepRunnerResult,
} from './CapabilityAutopilotRepairExecutionService.js';

export type CapabilityAutopilotExecutionGatewayLike = {
  submit: (task: Task, plan: Plan, dryRun?: boolean) => Promise<GatewayDecision>;
};

export type CapabilityAutopilotExecutionGatewayRunnerRuntime = {
  now?: () => Date;
  gateway: CapabilityAutopilotExecutionGatewayLike;
};

export class CapabilityAutopilotExecutionGatewayRunnerService implements CapabilityRepairStepRunner {
  private readonly now: () => Date;
  private readonly gateway: CapabilityAutopilotExecutionGatewayLike;

  constructor(runtime: CapabilityAutopilotExecutionGatewayRunnerRuntime) {
    if (!runtime.gateway) {
      throw new Error('CapabilityAutopilotExecutionGatewayRunnerService exige gateway.');
    }
    this.now = runtime.now || (() => new Date());
    this.gateway = runtime.gateway;
  }

  public async run(input: CapabilityRepairStepRunnerInput): Promise<CapabilityRepairStepRunnerResult> {
    if (!input.step.command) {
      return {
        success: false,
        summary: 'Step sem comando para o ExecutionGateway.',
        detail: 'Apenas CapabilityRepairStep com CapabilityRepairCommand pode ser enviado ao gateway.',
        evidence: [this.manualEvidence('missing_command', 'Step sem CapabilityRepairCommand.')],
        metadata: this.baseMetadata(input, null, null),
      };
    }

    if (input.step.kind === 'switch_executor') {
      return {
        success: false,
        summary: 'Fallback automatico bloqueado antes do gateway.',
        detail: 'Troca de executor precisa continuar visivel para o usuario.',
        evidence: [this.policyEvidence('fallback_blocked', 'switch_executor nao e executado como repair.')],
        metadata: this.baseMetadata(input, null, null),
      };
    }

    const dryRun = input.dryRun || input.step.command.dryRun === true;
    const task = this.buildSyntheticTask(input);
    const plan = this.buildSyntheticPlan(input);
    const decision = await this.gateway.submit(task, plan, dryRun);
    const result = decision.execution_result;
    const success = Boolean(decision.allowed && result?.success);

    return {
      success,
      summary: this.buildSummary(decision, result, dryRun),
      detail: this.buildDetail(decision, result),
      evidence: this.buildEvidence(input.step, decision, result),
      metadata: this.baseMetadata(input, decision, result),
    };
  }

  private buildSyntheticTask(input: CapabilityRepairStepRunnerInput): Task {
    const now = this.now().toISOString();
    const resumeIntent = input.repairPlan.resumeIntent || null;
    const command = input.step.command as CapabilityRepairCommand;
    const workspace = this.resolveWorkspace(command, resumeIntent, input.repairPlan.metadata);
    const source = this.resolveTaskSource(resumeIntent);
    const taskId = this.safeId(
      resumeIntent?.taskId ||
      resumeIntent?.task?.task_id ||
      `${input.repairPlan.repairPlanId}-${input.step.id}`,
    );

    return {
      task_id: taskId,
      created_at: now,
      updated_at: now,
      source,
      chat_id: resumeIntent?.sessionId || resumeIntent?.task?.task_id || 'capability-autopilot',
      user_id: resumeIntent?.userId || 'capability-autopilot',
      raw_message: resumeIntent?.rawText || input.step.summary || command.command,
      normalized_message: resumeIntent?.normalizedText || input.step.summary || command.command,
      command_type: resumeIntent?.commandType || 'capability_autopilot_repair',
      intent: resumeIntent?.task?.intent || 'capability_repair',
      target: input.repairPlan.capabilityId,
      workspace,
      risk_level: input.repairPlan.riskLevel,
      status: 'approved',
      requires_planning: false,
      requires_approval: false,
      approval_status: 'approved',
      planner_used: 'capability-autopilot-repair-planner',
      executor_used: command.executor,
      fallback_used: false,
      parent_task_id: resumeIntent?.taskId || resumeIntent?.task?.task_id || null,
      actions_planned: [input.step],
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
        phase: 'capability-autopilot-phase-65',
        capability_autopilot: true,
        capability_id: input.repairPlan.capabilityId,
        repair_plan_id: input.repairPlan.repairPlanId,
        repair_step_id: input.step.id,
        approved_permission_ids: input.permissions
          .filter((permission) => permission.status === 'approved')
          .map((permission) => permission.permission_id),
        permission_count: input.permissions.length,
        extra_allowed_paths: workspace ? [workspace] : [],
        extra_allowed_path_policies: workspace ? [{
          path: workspace,
          access_level: this.resolvePathAccessLevel(input.step),
          scope: 'once',
          reason: input.step.title,
        }] : [],
        extra_allowed_commands: [command.command],
        extra_allowed_command_policies: [{
          command: command.command,
          match_type: 'exact',
          scope: 'once',
          reason: input.step.title,
        }],
        resume_intent_id: resumeIntent?.intentId || null,
      },
    };
  }

  private buildSyntheticPlan(input: CapabilityRepairStepRunnerInput): Plan {
    const command = input.step.command as CapabilityRepairCommand;
    const workspace = this.resolveWorkspace(command, input.repairPlan.resumeIntent || null, input.repairPlan.metadata);
    const planStep = this.buildSyntheticPlanStep(input.step, command, workspace);

    return {
      plan_id: this.safeId(`${input.repairPlan.repairPlanId}-${input.step.id}-gateway-plan`),
      task_id: this.safeId(
        input.repairPlan.resumeIntent?.taskId ||
        input.repairPlan.resumeIntent?.task?.task_id ||
        `${input.repairPlan.repairPlanId}-${input.step.id}`,
      ),
      objective: `Capability repair: ${input.step.title}`,
      context: input.repairPlan.summary,
      assumptions: [
        'Permissoes contextuais do Capability Autopilot ja foram aprovadas antes deste runner.',
        'Fallback entre executores permanece bloqueado ate escolha explicita do usuario.',
      ],
      executor_recommendation: command.executor,
      workspace_recommendation: workspace,
      risk_level: input.repairPlan.riskLevel,
      requires_approval: false,
      steps: [planStep],
      validation_steps: input.repairPlan.validators.map((validator) => validator.successCondition),
      success_condition: input.step.expectedOutcome || 'Repair step concluido com sucesso.',
      rollback_condition: input.step.rollbackHint || null,
      notes: [
        `capabilityId=${input.repairPlan.capabilityId}`,
        `repairPlanId=${input.repairPlan.repairPlanId}`,
        `repairStepId=${input.step.id}`,
      ],
    };
  }

  private buildSyntheticPlanStep(
    step: CapabilityRepairStep,
    command: CapabilityRepairCommand,
    workspace: string | null,
  ): PlanStep {
    return {
      step_id: this.safeId(step.id),
      type: this.resolvePlanStepType(step),
      description: step.summary || step.title,
      tool: command.executor,
      args: {
        cwd: command.cwd || workspace,
        envKeys: command.envKeys || [],
        timeoutSeconds: command.timeoutSeconds || null,
        capabilityRepairStepKind: step.kind,
      },
      command: command.command,
      file_targets: workspace ? [workspace] : [],
      expected_output: step.expectedOutcome || null,
      sensitive: this.isSensitiveStep(step),
    };
  }

  private resolveWorkspace(
    command: CapabilityRepairCommand,
    resumeIntent: OriginalIntentEnvelope | null,
    metadata?: Record<string, unknown>,
  ): string | null {
    const metadataWorkspace = typeof metadata?.workspace === 'string' ? metadata.workspace : null;
    const workspace =
      command.cwd ||
      resumeIntent?.workspace ||
      resumeIntent?.executionRequest?.workspace ||
      resumeIntent?.task?.workspace ||
      resumeIntent?.plan?.workspace_recommendation ||
      metadataWorkspace ||
      null;
    const normalized = String(workspace || '').trim();
    return normalized || null;
  }

  private resolveTaskSource(resumeIntent: OriginalIntentEnvelope | null): TaskSource {
    const surface = resumeIntent?.surface;
    if (surface === 'telegram' || surface === 'web' || surface === 'cli' || surface === 'system') {
      return surface;
    }
    return 'bridge';
  }

  private resolvePlanStepType(step: CapabilityRepairStep): string {
    switch (step.kind) {
      case 'install_package':
      case 'install_binary':
        return 'install';
      case 'set_env':
      case 'change_path':
      case 'authenticate':
      case 'start_service':
      case 'restart_service':
        return 'script';
      case 'open_url':
        return 'network';
      case 'run_command':
      case 'validate':
      case 'resume_original_intent':
        return 'exec';
      default:
        return step.command ? 'exec' : 'analyze';
    }
  }

  private resolvePathAccessLevel(step: CapabilityRepairStep): string {
    if (step.kind === 'validate') {
      return 'read_only';
    }
    return 'read_write';
  }

  private isSensitiveStep(step: CapabilityRepairStep): boolean {
    return step.kind === 'install_package' ||
      step.kind === 'install_binary' ||
      step.kind === 'set_env' ||
      step.kind === 'change_path' ||
      step.kind === 'authenticate' ||
      step.kind === 'start_service' ||
      step.kind === 'restart_service';
  }

  private buildSummary(
    decision: GatewayDecision,
    result: ExecutionResult | null,
    dryRun: boolean,
  ): string {
    if (!decision.allowed) {
      return `ExecutionGateway bloqueou o repair: ${decision.reason}`;
    }
    if (dryRun) {
      return 'ExecutionGateway validou o repair em dry-run.';
    }
    if (result?.success) {
      return 'ExecutionGateway executou o repair com sucesso.';
    }
    return `ExecutionGateway executou o repair, mas ele falhou: ${result?.error_message || decision.reason}`;
  }

  private buildDetail(decision: GatewayDecision, result: ExecutionResult | null): string | null {
    const chunks = [
      decision.reason,
      result?.stdout ? `stdout=${this.truncate(result.stdout, 500)}` : null,
      result?.stderr ? `stderr=${this.truncate(result.stderr, 500)}` : null,
      result?.error_code ? `error_code=${result.error_code}` : null,
    ].filter((value): value is string => Boolean(value));
    return chunks.length ? chunks.join('\n') : null;
  }

  private buildEvidence(
    step: CapabilityRepairStep,
    decision: GatewayDecision,
    result: ExecutionResult | null,
  ): CapabilityEvidence[] {
    const evidence: CapabilityEvidence[] = [
      {
        kind: decision.allowed ? 'executor' : 'policy',
        source: 'ExecutionGateway',
        summary: decision.allowed ? 'Gateway permitiu o repair.' : 'Gateway bloqueou o repair.',
        detail: decision.reason,
        checkedTarget: step.command?.executor || null,
        status: decision.allowed ? 'allowed' : 'blocked',
        timestamp: this.now().toISOString(),
        metadata: {
          requiresConfirmation: decision.requires_confirmation,
          modeSufficient: decision.mode_sufficient,
          traceId: decision.correlation.traceId,
          policyAllowed: decision.policy_evaluation?.allowed ?? null,
          policyViolations: decision.policy_evaluation?.violations || [],
        },
      },
    ];

    if (result) {
      evidence.push({
        kind: 'command',
        source: result.executor || step.command?.executor || 'unknown',
        summary: result.success ? 'Comando executado com sucesso.' : 'Comando executado com falha.',
        detail: result.error_message || result.stderr || result.stdout || null,
        checkedTarget: step.command?.command || null,
        status: result.success ? 'success' : 'failed',
        timestamp: result.finished_at || this.now().toISOString(),
        metadata: {
          executionId: result.execution_id,
          commandsExecuted: result.commands_executed || [],
          actionsExecuted: result.actions_executed || [],
          stdout: result.stdout,
          stderr: result.stderr,
          errorCode: result.error_code,
          rollbackAvailable: result.rollback_available,
        },
      });
    }

    return evidence;
  }

  private baseMetadata(
    input: CapabilityRepairStepRunnerInput,
    decision: GatewayDecision | null,
    result: ExecutionResult | null,
  ): Record<string, unknown> {
    return {
      phase: 'capability-autopilot-phase-65',
      gatewayRunner: true,
      capabilityId: input.repairPlan.capabilityId,
      repairPlanId: input.repairPlan.repairPlanId,
      repairStepId: input.step.id,
      executor: input.step.command?.executor || null,
      command: input.step.command?.command || null,
      dryRun: input.dryRun || input.step.command?.dryRun === true,
      gatewayAllowed: decision?.allowed ?? null,
      gatewayRequiresConfirmation: decision?.requires_confirmation ?? null,
      traceId: decision?.correlation.traceId || null,
      executionId: result?.execution_id || null,
      executionSuccess: result?.success ?? null,
      errorCode: result?.error_code || null,
    };
  }

  private manualEvidence(status: string, summary: string): CapabilityEvidence {
    return {
      kind: 'manual',
      source: 'CapabilityAutopilotExecutionGatewayRunnerService',
      summary,
      status,
      timestamp: this.now().toISOString(),
    };
  }

  private policyEvidence(status: string, summary: string): CapabilityEvidence {
    return {
      kind: 'policy',
      source: 'CapabilityAutopilotExecutionGatewayRunnerService',
      summary,
      status,
      timestamp: this.now().toISOString(),
    };
  }

  private safeId(value: string): string {
    return String(value || 'capability-autopilot')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_.-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'capability-autopilot';
  }

  private truncate(value: string, maxLength: number): string {
    return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
  }
}
