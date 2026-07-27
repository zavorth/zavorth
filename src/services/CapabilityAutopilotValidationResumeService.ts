import type {
  CapabilityAutopilotAudience,
  CapabilityAutopilotSurface,
  CapabilityDiagnosis,
  CapabilityOperationalDescriptor,
  CapabilityReadinessSnapshot,
  CapabilityReceipt,
  CapabilityRepairPlan,
  CapabilityValidationResult,
  OriginalIntentEnvelope,
} from '../contracts/CapabilityAutopilotContract.js';
import type { PermissionRequest } from '../contracts/PermissionRequest.js';
import { PermissionService } from './PermissionService.js';
import { CapabilityAutopilotDiagnosisService } from './CapabilityAutopilotDiagnosisService.js';
import { CapabilityAutopilotReadinessService } from './CapabilityAutopilotReadinessService.js';
import { CapabilityAutopilotReceiptService } from './CapabilityAutopilotReceiptService.js';
import { CapabilityAutopilotRepairPlannerService } from './CapabilityAutopilotRepairPlannerService.js';

type PermissionServiceLike = Pick<PermissionService, 'getRequest'>;
type CapabilityAutopilotReadinessLike = Pick<
  CapabilityAutopilotReadinessService,
  'getOperationalDescriptor' | 'buildReadinessSnapshot'
>;
type CapabilityAutopilotDiagnosisLike = Pick<
  CapabilityAutopilotDiagnosisService,
  'diagnoseReadiness'
>;
type CapabilityAutopilotRepairPlannerLike = Pick<
  CapabilityAutopilotRepairPlannerService,
  'planFromDiagnosis'
>;
type CapabilityAutopilotReceiptLike = Pick<
  CapabilityAutopilotReceiptService,
  'buildReceiptFromParts'
>;

export type CapabilityAutopilotPermissionGateStatus =
  | 'not_required'
  | 'missing'
  | 'pending'
  | 'approved'
  | 'rejected';

export type CapabilityAutopilotValidationResumeStatus =
  | 'waiting_permission'
  | 'permission_rejected'
  | 'ready_to_resume'
  | 'needs_repair'
  | 'validation_failed';

export type CapabilityAutopilotValidationResumeInput = {
  capabilityId: string;
  previousReceipt?: CapabilityReceipt | null;
  repairPlan?: CapabilityRepairPlan | null;
  resumeIntent?: OriginalIntentEnvelope | null;
  permissions?: PermissionRequest[] | null;
  permissionIds?: string[] | null;
  requireApprovedPermissions?: boolean;
  surface?: CapabilityAutopilotSurface;
  audience?: CapabilityAutopilotAudience;
};

export type CapabilityAutopilotValidationResumeResult = {
  generatedAt: string;
  capabilityId: string;
  status: CapabilityAutopilotValidationResumeStatus;
  permissionStatus: CapabilityAutopilotPermissionGateStatus;
  permissions: PermissionRequest[];
  readiness: CapabilityReadinessSnapshot | null;
  diagnosis: CapabilityDiagnosis | null;
  repairPlan: CapabilityRepairPlan | null;
  validation: CapabilityValidationResult;
  receipt: CapabilityReceipt;
  resumeIntent: OriginalIntentEnvelope | null;
};

export type CapabilityAutopilotValidationResumeRuntime = {
  now?: () => Date;
  permissionService?: PermissionServiceLike;
  readinessService?: CapabilityAutopilotReadinessLike;
  diagnosisService?: CapabilityAutopilotDiagnosisLike;
  repairPlannerService?: CapabilityAutopilotRepairPlannerLike;
  receiptService?: CapabilityAutopilotReceiptLike;
};

export class CapabilityAutopilotValidationResumeService {
  private readonly now: () => Date;
  private readonly permissionService: PermissionServiceLike;
  private readonly readinessService: CapabilityAutopilotReadinessLike;
  private readonly diagnosisService: CapabilityAutopilotDiagnosisLike;
  private readonly repairPlannerService: CapabilityAutopilotRepairPlannerLike;
  private readonly receiptService: CapabilityAutopilotReceiptLike;

  constructor(runtime: CapabilityAutopilotValidationResumeRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.permissionService = runtime.permissionService || new PermissionService();
    this.readinessService = runtime.readinessService || new CapabilityAutopilotReadinessService();
    this.diagnosisService = runtime.diagnosisService || new CapabilityAutopilotDiagnosisService({
      readinessService: this.readinessService,
    });
    this.repairPlannerService = runtime.repairPlannerService || new CapabilityAutopilotRepairPlannerService({
      readinessService: this.readinessService,
      diagnosisService: this.diagnosisService,
    });
    this.receiptService = runtime.receiptService || new CapabilityAutopilotReceiptService({
      readinessService: this.readinessService,
      diagnosisService: this.diagnosisService,
      repairPlannerService: this.repairPlannerService,
    });
  }

