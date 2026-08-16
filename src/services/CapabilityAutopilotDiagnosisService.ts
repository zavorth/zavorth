import type {
  CapabilityDiagnosis,
  CapabilityDiagnosisNarrative,
  CapabilityFailureKind,
  CapabilityOperationalDescriptor,
  CapabilityReadinessSnapshot,
} from '../contracts/CapabilityAutopilotContract.js';
import type { IntegrationRequirement } from '../contracts/IntegrationHubContract.js';
import { CapabilityAutopilotReadinessService } from './CapabilityAutopilotReadinessService.js';

type CapabilityAutopilotReadinessLike = Pick<
  CapabilityAutopilotReadinessService,
  'buildReadinessSnapshot' | 'getOperationalDescriptor'
>;

export type CapabilityAutopilotDiagnosisRuntime = {
  now?: () => Date;
  readinessService?: CapabilityAutopilotReadinessLike;
};

type CapabilityFailureClassification = {
  failureKind: CapabilityFailureKind;
  rootCause: string;
  confidence: number;
  repairable: boolean;
  requiresUserInput: boolean;
};

export class CapabilityAutopilotDiagnosisService {
  private readonly now: () => Date;
  private readonly readinessService: CapabilityAutopilotReadinessLike;

  constructor(runtime: CapabilityAutopilotDiagnosisRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.readinessService = runtime.readinessService || new CapabilityAutopilotReadinessService();
  }

  public async diagnoseCapability(capabilityId: string): Promise<CapabilityDiagnosis> {
    const descriptor = this.readinessService.getOperationalDescriptor(capabilityId);
    const readiness = await this.readinessService.buildReadinessSnapshot(capabilityId);
    return this.diagnoseReadiness(readiness, descriptor);
  }

  public diagnoseReadiness(
    readiness: CapabilityReadinessSnapshot,
    descriptor: CapabilityOperationalDescriptor | null = null,
  ): CapabilityDiagnosis {
    const generatedAt = this.now().toISOString();
    const classification = this.classify(readiness, descriptor);
    const label = descriptor?.label || readiness.capabilityId;

    return {
      diagnosisId: this.buildDiagnosisId(readiness.capabilityId, generatedAt),
      capabilityId: readiness.capabilityId,
      generatedAt,
      failureKind: classification.failureKind,
      status: readiness.status,
      rootCause: classification.rootCause,
      confidence: classification.confidence,
      repairable: classification.repairable,
      requiresUserInput: classification.requiresUserInput,
      narratives: this.buildNarratives(label, readiness, classification),
      evidence: readiness.evidence,
      relatedExecution: null,
      metadata: {
        gate: 'capability-autopilot-diagnosis',
        readOnly: true,
        readinessStatus: readiness.status,
        blockingReason: readiness.blockingReason || null,
      },
    };
  }

