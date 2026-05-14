import type {
  CapabilityPermissionRequirement,
  CapabilityReceipt,
  CapabilityRepairPlan,
  OriginalIntentEnvelope,
} from '../contracts/CapabilityAutopilotContract.js';
import type { PermissionRequest, PermissionScope } from '../contracts/PermissionRequest.js';
import { PermissionService } from './PermissionService.js';

type PermissionServiceLike = Pick<PermissionService, 'createRequest'>;

export type CapabilityAutopilotPermissionRequestInput = {
  repairPlan: CapabilityRepairPlan;
  receipt?: CapabilityReceipt | null;
  resumeIntent?: OriginalIntentEnvelope | null;
  requestedBy?: string | null;
  taskId?: string | null;
  workspace?: string | null;
};

export type CapabilityAutopilotPermissionMapping = {
  requirementId: string;
  capabilityScope: CapabilityPermissionRequirement['scope'];
  legacyScope: PermissionScope;
  workspace: string | null;
  requestedValue: string | null;
  resolvedValue: string | null;
  reason: string;
};

export type CapabilityAutopilotPermissionRequestResult = {
  generatedAt: string;
  repairPlanId: string;
  capabilityId: string;
  requestedBy: string | null;
  skipped: boolean;
  reason: string;
  mappings: CapabilityAutopilotPermissionMapping[];
  permissions: PermissionRequest[];
};

export type CapabilityAutopilotPermissionRuntime = {
  now?: () => Date;
  permissionService?: PermissionServiceLike;
};

export class CapabilityAutopilotPermissionService {
  private readonly now: () => Date;
  private readonly permissionService: PermissionServiceLike;

  constructor(runtime: CapabilityAutopilotPermissionRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.permissionService = runtime.permissionService || new PermissionService();
  }

  public async createPermissionRequests(
    input: CapabilityAutopilotPermissionRequestInput,
  ): Promise<CapabilityAutopilotPermissionRequestResult> {
    const generatedAt = this.now().toISOString();
    const requirements = input.repairPlan.permissionRequirements || [];
    if (requirements.length === 0) {
      return {
        generatedAt,
        repairPlanId: input.repairPlan.repairPlanId,
        capabilityId: input.repairPlan.capabilityId,
        requestedBy: input.requestedBy || null,
        skipped: true,
        reason: 'Repair plan nao possui permission requirements.',
        mappings: [],
        permissions: [],
      };
    }

    const resumeIntent = input.resumeIntent || input.receipt?.resumeIntent || input.repairPlan.resumeIntent || null;
    const taskId = input.taskId || resumeIntent?.taskId || resumeIntent?.task?.task_id || null;
    const workspace = input.workspace || resumeIntent?.workspace || resumeIntent?.task?.workspace || null;
    const mappings = requirements.map((requirement) =>
      this.mapRequirement(requirement, input.repairPlan, workspace),
    );
    const permissions: PermissionRequest[] = [];

    for (const requirement of requirements) {
      const mapping = mappings.find((entry) => entry.requirementId === requirement.id) as CapabilityAutopilotPermissionMapping;
      const permission = await this.permissionService.createRequest({
        task_id: taskId,
        executor: this.resolveExecutorName(requirement, input.repairPlan, input.receipt),
        kind: requirement.kind,
        scope: mapping.legacyScope,
        workspace: mapping.workspace,
        requested_value: mapping.requestedValue,
        resolved_value: mapping.resolvedValue,
        reason: mapping.reason,
        requested_by: input.requestedBy || resumeIntent?.userId || null,
        metadata: this.buildMetadata({
          requirement,
          repairPlan: input.repairPlan,
          receipt: input.receipt || null,
          resumeIntent,
          mapping,
          generatedAt,
        }),
      });
      permissions.push(permission);
    }

    return {
      generatedAt,
      repairPlanId: input.repairPlan.repairPlanId,
      capabilityId: input.repairPlan.capabilityId,
      requestedBy: input.requestedBy || resumeIntent?.userId || null,
      skipped: false,
      reason: `Criados ${permissions.length} pedido(s) de permissao contextual.`,
      mappings,
      permissions,
    };
  }

