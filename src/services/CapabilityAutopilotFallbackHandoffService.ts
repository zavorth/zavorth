import type {
  CapabilityFallbackOption,
  CapabilityPermissionRequirement,
  CapabilityReceipt,
  CapabilityRepairPlan,
  CapabilityRepairStep,
  CapabilityTrustLevel,
  OriginalIntentEnvelope,
} from '../contracts/CapabilityAutopilotContract.js';
import type { PermissionRequest } from '../contracts/PermissionRequest.js';
import {
  CapabilityAutopilotFallbackSelectionService,
  type CapabilityFallbackSelectionResult,
} from './CapabilityAutopilotFallbackSelectionService.js';
import {
  CapabilityAutopilotPermissionService,
  type CapabilityAutopilotPermissionRequestResult,
} from './CapabilityAutopilotPermissionService.js';
import {
  CapabilityAutopilotValidationResumeService,
  type CapabilityAutopilotValidationResumeResult,
} from './CapabilityAutopilotValidationResumeService.js';


type ValidationResumeLike = Pick<CapabilityAutopilotValidationResumeService, 'validateForResume'>;
type PermissionRequestLike = Pick<CapabilityAutopilotPermissionService, 'createPermissionRequests'>;

export type CapabilityFallbackHandoffStatus =
  | 'blocked'
  | 'not_selected'
  | 'permission_requested'
  | 'waiting_permission'
  | 'permission_rejected'
  | 'ready_to_resume'
  | 'needs_repair';

export type CapabilityFallbackHandoffInput = {
  selection: CapabilityFallbackSelectionResult;
  receipt?: CapabilityReceipt | null;
  permissions?: PermissionRequest[] | null;
  permissionIds?: string[] | null;
  requestedBy?: string | null;
  createPermissionRequests?: boolean;
};

export type CapabilityFallbackHandoffResult = {
  generatedAt: string;
  status: CapabilityFallbackHandoffStatus;
  capabilityId: string;
  selectedFallback: CapabilityFallbackOption | null;
  selection: CapabilityFallbackSelectionResult;
  permissionPlan: CapabilityRepairPlan | null;
  permissionRequestResult: CapabilityAutopilotPermissionRequestResult | null;
  validationResult: CapabilityAutopilotValidationResumeResult | null;
  receipt: CapabilityReceipt | null;
  resumeIntent: OriginalIntentEnvelope | null;
  summary: string;
  technicalSummary: string;
  metadata: Record<string, unknown>;
};

export type CapabilityAutopilotFallbackHandoffRuntime = {
  now?: () => Date;
  validationResumeService?: ValidationResumeLike;
  permissionService?: PermissionRequestLike;
};

export class CapabilityAutopilotFallbackHandoffService {
  private readonly now: () => Date;
  private readonly validationResumeService: ValidationResumeLike;
  private readonly permissionService: PermissionRequestLike;

  constructor(runtime: CapabilityAutopilotFallbackHandoffRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.validationResumeService = runtime.validationResumeService || new CapabilityAutopilotValidationResumeService();
    this.permissionService = runtime.permissionService || new CapabilityAutopilotPermissionService();
  }

