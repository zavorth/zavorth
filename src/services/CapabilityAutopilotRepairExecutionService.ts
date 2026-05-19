import type {
  CapabilityEvidence,
  CapabilityReceipt,
  CapabilityRepairRunResult,
  CapabilityRepairRunStepResult,
  CapabilityRepairStep,
  CapabilityRepairRunStatus,
  CapabilityRepairRunStepStatus,
  CapabilityRepairPlan,
} from '../contracts/CapabilityAutopilotContract.js';
import type { PermissionRequest } from '../contracts/PermissionRequest.js';
import { PermissionService } from './PermissionService.js';
import {
  CapabilityAutopilotValidationResumeService,
  type CapabilityAutopilotPermissionGateStatus,
  type CapabilityAutopilotValidationResumeResult,
} from './CapabilityAutopilotValidationResumeService.js';

type PermissionServiceLike = Pick<PermissionService, 'getRequest'>;
type ValidationResumeLike = Pick<CapabilityAutopilotValidationResumeService, 'validateForResume'>;

export type CapabilityRepairStepRunnerInput = {
  repairPlan: CapabilityRepairPlan;
  step: CapabilityRepairStep;
  permissions: PermissionRequest[];
  dryRun: boolean;
};

export type CapabilityRepairStepRunnerResult = {
  success: boolean;
  summary: string;
  detail?: string | null;
  evidence?: CapabilityEvidence[];
  metadata?: Record<string, unknown>;
};

export type CapabilityRepairStepRunner = {
  run: (input: CapabilityRepairStepRunnerInput) => Promise<CapabilityRepairStepRunnerResult>;
};

export type CapabilityAutopilotRepairExecutionInput = {
  repairPlan: CapabilityRepairPlan;
  permissions?: PermissionRequest[] | null;
  permissionIds?: string[] | null;
  dryRun?: boolean;
  validateAfterEachStep?: boolean;
  previousReceipt?: CapabilityReceipt | null;
};

export type CapabilityAutopilotRepairExecutionResult = CapabilityRepairRunResult & {
  validationRuns: CapabilityAutopilotValidationResumeResult[];
  receipt: CapabilityReceipt | null;
};

export type CapabilityAutopilotRepairExecutionRuntime = {
  now?: () => Date;
  permissionService?: PermissionServiceLike;
  validationResumeService?: ValidationResumeLike;
  runner?: CapabilityRepairStepRunner | null;
};

export class CapabilityAutopilotRepairExecutionService {
  private readonly now: () => Date;
  private readonly permissionService: PermissionServiceLike;
  private readonly validationResumeService: ValidationResumeLike;
  private readonly runner: CapabilityRepairStepRunner | null;

  constructor(runtime: CapabilityAutopilotRepairExecutionRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.permissionService = runtime.permissionService || new PermissionService();
    this.validationResumeService = runtime.validationResumeService || new CapabilityAutopilotValidationResumeService();
    this.runner = runtime.runner || null;
  }

