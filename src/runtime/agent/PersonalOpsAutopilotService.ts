import { queryUniversalAgentRuns } from './RunObservatory.js';
import type { UniversalAgentRun } from './UniversalAgentRuntimeTypes.js';

export const PERSONAL_OPS_AUTOPILOT_CONTRACT_VERSION = '2026-05-03.personal-ops' as const;

export type PersonalOpsAutopilotStatus = 'idle' | 'suggesting' | 'waiting-approval' | 'blocked';

export type PersonalOpsAutopilotCategory =
  | 'provider'
  | 'budget'
  | 'memory'
  | 'artifact-memory'
  | 'capability'
  | 'skill'
  | 'watch-mode'
  | 'node-mesh'
  | 'channel'
  | 'safety'
  | 'runtime'
  | 'automation';

export type PersonalOpsAutopilotSuggestion = {
  id: string;
  category: PersonalOpsAutopilotCategory;
  title: string;
  cause: string;
  impact: string;
  nextStep: string;
  severity: 'info' | 'warning' | 'danger';
  confidence: number;
  requiresApproval: boolean;
  previewAvailable: boolean;
  mutableAction: boolean;
  evidence: Array<{
    source: string;
    ref: string | null;
    detail: string;
    receiptId?: string;
  }>;
  relatedArtifactIds: string[];
  relatedToolIds: string[];
  actions: {
    previewCommand: string;
    approvalCommand: string;
    runCommand: string;
    dismissCommand: string;
  };
};

export type PersonalOpsAutopilotReceipt = {
  id: string;
  kind:
    | 'run-observatory'
    | 'natural-capability-discovery'
    | 'budget'
    | 'provider-arena'
    | 'artifact-memory'
    | 'skill-quarantine'
    | 'approval'
    | 'policy'
    | 'surface';
  source: string;
  detail: string;
  status: 'ready' | 'needs-review' | 'missing';
};

export type PersonalOpsAutopilotSnapshot = {
  contractVersion: typeof PERSONAL_OPS_AUTOPILOT_CONTRACT_VERSION;
  source: 'PersonalOpsAutopilotService';
  generatedAt: string;
  identifiers: {
    runId: string;
    traceId: string;
    requestId: string;
    sessionId: string;
  };
  status: PersonalOpsAutopilotStatus;
  summary: {
    suggestionCount: number;
    attentionCount: number;
    approvalRequiredCount: number;
    previewAvailableCount: number;
    mutableActionCount: number;
    providerIssueCount: number;
    budgetIssueCount: number;
    artifactOpportunityCount: number;
    naturalIntentObserved: boolean;
    runObservatoryLinked: boolean;
  };
  suggestions: PersonalOpsAutopilotSuggestion[];
  receipts: PersonalOpsAutopilotReceipt[];
  policy: {
    noMutableActionExecuted: true;
    noAutorepairStarted: true;
    approvalsRequiredForMutation: true;
    previewBeforeAutorepair: true;
    naturalLanguageDoesNotBypassPolicy: true;
    usesReceiptsForSuggestions: true;
    secretsSerialized: false;
  };
  surface: {
    cliCommand: string;
    zavorthControlPath: string;
    previewHint: string;
    approvalHint: string;
  };
  nextSafeAction: string;
};

export type PersonalOpsAutopilotInput = {
  run: UniversalAgentRun;
  generatedAt?: string | null;
};

type LooseRecord = Record<string, unknown>;

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizeKey(value: unknown, fallback = 'ops'): string {
  return normalizeText(value, fallback)
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, '-')
    .replace(/^-+|-+$/g, '') || fallback;
}

function recordOrNull(value: unknown): LooseRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as LooseRecord
    : null;
}

function listRecords(value: unknown): LooseRecord[] {
  return Array.isArray(value)
    ? value.flatMap((entry) => {
      const record = recordOrNull(entry);
      return record ? [record] : [];
    })
    : [];
}

function listStrings(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(new Set(value.map((entry) => normalizeText(entry)).filter(Boolean)));
}