  public async continueSelectedFallback(
    input: CapabilityFallbackHandoffInput,
  ): Promise<CapabilityFallbackHandoffResult> {
    const generatedAt = this.now().toISOString();
    const selectedFallback = input.selection.selectedFallback;
    const receipt = input.selection.receipt || input.receipt || null;
    const resumeIntent = input.selection.nextIntent || receipt?.resumeIntent || null;

    if (!selectedFallback || !this.isSelectionUsable(input.selection.status)) {
      return this.result({
        generatedAt,
        status: input.selection.status === 'policy_blocked' ? 'blocked' : 'not_selected',
        selection: input.selection,
        selectedFallback: null,
        permissionPlan: null,
        permissionRequestResult: null,
        validationResult: null,
        receipt,
        resumeIntent,
        summary: this.buildBlockedSummary(input.selection.status),
        technicalSummary: `fallback_handoff=blocked; selection_status=${input.selection.status}`,
      });
    }

    const capabilityId = this.resolveTargetCapability(input.selection);
    const permissionPlan = selectedFallback.requiresPermission
      ? this.buildFallbackPermissionPlan({
        selectedFallback,
        selection: input.selection,
        receipt,
        resumeIntent,
        generatedAt,
      })
      : null;

    if (permissionPlan) {
      const permissionStatus = this.resolvePermissionStatus(permissionPlan, input.permissions || []);
      if (permissionStatus !== 'approved') {
        const permissionRequestResult = input.createPermissionRequests === false
          ? null
          : await this.permissionService.createPermissionRequests({
            repairPlan: permissionPlan,
            receipt,
            resumeIntent,
            requestedBy: input.requestedBy || resumeIntent?.userId || null,
          });

        return this.result({
          generatedAt,
          status: permissionRequestResult ? 'permission_requested' : 'waiting_permission',
          selection: input.selection,
          selectedFallback,
          permissionPlan,
          permissionRequestResult,
          validationResult: null,
          receipt: permissionRequestResult ? this.appendPermissionTimeline(receipt, permissionRequestResult, generatedAt) : receipt,
          resumeIntent,
          summary: permissionRequestResult ? `Fallback '${selectedFallback.label}' selected; contextual permission requested.`
            : `Fallback '${selectedFallback.label}' selected; waiting for approved contextual permission.`,
          technicalSummary: `fallback_handoff=permission_gate; status=${permissionRequestResult ? 'requested' : 'waiting'}; capability=${capabilityId}`,
        });
      }
    }

    const validationResult = await this.validationResumeService.validateForResume({
      capabilityId,
      previousReceipt: receipt,
      repairPlan: permissionPlan || undefined,
      resumeIntent,
      permissions: input.permissions || null,
      permissionIds: input.permissionIds || null,
      requireApprovedPermissions: Boolean(permissionPlan),
      surface: receipt?.surface || resumeIntent?.surface,
      audience: receipt?.audience || resumeIntent?.audience,
    });

    return this.result({
      generatedAt,
      status: this.mapValidationStatus(validationResult.status),
      selection: input.selection,
      selectedFallback,
      permissionPlan,
      permissionRequestResult: null,
      validationResult,
      receipt: validationResult.receipt,
      resumeIntent: validationResult.resumeIntent || resumeIntent,
      summary: this.buildValidationSummary(selectedFallback, validationResult),
      technicalSummary: [
        `fallback_handoff=validated`,
        `validation=${validationResult.status}`,
        `capability=${capabilityId}`,
        selectedFallback.executorName ? `executor=${selectedFallback.executorName}` : null,
      ].filter(Boolean).join('; '),
    });
  }

  public selectAndContinue(input: {
    receipt?: CapabilityReceipt | null;
    repairPlan?: CapabilityRepairPlan | null;
    fallbackId: string;
    requestedBy?: string | null;
    permissions?: PermissionRequest[] | null;
    permissionIds?: string[] | null;
    createPermissionRequests?: boolean;
  }): Promise<CapabilityFallbackHandoffResult> {
    const selection = new CapabilityAutopilotFallbackSelectionService({ now: this.now }).selectFallback({
      receipt: input.receipt || null,
      repairPlan: input.repairPlan || null,
      fallbackId: input.fallbackId,
      requestedBy: input.requestedBy || null,
    });
    return this.continueSelectedFallback({
      selection,
      receipt: input.receipt || null,
      permissions: input.permissions || null,
      permissionIds: input.permissionIds || null,
      requestedBy: input.requestedBy || null,
      createPermissionRequests: input.createPermissionRequests,
    });
  }

  private isSelectionUsable(status: CapabilityFallbackSelectionResult['status']): boolean {
    return status === 'selected' || status === 'requires_permission';
  }

  private resolveTargetCapability(selection: CapabilityFallbackSelectionResult): string {
    return selection.selectedFallback?.capabilityId ||
      selection.nextIntent?.requestedCapabilityId ||
      selection.selectedFallback?.executorName ||
      selection.capabilityId;
  }

