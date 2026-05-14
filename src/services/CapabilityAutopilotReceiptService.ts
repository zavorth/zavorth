import type {
  CapabilityAutopilotAudience,
  CapabilityAutopilotSurface,
  CapabilityDiagnosis,
  CapabilityOperationalDescriptor,
  CapabilityReadinessSnapshot,
  CapabilityReceipt,
  CapabilityReceiptStage,
  CapabilityReceiptTimelineEntry,
  CapabilityRepairPlan,
  CapabilityValidationResult,
  OriginalIntentEnvelope,
} from '../contracts/CapabilityAutopilotContract.js';
import { CapabilityAutopilotDiagnosisService } from './CapabilityAutopilotDiagnosisService.js';
import { CapabilityAutopilotReadinessService } from './CapabilityAutopilotReadinessService.js';
import { CapabilityAutopilotRepairPlannerService } from './CapabilityAutopilotRepairPlannerService.js';

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

export type CapabilityReceiptBuildOptions = {
  surface?: CapabilityAutopilotSurface;
  audience?: CapabilityAutopilotAudience;
  resumeIntent?: OriginalIntentEnvelope | null;
  validation?: CapabilityValidationResult | null;
};

export type CapabilityReceiptParts = {
  descriptor?: CapabilityOperationalDescriptor | null;
  readiness?: CapabilityReadinessSnapshot | null;
  diagnosis?: CapabilityDiagnosis | null;
  repairPlan?: CapabilityRepairPlan | null;
  validation?: CapabilityValidationResult | null;
  resumeIntent?: OriginalIntentEnvelope | null;
  surface?: CapabilityAutopilotSurface;
  audience?: CapabilityAutopilotAudience;
};

export type CapabilityAutopilotReceiptRuntime = {
  now?: () => Date;
  readinessService?: CapabilityAutopilotReadinessLike;
  diagnosisService?: CapabilityAutopilotDiagnosisLike;
  repairPlannerService?: CapabilityAutopilotRepairPlannerLike;
};

export class CapabilityAutopilotReceiptService {
  private readonly now: () => Date;
  private readonly readinessService: CapabilityAutopilotReadinessLike;
  private readonly diagnosisService: CapabilityAutopilotDiagnosisLike;
  private readonly repairPlannerService: CapabilityAutopilotRepairPlannerLike;

  constructor(runtime: CapabilityAutopilotReceiptRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.readinessService = runtime.readinessService || new CapabilityAutopilotReadinessService();
    this.diagnosisService = runtime.diagnosisService || new CapabilityAutopilotDiagnosisService({
      readinessService: this.readinessService,
    });
    this.repairPlannerService = runtime.repairPlannerService || new CapabilityAutopilotRepairPlannerService({
      readinessService: this.readinessService,
      diagnosisService: this.diagnosisService,
    });
  }

  public async buildCapabilityReceipt(
    capabilityId: string,
    options: CapabilityReceiptBuildOptions = {},
  ): Promise<CapabilityReceipt> {
    const descriptor = this.readinessService.getOperationalDescriptor(capabilityId);
    const readiness = await this.readinessService.buildReadinessSnapshot(capabilityId);
    const diagnosis = this.diagnosisService.diagnoseReadiness(readiness, descriptor);
    const repairPlan = this.repairPlannerService.planFromDiagnosis(diagnosis, {
      descriptor,
      readiness,
      resumeIntent: options.resumeIntent || null,
    });

    return this.buildReceiptFromParts({
      descriptor,
      readiness,
      diagnosis,
      repairPlan,
      validation: options.validation || null,
      resumeIntent: options.resumeIntent || null,
      surface: options.surface,
      audience: options.audience,
    });
  }

  public buildReceiptFromParts(parts: CapabilityReceiptParts): CapabilityReceipt {
    const generatedAt = this.now().toISOString();
    const capabilityId =
      parts.descriptor?.capabilityId ||
      parts.readiness?.capabilityId ||
      parts.diagnosis?.capabilityId ||
      parts.repairPlan?.capabilityId ||
      parts.validation?.capabilityId ||
      'unknown';
    const capabilityLabel = parts.descriptor?.label || capabilityId;
    const surface = parts.surface || parts.resumeIntent?.surface || 'chat';
    const audience = parts.audience || parts.resumeIntent?.audience || 'everyday_user';
    const stage = this.resolveStage(parts);
    const timeline = this.buildTimeline(parts, generatedAt);

    return {
      receiptId: this.buildReceiptId(capabilityId, generatedAt),
      generatedAt,
      stage,
      surface,
      audience,
      capabilityId,
      capabilityLabel,
      headline: this.buildHeadline(capabilityLabel, parts, stage, audience),
      userSummary: this.buildUserSummary(capabilityLabel, parts),
      technicalSummary: this.buildTechnicalSummary(capabilityLabel, parts),
      trustLevel: parts.repairPlan?.trustLevelRequired || 'protected',
      readiness: parts.readiness || null,
      diagnosis: parts.diagnosis || null,
      repairPlan: parts.repairPlan || null,
      validation: parts.validation || null,
      selectedFallback: null,
      resumeIntent: parts.resumeIntent || parts.repairPlan?.resumeIntent || null,
      timeline,
      metadata: {
        phase: 'capability-autopilot-phase-5',
        readOnly: true,
        receiptAudience: audience,
        receiptSurface: surface,
        timelineLength: timeline.length,
      },
    };
  }

