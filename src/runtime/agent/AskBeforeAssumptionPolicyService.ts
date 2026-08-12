import type { UniversalAgentRun } from './UniversalAgentRuntimeTypes.js';

export const ASK_BEFORE_ASSUMPTION_POLICY_CONTRACT_VERSION = '2026-05-03.track-42' as const;

export type AskBeforeAssumptionPolicyStatus = 'clear' | 'needs-question' | 'blocked';

export type AskBeforeAssumptionCategory =
  | 'missing-scope'
  | 'missing-target'
  | 'missing-permission'
  | 'missing-data'
  | 'risky-tool'
  | 'channel-handoff'
  | 'provider-route'
  | 'memory-write'
  | 'selfmod'
  | 'workspace-mutation';

export type AskBeforeAssumption = {
  id: string;
  category: AskBeforeAssumptionCategory;
  title: string;
  detail: string;
  severity: 'info' | 'warning' | 'danger';
  confidence: number;
  missingInput: string[];
  inferredFrom: string[];
  affectedActions: string[];
  requiresAnswer: boolean;
  questionId: string;
};

export type AskBeforeAssumptionQuestion = {
  id: string;
  priority: 'low' | 'medium' | 'high';
  question: string;
  reason: string;
  options: string[];
  blocksMutation: boolean;
  defaultAction: 'ask' | 'preview' | 'skip';
};

export type AskBeforeAssumptionReceipt = {
  id: string;
  kind:
    | 'universal-preview'
    | 'capability-negotiation'
    | 'tool-exposure'
    | 'safety-narrative'
    | 'risk-audit'
    | 'cross-channel-continuity'
    | 'agent-team-compiler'
    | 'personal-ops-autopilot'
    | 'policy'
    | 'surface';
  source: string;
  detail: string;
  status: 'ready' | 'needs-answer' | 'missing';
};

export type AskBeforeAssumptionPolicySnapshot = {
  contractVersion: typeof ASK_BEFORE_ASSUMPTION_POLICY_CONTRACT_VERSION;
  source: 'AskBeforeAssumptionPolicyService';
  generatedAt: string;
  identifiers: {
    runId: string;
    traceId: string;
    requestId: string;
    sessionId: string;
  };
  status: AskBeforeAssumptionPolicyStatus;
  summary: {
    assumptionCount: number;
    questionCount: number;
    blockerCount: number;
    mutableActionBlockedCount: number;
    highestSeverity: 'info' | 'warning' | 'danger';
    previewLinked: boolean;
    capabilityNegotiationLinked: boolean;
    safetyNarrativeLinked: boolean;
  };
  assumptions: AskBeforeAssumption[];
  questions: AskBeforeAssumptionQuestion[];
  receipts: AskBeforeAssumptionReceipt[];
  policy: {
    noAssumptionActedOn: true;
    noMutationExecuted: true;
    asksBeforeMutation: true;
    previewBeforeRiskyAction: true;
    approvalStillRequired: true;
    naturalLanguageDoesNotBypassPolicy: true;
    secretsSerialized: false;
  };
  surface: {
    cliCommand: string;
    zavorthControlPath: string;
    askHint: string;
    previewHint: string;
  };
  nextSafeAction: string;
};

export type AskBeforeAssumptionPolicyInput = {
  run: UniversalAgentRun;
  generatedAt?: string | null;
};

type LooseRecord = Record<string, unknown>;

type AssumptionSeed = Omit<AskBeforeAssumption, 'id' | 'questionId'> & {
  question: Omit<AskBeforeAssumptionQuestion, 'id'>;
};

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizeKey(value: unknown, fallback = 'assumption'): string {
  return (
    normalizeText(value, fallback)
      .toLowerCase()
      .replace(/[^a-z0-9_.:-]+/g, '-')
      .replace(/^-+|-+$/g, '') || fallback
  );
}

function recordOrNull(value: unknown): LooseRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as LooseRecord) : null;
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