  public async executeApprovedRepair(
    input: CapabilityAutopilotRepairExecutionInput,
  ): Promise<CapabilityAutopilotRepairExecutionResult> {
    const startedAt = this.now().toISOString();
    const dryRun = input.dryRun !== false;
    const validateAfterEachStep = input.validateAfterEachStep !== false;
    const permissions = await this.resolvePermissions(input);
    const permissionStatus = this.resolvePermissionStatus(input.repairPlan, permissions);
    const approved = ['approved', 'not_required'].includes(permissionStatus);

    if (!approved) {
      const finishedAt = this.now().toISOString();
      return {
        repairRunId: this.buildRunId(input.repairPlan.repairPlanId, startedAt),
        repairPlanId: input.repairPlan.repairPlanId,
        capabilityId: input.repairPlan.capabilityId,
        startedAt,
        finishedAt,
        status: 'blocked',
        dryRun,
        approved: false,
        permissionStatus,
        steps: this.buildBlockedStepResults(input.repairPlan, startedAt, finishedAt, permissionStatus),
        validationRequired: false,
        resumeIntent: input.repairPlan.resumeIntent || null,
        metadata: {
          phase: 'capability-autopilot-checkpoint-62',
          blockedReason: `permission_${permissionStatus}`,
        },
        validationRuns: [],
        receipt: input.previousReceipt || null,
      };
    }

    const steps: CapabilityRepairRunStepResult[] = [];
    const validationRuns: CapabilityAutopilotValidationResumeResult[] = [];
    let stoppedAfterResume = false;
    let hasExecutableStep = false;
    let hasFailedStep = false;

    for (const step of input.repairPlan.steps) {
      const stepResult = await this.runStep({
        repairPlan: input.repairPlan,
        step,
        permissions,
        dryRun,
        startedAt: this.now().toISOString(),
      });
      steps.push(stepResult);

      if (stepResult.command) {
        hasExecutableStep = true;
      }
      if (stepResult.status === 'failed' || stepResult.status === 'blocked') {
        hasFailedStep = true;
      }

      if (
        validateAfterEachStep &&
        !dryRun &&
        stepResult.status === 'succeeded'
      ) {
        const validation = await this.validationResumeService.validateForResume({
          capabilityId: input.repairPlan.capabilityId,
          previousReceipt: input.previousReceipt || null,
          repairPlan: input.repairPlan,
          permissions,
        });
        validationRuns.push(validation);
        if (validation.status === 'ready_to_resume') {
          stoppedAfterResume = true;
          break;
        }
      }
    }

    const finishedAt = this.now().toISOString();
    const status = this.resolveRunStatus({
      dryRun,
      hasExecutableStep,
      hasFailedStep,
      stoppedAfterResume,
      validationRuns,
      steps,
    });
    const latestValidation = validationRuns[validationRuns.length - 1] || null;

    return {
      repairRunId: this.buildRunId(input.repairPlan.repairPlanId, startedAt),
      repairPlanId: input.repairPlan.repairPlanId,
      capabilityId: input.repairPlan.capabilityId,
      startedAt,
      finishedAt,
      status,
      dryRun,
      approved: true,
      permissionStatus,
      steps,
      validationRequired: hasExecutableStep && !dryRun,
      resumeIntent: input.repairPlan.resumeIntent || null,
      metadata: {
        phase: 'capability-autopilot-checkpoint-62',
        validateAfterEachStep,
        stoppedAfterResume,
        executableSteps: steps.filter((step) => step.command).length,
      },
      validationRuns,
      receipt: latestValidation?.receipt || input.previousReceipt || null,
    };
  }

  private async runStep(input: {
    repairPlan: CapabilityRepairPlan;
    step: CapabilityRepairStep;
    permissions: PermissionRequest[];
    dryRun: boolean;
    startedAt: string;
  }): Promise<CapabilityRepairRunStepResult> {
    const finishedAt = this.now().toISOString();
    if (!input.step.command) {
      return this.stepResult(input.step, 'skipped', input.startedAt, finishedAt, {
        summary: 'Step nao possui comando executavel nesta etapa.',
        detail: 'Apenas steps com CapabilityRepairCommand sao elegiveis para execucao controlada.',
      });
    }

    const missingPermissions = input.step.permissionIds.filter((permissionId) =>
      !input.permissions.some((permission) => permission.permission_id === permissionId && permission.status === 'approved'),
    );
    if (missingPermissions.length > 0) {
      return this.stepResult(input.step, 'blocked', input.startedAt, finishedAt, {
        summary: 'Step bloqueado por permissao ausente.',
        detail: `Permissoes nao aprovadas: ${missingPermissions.join(', ')}`,
      });
    }

    if (input.step.kind === 'switch_executor') {
      return this.stepResult(input.step, 'blocked', input.startedAt, finishedAt, {
        summary: 'Fallback automatico bloqueado.',
        detail: 'Troca de executor deve ser escolhida de forma visivel pelo usuario, nao executada como repair invisivel.',
      });
    }

    if (input.dryRun) {
      return this.stepResult(input.step, 'dry_run', input.startedAt, finishedAt, {
        summary: `Dry run: ${input.step.command.command}`,
        detail: 'Nenhum comando foi executado.',
      });
    }

    if (!this.runner) {
      return this.stepResult(input.step, 'failed', input.startedAt, finishedAt, {
        summary: 'Runner de repair nao configurado.',
        detail: 'A Etapa 62 exige runner injetado para executar comandos reais com seguranca.',
      });
    }

    try {
      const output = await this.runner.run({
        repairPlan: input.repairPlan,
        step: input.step,
        permissions: input.permissions,
        dryRun: false,
      });
      return this.stepResult(input.step, output.success ? 'succeeded' : 'failed', input.startedAt, this.now().toISOString(), {
        summary: output.summary,
        detail: output.detail || null,
        evidence: output.evidence || [],
        metadata: output.metadata || {},
      });
    } catch (error: any) {
      return this.stepResult(input.step, 'failed', input.startedAt, this.now().toISOString(), {
        summary: 'Runner de repair falhou.',
        detail: error?.message || String(error),
      });
    }
  }