  private resolveStage(parts: CapabilityReceiptParts): CapabilityReceiptStage {
    if (parts.validation) {
      if (parts.validation.success && (parts.resumeIntent || parts.repairPlan?.resumeIntent)) {
        return 'resume';
      }
      return parts.validation.success ? 'completed' : 'failed';
    }
    if (parts.repairPlan?.status === 'validated') {
      return parts.resumeIntent || parts.repairPlan.resumeIntent ? 'resume' : 'completed';
    }
    if (parts.repairPlan?.status === 'approval_required') {
      return 'permission';
    }
    if (parts.repairPlan?.status === 'failed' || parts.repairPlan?.status === 'cancelled') {
      return 'failed';
    }
    if (parts.repairPlan) {
      return 'repair';
    }
    if (parts.diagnosis) {
      return 'diagnosis';
    }
    if (parts.readiness) {
      return 'preflight';
    }
    return 'intent';
  }

  private buildHeadline(
    capabilityLabel: string,
    parts: CapabilityReceiptParts,
    stage: CapabilityReceiptStage,
    audience: CapabilityAutopilotAudience,
  ): string {
    if (audience === 'technical_operator') {
      return this.buildTechnicalHeadline(capabilityLabel, parts, stage);
    }

    switch (stage) {
      case 'completed':
        return `${capabilityLabel} esta pronto.`;
      case 'resume':
        return `${capabilityLabel} esta pronto; posso retomar o pedido original.`;
      case 'permission':
        return `${capabilityLabel} precisa da sua permissao antes de eu mexer nisso.`;
      case 'repair':
        return `${capabilityLabel} tem um plano de reparo para revisar.`;
      case 'failed':
        return `${capabilityLabel} ainda nao conseguiu ficar pronto.`;
      case 'diagnosis':
        return parts.diagnosis?.narratives.find((entry) => entry.audience === 'everyday_user')?.headline ||
          `${capabilityLabel} precisa de diagnostico.`;
      case 'preflight':
        return parts.readiness?.summary || `${capabilityLabel} esta em preflight.`;
      default:
        return `Vou preparar ${capabilityLabel}.`;
    }
  }

  private buildTechnicalHeadline(
    capabilityLabel: string,
    parts: CapabilityReceiptParts,
    stage: CapabilityReceiptStage,
  ): string {
    const readiness = parts.readiness?.status || 'n/a';
    const failure = parts.diagnosis?.failureKind || 'n/a';
    const plan = parts.repairPlan?.status || 'n/a';
    return `${capabilityLabel}: stage=${stage}; readiness=${readiness}; failure=${failure}; plan=${plan}`;
  }

  private buildUserSummary(
    capabilityLabel: string,
    parts: CapabilityReceiptParts,
  ): string {
    if (parts.validation) {
      return parts.validation.success
        ? `${capabilityLabel} foi validado com sucesso.`
        : `${capabilityLabel} falhou na validacao: ${parts.validation.summary}`;
    }

    const everydayNarrative = parts.diagnosis?.narratives.find((entry) => entry.audience === 'everyday_user');
    const permissionCount = parts.repairPlan?.permissionRequirements.length || 0;
    const fallbackCount = parts.repairPlan?.fallbackOptions.length || 0;
    const resumeHint = parts.resumeIntent || parts.repairPlan?.resumeIntent
      ? ' Depois da validacao, eu consigo retomar exatamente o pedido original.'
      : '';

    if (parts.repairPlan?.status === 'validated') {
      return `${capabilityLabel} ja esta pronto para continuar.${resumeHint}`;
    }

    if (parts.repairPlan?.status === 'approval_required') {
      return [
        everydayNarrative?.explanation || parts.repairPlan.summary,
        `Antes de qualquer acao, preciso de ${permissionCount} permissao(oes) com escopo claro.`,
        fallbackCount > 0 ? `Tambem tenho ${fallbackCount} alternativa(s), mas nenhuma sera usada escondida.` : null,
        resumeHint.trim() || null,
      ].filter(Boolean).join(' ');
    }

    if (parts.repairPlan) {
      return [
        everydayNarrative?.explanation || parts.repairPlan.summary,
        'Este e apenas um plano; nada foi executado ainda.',
        resumeHint.trim() || null,
      ].filter(Boolean).join(' ');
    }

    if (everydayNarrative) {
      return everydayNarrative.explanation;
    }

    return parts.readiness?.detail || `${capabilityLabel} ainda nao tem detalhe suficiente.`;
  }