  public mapRequirement(
    requirement: CapabilityPermissionRequirement,
    repairPlan: Pick<CapabilityRepairPlan, 'capabilityId' | 'repairPlanId'>,
    workspace: string | null = null,
  ): CapabilityAutopilotPermissionMapping {
    const legacyScope = this.mapScope(requirement.scope);
    const requestedValue = requirement.requestedValue || requirement.resolvedValue || repairPlan.capabilityId;
    const resolvedValue = requirement.resolvedValue || requestedValue;

    return {
      requirementId: requirement.id,
      capabilityScope: requirement.scope,
      legacyScope,
      workspace: this.resolveWorkspace(requirement, workspace, resolvedValue),
      requestedValue,
      resolvedValue,
      reason: this.buildReason(requirement, legacyScope),
    };
  }

  private mapScope(scope: CapabilityPermissionRequirement['scope']): PermissionScope {
    switch (scope) {
      case 'once':
        return 'once';
      case 'session':
        return 'session';
      case 'path':
      case 'workspace':
      case 'app':
        return 'workspace';
      case 'host':
      case 'persistent':
        return 'persistent';
      default:
        return 'once';
    }
  }

  private resolveWorkspace(
    requirement: CapabilityPermissionRequirement,
    workspace: string | null,
    resolvedValue: string | null,
  ): string | null {
    switch (requirement.scope) {
      case 'path':
      case 'workspace':
      case 'app':
        return workspace || resolvedValue || null;
      default:
        return workspace || null;
    }
  }

  private resolveExecutorName(
    requirement: CapabilityPermissionRequirement,
    repairPlan: CapabilityRepairPlan,
    receipt?: CapabilityReceipt | null,
  ): string {
    return String(
      receipt?.readiness?.executor?.executorName ||
      receipt?.repairPlan?.resumeIntent?.requestedExecutorName ||
      repairPlan.resumeIntent?.requestedExecutorName ||
      requirement.resolvedValue ||
      requirement.requestedValue ||
      repairPlan.capabilityId,
    ).trim() || repairPlan.capabilityId;
  }

  private buildReason(
    requirement: CapabilityPermissionRequirement,
    legacyScope: PermissionScope,
  ): string {
    const scopeNote = requirement.scope === legacyScope
      ? `Escopo ${requirement.scope}.`
      : `Escopo ${requirement.scope} preservado em metadata e mapeado para ledger ${legacyScope}.`;
    return `${requirement.reason} ${scopeNote}`.trim();
  }

  private buildMetadata(input: {
    requirement: CapabilityPermissionRequirement;
    repairPlan: CapabilityRepairPlan;
    receipt: CapabilityReceipt | null;
    resumeIntent: OriginalIntentEnvelope | null;
    mapping: CapabilityAutopilotPermissionMapping;
    generatedAt: string;
  }): Record<string, unknown> {
    return {
      ...(input.requirement.metadata || {}),
      capability_autopilot: true,
      phase: 'capability-autopilot-phase-6',
      generated_at: input.generatedAt,
      capability_id: input.repairPlan.capabilityId,
      repair_plan_id: input.repairPlan.repairPlanId,
      diagnosis_id: input.repairPlan.diagnosisId || null,
      receipt_id: input.receipt?.receiptId || null,
      requirement_id: input.requirement.id,
      capability_scope: input.requirement.scope,
      legacy_scope: input.mapping.legacyScope,
      scope_mapping_reason: input.requirement.scope === input.mapping.legacyScope
        ? 'native'
        : 'mapped_to_existing_permission_scope',
      risk_level: input.requirement.riskLevel,
      trust_level_required: input.requirement.trustLevelRequired,
      optional: Boolean(input.requirement.optional),
      resume_intent_id: input.resumeIntent?.intentId || null,
      resume_task_id: input.resumeIntent?.taskId || input.resumeIntent?.task?.task_id || null,
      requested_capability_id: input.resumeIntent?.requestedCapabilityId || null,
      requested_executor_name: input.resumeIntent?.requestedExecutorName || null,
      permission_receipt_stage: input.receipt?.stage || null,
      permission_user_summary: input.receipt?.userSummary || null,
    };
  }
}