  private classify(
    readiness: CapabilityReadinessSnapshot,
    descriptor: CapabilityOperationalDescriptor | null,
  ): CapabilityFailureClassification {
    if (readiness.ready && readiness.status === 'ready') {
      return {
        failureKind: 'unknown',
        rootCause: 'No operational failure detected in current readiness.',
        confidence: 1,
        repairable: false,
        requiresUserInput: false,
      };
    }

    const missingBinary = this.findMissingRequirement(readiness, ['binary']);
    if (missingBinary) {
      return {
        failureKind: 'missing_binary',
        rootCause: `Required binary missing: ${missingBinary.label}.`,
        confidence: 0.94,
        repairable: true,
        requiresUserInput: true,
      };
    }

    const missingSecret = readiness.missingRequirements.find((entry) => entry.secret || entry.type === 'env');
    if (missingSecret) {
      return {
        failureKind: 'missing_secret',
        rootCause: `Credential, secret, or environment variable missing: ${missingSecret.label}.`,
        confidence: 0.9,
        repairable: true,
        requiresUserInput: true,
      };
    }

    const missingAuth = this.findMissingRequirement(readiness, ['account']);
    if (missingAuth || readiness.probe?.status === 'not_configured') {
      return {
        failureKind: 'missing_auth',
        rootCause: missingAuth ? `Account or authentication pending: ${missingAuth.label}.`
          : readiness.probe?.summary || 'Integration not configured yet.',
        confidence: 0.86,
        repairable: true,
        requiresUserInput: true,
      };
    }

    const missingRuntime = this.findMissingRequirement(readiness, ['docker', 'browser']);
    if (missingRuntime) {
      return {
        failureKind: 'missing_runtime',
        rootCause: `Auxiliary runtime missing or unavailable: ${missingRuntime.label}.`,
        confidence: 0.84,
        repairable: true,
        requiresUserInput: true,
      };
    }

    if (readiness.executor?.available === false) {
      return {
        failureKind: 'executor_unavailable',
        rootCause: `Executor ${readiness.executor.executorName} unavailable on this host.`,
        confidence: 0.92,
        repairable: true,
        requiresUserInput: true,
      };
    }

    const blockingReason = String(readiness.blockingReason || '').toLowerCase();
    if (blockingReason.includes('policy')) {
      return {
        failureKind: 'policy_blocked',
        rootCause: readiness.detail || 'Policy blocked the capability before execution.',
        confidence: 0.88,
        repairable: false,
        requiresUserInput: true,
      };
    }

    if (
      blockingReason.includes('approval') ||
      blockingReason.includes('permission') ||
      (blockingReason.startsWith('lifecycle:') && descriptor?.lifecycle?.approvalRequired)
    ) {
      return {
        failureKind: 'permission_required',
        rootCause: readiness.detail || 'The capability needs approval before continuing.',
        confidence: 0.82,
        repairable: true,
        requiresUserInput: true,
      };
    }

    if (readiness.probe?.status === 'failed') {
      return {
        failureKind: 'probe_failed',
        rootCause: readiness.probe.detail || readiness.probe.summary,
        confidence: 0.87,
        repairable: true,
        requiresUserInput: false,
      };
    }

    if (readiness.status === 'degraded') {
      return {
        failureKind: 'remote_unhealthy',
        rootCause: readiness.detail || 'Capability degraded in current readiness',
        confidence: 0.68,
        repairable: true,
        requiresUserInput: false,
      };
    }

    if (readiness.status === 'blocked') {
      return {
        failureKind: 'permission_required',
        rootCause: readiness.detail || 'Capability blocked until there is permission or a policy change.',
        confidence: 0.72,
        repairable: true,
        requiresUserInput: true,
      };
    }

    return {
      failureKind: 'unknown',
      rootCause: readiness.detail || readiness.summary || 'Readiness still unknown.',
      confidence: readiness.status === 'unknown' ? 0.45 : 0.35,
      repairable: false,
      requiresUserInput: false,
    };
  }

  private buildNarratives(
    label: string,
    readiness: CapabilityReadinessSnapshot,
    classification: CapabilityFailureClassification,
  ): CapabilityDiagnosisNarrative[] {
    return [
      {
        audience: 'everyday_user',
        headline: this.buildEverydayHeadline(label, classification),
        explanation: this.buildEverydayExplanation(label, readiness, classification),
        technicalDetail: null,
      },
      {
        audience: 'technical_operator',
        headline: this.buildTechnicalHeadline(label, classification),
        explanation: this.buildTechnicalExplanation(readiness, classification),
        technicalDetail: this.buildTechnicalDetail(readiness, classification),
      },
    ];
  }

  private buildEverydayHeadline(
    label: string,
    classification: CapabilityFailureClassification,
  ): string {
    switch (classification.failureKind) {
      case 'missing_binary':
        return `${label} is not installed yet or was not found.`;
      case 'missing_secret':
      case 'missing_auth':
        return `${label} needs login or a key before working.`;
      case 'executor_unavailable':
        return `${label} is not available on this computer right now.`;
      case 'policy_blocked':
      case 'permission_required':
        return `${label} needs your permission before continuing.`;
      case 'probe_failed':
      case 'remote_unhealthy':
        return `${label} reported a problem in the latest test.`;
      case 'unknown':
        return classification.repairable ? `${label} needs a check before continuing.`
          : `${label} has not shown a clear problem yet.`;
      default:
        return `${label} needs preparation before running.`;
    }
  }

