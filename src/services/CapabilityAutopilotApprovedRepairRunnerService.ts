import type {
  CapabilityEvidence,
  CapabilityRepairRunResult,
  CapabilityRepairRunStatus,
  CapabilityRepairRunStepResult,
  CapabilityRepairRunStepStatus,
  CapabilityRepairStep,
  CapabilityRepairStepKind,
  CapabilityRepairPlan,
} from '../contracts/CapabilityAutopilotContract.js';
import type { PermissionRequest } from '../contracts/PermissionRequest.js';
import { PermissionService } from './PermissionService.js';
import { logger } from '../logger.js';

type PermissionServiceLike = Pick<PermissionService, 'getRequest'>;

export type CapabilityAutopilotApprovedRepairRunnerInput = {
  repairPlan: CapabilityRepairPlan;
  permissions?: PermissionRequest[] | null;
  permissionIds?: string[] | null;
  dryRun?: boolean;
  requestedBy?: string | null;
  requireApprovedPermissions?: boolean;
};

export type CapabilityAutopilotStepExecutionInput = {
  repairPlan: CapabilityRepairPlan;
  step: CapabilityRepairStep;
  dryRun: boolean;
  approvedPermissions: PermissionRequest[];
  requestedBy: string | null;
};

export type CapabilityAutopilotStepExecutionResult = {
  success: boolean;
  summary: string;
  detail?: string | null;
  evidence?: CapabilityEvidence[];
  metadata?: Record<string, unknown>;
};

export type CapabilityAutopilotRepairStepExecutor = (
  input: CapabilityAutopilotStepExecutionInput,
) => Promise<CapabilityAutopilotStepExecutionResult> | CapabilityAutopilotStepExecutionResult;

export type CapabilityAutopilotApprovedRepairRunnerRuntime = {
  now?: () => Date;
  permissionService?: PermissionServiceLike;
  stepExecutor?: CapabilityAutopilotRepairStepExecutor | null;
};

export class CapabilityAutopilotApprovedRepairRunnerService {
  private readonly now: () => Date;
  private readonly permissionService: PermissionServiceLike;
  private readonly stepExecutor: CapabilityAutopilotRepairStepExecutor | null;

  constructor(runtime: CapabilityAutopilotApprovedRepairRunnerRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.permissionService = runtime.permissionService || new PermissionService();
    this.stepExecutor = runtime.stepExecutor || null;
  }

  public async runApprovedRepair(
    input: CapabilityAutopilotApprovedRepairRunnerInput,
  ): Promise<CapabilityRepairRunResult> {
    const startedAt = this.now().toISOString();
    const dryRun = input.dryRun !== false;
    const requireApprovedPermissions = input.requireApprovedPermissions !== false;
    const permissions = await this.resolvePermissions(input);
    const permissionStatus = this.resolvePermissionStatus(input.repairPlan, permissions);
    const approved = permissionStatus === 'approved' || permissionStatus === 'not_required';

    if (requireApprovedPermissions && !approved) {
      return this.buildBlockedRun({
        repairPlan: input.repairPlan,
        startedAt,
        permissionStatus,
        permissions,
        dryRun,
      });
    }

    const steps: CapabilityRepairRunStepResult[] = [];
    for (const step of input.repairPlan.steps) {
      steps.push(await this.runStep({
        repairPlan: input.repairPlan,
        step,
        dryRun,
        permissions,
        requestedBy: input.requestedBy || null,
      }));
    }

    const finishedAt = this.now().toISOString();
    const status = this.resolveRunStatus(steps, dryRun);

    return {
      repairRunId: this.buildRunId(input.repairPlan, startedAt),
      repairPlanId: input.repairPlan.repairPlanId,
      capabilityId: input.repairPlan.capabilityId,
      startedAt,
      finishedAt,
      status,
      dryRun,
      approved,
      permissionStatus,
      steps,
      validationRequired: status === 'completed',
      resumeIntent: input.repairPlan.resumeIntent || null,
      metadata: {
        phase: 'capability-autopilot-checkpoint-61',
        requestedBy: input.requestedBy || null,
        permissionCount: permissions.length,
        stepCount: steps.length,
      },
    };
  }