  private buildFallbackPermissionPlan(input: {
    selectedFallback: CapabilityFallbackOption;
    selection: CapabilityFallbackSelectionResult;
    receipt: CapabilityReceipt | null;
    resumeIntent: OriginalIntentEnvelope | null;
    generatedAt: string;
  }): CapabilityRepairPlan {
    const capabilityId = this.resolveTargetCapability(input.selection);
    const permission = this.fallbackPermissionRequirement(input.selectedFallback, capabilityId);
    const steps: CapabilityRepairStep[] = [
      {
        id: 'explain-fallback',
        kind: 'explain',
        title: 'Explain selected fallback',
        summary: `Fallback selected: ${input.selectedFallback.label}.`,
        command: null,
        installStep: null,
        permissionIds: [],
        expectedOutcome: 'User understands the swap before execution.',
      },
      {
        id: 'request-fallback-permission',
        kind: 'ask_user',
        title: 'Ask for fallback permission',
        summary: permission.reason,
        command: null,
        installStep: null,
        permissionIds: [permission.id],
        expectedOutcome: 'Contextual permission approved.',
      },
      {
        id: 'switch-to-selected-fallback',
        kind: 'switch_executor',
        title: 'Registrar troca de executor',
        summary: 'The switch is recorded, but not executed invisibly.',
        command: null,
        installStep: null,
        permissionIds: [permission.id],
        expectedOutcome: 'Alternative executor is approved for the next governed run.',
      },
    ];

    return {
      repairPlanId: `${input.selection.repairPlanId || input.selection.capabilityId}-fallback-${input.selectedFallback.id}`,
      capabilityId,
      diagnosisId: null,
      createdAt: input.generatedAt,
      status: 'approval_required',
      summary: `Authorize fallback '${input.selectedFallback.label}' to continue the original request.`,
      riskLevel: permission.riskLevel,
      trustLevelRequired: permission.trustLevelRequired,
      permissionRequirements: [permission],
      steps,
      validators: [{
        id: 'validate-fallback-readiness',
        title: 'Validate fallback readiness',
        kind: 'manual',
        target: capabilityId,
        successCondition: 'Capability alternactive ready e safe para resume.',
        required: true,
      }],
      fallbackOptions: [],
      resumeIntent: input.resumeIntent,
      metadata: {
        gate: 'capability-autopilot-fallback-handoff',
        fallbackId: input.selectedFallback.id,
        fallbackLabel: input.selectedFallback.label,
        previousCapabilityId: input.selection.capabilityId,
        selectedExecutorName: input.selectedFallback.executorName || null,
        sourceReceiptId: input.receipt?.receiptId || null,
      },
    };
  }

  private fallbackPermissionRequirement(
    selectedFallback: CapabilityFallbackOption,
    capabilityId: string,
  ): CapabilityPermissionRequirement {
    const target = selectedFallback.executorName || selectedFallback.capabilityId || capabilityId;
    return {
      id: `fallback-${selectedFallback.id}-switch-executor-session`,
      kind: 'switch_executor',
      scope: 'session',
      reason: `You chose to use '${selectedFallback.label}' as an alternative. I need to record that switch before continuing.`,
      requestedValue: target,
      resolvedValue: target,
      riskLevel: 5,
      trustLevelRequired: this.resolveTrustLevel(selectedFallback),
      metadata: {
        fallback_id: selectedFallback.id,
        fallback_label: selectedFallback.label,
        fallback_executor: selectedFallback.executorName || null,
        fallback_capability: selectedFallback.capabilityId || null,
      },
    };
  }

  private resolveTrustLevel(selectedFallback: CapabilityFallbackOption): CapabilityTrustLevel {
    if (selectedFallback.executorName === 'local' || selectedFallback.executorName === 'external_executor') {
      return 'collaborator';
    }
    return 'collaborator';
  }