  private buildEverydayExplanation(
    label: string,
    readiness: CapabilityReadinessSnapshot,
    classification: CapabilityFailureClassification,
  ): string {
    if (readiness.ready) {
      return `Everything indicates that ${label} is ready. I can proceed without requesting repairs.`;
    }

    const nextAction = readiness.suggestedNextAction?.label ? ` Suggested next step: ${readiness.suggestedNextAction.label}.`
      : '';

    switch (classification.failureKind) {
      case 'missing_binary':
        return `I understand what you want to use, but the local tool has not appeared on the computer or in the PATH yet.${nextAction}`;
      case 'missing_secret':
      case 'missing_auth':
        return `The tool exists as an option, but an authorization, key, or login is needed before I can use it safely.${nextAction}`;
      case 'permission_required':
        return `I can prepare this, but I first need a clearly scoped permission so I do not go beyond what was agreed.${nextAction}`;
      case 'policy_blocked':
        return `The current security rule blocked this action. I should not work around it on my own.${nextAction}`;
      case 'executor_unavailable':
        return `The chosen path to execute the task is not ready on this host. I can explain what is missing before attempting any repair.${nextAction}`;
      case 'probe_failed':
      case 'remote_unhealthy':
        return `The latest health check for this capability failed. Better to diagnose before continuing to avoid errors mid-task.${nextAction}`;
      default:
        return `${readiness.summary} ${readiness.detail}${nextAction}`.trim();
    }
  }

  private buildTechnicalHeadline(
    label: string,
    classification: CapabilityFailureClassification,
  ): string {
    return `${label}: ${classification.failureKind}`;
  }

  private buildTechnicalExplanation(
    readiness: CapabilityReadinessSnapshot,
    classification: CapabilityFailureClassification,
  ): string {
    return [
      `Readiness=${readiness.status}`,
      `confidence=${classification.confidence}`,
      `repairable=${classification.repairable}`,
      `requiresUserInput=${classification.requiresUserInput}`,
      readiness.blockingReason ? `blockingReason=${readiness.blockingReason}` : null,
    ].filter(Boolean).join('; ');
  }

  private buildTechnicalDetail(
    readiness: CapabilityReadinessSnapshot,
    classification: CapabilityFailureClassification,
  ): string {
    const missing = readiness.missingRequirements
      .map((entry) => `${entry.id}:${entry.type}`)
      .join(', ');
    const targets = readiness.checkedTargets
      .map((entry) => `${entry.kind}:${entry.status}:${entry.value || entry.label}`)
      .join(', ');

    return [
      `rootCause=${classification.rootCause}`,
      missing ? `missingRequirements=${missing}` : null,
      targets ? `checkedTargets=${targets}` : null,
      readiness.probe ? `probe=${readiness.probe.integrationId}:${readiness.probe.status}:${readiness.probe.transport}` : null,
      readiness.executor ? `executor=${readiness.executor.executorName}:${readiness.executor.available}` : null,
    ].filter(Boolean).join(' | ');
  }

  private findMissingRequirement(
    readiness: CapabilityReadinessSnapshot,
    types: IntegrationRequirement['type'][],
  ): IntegrationRequirement | null {
    return readiness.missingRequirements.find((entry) => types.includes(entry.type)) || null;
  }

  private buildDiagnosisId(capabilityId: string, generatedAt: string): string {
    const safeCapabilityId = String(capabilityId || 'unknown')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_.-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'unknown';
    const safeTimestamp = generatedAt.replace(/[^0-9a-z]+/gi, '');
    return `${safeCapabilityId}-diagnosis-${safeTimestamp}`;
  }
}
