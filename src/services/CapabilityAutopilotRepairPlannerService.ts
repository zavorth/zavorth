import type {
  CapabilityDiagnosis,
  CapabilityFallbackOption,
  CapabilityFailureKind,
  CapabilityOperationalDescriptor,
  CapabilityPermissionRequirement,
  CapabilityReadinessSnapshot,
  CapabilityRepairPlan,
  CapabilityRepairPlanStatus,
  CapabilityRepairStep,
  CapabilityRepairStepKind,
  CapabilityTrustLevel,
  CapabilityValidationStep,
  OriginalIntentEnvelope,
} from '../contracts/CapabilityAutopilotContract.js';
import { CapabilityAutopilotDiagnosisService } from './CapabilityAutopilotDiagnosisService.js';

import { CapabilityAutopilotReadinessService } from './CapabilityAutopilotReadinessService.js';

type CapabilityAutopilotReadinessLike = Pick<
  CapabilityAutopilotReadinessService,
  'buildReadinessSnapshot' | 'getOperationalDescriptor'
>;
type CapabilityAutopilotDiagnosisLike = Pick<
  CapabilityAutopilotDiagnosisService,
  'diagnoseReadiness'
>;

export type CapabilityRepairPlanContext = {
  descriptor?: CapabilityOperationalDescriptor | null;
  readiness?: CapabilityReadinessSnapshot | null;
  resumeIntent?: OriginalIntentEnvelope | null;
};

export type CapabilityAutopilotRepairPlannerRuntime = {
  now?: () => Date;
  readinessService?: CapabilityAutopilotReadinessLike;
  diagnosisService?: CapabilityAutopilotDiagnosisLike;
};

type RepairPosture = {
  riskLevel: number;
  trustLevelRequired: CapabilityTrustLevel;
  status: CapabilityRepairPlanStatus;
};

type RepairPlanDraft = {
  permissionRequirements: CapabilityPermissionRequirement[];
  steps: CapabilityRepairStep[];
  validators: CapabilityValidationStep[];
  fallbackOptions: CapabilityFallbackOption[];
};

export class CapabilityAutopilotRepairPlannerService {
  private readonly now: () => Date;
  private readonly readinessService: CapabilityAutopilotReadinessLike;
  private readonly diagnosisService: CapabilityAutopilotDiagnosisLike;

  constructor(runtime: CapabilityAutopilotRepairPlannerRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.readinessService = runtime.readinessService || new CapabilityAutopilotReadinessService();
    this.diagnosisService = runtime.diagnosisService || new CapabilityAutopilotDiagnosisService({
      readinessService: this.readinessService,
    });
  }

  public async buildRepairPlan(
    capabilityId: string,
    resumeIntent: OriginalIntentEnvelope | null = null,
  ): Promise<CapabilityRepairPlan> {
    const descriptor = this.readinessService.getOperationalDescriptor(capabilityId);
    const readiness = await this.readinessService.buildReadinessSnapshot(capabilityId);
    const diagnosis = this.diagnosisService.diagnoseReadiness(readiness, descriptor);
    return this.planFromDiagnosis(diagnosis, { descriptor, readiness, resumeIntent });
  }

  public planFromDiagnosis(
    diagnosis: CapabilityDiagnosis,
    context: CapabilityRepairPlanContext = {},
  ): CapabilityRepairPlan {
    const descriptor = context.descriptor || null;
    const readiness = context.readiness || null;
    const generatedAt = this.now().toISOString();
    const posture = this.resolvePosture(diagnosis);
    const draft = this.buildDraft(diagnosis, descriptor, readiness, context.resumeIntent || null);

    return {
      repairPlanId: this.buildRepairPlanId(diagnosis.capabilityId, generatedAt),
      capabilityId: diagnosis.capabilityId,
      diagnosisId: diagnosis.diagnosisId,
      createdAt: generatedAt,
      status: posture.status,
      summary: this.buildSummary(diagnosis, descriptor, readiness),
      riskLevel: posture.riskLevel,
      trustLevelRequired: posture.trustLevelRequired,
      permissionRequirements: draft.permissionRequirements,
      steps: draft.steps,
      validators: draft.validators,
      fallbackOptions: draft.fallbackOptions,
      resumeIntent: context.resumeIntent || null,
      metadata: {
        gate: 'capability-autopilot-repair-planner',
        readOnly: true,
        failureKind: diagnosis.failureKind,
        readinessStatus: readiness?.status || diagnosis.status,
      },
    };
  }

