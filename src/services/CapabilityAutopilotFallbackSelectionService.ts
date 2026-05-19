import type {
  CapabilityAutopilotAudience,
  CapabilityAutopilotSurface,
  CapabilityFallbackOption,
  CapabilityReceipt,
  CapabilityRepairPlan,
  OriginalIntentEnvelope,
} from '../contracts/CapabilityAutopilotContract.js';

export type CapabilityFallbackCandidate = {
  id: string;
  label: string;
  executorName: string | null;
  capabilityId: string | null;
  reason: string;
  requiresPermission: boolean;
  policyAllowed: boolean | null;
  selectable: boolean;
  explicitUserActionRequired: true;
  blockedReason: string | null;
};

export type CapabilityFallbackSelectionStatus =
  | 'available'
  | 'no_options'
  | 'selected'
  | 'requires_permission'
  | 'policy_blocked'
  | 'not_found';

export type CapabilityFallbackMenuInput = {
  receipt?: CapabilityReceipt | null;
  repairPlan?: CapabilityRepairPlan | null;
  surface?: CapabilityAutopilotSurface;
  audience?: CapabilityAutopilotAudience;
};

export type CapabilityFallbackSelectionInput = CapabilityFallbackMenuInput & {
  fallbackId: string;
  requestedBy?: string | null;
};

export type CapabilityFallbackSelectionResult = {
  generatedAt: string;
  status: CapabilityFallbackSelectionStatus;
  capabilityId: string;
  repairPlanId: string | null;
  requestedFallbackId?: string | null;
  selectedFallback: CapabilityFallbackOption | null;
  candidates: CapabilityFallbackCandidate[];
  receipt: CapabilityReceipt | null;
  nextIntent: OriginalIntentEnvelope | null;
  summary: string;
  technicalSummary: string;
  metadata: Record<string, unknown>;
};

export type CapabilityAutopilotFallbackSelectionRuntime = {
  now?: () => Date;
};

export class CapabilityAutopilotFallbackSelectionService {
  private readonly now: () => Date;