  private buildTechnicalSummary(
    capabilityLabel: string,
    parts: CapabilityReceiptParts,
  ): string {
    const technicalNarrative = parts.diagnosis?.narratives.find((entry) => entry.audience === 'technical_operator');
    const lines = [
      `capability=${parts.descriptor?.capabilityId || parts.readiness?.capabilityId || capabilityLabel}`,
      `label=${capabilityLabel}`,
      parts.readiness ? `readiness=${parts.readiness.status}; ready=${parts.readiness.ready}; safeToRun=${parts.readiness.safeToRun}` : null,
      parts.diagnosis ? `diagnosis=${parts.diagnosis.failureKind}; confidence=${parts.diagnosis.confidence}; repairable=${parts.diagnosis.repairable}` : null,
      parts.repairPlan ? `repairPlan=${parts.repairPlan.status}; risk=${parts.repairPlan.riskLevel}; trust=${parts.repairPlan.trustLevelRequired}; permissions=${parts.repairPlan.permissionRequirements.length}; steps=${parts.repairPlan.steps.length}; fallbacks=${parts.repairPlan.fallbackOptions.length}` : null,
      parts.validation ? `validation=${parts.validation.success}; results=${parts.validation.results.length}` : null,
      technicalNarrative?.technicalDetail ? `detail=${technicalNarrative.technicalDetail}` : null,
    ];

    return lines.filter(Boolean).join(' | ');
  }

  private buildTimeline(
    parts: CapabilityReceiptParts,
    generatedAt: string,
  ): CapabilityReceiptTimelineEntry[] {
    const entries: CapabilityReceiptTimelineEntry[] = [];

    if (parts.resumeIntent) {
      entries.push(this.timeline(generatedAt, 'intent', 'completed', 'Pedido original preservado.', parts.resumeIntent.rawText));
    }

    if (parts.readiness) {
      entries.push(this.timeline(
        parts.readiness.generatedAt || generatedAt,
        'preflight',
        parts.readiness.ready ? 'completed' : 'blocked',
        parts.readiness.summary,
        parts.readiness.detail,
      ));
    }

    if (parts.diagnosis) {
      entries.push(this.timeline(
        parts.diagnosis.generatedAt || generatedAt,
        'diagnosis',
        parts.diagnosis.repairable ? 'completed' : (parts.diagnosis.status === 'ready' ? 'skipped' : 'blocked'),
        parts.diagnosis.rootCause,
        `failureKind=${parts.diagnosis.failureKind}; confidence=${parts.diagnosis.confidence}`,
      ));
    }

    if (parts.repairPlan) {
      entries.push(this.timeline(
        parts.repairPlan.createdAt || generatedAt,
        parts.repairPlan.status === 'approval_required' ? 'permission' : 'repair',
        this.mapRepairPlanTimelineStatus(parts.repairPlan.status),
        parts.repairPlan.summary,
        `risk=${parts.repairPlan.riskLevel}; permissions=${parts.repairPlan.permissionRequirements.length}; validators=${parts.repairPlan.validators.length}`,
      ));
    }

    if (parts.validation) {
      entries.push(this.timeline(
        parts.validation.generatedAt || generatedAt,
        'validation',
        parts.validation.success ? 'completed' : 'failed',
        parts.validation.summary,
        `results=${parts.validation.results.length}`,
      ));
    }

    return entries;
  }

  private mapRepairPlanTimelineStatus(
    status: CapabilityRepairPlan['status'],
  ): CapabilityReceiptTimelineEntry['status'] {
    switch (status) {
      case 'validated':
        return 'completed';
      case 'approval_required':
      case 'proposed':
        return 'pending';
      case 'running':
        return 'running';
      case 'failed':
      case 'cancelled':
        return 'failed';
      case 'approved':
        return 'completed';
      default:
        return 'pending';
    }
  }

  private timeline(
    at: string,
    stage: CapabilityReceiptStage,
    status: CapabilityReceiptTimelineEntry['status'],
    summary: string,
    detail?: string | null,
  ): CapabilityReceiptTimelineEntry {
    return {
      at,
      stage,
      status,
      summary,
      detail: detail || null,
    };
  }

  private buildReceiptId(capabilityId: string, generatedAt: string): string {
    const safeCapabilityId = String(capabilityId || 'unknown')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_.-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'unknown';
    return `${safeCapabilityId}-receipt-${generatedAt.replace(/[^0-9a-z]+/gi, '')}`;
  }
}