  private buildDraft(
    diagnosis: CapabilityDiagnosis,
    descriptor: CapabilityOperationalDescriptor | null,
    readiness: CapabilityReadinessSnapshot | null,
    resumeIntent: OriginalIntentEnvelope | null,
  ): RepairPlanDraft {
    const permissionRequirements = this.buildPermissionRequirements(diagnosis, descriptor, readiness);
    const steps = this.buildSteps(diagnosis, descriptor, readiness, permissionRequirements, resumeIntent);
    const validators = this.buildValidators(diagnosis, descriptor, readiness);
    const fallbackOptions = this.buildFallbackOptions(diagnosis, descriptor);

    return {
      permissionRequirements,
      steps,
      validators,
      fallbackOptions,
    };
  }

  private buildPermissionRequirements(
    diagnosis: CapabilityDiagnosis,
    descriptor: CapabilityOperationalDescriptor | null,
    readiness: CapabilityReadinessSnapshot | null,
  ): CapabilityPermissionRequirement[] {
    if (diagnosis.status === 'ready' || !diagnosis.repairable) {
      return [];
    }

    const target = descriptor?.executor?.executorName || descriptor?.integration?.integrationId || diagnosis.capabilityId;
    const base = {
      requestedValue: target,
      resolvedValue: target,
      metadata: {
        capabilityId: diagnosis.capabilityId,
        failureKind: diagnosis.failureKind,
        blockingReason: readiness?.blockingReason || null,
      },
    };

    switch (diagnosis.failureKind) {
      case 'missing_binary':
        return [{
          id: this.buildPermissionId(diagnosis.capabilityId, 'install_binary', 'host'),
          kind: 'install_binary',
          scope: 'host',
          reason: 'Installing or locating a local tool requires host permission.',
          riskLevel: 7,
          trustLevelRequired: 'collaborator',
          ...base,
        }];
      case 'missing_secret':
      case 'missing_auth':
        return [{
          id: this.buildPermissionId(diagnosis.capabilityId, 'provide_secret', 'session'),
          kind: diagnosis.failureKind === 'missing_auth' ? 'authenticate' : 'provide_secret',
          scope: 'session',
          reason: 'Credentials and login must be provided by the user or approved for the session.',
          riskLevel: 5,
          trustLevelRequired: 'collaborator',
          ...base,
        }];
      case 'missing_runtime':
        return [{
          id: this.buildPermissionId(diagnosis.capabilityId, 'prepare_runtime', 'host'),
          kind: 'prepare_runtime',
          scope: 'host',
          reason: 'Prepare Docker, browser, service local ou runtime auxiliar muda o ambiente do host.',
          riskLevel: 8,
          trustLevelRequired: 'overlord',
          ...base,
        }];
      case 'executor_unavailable':
      case 'probe_failed':
      case 'remote_unhealthy':
        return [{
          id: this.buildPermissionId(diagnosis.capabilityId, 'run_diagnostics', 'session'),
          kind: 'run_diagnostics',
          scope: 'session',
          reason: 'Diagnosticar a capability pode run doctor, probe ou smoke test controlado.',
          riskLevel: 4,
          trustLevelRequired: 'collaborator',
          ...base,
        }];
      case 'permission_required':
        return [{
          id: this.buildPermissionId(diagnosis.capabilityId, 'enable_capability', 'session'),
          kind: 'enable_capability',
          scope: 'session',
          reason: 'The capability must be enabled before execution.',
          riskLevel: 4,
          trustLevelRequired: 'collaborator',
          ...base,
        }];
      default:
        return [];
    }
  }