  constructor(runtime: CapabilityAutopilotFallbackSelectionRuntime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public buildFallbackMenu(input: CapabilityFallbackMenuInput): CapabilityFallbackSelectionResult {
    const generatedAt = this.now().toISOString();
    const repairPlan = this.resolveRepairPlan(input);
    const candidates = this.buildCandidates(repairPlan);
    const capabilityId = repairPlan?.capabilityId || input.receipt?.capabilityId || 'unknown';
    const status: CapabilityFallbackSelectionStatus = candidates.length > 0 ? 'available' : 'no_options';

    return {
      generatedAt,
      status,
      capabilityId,
      repairPlanId: repairPlan?.repairPlanId || null,
      requestedFallbackId: null,
      selectedFallback: null,
      candidates,
      receipt: input.receipt || null,
      nextIntent: null,
      summary: this.buildMenuSummary(candidates, input.audience || input.receipt?.audience || 'everyday_user'),
      technicalSummary: `fallbacks=${candidates.length}; selectable=${candidates.filter((entry) => entry.selectable).length}`,
      metadata: {
        phase: 'capability-autopilot-checkpoint-65',
        explicitSelectionRequired: true,
        autoFallbackExecuted: false,
        surface: input.surface || input.receipt?.surface || null,
      },
    };
  }

  public selectFallback(input: CapabilityFallbackSelectionInput): CapabilityFallbackSelectionResult {
    const generatedAt = this.now().toISOString();
    const repairPlan = this.resolveRepairPlan(input);
    const candidates = this.buildCandidates(repairPlan);
    const capabilityId = repairPlan?.capabilityId || input.receipt?.capabilityId || 'unknown';
    const candidate = candidates.find((entry) => entry.id === input.fallbackId) || null;

    if (!repairPlan || candidates.length === 0) {
      return this.result({
        generatedAt,
        status: 'no_options',
        capabilityId,
        repairPlan,
        requestedFallbackId: input.fallbackId,
        selectedFallback: null,
        candidates,
        receipt: input.receipt || null,
        nextIntent: null,
        summary: 'Nao ha fallback disponivel para este plano.',
        technicalSummary: 'fallback_selection=no_options',
        requestedBy: input.requestedBy || null,
      });
    }

    if (!candidate) {
      return this.result({
        generatedAt,
        status: 'not_found',
        capabilityId,
        repairPlan,
        requestedFallbackId: input.fallbackId,
        selectedFallback: null,
        candidates,
        receipt: input.receipt || null,
        nextIntent: null,
        summary: `Fallback '${input.fallbackId}' nao existe neste plano.`,
        technicalSummary: `fallback_selection=not_found; requested=${input.fallbackId}`,
        requestedBy: input.requestedBy || null,
      });
    }

    const selectedFallback = repairPlan.fallbackOptions.find((entry) => entry.id === candidate.id) || null;
    if (!selectedFallback || !candidate.selectable) {
      return this.result({
        generatedAt,
        status: 'policy_blocked',
        capabilityId,
        repairPlan,
        requestedFallbackId: input.fallbackId,
        selectedFallback: null,
        candidates,
        receipt: this.buildSelectionReceipt(input.receipt || null, repairPlan, null, generatedAt, 'blocked'),
        nextIntent: null,
        summary: candidate.blockedReason || `Fallback '${candidate.label}' esta bloqueado pela policy.`,
        technicalSummary: `fallback_selection=policy_blocked; id=${candidate.id}; policyAllowed=${candidate.policyAllowed}`,
        requestedBy: input.requestedBy || null,
      });
    }

    const status: CapabilityFallbackSelectionStatus = selectedFallback.requiresPermission
      ? 'requires_permission'
      : 'selected';
    const nextIntent = this.buildFallbackIntent(repairPlan, selectedFallback, input.receipt || null, generatedAt);

    return this.result({
      generatedAt,
      status,
      capabilityId,
      repairPlan,
      requestedFallbackId: input.fallbackId,
      selectedFallback,
      candidates,
      receipt: this.buildSelectionReceipt(input.receipt || null, repairPlan, selectedFallback, generatedAt, status),
      nextIntent,
      summary: this.buildSelectionSummary(selectedFallback, status),
      technicalSummary: [
        `fallback_selection=${status}`,
        `id=${selectedFallback.id}`,
        selectedFallback.executorName ? `executor=${selectedFallback.executorName}` : null,
        selectedFallback.capabilityId ? `capability=${selectedFallback.capabilityId}` : null,
        `requiresPermission=${selectedFallback.requiresPermission}`,
      ].filter(Boolean).join('; '),
      requestedBy: input.requestedBy || null,
    });
  }

  private resolveRepairPlan(input: CapabilityFallbackMenuInput): CapabilityRepairPlan | null {
    return input.repairPlan || input.receipt?.repairPlan || null;
  }

  private buildCandidates(repairPlan: CapabilityRepairPlan | null): CapabilityFallbackCandidate[] {
    return (repairPlan?.fallbackOptions || []).map((fallback) => {
      const policyBlocked = fallback.policyAllowed === false;
      return {
        id: fallback.id,
        label: fallback.label,
        executorName: fallback.executorName || null,
        capabilityId: fallback.capabilityId || null,
        reason: fallback.reason,
        requiresPermission: fallback.requiresPermission,
        policyAllowed: fallback.policyAllowed,
        selectable: !policyBlocked,
        explicitUserActionRequired: true,
        blockedReason: policyBlocked
          ? `Fallback '${fallback.label}' bloqueado pela policy atual.`
          : null,
      };
    });
  }

  private buildFallbackIntent(
    repairPlan: CapabilityRepairPlan,
    selectedFallback: CapabilityFallbackOption,
    receipt: CapabilityReceipt | null,
    generatedAt: string,
  ): OriginalIntentEnvelope | null {
    const original = repairPlan.resumeIntent || receipt?.resumeIntent || null;
    if (!original) {
      return null;
    }

    return {
      ...original,
      intentId: `${original.intentId || repairPlan.repairPlanId}-fallback-${selectedFallback.id}`,
      createdAt: generatedAt,
      requestedCapabilityId: selectedFallback.capabilityId || original.requestedCapabilityId || repairPlan.capabilityId,
      requestedExecutorName: selectedFallback.executorName || original.requestedExecutorName || null,
      metadata: {
        ...(original.metadata || {}),
        fallbackSelected: true,
        fallbackId: selectedFallback.id,
        fallbackLabel: selectedFallback.label,
        previousCapabilityId: repairPlan.capabilityId,
        previousExecutorName: original.requestedExecutorName || null,
      },
    };
  }

  private buildSelectionReceipt(
    receipt: CapabilityReceipt | null,
    repairPlan: CapabilityRepairPlan,
    selectedFallback: CapabilityFallbackOption | null,
    generatedAt: string,
    status: CapabilityFallbackSelectionStatus | 'blocked',
  ): CapabilityReceipt | null {
    if (!receipt) {
      return null;
    }

    const timelineStatus = status === 'policy_blocked' || status === 'blocked'
      ? 'blocked'
      : (status === 'requires_permission' ? 'pending' : 'completed');

    return {
      ...receipt,
      generatedAt,
      phase: 'fallback',
      repairPlan,
      selectedFallback,
      timeline: [
        ...receipt.timeline,
        {
          at: generatedAt,
          phase: 'fallback',
          status: timelineStatus,
          summary: selectedFallback
            ? `Fallback escolhido: ${selectedFallback.label}.`
            : 'Fallback nao selecionado.',
          detail: selectedFallback
            ? `requiresPermission=${selectedFallback.requiresPermission}; policyAllowed=${selectedFallback.policyAllowed}`
            : `status=${status}`,
        },
      ],
      metadata: {
        ...(receipt.metadata || {}),
        phase: 'capability-autopilot-checkpoint-65',
        fallbackSelectionRecorded: Boolean(selectedFallback),
        autoFallbackExecuted: false,
      },
    };
  }

  private buildMenuSummary(
    candidates: CapabilityFallbackCandidate[],
    audience: CapabilityAutopilotAudience,
  ): string {
    if (candidates.length === 0) {
      return 'Nao encontrei uma alternativa segura para esta capability ainda.';
    }
    const selectable = candidates.filter((entry) => entry.selectable).length;
    if (audience === 'technical_operator') {
      return `${selectable}/${candidates.length} fallback(s) selectable; explicit selection required.`;
    }
    return `Tenho ${selectable} alternativa(s) possivel(is), mas so uso uma delas se voce escolher.`;
  }

  private buildSelectionSummary(
    selectedFallback: CapabilityFallbackOption,
    status: CapabilityFallbackSelectionStatus,
  ): string {
    if (status === 'requires_permission') {
      return `Fallback '${selectedFallback.label}' foi escolhido, mas ainda precisa de permissao antes de executar.`;
    }
    return `Fallback '${selectedFallback.label}' foi escolhido e pode seguir para validacao/execucao governada.`;
  }

  private result(input: {
    generatedAt: string;
    status: CapabilityFallbackSelectionStatus;
    capabilityId: string;
    repairPlan: CapabilityRepairPlan | null;
    requestedFallbackId: string | null;
    selectedFallback: CapabilityFallbackOption | null;
    candidates: CapabilityFallbackCandidate[];
    receipt: CapabilityReceipt | null;
    nextIntent: OriginalIntentEnvelope | null;
    summary: string;
    technicalSummary: string;
    requestedBy: string | null;
  }): CapabilityFallbackSelectionResult {
    return {
      generatedAt: input.generatedAt,
      status: input.status,
      capabilityId: input.capabilityId,
      repairPlanId: input.repairPlan?.repairPlanId || null,
      requestedFallbackId: input.requestedFallbackId,
      selectedFallback: input.selectedFallback,
      candidates: input.candidates,
      receipt: input.receipt,
      nextIntent: input.nextIntent,
      summary: input.summary,
      technicalSummary: input.technicalSummary,
      metadata: {
        phase: 'capability-autopilot-checkpoint-65',
        explicitSelectionRequired: true,
        autoFallbackExecuted: false,
        requestedBy: input.requestedBy,
      },
    };
  }
}