  private stepResult(
    step: CapabilityRepairStep,
    status: CapabilityRepairRunStepStatus,
    startedAt: string,
    finishedAt: string,
    result: {
      summary: string;
      detail?: string | null;
      evidence?: CapabilityEvidence[];
      metadata?: Record<string, unknown>;
    },
  ): CapabilityRepairRunStepResult {
    return {
      stepId: step.id,
      kind: step.kind,
      title: step.title,
      status,
      startedAt,
      finishedAt,
      summary: result.summary,
      detail: result.detail || null,
      permissionIds: [...step.permissionIds],
      command: step.command || null,
      evidence: result.evidence || [],
      metadata: {
        ...(step.metadata || {}),
        ...(result.metadata || {}),
      },
    };
  }

  private buildBlockedStepResults(
    repairPlan: CapabilityRepairPlan,
    startedAt: string,
    finishedAt: string,
    permissionStatus: CapabilityAutopilotPermissionGateStatus,
  ): CapabilityRepairRunStepResult[] {
    return repairPlan.steps.map((step) =>
      this.stepResult(step, step.command ? 'blocked' : 'skipped', startedAt, finishedAt, {
        summary: step.command
          ? 'Step bloqueado antes da execucao.'
          : 'Step sem comando executavel.',
        detail: `permissionStatus=${permissionStatus}`,
      }),
    );
  }

  private resolveRunStatus(input: {
    dryRun: boolean;
    hasExecutableStep: boolean;
    hasFailedStep: boolean;
    stoppedAfterResume: boolean;
    validationRuns: CapabilityAutopilotValidationResumeResult[];
    steps: CapabilityRepairRunStepResult[];
  }): CapabilityRepairRunStatus {
    if (input.dryRun) {
      return 'dry_run';
    }
    if (input.hasFailedStep) {
      return 'failed';
    }
    if (input.stoppedAfterResume) {
      return 'completed';
    }
    const latestValidation = input.validationRuns[input.validationRuns.length - 1] || null;
    if (latestValidation?.status === 'needs_repair') {
      return 'partial';
    }
    if (!input.hasExecutableStep) {
      return input.steps.some((step) => step.status === 'blocked') ? 'blocked' : 'completed';
    }
    return 'completed';
  }

  private async resolvePermissions(
    input: CapabilityAutopilotRepairExecutionInput,
  ): Promise<PermissionRequest[]> {
    if (Array.isArray(input.permissions)) {
      return input.permissions;
    }

    const ids = input.permissionIds || [];
    const permissions: PermissionRequest[] = [];
    for (const permissionId of ids) {
      const permission = await this.permissionService.getRequest(permissionId);
      if (permission) {
        permissions.push(permission);
      }
    }
    return permissions;
  }

  private resolvePermissionStatus(
    repairPlan: CapabilityRepairPlan,
    permissions: PermissionRequest[],
  ): CapabilityAutopilotPermissionGateStatus {
    const requiredCount = repairPlan.permissionRequirements.length;
    if (requiredCount === 0) {
      return 'not_required';
    }
    if (permissions.length < requiredCount) {
      return 'missing';
    }
    if (permissions.some((permission) => permission.status === 'rejected')) {
      return 'rejected';
    }
    if (permissions.every((permission) => permission.status === 'approved')) {
      return 'approved';
    }
    return 'pending';
  }

  private buildRunId(repairPlanId: string, startedAt: string): string {
    const safePlanId = String(repairPlanId || 'repair-plan')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_.-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'repair-plan';
    return `${safePlanId}-run-${startedAt.replace(/[^0-9a-z]+/gi, '')}`;
  }
}