  private async resolvePermissions(
    input: CapabilityAutopilotApprovedRepairRunnerInput,
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
  ): CapabilityRepairRunResult['permissionStatus'] {
    const requirements = repairPlan.permissionRequirements.filter((entry) => !entry.optional);
    if (requirements.length === 0) {
      return 'not_required';
    }

    const matches = requirements.map((requirement) =>
      this.findPermissionForRequirement(requirement.id, requirement.kind, permissions),
    );
    if (matches.some((permission) => !permission)) {
      return 'missing';
    }
    if (matches.some((permission) => permission?.status === 'rejected')) {
      return 'rejected';
    }
    if (matches.every((permission) => permission?.status === 'approved')) {
      return 'approved';
    }
    return 'pending';
  }

  private async runStep(input: {
    repairPlan: CapabilityRepairPlan;
    step: CapabilityRepairStep;
    dryRun: boolean;
    permissions: PermissionRequest[];
    requestedBy: string | null;
  }): Promise<CapabilityRepairRunStepResult> {
    const startedAt = this.now().toISOString();
    const permissionStatus = this.resolveStepPermissionStatus(input.step, input.permissions);
    if (!['approved', 'not_required'].includes(permissionStatus)) {
      return this.stepResult({
        step: input.step,
        startedAt,
        status: 'blocked',
        summary: `${input.step.title} bloqueado por permissao.`,
        detail: `permissionStatus=${permissionStatus}`,
      });
    }

    if (!input.step.command) {
      return this.runDeclarativeStep(input.step, startedAt);
    }

    if (input.dryRun || input.step.command.dryRun) {
      return this.stepResult({
        step: input.step,
        startedAt,
        status: 'dry_run',
        summary: `${input.step.title} pronto para execucao aprovada.`,
        detail: 'Dry-run: comando nao executado.',
      });
    }

    if (!this.stepExecutor) {
      return this.stepResult({
        step: input.step,
        startedAt,
        status: 'blocked',
        summary: `${input.step.title} sem executor configurado.`,
        detail: 'A Etapa 61 exige stepExecutor injetado para executar comandos reais.',
      });
    }

    try {
      const execution = await this.stepExecutor({
        repairPlan: input.repairPlan,
        step: input.step,
        dryRun: input.dryRun,
        approvedPermissions: input.permissions.filter((permission) => permission.status === 'approved'),
        requestedBy: input.requestedBy,
      });
      return this.stepResult({
        step: input.step,
        startedAt,
        status: execution.success ? 'succeeded' : 'failed',
        summary: execution.summary,
        detail: execution.detail || null,
        evidence: execution.evidence,
        metadata: execution.metadata,
      });
    } catch (error: any) {
    logger.warn('[Capability Autopilot Approved Repair Runner] process execution failed', error);
    return this.stepResult({
        step: input.step,
        startedAt,
        status: 'failed',
        summary: `${input.step.title} falhou durante execucao aprovada.`,
        detail: error instanceof Error ? error.message : String(error),
      });
  }
  }

  private resolveStepPermissionStatus(
    step: CapabilityRepairStep,
    permissions: PermissionRequest[],
  ): CapabilityRepairRunResult['permissionStatus'] {
    if (step.permissionIds.length === 0) {
      return 'not_required';
    }

    const matches = step.permissionIds.map((permissionId) =>
      permissions.find((permission) =>
        permission.permission_id === permissionId ||
        permission.metadata?.requirement_id === permissionId,
      ),
    );
    if (matches.some((permission) => !permission)) {
      return 'missing';
    }
    if (matches.some((permission) => permission?.status === 'rejected')) {
      return 'rejected';
    }
    if (matches.every((permission) => permission?.status === 'approved')) {
      return 'approved';
    }
    return 'pending';
  }