  private resolvePermissionStatus(
    permissionPlan: CapabilityRepairPlan,
    permissions: PermissionRequest[],
  ): 'approved' | 'waiting' {
    const requiredIds = permissionPlan.permissionRequirements.map((requirement) => requirement.id);
    const approved = requiredIds.every((requirementId) =>
      permissions.some((permission) =>
        permission.status === 'approved' &&
        (
          permission.permission_id === requirementId ||
          permission.metadata?.requirement_id === requirementId ||
          permission.metadata?.fallback_id === permissionPlan.metadata?.fallbackId
        ),
      ),
    );
    return approved ? 'approved' : 'waiting';
  }

  private appendPermissionTimeline(
    receipt: CapabilityReceipt | null,
    permissionRequestResult: CapabilityAutopilotPermissionRequestResult,
    generatedAt: string,
  ): CapabilityReceipt | null {
    if (!receipt) {
      return null;
    }
    return {
      ...receipt,
      generatedAt,
      stage: 'permission',
      timeline: [
        ...receipt.timeline,
        {
          at: generatedAt,
          stage: 'permission',
          status: 'pending',
          summary: permissionRequestResult.reason,
          detail: `permissions=${permissionRequestResult.permissions.length}; repairPlan=${permissionRequestResult.repairPlanId}`,
        },
      ],
      metadata: {
        ...(receipt.metadata || {}),
        gate: 'capability-autopilot-fallback-handoff',
        fallbackPermissionRequested: true,
      },
    };
  }

  private mapValidationStatus(
    status: CapabilityAutopilotValidationResumeResult['status'],
  ): CapabilityFallbackHandoffStatus {
    switch (status) {
      case 'ready_to_resume':
        return 'ready_to_resume';
      case 'permission_rejected':
        return 'permission_rejected';
      case 'waiting_permission':
        return 'waiting_permission';
      default:
        return 'needs_repair';
    }
  }

  private buildValidationSummary(
    selectedFallback: CapabilityFallbackOption,
    validationResult: CapabilityAutopilotValidationResumeResult,
  ): string {
    if (validationResult.status === 'ready_to_resume') {
      return `Fallback '${selectedFallback.label}' is ready to resume the original request.`;
    }
    if (validationResult.status === 'waiting_permission') {
      return `Fallback '${selectedFallback.label}' is still waiting for approved permission.`;
    }
    if (validationResult.status === 'permission_rejected') {
      return `Permission rejected for fallback '${selectedFallback.label}'.`;
    }
    return `Fallback '${selectedFallback.label}' still needs repair before resuming.`;
  }

  private buildBlockedSummary(status: CapabilityFallbackSelectionResult['status']): string {
    if (status === 'policy_blocked') {
      return 'Fallback blocked by policy; I should not continue.';
    }
    if (status === 'not_found') {
      return 'Requested fallback was not found; I should not continue.';
    }
    return 'No fallback was explicitly selected.';
  }

  private result(input: {
    generatedAt: string;
    status: CapabilityFallbackHandoffStatus;
    selection: CapabilityFallbackSelectionResult;
    selectedFallback: CapabilityFallbackOption | null;
    permissionPlan: CapabilityRepairPlan | null;
    permissionRequestResult: CapabilityAutopilotPermissionRequestResult | null;
    validationResult: CapabilityAutopilotValidationResumeResult | null;
    receipt: CapabilityReceipt | null;
    resumeIntent: OriginalIntentEnvelope | null;
    summary: string;
    technicalSummary: string;
  }): CapabilityFallbackHandoffResult {
    return {
      generatedAt: input.generatedAt,
      status: input.status,
      capabilityId: this.resolveTargetCapability(input.selection),
      selectedFallback: input.selectedFallback,
      selection: input.selection,
      permissionPlan: input.permissionPlan,
      permissionRequestResult: input.permissionRequestResult,
      validationResult: input.validationResult,
      receipt: input.receipt,
      resumeIntent: input.resumeIntent,
      summary: input.summary,
      technicalSummary: input.technicalSummary,
      metadata: {
        gate: 'capability-autopilot-fallback-handoff',
        autoFallbackExecuted: false,
        explicitSelectionRequired: true,
        selectionStatus: input.selection.status,
        fallbackId: input.selectedFallback?.id || null,
      },
    };
  }
}
