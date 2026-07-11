import { createHash } from 'crypto';
import type {
  CapabilityMemoryOutcome,
  CapabilityMemoryRecord,
  CapabilityMemorySignal,
  CapabilityReceipt,
  CapabilityRepairRunResult,
  CapabilityReplayFrame,
  CapabilityValidationResult,
  OriginalIntentEnvelope,
} from '../contracts/CapabilityAutopilotContract.js';

export type CapabilityAutopilotMemoryReplayInput = {
  receipt: CapabilityReceipt;
  validation?: CapabilityValidationResult | null;
  repairRun?: CapabilityRepairRunResult | null;
  rawIntentText?: string | null;
  workspace?: string | null;
};

export type CapabilityAutopilotMemoryReplaySummary = {
  generatedAt: string;
  totalRecords: number;
  outcomeCounts: Record<CapabilityMemoryOutcome, number>;
  failureCounts: Record<string, number>;
  replayableCount: number;
  lastRecommendedAction: string | null;
};

export type CapabilityAutopilotMemoryReplayRuntime = {
  now?: () => Date;
};

export class CapabilityAutopilotMemoryReplayService {
  private readonly now: () => Date;

  constructor(runtime: CapabilityAutopilotMemoryReplayRuntime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public buildMemoryRecord(input: CapabilityAutopilotMemoryReplayInput): CapabilityMemoryRecord {
    const generatedAt = this.now().toISOString();
    const receipt = input.receipt;
    const validation = input.validation || receipt.validation || null;
    const resumeIntent = receipt.resumeIntent || receipt.repairPlan?.resumeIntent || null;
    const outcome = this.resolveOutcome(receipt, validation, input.repairRun || null);
    const signals = this.buildSignals(receipt, validation, input.repairRun || null);
    const workspace = this.resolveWorkspace(input.workspace, resumeIntent);
    const rawIntent = input.rawIntentText || resumeIntent?.normalizedText || resumeIntent?.rawText || null;

    return {
      memoryId: this.buildMemoryId(receipt, generatedAt),
      generatedAt,
      capabilityId: receipt.capabilityId,
      capabilityLabel: receipt.capabilityLabel,
      workspaceHash: workspace ? this.hashValue('workspace', workspace) : null,
      intentFingerprint: rawIntent ? this.hashValue('intent', this.normalizeIntent(rawIntent)) : null,
      outcome,
      stage: receipt.stage,
      failureKind: receipt.diagnosis?.failureKind || null,
      readinessStatus: receipt.readiness?.status || null,
      permissionCount: receipt.repairPlan?.permissionRequirements.length || 0,
      fallbackCount: receipt.repairPlan?.fallbackOptions.length || (receipt.selectedFallback ? 1 : 0),
      signals,
      lesson: this.buildLesson(receipt, outcome, validation),
      replayable: this.isReplayable(outcome, signals),
      privacy: {
        rawIntentStored: false,
        rawWorkspaceStored: false,
        redacted: true,
      },
      source: {
        receiptId: receipt.receiptId,
        repairPlanId: receipt.repairPlan?.repairPlanId || null,
        validationGeneratedAt: validation?.generatedAt || null,
      },
      metadata: {
        gate: 'capability-autopilot-memory-replay',
        signalCount: signals.length,
        hasWorkspaceHash: Boolean(workspace),
        hasIntentFingerprint: Boolean(rawIntent),
        repairRunStatus: input.repairRun?.status || null,
      },
    };
  }

  public buildReplayFrame(record: CapabilityMemoryRecord): CapabilityReplayFrame {
    return {
      replayId: `${record.memoryId}-replay-${this.safeTimestamp(this.now().toISOString())}`,
      generatedAt: this.now().toISOString(),
      capabilityId: record.capabilityId,
      outcome: record.outcome,
      replayable: record.replayable,
      recommendedNextAction: this.recommendedNextAction(record),
      safeSummary: record.lesson,
      signals: record.signals.map((signal) => ({ ...signal })),
      sourceMemoryId: record.memoryId,
    };
  }

  public summarizeRecords(records: CapabilityMemoryRecord[]): CapabilityAutopilotMemoryReplaySummary {
    const outcomeCounts = this.emptyOutcomeCounts();
    const failureCounts: Record<string, number> = {};
    let lastRecommendedAction: string | null = null;

    for (const record of records) {
      outcomeCounts[record.outcome] += 1;
      const failure = record.failureKind || 'none';
      failureCounts[failure] = (failureCounts[failure] || 0) + 1;
      lastRecommendedAction = this.recommendedNextAction(record);
    }

    return {
      generatedAt: this.now().toISOString(),
      totalRecords: records.length,
      outcomeCounts,
      failureCounts,
      replayableCount: records.filter((record) => record.replayable).length,
      lastRecommendedAction,
    };
  }

  private resolveOutcome(
    receipt: CapabilityReceipt,
    validation: CapabilityValidationResult | null,
    repairRun: CapabilityRepairRunResult | null,
  ): CapabilityMemoryOutcome {
    if (receipt.selectedFallback) {
      return 'fallback_selected';
    }
    if (validation?.success || receipt.stage === 'resume' || receipt.stage === 'completed') {
      return 'ready';
    }
    if (receipt.stage === 'failed' || validation?.success === false || repairRun?.status === 'failed') {
      return 'failed';
    }
    if (receipt.stage === 'permission') {
      return 'permission_required';
    }
    return 'needs_repair';
  }

  private buildSignals(
    receipt: CapabilityReceipt,
    validation: CapabilityValidationResult | null,
    repairRun: CapabilityRepairRunResult | null,
  ): CapabilityMemorySignal[] {
    const signals: CapabilityMemorySignal[] = [];

    if (receipt.readiness) {
      signals.push(this.signal(
        'readiness',
        'readiness',
        `${receipt.readiness.status}: ${receipt.readiness.summary}`,
        receipt.readiness.ready && receipt.readiness.safeToRun ? 1 : 4,
        {
          status: receipt.readiness.status,
          severity: receipt.readiness.severity,
          ready: receipt.readiness.ready,
          safeToRun: receipt.readiness.safeToRun,
          missingRequirements: receipt.readiness.missingRequirements.length,
        },
      ));
    }

    if (receipt.diagnosis) {
      signals.push(this.signal(
        'diagnosis',
        'diagnosis',
        `${receipt.diagnosis.failureKind}: ${receipt.diagnosis.rootCause}`,
        receipt.diagnosis.repairable ? 3 : 5,
        {
          failureKind: receipt.diagnosis.failureKind,
          confidence: receipt.diagnosis.confidence,
          repairable: receipt.diagnosis.repairable,
          requiresUserInput: receipt.diagnosis.requiresUserInput,
        },
      ));
    }

    if (receipt.repairPlan?.permissionRequirements.length) {
      signals.push(this.signal(
        'permission',
        'permission',
        `${receipt.repairPlan.permissionRequirements.length} permission requirement(s) before repair.`,
        5,
        {
          permissionCount: receipt.repairPlan.permissionRequirements.length,
          maxRiskLevel: Math.max(...receipt.repairPlan.permissionRequirements.map((item) => item.riskLevel)),
          trustLevelRequired: receipt.repairPlan.trustLevelRequired,
        },
      ));
    }

    if (receipt.repairPlan) {
      signals.push(this.signal(
        'repair',
        'repair',
        `${receipt.repairPlan.status}: ${receipt.repairPlan.summary}`,
        receipt.repairPlan.status === 'validated' ? 1 : 3,
        {
          repairPlanStatus: receipt.repairPlan.status,
          stepCount: receipt.repairPlan.steps.length,
          validatorCount: receipt.repairPlan.validators.length,
          fallbackCount: receipt.repairPlan.fallbackOptions.length,
        },
      ));
    }

    if (repairRun) {
      signals.push(this.signal(
        'repair-run',
        'repair',
        `${repairRun.status}: ${repairRun.steps.length} repair step result(s).`,
        repairRun.status === 'completed' ? 1 : 4,
        {
          repairRunStatus: repairRun.status,
          dryRun: repairRun.dryRun,
          approved: repairRun.approved,
          permissionStatus: repairRun.permissionStatus,
          stepCount: repairRun.steps.length,
        },
      ));
    }

    if (validation) {
      signals.push(this.signal(
        'validation',
        'validation',
        `${validation.success ? 'passed' : 'failed'}: ${validation.summary}`,
        validation.success ? 1 : 5,
        {
          success: validation.success,
          resultCount: validation.results.length,
          readinessStatus: validation.readiness?.status || null,
        },
      ));
    }

    if (receipt.selectedFallback || receipt.repairPlan?.fallbackOptions.length) {
      signals.push(this.signal(
        'fallback',
        'fallback',
        receipt.selectedFallback
          ? `Fallback selected: ${receipt.selectedFallback.label}`
          : `${receipt.repairPlan?.fallbackOptions.length || 0} fallback option(s) available.`,
        receipt.selectedFallback ? 2 : 3,
        {
          selectedFallbackId: receipt.selectedFallback?.id || null,
          fallbackCount: receipt.repairPlan?.fallbackOptions.length || (receipt.selectedFallback ? 1 : 0),
        },
      ));
    }

    signals.push(this.signal(
      'surface',
      'surface',
      `Observed on ${receipt.surface} for ${receipt.audience}.`,
      1,
      {
        surface: receipt.surface,
        audience: receipt.audience,
        stage: receipt.stage,
      },
    ));

    return signals;
  }

  private signal(
    id: string,
    kind: CapabilityMemorySignal['kind'],
    summary: string,
    weight: number,
    metadata: Record<string, unknown>,
  ): CapabilityMemorySignal {
    return {
      id,
      kind,
      summary,
      weight,
      metadata,
    };
  }

  private buildLesson(
    receipt: CapabilityReceipt,
    outcome: CapabilityMemoryOutcome,
    validation: CapabilityValidationResult | null,
  ): string {
    const label = receipt.capabilityLabel || receipt.capabilityId;
    const failure = receipt.diagnosis?.failureKind || receipt.readiness?.status || 'unknown';

    switch (outcome) {
      case 'ready':
        return `${label} can resume when readiness and validation are green.`;
      case 'permission_required':
        return `${label} needs explicit permission before repair; keep the original intent parked.`;
      case 'fallback_selected':
        return `${label} used an explicit fallback selected by the user.`;
      case 'failed':
        return `${label} failed validation (${validation?.summary || failure}); prefer fallback or manual operator review.`;
      case 'needs_repair':
      default:
        return `${label} needs repair planning for ${failure}; keep diagnostics preview-first.`;
    }
  }

  private recommendedNextAction(record: CapabilityMemoryRecord): string {
    switch (record.outcome) {
      case 'ready':
        return 'resume_original_intent_after_readiness_check';
      case 'permission_required':
        return 'ask_for_explicit_approval_with_scoped_permissions';
      case 'fallback_selected':
        return 'continue_selected_fallback_with_audit_receipt';
      case 'failed':
        return 'offer_visible_fallback_or_manual_operator_review';
      case 'needs_repair':
      default:
        return 'rebuild_preview_first_repair_plan';
    }
  }

  private isReplayable(
    outcome: CapabilityMemoryOutcome,
    signals: CapabilityMemorySignal[],
  ): boolean {
    return signals.length > 0 && outcome !== 'failed';
  }

  private resolveWorkspace(
    explicitWorkspace: string | null | undefined,
    resumeIntent: OriginalIntentEnvelope | null,
  ): string | null {
    return explicitWorkspace ||
      resumeIntent?.workspace ||
      resumeIntent?.executionRequest?.workspace ||
      resumeIntent?.task?.workspace ||
      resumeIntent?.plan?.workspace_recommendation ||
      null;
  }

  private normalizeIntent(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  private hashValue(namespace: string, value: string): string {
    return createHash('sha256')
      .update(`${namespace}:${value}`, 'utf8')
      .digest('hex');
  }

  private buildMemoryId(receipt: CapabilityReceipt, generatedAt: string): string {
    return `${this.safeId(receipt.capabilityId)}-memory-${this.hashValue(
      'memory',
      `${receipt.receiptId}:${generatedAt}`,
    ).slice(0, 16)}`;
  }

  private emptyOutcomeCounts(): Record<CapabilityMemoryOutcome, number> {
    return {
      ready: 0,
      permission_required: 0,
      needs_repair: 0,
      fallback_selected: 0,
      failed: 0,
    };
  }

  private safeId(value: string): string {
    return String(value || 'capability')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_.-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'capability';
  }

  private safeTimestamp(value: string): string {
    return value.replace(/[^0-9a-z]+/gi, '');
  }
}