  private buildSteps(
    diagnosis: CapabilityDiagnosis,
    descriptor: CapabilityOperationalDescriptor | null,
    readiness: CapabilityReadinessSnapshot | null,
    permissionRequirements: CapabilityPermissionRequirement[],
    resumeIntent: OriginalIntentEnvelope | null,
  ): CapabilityRepairStep[] {
    const permissionIds = permissionRequirements.map((entry) => entry.id);
    const steps: CapabilityRepairStep[] = [
      this.step('explain-problem', 'explain', 'Explain the problem', diagnosis.rootCause, [], 'The user understands the blocker before any action.'),
    ];

    if (diagnosis.status === 'ready') {
      steps.push(this.step(
        'no-repair-needed',
        'noop',
        'No repair needed',
        'Current readiness is already healthy.',
        [],
        'The capability can proceed to normal execution.',
      ));
      if (resumeIntent) {
        steps.push(this.buildResumeStep(resumeIntent, []));
      }
      return steps;
    }

    if (!diagnosis.repairable) {
      steps.push(this.step(
        'ask-for-context',
        'ask_user',
        'Ask for additional context',
        'The failure does not yet have a safe enough repair to propose automation.',
        [],
        'The user provides context or chooses another capability.',
      ));
      return steps;
    }

    steps.push(this.step(
      'request-permission',
      'ask_user',
      'Ask for contextual permission',
      this.buildPermissionSummary(permissionRequirements),
      permissionIds,
      'Permission approved with explicit scope before repair.',
    ));

    switch (diagnosis.failureKind) {
      case 'missing_binary':
        steps.push(this.step(
          'prepare-binary',
          'install_binary',
          'Prepare local binary',
          this.buildMissingBinarySummary(readiness),
          permissionIds,
          'Binary is installed or visible on PATH.',
        ));
        break;
      case 'missing_secret':
        steps.push(this.step(
          'collect-secret',
          'set_env',
          'Collect missing secret or env value',
          'Ask the user for the value or guide safe configuration in existing storage.',
          permissionIds,
          'Credential remains available only in the approved scope.',
        ));
        break;
      case 'missing_auth':
        steps.push(this.step(
          'authenticate',
          'authenticate',
          'Complete authentication',
          'Guide login, account setup, or credential rotation without capturing a password in clear text.',
          permissionIds,
          'Authentication becomes ready for a new probe.',
        ));
        break;
      case 'missing_runtime':
        steps.push(this.step(
          'prepare-runtime',
          'start_service',
          'Prepare helper runtime',
          'Prepare Docker, browser, sidecar, or required service according to policy.',
          permissionIds,
          'Auxiliary runtime becomes ready or fails with evidence.',
        ));
        break;
      case 'executor_unavailable':
        steps.push(this.step(
          'repair-executor',
          'run_command',
          'Diagnose executor',
          `Run a controlled doctor/smoke check for ${descriptor?.executor?.executorName || diagnosis.capabilityId}.`,
          permissionIds,
          'Executor becomes available or a fallback is presented.',
        ));
        break;
      case 'probe_failed':
      case 'remote_unhealthy':
        steps.push(this.step(
          'rerun-health-check',
          'validate',
          'Rerun health check',
          'Run the appropriate probe/doctor and store evidence before resume.',
          permissionIds,
          'Probe passes or fails with a more specific cause.',
        ));
        break;
      case 'permission_required':
        steps.push(this.step(
          'enable-capability',
          'ask_user',
          'Enable capability in the approved scope',
          'Apply enablement only after contextual approval.',
          permissionIds,
          'Capability is no longer blocked by lifecycle/approval.',
        ));
        break;
      default:
        steps.push(this.step(
          'manual-repair',
          'manual',
          'Supervised manual repair',
          'No safe automatic recipe exists at this stage.',
          permissionIds,
          'Operator decides the next path.',
        ));
    }

    steps.push(this.step(
      'validate-repair',
      'validate',
      'Validate repair',
      'Recalculate readiness and confirm the capability became ready.',
      [],
      'Readiness changes to ready before resume.',
    ));

    if (resumeIntent) {
      steps.push(this.buildResumeStep(resumeIntent, []));
    }

    return steps;
  }

  private buildValidators(
    diagnosis: CapabilityDiagnosis,
    descriptor: CapabilityOperationalDescriptor | null,
    readiness: CapabilityReadinessSnapshot | null,
  ): CapabilityValidationStep[] {
    const validators: CapabilityValidationStep[] = [
      {
        id: 'readiness-snapshot',
        title: 'Recalculate readiness',
        kind: 'manual',
        target: diagnosis.capabilityId,
        successCondition: 'CapabilityReadinessSnapshot.ready must be true before resume.',
        required: true,
      },
    ];

    if (readiness?.probe) {
      validators.push({
        id: 'integration-probe',
        title: 'validate probe da integration',
        kind: 'probe',
        target: readiness.probe.checkedTarget || readiness.probe.integrationId,
        successCondition: 'Probe must return status ok.',
        required: true,
      });
    }

    if (descriptor?.executor?.executorName) {
      validators.push({
        id: 'executor-smoke',
        title: 'validate executor',
        kind: 'executor_smoke',
        target: descriptor.executor.executorName,
        successCondition: 'Executor must report available before real execution.',
        required: descriptor.type === 'executor',
      });
    }

    return validators;
  }