function numberOrNull(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function redactText(value: unknown, fallback = '', maxLength = 260): string {
  const text = normalizeText(value, fallback)
    .replace(/((?:api[_-]...key|token|secret|password)\s*[:=]\s*)\S+/gi, '$1[redacted]')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

function severityRank(severity: PersonalOpsAutopilotSuggestion['severity']): number {
  if (severity === 'danger') {
    return 3;
  }
  if (severity === 'warning') {
    return 2;
  }
  return 1;
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) {
    return 0.5;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return Number(value.toFixed(2));
}

export class PersonalOpsAutopilotService {
  private readonly now: () => Date;

  constructor(options: { now?: () => Date } = {}) {
    this.now = options.now || (() => new Date());
  }

  public buildSnapshot(input: PersonalOpsAutopilotInput): PersonalOpsAutopilotSnapshot {
    const { run } = input;
    const generatedAt = normalizeText(input.generatedAt, this.now().toISOString());
    const observatory = queryUniversalAgentRuns({
      runs: [run],
      query: {
        runId: run.id,
        limit: 1,
      },
      generatedAt,
    });
    const suggestions = this.buildSuggestions(run, observatory.receipts.length > 0)
      .sort((left, right) => severityRank(right.severity) - severityRank(left.severity))
      .slice(0, 12);
    const status = this.resolveStatus(run, suggestions);
    const receipts = this.buildReceipts(run, suggestions, observatory.receipts.length);

    return {
      contractVersion: PERSONAL_OPS_AUTOPILOT_CONTRACT_VERSION,
      source: 'PersonalOpsAutopilotService',
      generatedAt,
      identifiers: {
        runId: run.id,
        traceId: run.traceId,
        requestId: run.requestId,
        sessionId: run.sessionId,
      },
      status,
      summary: {
        suggestionCount: suggestions.length,
        attentionCount: suggestions.filter((suggestion) => suggestion.severity !== 'info').length,
        approvalRequiredCount: suggestions.filter((suggestion) => suggestion.requiresApproval).length,
        previewAvailableCount: suggestions.filter((suggestion) => suggestion.previewAvailable).length,
        mutableActionCount: suggestions.filter((suggestion) => suggestion.mutableAction).length,
        providerIssueCount: suggestions.filter((suggestion) => suggestion.category === 'provider').length,
        budgetIssueCount: suggestions.filter((suggestion) => suggestion.category === 'budget').length,
        artifactOpportunityCount: suggestions.filter((suggestion) => suggestion.category === 'artifact-memory').length,
        naturalIntentObserved: Boolean(recordOrNull(run.metadata.naturalCapabilityDiscovery)),
        runObservatoryLinked: observatory.receipts.length > 0,
      },
      suggestions,
      receipts,
      policy: {
        noMutableActionExecuted: true,
        noAutorepairStarted: true,
        approvalsRequiredForMutation: true,
        previewBeforeAutorepair: true,
        naturalLanguageDoesNotBypassPolicy: true,
        usesReceiptsForSuggestions: true,
        secretsSerialized: false,
      },
      surface: {
        cliCommand: `zavorth personal-ops run ${run.id} --json`,
        zavorthControlPath: '/zavorthControl...sector=overview',
        previewHint: 'Use preview before any autorepair, reconnect, provider switch, or channel repair.',
        approvalHint: 'Mutable actions require explicit operator approval.',
      },
      nextSafeAction: this.nextSafeAction(status, suggestions),
    };
  }

  private buildSuggestions(run: UniversalAgentRun, runObservatoryLinked: boolean): PersonalOpsAutopilotSuggestion[] {
    return [
      ...this.providerSuggestions(run),
      ...this.budgetSuggestions(run),
      ...this.artifactMemorySuggestions(run),
      ...this.capabilitySuggestions(run),
      ...this.skillSuggestions(run),
      ...this.safetySuggestions(run),
      ...this.approvalSuggestions(run),
      ...this.runtimeSuggestions(run, runObservatoryLinked),
    ];
  }

  private providerSuggestions(run: UniversalAgentRun): PersonalOpsAutopilotSuggestion[] {
    const providerArena = recordOrNull(run.metadata.providerArena);
    const summary = recordOrNull(providerArena?.summary);
    const selected = recordOrNull(providerArena?.selected);
    const candidates = listRecords(providerArena?.candidates);
    const fallbackUsed = summary?.fallbackUsed === true
      || recordOrNull(run.metadata.llmRuntimeRoute)?.fallbackUsed === true;
    const readyCandidateCount = numberOrNull(summary?.readyCandidateCount) ?? candidates.filter((candidate) => candidate.ready === true).length;
    const unhealthy = candidates.filter((candidate) => normalizeText(candidate.healthStatus).toLowerCase() === 'unhealthy');
    const recommendedProvider = normalizeText(summary?.recommendedProviderLabel || selected?.providerLabel);
    const recommendedModel = normalizeText(summary?.recommendedModelLabel || selected?.modelLabel);
    if (!fallbackUsed && readyCandidateCount > 0 && unhealthy.length === 0) {
      return [];
    }
    return [
      this.suggestion({
        id: 'provider-route-review',
        category: 'provider',
        title: 'review route de provider/model',
        cause: fallbackUsed ? 'Run usou fallback ou route observada degradada.'
          : readyCandidateCount === 0
            ? 'Provider Arena did not find a ready candidate.'
            : `${unhealthy.length} candidate(s) aparecem como unhealthy.`,
        impact: 'Responses may become slower, more expensive, or fail on similar runs.',
        nextStep: recommendedProvider
          ? `Compare ${recommendedProvider}${recommendedModel ? `/${recommendedModel}` : ''} with a route configurada before trocar.`
          : 'Open Provider Arena and validate health before changing route.',
        severity: readyCandidateCount === 0 ? 'danger' : 'warning',
        confidence: providerArena ? 0.86 : 0.62,
        requiresApproval: true,
        mutableAction: true,
        evidence: [
          {
            source: 'ProviderArenaService',
            ref: 'providerArena',
            detail: redactText(summary?.decisionSource, 'Provider Arena published route evidence.'),
          },
        ],
        relatedToolIds: ['provider.route.preview'],
        run,
      }),
    ];
  }

  private budgetSuggestions(run: UniversalAgentRun): PersonalOpsAutopilotSuggestion[] {
    const budget = recordOrNull(run.metadata.runBudget);
    if (!budget) {
      return [];
    }
    const estimated = numberOrNull(budget.estimatedCostUnits);
    const max = numberOrNull(budget.maxEstimatedCostUnits);
    const degraded = budget.degraded === true
      || normalizeText(budget.status).toLowerCase() === 'exceeded'
      || (estimated !== null && max !== null && estimated > max);
    const reason = redactText(budget.reason || budget.summary || budget.policyReason);
    if (!degraded && !reason) {
      return [];
    }
    return [
      this.suggestion({
        id: 'budget-review',
        category: 'budget',
        title: 'Review run budget/cost',
        cause: reason || 'Run published a cost signal above expected.',
        impact: 'Autonomia pode consumir mais quota ou degradar provider without visibilidade.',
        nextStep: 'Open a cost-reduction preview before changing provider, model, or depth.',
        severity: degraded ? 'warning' : 'info',
        confidence: 0.82,
        requiresApproval: true,
        mutableAction: true,
        evidence: [
          {
            source: 'RunBudgetPolicy',
            ref: 'runBudget',
            detail: estimated !== null && max !== null ? `estimado=${estimated}; max=${max}` : reason || 'budget observado',
          },
        ],
        relatedToolIds: ['budget.preview'],
        run,
      }),
    ];
  }

  private artifactMemorySuggestions(run: UniversalAgentRun): PersonalOpsAutopilotSuggestion[] {
    const artifactMemory = recordOrNull(run.metadata.artifactMemory);
    if (!artifactMemory) {
      return [];
    }
    const summary = recordOrNull(artifactMemory.summary) || {};
    const status = normalizeText(artifactMemory.status).toLowerCase();
    const reusableCount = numberOrNull(summary.reusableCount) ?? 0;
    const linkedMemoryReceiptCount = numberOrNull(summary.linkedMemoryReceiptCount) ?? 0;
    const memoryEntryCount = numberOrNull(summary.memoryEntryCount) ?? 0;
    const entries = listRecords(artifactMemory.entries);
    if (reusableCount === 0 && status !== 'needs-index') {
      return [];
    }
    return [
      this.suggestion({
        id: 'artifact-memory-reuse',
        category: 'artifact-memory',
        title: status === 'needs-index' ? 'Indexar Artifact Memory with receipts' : 'Usar artifacts reutilizaveis with citaction',
        cause: status === 'needs-index'
          ? 'Artifact Memory tem entradas without indexaction completa ou receipts faltantes.'
          : `${reusableCount} artifact(s) reutilizaveis foram publicados.`,
        impact: 'Planos, diffs e reports podem ser reaproveitados without perder origem.',
        nextStep: linkedMemoryReceiptCount < memoryEntryCount ? 'Promote missing receipts only by explicit command.'
          : 'Reutilizar artifacts citando artifactId, runId e receipt.',
        severity: status === 'needs-index' ? 'warning' : 'info',
        confidence: 0.88,
        requiresApproval: status === 'needs-index',
        mutableAction: status === 'needs-index',
        evidence: entries.slice(0, 3).map((entry) => ({
          source: 'ArtifactMemoryService',
          ref: normalizeText(entry.artifactId, 'artifact'),
          detail: redactText(entry.title, 'artifact indexado'),
        })),
        relatedArtifactIds: entries.map((entry) => normalizeText(entry.artifactId)).filter(Boolean).slice(0, 6),
        relatedToolIds: ['artifact-memory.preview'],
        run,
      }),
    ];
  }

  private capabilitySuggestions(run: UniversalAgentRun): PersonalOpsAutopilotSuggestion[] {
    const discovery = recordOrNull(run.metadata.naturalCapabilityDiscovery);
    const negotiation = recordOrNull(run.metadata.capabilityNegotiation);
    const safety = recordOrNull(discovery?.safety) || {};
    const recommendations = listRecords(discovery?.recommendations);
    const negotiationStatus = normalizeText(negotiation?.status).toLowerCase();
    const approvalRequired = safety.requiresApproval === true
      || negotiationStatus === 'waiting-approval'
      || negotiationStatus === 'proposal';
    const previewRequired = safety.previewRequired === true;
    if (!approvalRequired && !previewRequired && recommendations.length === 0) {
      return [];
    }
    return [
      this.suggestion({
        id: 'capability-scope-review',
        category: 'capability',
        title: 'review escopo de capability',
        cause: approvalRequired ? 'Discovery ou Capability Negotiation indicou approval/escopo pending.'
          : 'Natural Capability Discovery encontrou capabilities candidatas.',
        impact: 'Tools can remain blocked or too broad if scope is not reviewed.',
        nextStep: 'Generate scope preview and request approval only for necessary tools.',
        severity: approvalRequired ? 'warning' : 'info',
        confidence: 0.8,
        requiresApproval: approvalRequired,
        mutableAction: approvalRequired,
        evidence: recommendations.slice(0, 3).map((entry) => ({
          source: 'NaturalCapabilityDiscoveryService',
          ref: normalizeText(entry.id || entry.capabilityId),
          detail: redactText(entry.reason || entry.label, 'capability candidata'),
        })),
        relatedToolIds: listStrings(safety.approvalRequiredToolIds).concat(listStrings(safety.previewRequiredToolIds)).slice(0, 8),
        run,
      }),
    ];
  }

  private skillSuggestions(run: UniversalAgentRun): PersonalOpsAutopilotSuggestion[] {
    const quarantine = recordOrNull(run.metadata.skillMcpQuarantine);
    const summary = recordOrNull(quarantine?.summary) || {};
    const reviewRequired = numberOrNull(summary.reviewRequired) ?? 0;
    const quarantined = numberOrNull(summary.quarantined) ?? 0;
    if (reviewRequired === 0 && quarantined === 0) {
      return [];
    }
    return [
      this.suggestion({
        id: 'skill-quarantine-review',
        category: 'skill',
        title: 'review Skills/MCP quarantined',
        cause: `${quarantined} import(s) quarantined; ${reviewRequired} exigunder review.`,
        impact: 'Capabilities importadas podem ficar ocultas ou inseguras se promovidas without inspecao.',
        nextStep: 'Inspect source and risk before promoting any skill/MCP.',
        severity: reviewRequired > 0 ? 'warning' : 'info',
        confidence: 0.84,
        requiresApproval: true,
        mutableAction: true,
        evidence: listRecords(quarantine?.entries).slice(0, 3).map((entry) => ({
          source: 'SkillMcpQuarantineService',
          ref: normalizeText(entry.id),
          detail: redactText(entry.riskLevel || entry.trustState, 'entrada quarantined'),
        })),
        relatedToolIds: ['skill.review', 'mcp.review'],
        run,
      }),
    ];
  }

  private safetySuggestions(run: UniversalAgentRun): PersonalOpsAutopilotSuggestion[] {
    const safety = recordOrNull(run.metadata.safetyNarrative);
    if (!safety) {
      return [];
    }
    const status = normalizeText(safety.status).toLowerCase();
    if (status !== 'blocked' && status !== 'waiting-approval' && safety.highRiskBlockPresent !== true) {
      return [];
    }
    return [
      this.suggestion({
        id: 'safety-resolution',
        category: 'safety',
        title: 'Resolve security block',
        cause: redactText(safety.summary || safety.userMessage, 'Safety Narrative published a block or pending approval.'),
        impact: 'Run must not proceed with sensitive action until there is a safe alternative.',
        nextStep: 'Escolher alternactive safe ou approve escopo minimo after de preview.',
        severity: status === 'blocked' ? 'danger' : 'warning',
        confidence: 0.9,
        requiresApproval: true,
        mutableAction: true,
        evidence: listRecords(safety.reasons).slice(0, 3).map((entry) => ({
          source: 'SafetyNarrativeService',
          ref: normalizeText(entry.id),
          detail: redactText(entry.title || entry.detail, 'motivo de safety'),
        })),
        relatedToolIds: listRecords(safety.reasons).flatMap((entry) => listStrings(entry.toolIds)).slice(0, 8),
        run,
      }),
    ];
  }

  private approvalSuggestions(run: UniversalAgentRun): PersonalOpsAutopilotSuggestion[] {
    const pendingApprovals = run.approvals.filter((approval) => approval.status === 'pending');
    if (pendingApprovals.length === 0) {
      return [];
    }
    return [
      this.suggestion({
        id: 'pending-approvals',
        category: 'runtime',
        title: 'Approvals pendings',
        cause: `${pendingApprovals.length} approval(s) aguardam decision do operador.`,
        impact: 'Runs podem ficar parados ate approval, reject ou ajuste de escopo.',
        nextStep: 'review causa, risk e escopo before approve.',
        severity: 'warning',
        confidence: 0.95,
        requiresApproval: true,
        mutableAction: true,
        evidence: pendingApprovals.slice(0, 3).map((approval) => ({
          source: 'AgentRunService',
          ref: approval.id,
          detail: redactText(approval.title || approval.reason, 'approval pending'),
        })),
        relatedToolIds: pendingApprovals.flatMap((approval) => {
          const approvalRecord = recordOrNull(approval) || {};
          const metadata = recordOrNull(approvalRecord.metadata) || {};
          return [
            ...listStrings(approvalRecord.toolIds),
            ...listStrings(metadata.toolIds),
          ];
        }).slice(0, 8),
        run,
      }),
    ];
  }

  private runtimeSuggestions(run: UniversalAgentRun, runObservatoryLinked: boolean): PersonalOpsAutopilotSuggestion[] {
    if (run.status !== 'failed' && runObservatoryLinked) {
      return [];
    }
    if (run.status === 'failed') {
      return [
        this.suggestion({
          id: 'runtime-failure-diagnosis',
          category: 'runtime',
          title: 'Diagnose run failure',
          cause: redactText(run.summary, 'Run finished with failure.'),
          impact: 'Repeated failures can affect channels, providers, or future automations.',
          nextStep: 'Open read-only diagnostics before any autorepair.',
          severity: 'danger',
          confidence: 0.82,
          requiresApproval: true,
          mutableAction: true,
          evidence: [
            {
              source: 'RunObservatory',
              ref: run.id,
              detail: runObservatoryLinked ? 'run present in observatory' : 'observatory has no receipt for this run',
            },
          ],
          relatedToolIds: ['runtime.doctor', 'autorepair.preview'],
          run,
        }),
      ];
    }
    if (!runObservatoryLinked) {
      return [
        this.suggestion({
          id: 'observatory-receipt-gap',
          category: 'runtime',
          title: 'Completar receipts de observability',
          cause: 'Run Observatory did not return receipts for the current run.',
          impact: 'Auditoria e replay ficam menos trusted.',
          nextStep: 'Generate observability diagnostic without running automatic repair.',
          severity: 'info',
          confidence: 0.6,
          requiresApproval: false,
          mutableAction: false,
          evidence: [
            {
              source: 'RunObservatory',
              ref: run.id,
              detail: 'receipt missing ou vazio',
            },
          ],
          relatedToolIds: ['observatory.inspect'],
          run,
        }),
      ];
    }
    return [];
  }

  private suggestion(input: {
    id: string;
    category: PersonalOpsAutopilotCategory;
    title: string;
    cause: string;
    impact: string;
    nextStep: string;
    severity: PersonalOpsAutopilotSuggestion['severity'];
    confidence: number;
    requiresApproval: boolean;
    mutableAction: boolean;
    evidence: PersonalOpsAutopilotSuggestion['evidence'];
    relatedArtifactIds?: string[];
    relatedToolIds?: string[];
    run: UniversalAgentRun;
  }): PersonalOpsAutopilotSuggestion {
    const id = `personal-ops:${normalizeKey(input.id)}`;
    return {
      id,
      category: input.category,
      title: redactText(input.title),
      cause: redactText(input.cause),
      impact: redactText(input.impact),
      nextStep: redactText(input.nextStep),
      severity: input.severity,
      confidence: clampConfidence(input.confidence),
      requiresApproval: input.requiresApproval,
      previewAvailable: true,
      mutableAction: input.mutableAction,
      evidence: input.evidence.length > 0
        ? input.evidence.map((entry, index) => ({
          source: redactText(entry.source, 'runtime'),
          ref: normalizeText(entry.ref) || null,
          detail: redactText(entry.detail, `evidence ${index + 1}`),
          ...(entry.receiptId ? { receiptId: entry.receiptId } : {}),
        }))
        : [{
          source: 'PersonalOpsAutopilotService',
          ref: input.run.id,
          detail: 'Sugestao derivada do snapshot current do run.',
        }],
      relatedArtifactIds: Array.from(new Set(input.relatedArtifactIds || [])).slice(0, 8),
      relatedToolIds: Array.from(new Set(input.relatedToolIds || [])).slice(0, 8),
      actions: {
        previewCommand: `zavorth personal-ops preview ${normalizeKey(input.id)} --run ${input.run.id}`,
        approvalCommand: input.requiresApproval ? `zavorth personal-ops approve ${normalizeKey(input.id)} --run ${input.run.id}`
          : `zavorth personal-ops review ${normalizeKey(input.id)} --run ${input.run.id}`,
        runCommand: input.mutableAction ? `zavorth personal-ops run ${normalizeKey(input.id)} --requires-approval`
          : `zavorth personal-ops inspect ${normalizeKey(input.id)}`,
        dismissCommand: `zavorth personal-ops dismiss ${normalizeKey(input.id)} --run ${input.run.id}`,
      },
    };
  }

  private buildReceipts(
    run: UniversalAgentRun,
    suggestions: PersonalOpsAutopilotSuggestion[],
    observatoryReceiptCount: number,
  ): PersonalOpsAutopilotReceipt[] {
    const receipts: PersonalOpsAutopilotReceipt[] = [
      {
        id: 'personal-ops:receipt:run-observatory',
        kind: 'run-observatory',
        source: 'RunObservatory',
        detail: `${observatoryReceiptCount} observability receipt(s) used for context.`,
        status: observatoryReceiptCount > 0 ? 'ready' : 'missing',
      },
      {
        id: 'personal-ops:receipt:policy',
        kind: 'policy',
        source: 'PersonalOpsAutopilotService',
        detail: 'Autopilot only suggests; mutations require preview and approval.',
        status: 'ready',
      },
      {
        id: 'personal-ops:receipt:surface',
        kind: 'surface',
        source: '/zavorthControl',
        detail: 'Personal Ops Autopilot projected into /zavorthControl and CLI.',
        status: 'ready',
      },
    ];
    if (recordOrNull(run.metadata.naturalCapabilityDiscovery)) {
      receipts.push({
        id: 'personal-ops:receipt:natural-capability-discovery',
        kind: 'natural-capability-discovery',
        source: 'NaturalCapabilityDiscoveryService',
        detail: 'Discovery used to suggest operational scope.',
        status: 'ready',
      });
    }
    if (recordOrNull(run.metadata.runBudget)) {
      receipts.push({
        id: 'personal-ops:receipt:budget',
        kind: 'budget',
        source: 'RunBudgetPolicy',
        detail: 'Budget/cost used as autopilot evidence.',
        status: 'ready',
      });
    }
    if (recordOrNull(run.metadata.providerArena)) {
      receipts.push({
        id: 'personal-ops:receipt:provider-arena',
        kind: 'provider-arena',
        source: 'ProviderArenaService',
        detail: 'Provider Arena used for route recommendation.',
        status: 'ready',
      });
    }
    if (recordOrNull(run.metadata.artifactMemory)) {
      receipts.push({
        id: 'personal-ops:receipt:artifact-memory',
        kind: 'artifact-memory',
        source: 'ArtifactMemoryService',
        detail: 'Artifact Memory used for reuse opportunities.',
        status: 'ready',
      });
    }
    if (recordOrNull(run.metadata.skillMcpQuarantine)) {
      receipts.push({
        id: 'personal-ops:receipt:skill-quarantine',
        kind: 'skill-quarantine',
        source: 'SkillMcpQuarantineService',
        detail: 'Quarantine used to suggest review.',
        status: 'ready',
      });
    }
    if (suggestions.some((suggestion) => suggestion.requiresApproval)) {
      receipts.push({
        id: 'personal-ops:receipt:approval',
        kind: 'approval',
        source: 'AgentRunService',
        detail: 'One or more suggestions require approval before mutation.',
        status: 'needs-review',
      });
    }
    return receipts;
  }

  private resolveStatus(
    run: UniversalAgentRun,
    suggestions: PersonalOpsAutopilotSuggestion[],
  ): PersonalOpsAutopilotStatus {
    if (run.status === 'failed' && suggestions.some((suggestion) => suggestion.severity === 'danger')) {
      return 'blocked';
    }
    if (suggestions.some((suggestion) => suggestion.requiresApproval)) {
      return 'waiting-approval';
    }
    if (suggestions.length > 0) {
      return 'suggesting';
    }
    return 'idle';
  }

  private nextSafeAction(
    status: PersonalOpsAutopilotStatus,
    suggestions: PersonalOpsAutopilotSuggestion[],
  ): string {
    if (status === 'blocked') {
      return 'Open read-only diagnostics and choose preview before any autorepair.';
    }
    if (status === 'waiting-approval') {
      return 'review suggestions with required approval; no mutable action was executed.';
    }
    if (status === 'suggesting') {
      const first = suggestions[0];
      return first ? `run preview: ${first.actions.previewCommand}`
        : 'review operational suggestions in read-only mode.';
    }
    return 'No operational correction suggested now; keep observing the runtime.';
  }
}