function redactText(value: unknown, fallback = '', maxLength = 260): string {
  const text = normalizeText(value, fallback)
    .replace(/((?:api[_-]?key|token|secret|password)\s*[:=]\s*)\S+/gi, '$1[redacted]')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

function normalizeSearchText(value: unknown): string {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function severityRank(severity: AskBeforeAssumption['severity']): number {
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

export class AskBeforeAssumptionPolicyService {
  private readonly now: () => Date;

  constructor(options: { now?: () => Date } = {}) {
    this.now = options.now || (() => new Date());
  }

  public buildSnapshot(input: AskBeforeAssumptionPolicyInput): AskBeforeAssumptionPolicySnapshot {
    const { run } = input;
    const generatedAt = normalizeText(input.generatedAt, this.now().toISOString());
    const seeds = this.buildSeeds(run)
      .sort((left, right) => severityRank(right.severity) - severityRank(left.severity))
      .slice(0, 12);
    const assumptions = seeds.map((seed, index) => this.toAssumption(run, seed, index));
    const questions = assumptions.map((assumption, index) => this.toQuestion(seeds[index], assumption));
    const status = this.resolveStatus(assumptions);
    const receipts = this.buildReceipts(run, assumptions);
    const highestSeverity = assumptions[0]?.severity || 'info';

    return {
      contractVersion: ASK_BEFORE_ASSUMPTION_POLICY_CONTRACT_VERSION,
      source: 'AskBeforeAssumptionPolicyService',
      generatedAt,
      identifiers: {
        runId: run.id,
        traceId: run.traceId,
        requestId: run.requestId,
        sessionId: run.sessionId,
      },
      status,
      summary: {
        assumptionCount: assumptions.length,
        questionCount: questions.length,
        blockerCount: assumptions.filter((assumption) => assumption.severity === 'danger').length,
        mutableActionBlockedCount: assumptions.filter(
          (assumption) => assumption.affectedActions.length > 0 && assumption.requiresAnswer,
        ).length,
        highestSeverity,
        previewLinked: Boolean(recordOrNull(run.metadata.universalPreviewMode)),
        capabilityNegotiationLinked: Boolean(recordOrNull(run.metadata.capabilityNegotiation)),
        safetyNarrativeLinked: Boolean(recordOrNull(run.metadata.safetyNarrative)),
      },
      assumptions,
      questions,
      receipts,
      policy: {
        noAssumptionActedOn: true,
        noMutationExecuted: true,
        asksBeforeMutation: true,
        previewBeforeRiskyAction: true,
        approvalStillRequired: true,
        naturalLanguageDoesNotBypassPolicy: true,
        secretsSerialized: false,
      },
      surface: {
        cliCommand: `zavorth assumptions "${redactText(run.input, 'request', 80)}"`,
        zavorthControlPath: '/zavorthControl...sector=config',
        askHint: 'Ask before assuming target, scope, permission, or channel.',
        previewHint: 'Use preview when the response could generate mutation or handoff.',
      },
      nextSafeAction: this.resolveNextSafeAction(status, questions),
    };
  }

  private buildSeeds(run: UniversalAgentRun): AssumptionSeed[] {
    const explicit = this.explicitAssumptions(run);
    return this.dedupeSeeds([
      ...explicit,
      ...this.vagueTargetAssumptions(run),
      ...this.mutableToolAssumptions(run),
      ...this.previewAssumptions(run),
      ...this.capabilityAssumptions(run),
      ...this.crossChannelAssumptions(run),
      ...this.agentTeamAssumptions(run),
      ...this.providerAssumptions(run),
      ...this.memoryAssumptions(run),
    ]);
  }

  private explicitAssumptions(run: UniversalAgentRun): AssumptionSeed[] {
    const raw = recordOrNull(run.metadata.askBeforeAssumptionPolicy);
    return listRecords(raw?.assumptions).map((entry) =>
      this.seed({
        category: this.normalizeCategory(entry.category),
        title: normalizeText(entry.title, 'Declared assumption'),
        detail: redactText(entry.detail ?? entry.reason, 'Metadata declarou uma lacuna a confirmar.'),
        severity: this.normalizeSeverity(entry.severity),
        confidence: Number(entry.confidence) || 0.8,
        missingInput: listStrings(entry.missingInput),
        inferredFrom: ['metadata.askBeforeAssumptionPolicy'],
        affectedActions: listStrings(entry.affectedActions),
        requiresAnswer: entry.requiresAnswer !== false,
        question: {
          priority: this.normalizePriority(entry.priority),
          question: normalizeText(entry.question, 'Can you confirm this choice before continuing...'),
          reason: redactText(entry.reason ?? entry.detail, 'Confirmaction declarada por metadata.'),
          options: listStrings(entry.options),
          blocksMutation: entry.blocksMutation !== false,
          defaultAction: 'ask',
        },
      }),
    );
  }

  private vagueTargetAssumptions(run: UniversalAgentRun): AssumptionSeed[] {
    const text = normalizeSearchText(run.input);
    const vague = false;
    const mutating = false;
    if (!vague && !mutating) {
      return [];
    }
    return [
      this.seed({
        category: mutating ? 'missing-target' : 'missing-scope',
        title: mutating ? 'Mutation target not confirmed' : 'Ambiguous scope',
        detail: mutating ? 'The request suggests a mutating action, but the target and exact success criteria are not fully confirmed.'
          : 'The request contains a vague reference; answering without asking may assume the wrong scope.',
        severity: mutating ? 'danger' : 'warning',
        confidence: mutating ? 0.9 : 0.72,
        missingInput: mutating ? ['exact target', 'success criterion', 'permission'] : ['desired scope'],
        inferredFrom: ['run.input'],
        affectedActions: mutating ? ['workspace mutation', 'external publish'] : [],
        requiresAnswer: true,
        question: {
          priority: mutating ? 'high' : 'medium',
          question: mutating ? 'Which exact target may I change and what result do you expect...'
            : 'Qual escopo you quer que eu considere before seguir...',
          reason: 'Avoid assuming a target or criterion from ambiguous text.',
          options: mutating
            ? ['explain first', 'prepare preview', 'wait for target']
            : ['ask', 'continue read-only', 'summarize options'],
          blocksMutation: mutating,
          defaultAction: mutating ? 'ask' : 'preview',
        },
      }),
    ];
  }

  private mutableToolAssumptions(run: UniversalAgentRun): AssumptionSeed[] {
    const riskyTools = (run.toolExposure.tools || [])
      .filter((tool) => tool.requiresApproval || tool.risk === 'danger' || tool.risk === 'attention')
      .slice(0, 8);
    if (riskyTools.length === 0) {
      return [];
    }
    return [
      this.seed({
        category: 'risky-tool',
        title: 'Risky tools require confirmation',
        detail: `${riskyTools.length} tool(s) require approval or have elevated risk.`,
        severity: riskyTools.some((tool) => tool.risk === 'danger') ? 'danger' : 'warning',
        confidence: 0.93,
        missingInput: ['explicit approval', 'tool scope'],
        inferredFrom: riskyTools.map((tool) => `tool:${tool.id}`),
        affectedActions: riskyTools.map((tool) => tool.id),
        requiresAnswer: true,
        question: {
          priority: riskyTools.some((tool) => tool.risk === 'danger') ? 'high' : 'medium',
          question: 'Do you approve this tool scope before running anything mutable...',
          reason: 'Risky tools must not be triggered by assumption.',
          options: ['approve scope', 'request preview', 'block'],
          blocksMutation: true,
          defaultAction: 'ask',
        },
      }),
    ];
  }

  private previewAssumptions(run: UniversalAgentRun): AssumptionSeed[] {
    const preview = recordOrNull(run.metadata.universalPreviewMode);
    const risk = recordOrNull(preview?.risk);
    if (!preview || risk?.previewRequired !== true) {
      return [];
    }
    return [
      this.seed({
        category: 'missing-permission',
        title: 'Preview required before continuing',
        detail: 'Universal Preview Mode marked that the plan needs preview before the real action.',
        severity: risk.requiresApproval === true ? 'danger' : 'warning',
        confidence: 0.95,
        missingInput: ['preview confirmation'],
        inferredFrom: ['universalPreviewMode.risk'],
        affectedActions: listStrings(risk.previewRequiredToolIds),
        requiresAnswer: true,
        question: {
          priority: risk.requiresApproval === true ? 'high' : 'medium',
          question: 'Do you want me to show the preview before any real execution...',
          reason: 'Preview policy must override any natural-language inference.',
          options: ['show preview', 'adjust scope', 'cancel'],
          blocksMutation: true,
          defaultAction: 'preview',
        },
      }),
    ];
  }

  private capabilityAssumptions(run: UniversalAgentRun): AssumptionSeed[] {
    const negotiation = recordOrNull(run.metadata.capabilityNegotiation);
    if (!negotiation || normalizeText(negotiation.status) !== 'waiting-approval') {
      return [];
    }
    return [
      this.seed({
        category: 'missing-permission',
        title: 'Capability waiting for permission',
        detail: 'Capability Negotiation indicates there is still scope to approve.',
        severity: 'warning',
        confidence: 0.9,
        missingInput: ['capability approval', 'scope limits'],
        inferredFrom: ['capabilityNegotiation.status'],
        affectedActions: ['capability execution'],
        requiresAnswer: true,
        question: {
          priority: 'medium',
          question: 'Which capability and scope do you approve for this request...',
          reason: 'Execution must not assume permissions beyond the negotiated scope.',
          options: ['approve minimum', 'request preview', 'block'],
          blocksMutation: true,
          defaultAction: 'ask',
        },
      }),
    ];
  }

  private crossChannelAssumptions(run: UniversalAgentRun): AssumptionSeed[] {
    const continuity = recordOrNull(run.metadata.crossChannelContinuity);
    if (!continuity || normalizeText(continuity.status) !== 'handoff-ready') {
      return [];
    }
    return [
      this.seed({
        category: 'channel-handoff',
        title: 'Channel handoff needs confirmation',
        detail: 'Cross-Channel Continuity prepared a handoff, but no message should be sent without approval.',
        severity: 'warning',
        confidence: 0.92,
        missingInput: ['destination channel', 'handoff approval'],
        inferredFrom: ['crossChannelContinuity.status'],
        affectedActions: ['cross-channel notification'],
        requiresAnswer: true,
        question: {
          priority: 'medium',
          question: 'Which channel should receive the handoff, and do you approve sending it...',
          reason: 'Channel changes must not happen by assumption.',
          options: ['keep current channel', 'prepare preview', 'approve handoff'],
          blocksMutation: true,
          defaultAction: 'ask',
        },
      }),
    ];
  }

  private agentTeamAssumptions(run: UniversalAgentRun): AssumptionSeed[] {
    const team = recordOrNull(run.metadata.agentTeamCompiler);
    if (!team || normalizeText(team.status) !== 'waiting-approval') {
      return [];
    }
    return [
      this.seed({
        category: 'missing-permission',
        title: 'Agent team is waiting for approval',
        detail: 'Agent Team Compiler compiled roles, but subagent launch needs confirmation.',
        severity: 'warning',
        confidence: 0.9,
        missingInput: ['role approval', 'subagent budget'],
        inferredFrom: ['agentTeamCompiler.status'],
        affectedActions: ['subagent launch'],
        requiresAnswer: true,
        question: {
          priority: 'medium',
          question: 'Do you approve the roles and budget before launching subagents...',
          reason: 'Subagents must not be opened by inference.',
          options: ['review roles', 'approve minimo', 'cancel'],
          blocksMutation: true,
          defaultAction: 'ask',
        },
      }),
    ];
  }

  private providerAssumptions(run: UniversalAgentRun): AssumptionSeed[] {
    const arena = recordOrNull(run.metadata.providerArena);
    const summary = recordOrNull(arena?.summary);
    if (!summary || summary.fallbackUsed !== true) {
      return [];
    }
    return [
      this.seed({
        category: 'provider-route',
        title: 'Provider fallback needs visibility',
        detail:
          'Provider Arena detected fallback; do not assume the user accepts cost, latency, or routing without explicit visibility.',
        severity: 'info',
        confidence: 0.82,
        missingInput: ['preference de provider/model'],
        inferredFrom: ['providerArena.summary.fallbackUsed'],
        affectedActions: ['model route'],
        requiresAnswer: false,
        question: {
          priority: 'low',
          question: 'Quer manter o provider/model recomendado ou escolher outro...',
          reason: 'Fallback must stay visible before expensive or repeated decisions.',
          options: ['manter recomendado', 'comparar arena', 'escolher outro'],
          blocksMutation: false,
          defaultAction: 'preview',
        },
      }),
    ];
  }

  private memoryAssumptions(run: UniversalAgentRun): AssumptionSeed[] {
    const artifactMemory = recordOrNull(run.metadata.artifactMemory);
    const summary = recordOrNull(artifactMemory?.summary);
    const memoryWithReceipts = recordOrNull(run.metadata.memoryWithReceipts);
    const memoryWriteLikely = Boolean(run.metadata.memoryWriteRequested || run.metadata.memoryWriteIntent);
    if (!memoryWriteLikely && Number(summary?.reusableCount || 0) <= 0 && !memoryWithReceipts) {
      return [];
    }
    return [
      this.seed({
        category: 'memory-write',
        title: 'Memory requires origin and consent',
        detail: 'Promoting information to memory must cite origin and depend on explicit action.',
        severity: memoryWriteLikely ? 'warning' : 'info',
        confidence: memoryWriteLikely ? 0.85 : 0.68,
        missingInput: ['what to remember', 'origin/receipt', 'memory scope'],
        inferredFrom: ['artifactMemory', 'memoryWithReceipts', 'run.input'],
        affectedActions: ['memory write'],
        requiresAnswer: memoryWriteLikely,
        question: {
          priority: memoryWriteLikely ? 'medium' : 'low',
          question: 'What exactly should I remember and which receipt should I cite...',
          reason: 'Memory without origin becomes a persistent assumption.',
          options: ['cite artifact', 'save procedural', 'do not save'],
          blocksMutation: memoryWriteLikely,
          defaultAction: memoryWriteLikely ? 'ask' : 'preview',
        },
      }),
    ];
  }

  private seed(seed: AssumptionSeed): AssumptionSeed {
    return {
      ...seed,
      detail: redactText(seed.detail),
      confidence: clampConfidence(seed.confidence),
      missingInput: Array.from(new Set(seed.missingInput.filter(Boolean))),
      inferredFrom: Array.from(new Set(seed.inferredFrom.filter(Boolean))),
      affectedActions: Array.from(new Set(seed.affectedActions.filter(Boolean))),
      question: {
        ...seed.question,
        reason: redactText(seed.question.reason),
        options: Array.from(new Set(seed.question.options.filter(Boolean))).slice(0, 5),
      },
    };
  }

  private toAssumption(run: UniversalAgentRun, seed: AssumptionSeed, index: number): AskBeforeAssumption {
    const id = `ask-assumption:${run.id}:${normalizeKey(seed.category)}:${index + 1}`;
    return {
      id,
      category: seed.category,
      title: seed.title,
      detail: seed.detail,
      severity: seed.severity,
      confidence: seed.confidence,
      missingInput: [...seed.missingInput],
      inferredFrom: [...seed.inferredFrom],
      affectedActions: [...seed.affectedActions],
      requiresAnswer: seed.requiresAnswer,
      questionId: `${id}:question`,
    };
  }

  private toQuestion(seed: AssumptionSeed | undefined, assumption: AskBeforeAssumption): AskBeforeAssumptionQuestion {
    return {
      id: assumption.questionId,
      priority: seed?.question.priority || (assumption.severity === 'danger' ? 'high' : 'medium'),
      question: seed?.question.question || 'Can you confirm before continuing...',
      reason: seed?.question.reason || assumption.detail,
      options: seed?.question.options.length ? seed.question.options : ['ask', 'preview', 'cancel'],
      blocksMutation: seed?.question.blocksMutation ?? assumption.requiresAnswer,
      defaultAction: seed?.question.defaultAction || 'ask',
    };
  }

  private buildReceipts(run: UniversalAgentRun, assumptions: AskBeforeAssumption[]): AskBeforeAssumptionReceipt[] {
    return [
      {
        id: `ask-policy-receipt:${run.id}:preview`,
        kind: 'universal-preview',
        source: 'UniversalPreviewModeService',
        detail: recordOrNull(run.metadata.universalPreviewMode) ? 'Universal Preview Mode available para perguntas com risk.'
          : 'Universal Preview Mode missing neste snapshot.',
        status: recordOrNull(run.metadata.universalPreviewMode) ? 'ready' : 'missing',
      },
      {
        id: `ask-policy-receipt:${run.id}:capability`,
        kind: 'capability-negotiation',
        source: 'CapabilityNegotiationService',
        detail: recordOrNull(run.metadata.capabilityNegotiation) ? 'Capability Negotiation available para escopo/permission.'
          : 'Capability Negotiation absent or not necessary.',
        status: recordOrNull(run.metadata.capabilityNegotiation) ? 'ready' : 'missing',
      },
      {
        id: `ask-policy-receipt:${run.id}:tool-exposure`,
        kind: 'tool-exposure',
        source: 'ToolExposurePolicy',
        detail: `${run.toolExposure.tools.length} tool(s) observadas no profile de exposure.`,
        status: run.toolExposure.tools.length > 0 ? 'ready' : 'missing',
      },
      {
        id: `ask-policy-receipt:${run.id}:safety`,
        kind: 'safety-narrative',
        source: 'SafetyNarrativeService',
        detail: recordOrNull(run.metadata.safetyNarrative) ? 'Safety Narrative available para explicar bloqueios.'
          : 'Safety Narrative has not been attached yet.',
        status: recordOrNull(run.metadata.safetyNarrative) ? 'ready' : 'missing',
      },
      {
        id: `ask-policy-receipt:${run.id}:questions`,
        kind: 'policy',
        source: 'AskBeforeAssumptionPolicyService',
        detail: `${assumptions.length} question(s)/assumption(s) prepared without running action.`,
        status: assumptions.length > 0 ? 'needs-answer' : 'ready',
      },
      {
        id: `ask-policy-receipt:${run.id}:surface`,
        kind: 'surface',
        source: 'CLI/ZavorthControl',
        detail: 'Questions expostas por CLI read-only e ZavorthControl.',
        status: 'ready',
      },
    ];
  }

  private dedupeSeeds(seeds: AssumptionSeed[]): AssumptionSeed[] {
    const seen = new Set<string>();
    return seeds.filter((seed) => {
      const key = `${seed.category}:${seed.title}:${seed.detail}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private resolveStatus(assumptions: AskBeforeAssumption[]): AskBeforeAssumptionPolicyStatus {
    if (assumptions.some((assumption) => assumption.severity === 'danger' && assumption.requiresAnswer)) {
      return 'blocked';
    }
    if (assumptions.some((assumption) => assumption.requiresAnswer)) {
      return 'needs-question';
    }
    return 'clear';
  }

  private resolveNextSafeAction(
    status: AskBeforeAssumptionPolicyStatus,
    questions: AskBeforeAssumptionQuestion[],
  ): string {
    if (status === 'blocked') {
      return 'Ask before any mutation, handoff, provider switch, or launch.';
    }
    if (status === 'needs-question') {
      return questions[0]?.question || 'Ask a clarification question before continuing.';
    }
    return 'No required question; continue while respecting preview, approval, and tool policy.';
  }

  private normalizeCategory(value: unknown): AskBeforeAssumptionCategory {
    const raw = normalizeText(value).toLowerCase();
    if (
      raw === 'missing-scope' ||
      raw === 'missing-target' ||
      raw === 'missing-permission' ||
      raw === 'missing-data' ||
      raw === 'risky-tool' ||
      raw === 'channel-handoff' ||
      raw === 'provider-route' ||
      raw === 'memory-write' ||
      raw === 'selfmod' ||
      raw === 'workspace-mutation'
    ) {
      return raw;
    }
    return 'missing-scope';
  }

  private normalizeSeverity(value: unknown): AskBeforeAssumption['severity'] {
    const raw = normalizeText(value).toLowerCase();
    if (raw === 'danger' || raw === 'warning' || raw === 'info') {
      return raw;
    }
    return 'warning';
  }

  private normalizePriority(value: unknown): AskBeforeAssumptionQuestion['priority'] {
    const raw = normalizeText(value).toLowerCase();
    if (raw === 'high' || raw === 'medium' || raw === 'low') {
      return raw;
    }
    return 'medium';
  }
}