  private buildFallbackOptions(
    diagnosis: CapabilityDiagnosis,
    descriptor: CapabilityOperationalDescriptor | null,
  ): CapabilityFallbackOption[] {
    if (diagnosis.status === 'ready' || diagnosis.failureKind === 'policy_blocked') {
      return [];
    }

    const currentExecutor = descriptor?.executor?.executorName || null;
    const candidates = ['local', 'codex', 'external_executor', 'gemini_cli']
      .filter((executorName) => executorName !== currentExecutor);

    return [
      ...candidates.map((executorName) => ({
        id: `fallback-${executorName}`,
        label: `try ${executorName}`,
        executorName,
        capabilityId: null,
        reason: `Visible fallback if ${descriptor?.label || diagnosis.capabilityId} cannot be repaired now.`,
        requiresPermission: true,
        policyAllowed: null,
      })),
      {
        id: 'fallback-manual-guidance',
        label: 'Orientaction manual',
        executorName: null,
        capabilityId: null,
        reason: 'Explain to the user how to prepare the tool without automation.',
        requiresPermission: false,
        policyAllowed: true,
      },
    ];
  }

  private resolvePosture(diagnosis: CapabilityDiagnosis): RepairPosture {
    if (diagnosis.status === 'ready') {
      return {
        riskLevel: 0,
        trustLevelRequired: 'protected',
        status: 'validated',
      };
    }

    if (!diagnosis.repairable) {
      return {
        riskLevel: 2,
        trustLevelRequired: 'protected',
        status: 'proposed',
      };
    }

    switch (diagnosis.failureKind) {
      case 'missing_runtime':
        return { riskLevel: 8, trustLevelRequired: 'overlord', status: 'approval_required' };
      case 'missing_binary':
        return { riskLevel: 7, trustLevelRequired: 'collaborator', status: 'approval_required' };
      case 'missing_secret':
      case 'missing_auth':
        return { riskLevel: 5, trustLevelRequired: 'collaborator', status: 'approval_required' };
      case 'policy_blocked':
        return { riskLevel: 9, trustLevelRequired: 'overlord', status: 'proposed' };
      case 'permission_required':
      case 'executor_unavailable':
      case 'probe_failed':
      case 'remote_unhealthy':
        return { riskLevel: 4, trustLevelRequired: 'collaborator', status: 'approval_required' };
      default:
        return { riskLevel: 3, trustLevelRequired: 'protected', status: 'proposed' };
    }
  }

  private buildSummary(
    diagnosis: CapabilityDiagnosis,
    descriptor: CapabilityOperationalDescriptor | null,
    readiness: CapabilityReadinessSnapshot | null,
  ): string {
    const label = descriptor?.label || diagnosis.capabilityId;
    if (diagnosis.status === 'ready') {
      return `${label} is already ready; no repair is needed.`;
    }
    const next = readiness?.suggestedNextAction?.label ? ` next passo sugerido: ${readiness.suggestedNextAction.label}.`
      : '';
    return `${label}: proposed plan for ${diagnosis.failureKind}. ${diagnosis.rootCause}.${next}`.trim();
  }

  private buildPermissionSummary(requirements: CapabilityPermissionRequirement[]): string {
    if (requirements.length === 0) {
      return 'No additional permission was detected.';
    }

    return requirements
      .map((entry) => `${entry.kind} (${entry.scope}, risk ${entry.riskLevel})`)
      .join('; ');
  }

  private buildMissingBinarySummary(readiness: CapabilityReadinessSnapshot | null): string {
    const missingBinary = readiness?.missingRequirements.find((entry) => entry.type === 'binary');
    if (!missingBinary) {
      return 'Prepare the missing binary according to capability doctor/manifest.';
    }
    return `${missingBinary.label}: ${missingBinary.description}`;
  }

  private buildResumeStep(
    resumeIntent: OriginalIntentEnvelope,
    permissionIds: string[],
  ): CapabilityRepairStep {
    return this.step(
      'resume-original-intent',
      'resume_original_intent',
      'Resume original request',
      `resume: ${resumeIntent.rawText || resumeIntent.normalizedText}`,
      permissionIds,
      'Original request returns to the flow after validation.',
    );
  }

  private step(
    id: string,
    kind: CapabilityRepairStepKind,
    title: string,
    summary: string,
    permissionIds: string[],
    expectedOutcome: string,
  ): CapabilityRepairStep {
    return {
      id,
      kind,
      title,
      summary,
      command: null,
      installStep: null,
      permissionIds,
      expectedOutcome,
      rollbackHint: null,
      optional: false,
    };
  }

  private buildPermissionId(capabilityId: string, kind: string, scope: string): string {
    return `${this.slug(capabilityId)}-${this.slug(kind)}-${this.slug(scope)}`;
  }

  private buildRepairPlanId(capabilityId: string, generatedAt: string): string {
    return `${this.slug(capabilityId)}-repair-${generatedAt.replace(/[^0-9a-z]+/gi, '')}`;
  }

  private slug(value: string): string {
    return String(value || 'unknown')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_.-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'unknown';
  }
}