  private runDeclarativeStep(
    step: CapabilityRepairStep,
    startedAt: string,
  ): CapabilityRepairRunStepResult {
    if (this.isNarrativeStep(step.kind)) {
      return this.stepResult({
        step,
        startedAt,
        status: 'succeeded',
        summary: `${step.title} registrado.`,
        detail: step.summary,
      });
    }

    return this.stepResult({
      step,
      startedAt,
      status: 'skipped',
      summary: `${step.title} exige execucao externa ou validacao posterior.`,
      detail: 'Sem comando anexado ao step; nada foi executado.',
    });
  }

  private isNarrativeStep(kind: CapabilityRepairStepKind): boolean {
    return kind === 'explain' || kind === 'ask_user' || kind === 'noop';
  }

  private buildBlockedRun(input: {
    repairPlan: CapabilityRepairPlan;
    startedAt: string;
    permissionStatus: CapabilityRepairRunResult['permissionStatus'];
    permissions: PermissionRequest[];
    dryRun: boolean;
  }): CapabilityRepairRunResult {
    const finishedAt = this.now().toISOString();
    return {
      repairRunId: this.buildRunId(input.repairPlan, input.startedAt),
      repairPlanId: input.repairPlan.repairPlanId,
      capabilityId: input.repairPlan.capabilityId,
      startedAt: input.startedAt,
      finishedAt,
      status: 'blocked',
      dryRun: input.dryRun,
      approved: false,
      permissionStatus: input.permissionStatus,
      steps: [],
      validationRequired: false,
      resumeIntent: input.repairPlan.resumeIntent || null,
      metadata: {
        phase: 'capability-autopilot-checkpoint-61',
        blockedReason: `permissionStatus=${input.permissionStatus}`,
        permissionCount: input.permissions.length,
      },
    };
  }

  private resolveRunStatus(
    steps: CapabilityRepairRunStepResult[],
    dryRun: boolean,
  ): CapabilityRepairRunStatus {
    if (steps.some((step) => step.status === 'failed')) {
      return 'failed';
    }
    if (steps.some((step) => step.status === 'blocked')) {
      return 'blocked';
    }
    if (dryRun || steps.some((step) => step.status === 'dry_run')) {
      return 'dry_run';
    }
    if (steps.some((step) => step.status === 'skipped')) {
      return 'partial';
    }
    return 'completed';
  }

  private stepResult(input: {
    step: CapabilityRepairStep;
    startedAt: string;
    status: CapabilityRepairRunStepStatus;
    summary: string;
    detail?: string | null;
    evidence?: CapabilityEvidence[];
    metadata?: Record<string, unknown>;
  }): CapabilityRepairRunStepResult {
    return {
      stepId: input.step.id,
      kind: input.step.kind,
      title: input.step.title,
      status: input.status,
      startedAt: input.startedAt,
      finishedAt: this.now().toISOString(),
      summary: input.summary,
      detail: input.detail || null,
      permissionIds: [...input.step.permissionIds],
      command: input.step.command || null,
      evidence: input.evidence || [],
      metadata: input.metadata || {},
    };
  }

  private findPermissionForRequirement(
    requirementId: string,
    kind: string,
    permissions: PermissionRequest[],
  ): PermissionRequest | undefined {
    return permissions.find((permission) =>
      permission.metadata?.requirement_id === requirementId ||
      permission.permission_id === requirementId ||
      permission.kind === kind,
    );
  }

  private buildRunId(repairPlan: CapabilityRepairPlan, startedAt: string): string {
    return `${repairPlan.capabilityId}-repair-run-${startedAt.replace(/[-:.]/g, '').replace('T', 'T').replace('Z', 'Z')}`;
  }
}