  public async validateForResume(
    input: CapabilityAutopilotValidationResumeInput,
  ): Promise<CapabilityAutopilotValidationResumeResult> {
    const generatedAt = this.now().toISOString();
    const repairPlan = input.repairPlan || input.previousReceipt?.repairPlan || null;
    const resumeIntent =
      input.resumeIntent ||
      input.previousReceipt?.resumeIntent ||
      repairPlan?.resumeIntent ||
      null;
    const permissions = await this.resolvePermissions(input);
    const permissionStatus = this.resolvePermissionStatus(repairPlan, permissions);
    const requiresApprovedPermissions = input.requireApprovedPermissions !== false;

    if (requiresApprovedPermissions && !['approved', 'not_required'].includes(permissionStatus)) {
      const validation = this.buildPermissionGateValidation(
        input.capabilityId,
        generatedAt,
        permissionStatus,
        permissions,
      );
      const receipt = this.buildGateReceipt({
        input,
        repairPlan,
        resumeIntent,
        validation: permissionStatus === 'rejected' ? validation : null,
      });
      return {
        generatedAt,
        capabilityId: input.capabilityId,
        status: permissionStatus === 'rejected' ? 'permission_rejected' : 'waiting_permission',
        permissionStatus,
        permissions,
        readiness: input.previousReceipt?.readiness || null,
        diagnosis: input.previousReceipt?.diagnosis || null,
        repairPlan,
        validation,
        receipt,
        resumeIntent,
      };
    }

    const descriptor = this.readinessService.getOperationalDescriptor(input.capabilityId);
    const readiness = await this.readinessService.buildReadinessSnapshot(input.capabilityId);
    const diagnosis = this.diagnosisService.diagnoseReadiness(readiness, descriptor);
    const nextRepairPlan = this.repairPlannerService.planFromDiagnosis(diagnosis, {
      descriptor,
      readiness,
      resumeIntent,
    });
    const validation = this.buildReadinessValidation(
      input.capabilityId,
      generatedAt,
      readiness,
      nextRepairPlan,
    );
    const receipt = this.receiptService.buildReceiptFromParts({
      descriptor,
      readiness,
      diagnosis,
      repairPlan: nextRepairPlan,
      validation,
      resumeIntent,
      surface: input.surface || input.previousReceipt?.surface || resumeIntent?.surface,
      audience: input.audience || input.previousReceipt?.audience || resumeIntent?.audience,
    });

    return {
      generatedAt,
      capabilityId: input.capabilityId,
      status: validation.success ? 'ready_to_resume' : 'needs_repair',
      permissionStatus,
      permissions,
      readiness,
      diagnosis,
      repairPlan: nextRepairPlan,
      validation,
      receipt,
      resumeIntent,
    };
  }

  private async resolvePermissions(
    input: CapabilityAutopilotValidationResumeInput,
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
    repairPlan: CapabilityRepairPlan | null,
    permissions: PermissionRequest[],
  ): CapabilityAutopilotPermissionGateStatus {
    const requiredCount = repairPlan?.permissionRequirements.length || 0;
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

  private buildPermissionGateValidation(
    capabilityId: string,
    generatedAt: string,
    permissionStatus: CapabilityAutopilotPermissionGateStatus,
    permissions: PermissionRequest[],
  ): CapabilityValidationResult {
    return {
      capabilityId,
      generatedAt,
      success: false,
      summary: this.buildPermissionGateSummary(permissionStatus),
      results: [{
        validationStepId: 'permission-gate',
        status: permissionStatus === 'rejected' ? 'failed' : 'skipped',
        detail: `permissionStatus=${permissionStatus}; permissions=${permissions.length}`,
      }],
      readiness: null,
    };
  }

  private buildReadinessValidation(
    capabilityId: string,
    generatedAt: string,
    readiness: CapabilityReadinessSnapshot,
    repairPlan: CapabilityRepairPlan,
  ): CapabilityValidationResult {
    return {
      capabilityId,
      generatedAt,
      success: readiness.ready && readiness.safeToRun,
      summary: readiness.ready && readiness.safeToRun ? 'Capability validated and ready to resume.'
        : 'Capability is not ready yet; return to diagnosis/plan.',
      results: [
        {
          validationStepId: 'readiness-snapshot',
          status: readiness.ready && readiness.safeToRun ? 'passed' : 'failed',
          detail: `${readiness.status}: ${readiness.summary}`,
          evidence: readiness.evidence,
        },
        ...repairPlan.validators.map((validator) => ({
          validationStepId: validator.id,
          status: readiness.ready && readiness.safeToRun ? 'passed' as const : 'skipped' as const,
          detail: readiness.ready && readiness.safeToRun
            ? validator.successCondition
            : 'Validator not executed because readiness still failed.',
        })),
      ],
      readiness,
    };
  }

  private buildGateReceipt(input: {
    input: CapabilityAutopilotValidationResumeInput;
    repairPlan: CapabilityRepairPlan | null;
    resumeIntent: OriginalIntentEnvelope | null;
    validation: CapabilityValidationResult | null;
  }): CapabilityReceipt {
    const previous = input.input.previousReceipt;
    return this.receiptService.buildReceiptFromParts({
      descriptor: previous?.readiness ? undefined : null,
      readiness: previous?.readiness || null,
      diagnosis: previous?.diagnosis || null,
      repairPlan: input.repairPlan || previous?.repairPlan || null,
      validation: input.validation,
      resumeIntent: input.resumeIntent,
      surface: input.input.surface || previous?.surface || input.resumeIntent?.surface,
      audience: input.input.audience || previous?.audience || input.resumeIntent?.audience,
    });
  }

  private buildPermissionGateSummary(
    permissionStatus: CapabilityAutopilotPermissionGateStatus,
  ): string {
    switch (permissionStatus) {
      case 'missing':
        return 'Permission requests are still missing for resume validation.';
      case 'pending':
        return 'Waiting for approved permission before revalidating the capability.';
      case 'rejected':
        return 'Permission rejected; should not proceed with repair or resume.';
      default:
        return 'Permission does not allow resume yet.';
    }
  }
}
