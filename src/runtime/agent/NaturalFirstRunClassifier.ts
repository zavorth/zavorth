import type { UniversalAgentChannel } from './UniversalAgentRuntimeTypes.js';

export type NaturalFirstRoute =
  | 'slash-command'
  | 'light-chat'
  | 'llm-reply'
  | 'capability-discovery'
  | 'approval-proposal'
  | 'tool-preview'
  | 'governed-execution'
  | 'memory-recall';

export type NaturalFirstIntentKind =
  | 'slash-command'
  | 'low-signal-chat'
  | 'free-text-question'
  | 'capability-discovery'
  | 'memory-recall'
  | 'tool-use'
  | 'operational-work'
  | 'sensitive-action';

export type NaturalFirstRiskLevel = 'safe' | 'attention' | 'danger';

export type NaturalFirstCostTier = 'cheap' | 'standard' | 'expensive';

export type NaturalFirstRuntimeContext = {
  channel: UniversalAgentChannel;
  user: {
    present: boolean;
    id: string | null;
  };
  session: {
    present: boolean;
    id: string | null;
  };
  workspace: {
    present: boolean;
    path: string | null;
  };
  attachments: {
    count: number;
    present: boolean;
  };
  memory: {
    hinted: boolean;
    sources: string[];
  };
  tools: {
    requested: string[];
    available: string[];
    approvalRequired: string[];
    highestRisk: NaturalFirstRiskLevel;
  };
};

export type NaturalFirstRunRisk = {
  level: NaturalFirstRiskLevel;
  requiresApproval: boolean;
  previewRequired: boolean;
  reasons: string[];
};

export type NaturalFirstRunCost = {
  tier: NaturalFirstCostTier;
  budgetHint: 'minimal-context' | 'session-context' | 'workspace-context' | 'governed-runtime';
  reason: string;
};

export type NaturalFirstRunIntent = {
  primary: NaturalFirstIntentKind;
  candidates: NaturalFirstIntentKind[];
  confidence: number;
};

export type NaturalFirstRunClassificationInput = {
  text: string;
  channel: UniversalAgentChannel;
  userId?: string | null;
  sessionId?: string | null;
  workspace?: string | null;
  requestedTools?: string[];
  availableTools?: string[];
  /**
   * Structured transaction signals only (slash/UI/tool). Free text never sets these.
   */
  transactionApprovalIntent?: boolean;
  transactionPreviewIntent?: boolean;
  metadata?: Record<string, unknown>;
};

export type NaturalFirstRunClassification = {
  source: 'NaturalFirstRunClassifier';
  contractVersion: 'natural-first-classifier/4';
  mode: 'natural-first-agent-runtime';
  shouldEnterGateway: boolean;
  route: NaturalFirstRoute;
  intent: NaturalFirstRunIntent;
  risk: NaturalFirstRunRisk;
  cost: NaturalFirstRunCost;
  context: NaturalFirstRuntimeContext;
  effort: 'light' | 'standard' | 'heavy';
  usesLlm: 'optional' | 'preferred' | 'not-required';
  requiresApproval: boolean;
  reason: string;
  signals: string[];
};

type RouteDecisionInput = {
  route: NaturalFirstRoute;
  intent: NaturalFirstIntentKind;
  effort: NaturalFirstRunClassification['effort'];
  usesLlm: NaturalFirstRunClassification['usesLlm'];
  reason: string;
  signals: string[];
  shouldEnterGateway?: boolean;
};

/** Risk classification for structured tool ids only (not free-text keywords). */
const TOOL_DANGER_PATTERNS = [
  /(?:^|[._:-])(write|delete|remove|rm|edit|apply|rollback|reset|deploy|commit|push|publish)(?:$|[._:-])/,
  /\b(shell\.exec|bash\.exec|powershell\.exec|workspace\.delete|git\.reset|selfmod\.apply|selfmod\.rollback)\b/,
];

const TOOL_ATTENTION_PATTERNS = [
  /(?:^|[._:-])(shell|exec|network|fetch|search|send|browser|watch|invoke|automation|cron)(?:$|[._:-])/,
  /\b(echo_hands|watchmode\.control|node\.invoke|web\.search|network_fetch)\b/,
];

const TOOL_SAFE_PATTERNS = [
  /(?:^|[._:-])(read|list|history|status|inspect|describe)(?:$|[._:-])/,
  /\b(read_file|workspace\.read|memory\.read|sessions\.history|sessions\.list|get_datetime|datetime|time\.now)\b/,
];

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeSearchText(value: unknown): string {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function recordOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function normalizeList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(new Set(value.map((item) => normalizeText(item)).filter(Boolean)));
}

function includesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((item) => normalizeText(item)).filter(Boolean)));
}

function riskScore(risk: NaturalFirstRiskLevel): number {
  if (risk === 'danger') {
    return 3;
  }
  if (risk === 'attention') {
    return 2;
  }
  return 1;
}

function maxRisk(risks: NaturalFirstRiskLevel[]): NaturalFirstRiskLevel {
  const score = Math.max(1, ...risks.map(riskScore));
  if (score >= 3) {
    return 'danger';
  }
  if (score === 2) {
    return 'attention';
  }
  return 'safe';
}

function riskForTool(toolId: string): NaturalFirstRiskLevel {
  const normalized = normalizeSearchText(toolId);
  if (includesAny(normalized, TOOL_DANGER_PATTERNS)) {
    return 'danger';
  }
  if (includesAny(normalized, TOOL_ATTENTION_PATTERNS)) {
    return 'attention';
  }
  if (includesAny(normalized, TOOL_SAFE_PATTERNS)) {
    return 'safe';
  }
  return 'attention';
}

function hasRequestedTools(value: unknown): boolean {
  return normalizeList(value).length > 0;
}

function resolveAttachmentCount(metadata: Record<string, unknown>): number {
  const attachments = metadata.attachments;
  if (Array.isArray(attachments)) {
    return attachments.length;
  }
  const responseDecision = recordOrNull(metadata.responseDecision);
  const responseAttachments = responseDecision?.attachments;
  return Array.isArray(responseAttachments) ? responseAttachments.length : 0;
}

function resolveMemorySources(metadata: Record<string, unknown>): string[] {
  const sources: string[] = [];
  if (normalizeText(metadata.memoryPrompt)) {
    sources.push('memoryPrompt');
  }
  if (hasRequestedTools(metadata.memorySignals)) {
    sources.push('memorySignals');
  }
  if (recordOrNull(metadata.memoryContext)) {
    sources.push('memoryContext');
  }
  if (recordOrNull(metadata.memoryPlane)) {
    sources.push('memoryPlane');
  }
  const coldContext = recordOrNull(metadata.coldContext);
  if (recordOrNull(coldContext?.memoryContext) || recordOrNull(coldContext?.memoryPlane)) {
    sources.push('coldContext');
  }
  const canonicalContext = recordOrNull(metadata.canonicalContext) || recordOrNull(metadata.context);
  if (recordOrNull(canonicalContext?.memory) || recordOrNull(canonicalContext?.memoryContext)) {
    sources.push('canonicalContext');
  }
  return unique(sources);
}

function resolveMetadataTools(metadata: Record<string, unknown>): {
  requested: string[];
  available: string[];
  approvalRequired: string[];
} {
  const responseDecision = recordOrNull(metadata.responseDecision);
  const toolHintProfile = recordOrNull(metadata.toolHintProfile);
  return {
    requested: unique([...normalizeList(metadata.requestedTools), ...normalizeList(responseDecision?.requestedTools)]),
    available: unique([
      ...normalizeList(metadata.allowedTools),
      ...normalizeList(metadata.availableTools),
      ...normalizeList(toolHintProfile?.recommendedToolNames),
    ]),
    approvalRequired: unique([
      ...normalizeList(metadata.requireApprovalFor),
      ...normalizeList(responseDecision?.requireApprovalFor),
    ]),
  };
}

function isMemoryOrSessionTool(toolId: string): boolean {
  const normalizedTool = normalizeSearchText(toolId);
  return normalizedTool.includes('memory') || normalizedTool.includes('session') || normalizedTool.includes('history');
}

function confidenceFor(intent: NaturalFirstIntentKind, signalCount: number, risk: NaturalFirstRiskLevel): number {
  const base: Record<NaturalFirstIntentKind, number> = {
    'slash-command': 0.99,
    'low-signal-chat': 0.94,
    'free-text-question': 0.66,
    'capability-discovery': 0.84,
    'memory-recall': 0.86,
    'tool-use': 0.86,
    'operational-work': 0.82,
    'sensitive-action': 0.92,
  };
  const signalBoost = Math.min(0.08, Math.max(0, signalCount - 1) * 0.02);
  const riskBoost = risk === 'danger' ? 0.03 : 0;
  return Math.min(0.99, Number((base[intent] + signalBoost + riskBoost).toFixed(2)));
}

function buildCost(route: NaturalFirstRoute, context: NaturalFirstRuntimeContext): NaturalFirstRunCost {
  if (route === 'light-chat' || route === 'slash-command') {
    return {
      tier: 'cheap',
      budgetHint: 'minimal-context',
      reason: 'Short response or operator shortcut with minimal context.',
    };
  }
  if (route === 'governed-execution') {
    return {
      tier: 'expensive',
      budgetHint: 'governed-runtime',
      reason: 'Operational work may need context, tools, policy, and follow-up.',
    };
  }
  if (
    route === 'tool-preview' ||
    route === 'approval-proposal' ||
    route === 'capability-discovery' ||
    route === 'memory-recall'
  ) {
    return {
      tier: 'standard',
      budgetHint: context.workspace.present ? 'workspace-context' : 'session-context',
      reason: 'Governed route needs enough context to explain risk, memory, capability, or preview.',
    };
  }
  if (context.workspace.present || context.tools.requested.length > 0 || context.memory.hinted) {
    return {
      tier: 'standard',
      budgetHint: context.workspace.present ? 'workspace-context' : 'session-context',
      reason: 'Classification uses session context, memory, workspace, or tools.',
    };
  }
  return {
    tier: 'cheap',
    budgetHint: 'session-context',
    reason: 'Free-text agent turn with session-light context; the LLM may request tools.',
  };
}

export class NaturalFirstRunClassifier {
  public classify(input: NaturalFirstRunClassificationInput): NaturalFirstRunClassification {
    const rawText = normalizeText(input.text);
    normalizeSearchText(rawText);
    const metadata = input.metadata || {};
    const metadataTools = resolveMetadataTools(metadata);
    const requestedTools = unique([...(input.requestedTools || []), ...metadataTools.requested]);
    const availableTools = unique([...(input.availableTools || []), ...metadataTools.available]);
    const approvalRequiredTools = unique(metadataTools.approvalRequired);
    const toolRisks = requestedTools.map(riskForTool);
    const toolRisk = maxRisk(toolRisks);
    const highestRisk = maxRisk([toolRisk, approvalRequiredTools.length > 0 ? 'danger' : 'safe']);
    const memorySources = resolveMemorySources(metadata);
    const memoryIntent =
      memorySources.length > 0 ||
      requestedTools.some((tool) => {
        const normalizedTool = normalizeSearchText(tool);
        return normalizedTool.includes('memory') || normalizedTool.includes('session');
      });
    const memoryOnlyTools = requestedTools.length > 0 && requestedTools.every((tool) => isMemoryOrSessionTool(tool));
    const capabilityIntent = false;
    const operationalIntent = false;
    // Structured requested tools / structured transaction flags only — free text never forces routes.
    const toolIntent = !memoryOnlyTools && requestedTools.length > 0;
    const textDanger = false;
    const textAttention = false;
    const transactionApprovalIntent = input.transactionApprovalIntent === true;
    const transactionPreviewIntent = input.transactionPreviewIntent === true;
    const lowSignalChat = false;
    const attachmentsCount = resolveAttachmentCount(metadata);
    const context: NaturalFirstRuntimeContext = {
      channel: input.channel,
      user: {
        present: Boolean(normalizeText(input.userId || metadata.userId)),
        id: normalizeText(input.userId || metadata.userId) || null,
      },
      session: {
        present: Boolean(normalizeText(input.sessionId || metadata.sessionId)),
        id: normalizeText(input.sessionId || metadata.sessionId) || null,
      },
      workspace: {
        present: Boolean(normalizeText(input.workspace || metadata.workspace || metadata.workspaceHint)),
        path: normalizeText(input.workspace || metadata.workspace || metadata.workspaceHint) || null,
      },
      attachments: {
        count: attachmentsCount,
        present: attachmentsCount > 0,
      },
      memory: {
        hinted: memoryIntent,
        sources: memorySources,
      },
      tools: {
        requested: requestedTools,
        available: availableTools,
        approvalRequired: approvalRequiredTools,
        highestRisk,
      },
    };
    const candidates = this.buildCandidates({
      lowSignalChat,
      memoryIntent,
      capabilityIntent,
      toolIntent,
      operationalIntent,
      transactionApprovalIntent,
      transactionPreviewIntent,
      textDanger,
      textAttention,
      requestedTools,
      approvalRequiredTools,
    });
    const decision = this.decideRoute({
      rawText,
      lowSignalChat,
      memoryIntent,
      capabilityIntent,
      toolIntent,
      operationalIntent,
      transactionApprovalIntent,
      transactionPreviewIntent,
      textDanger,
      highestRisk,
      approvalRequiredTools,
    });
    const risk = this.buildRisk({
      highestRisk,
      textDanger,
      textAttention,
      toolRisk,
      requestedTools,
      approvalRequiredTools,
      transactionApprovalIntent,
      transactionPreviewIntent,
      route: decision.route,
    });
    const signals = unique([
      ...decision.signals,
      ...candidates.map((candidate) => `candidate:${candidate}`),
      ...(context.session.present ? ['session-context'] : []),
      ...(context.user.present ? ['user-context'] : []),
      ...(context.workspace.present ? ['workspace-context'] : []),
      ...(context.attachments.present ? ['attachments-context'] : []),
      ...(context.memory.hinted ? ['memory-context'] : []),
      ...(requestedTools.length > 0 ? ['requested-tools'] : []),
      ...(availableTools.length > 0 ? ['available-tools'] : []),
      ...(approvalRequiredTools.length > 0 ? ['approval-required-tools'] : []),
      `risk:${risk.level}`,
    ]);
    const intent: NaturalFirstRunIntent = {
      primary: decision.intent,
      candidates,
      confidence: confidenceFor(decision.intent, signals.length, risk.level),
    };
    const cost = buildCost(decision.route, context);

    return this.build({
      ...decision,
      risk,
      cost,
      context,
      intent,
      signals,
    });
  }

  private buildCandidates(input: {
    lowSignalChat: boolean;
    memoryIntent: boolean;
    capabilityIntent: boolean;
    toolIntent: boolean;
    operationalIntent: boolean;
    textDanger: boolean;
    textAttention: boolean;
    transactionApprovalIntent: boolean;
    transactionPreviewIntent: boolean;
    requestedTools: string[];
    approvalRequiredTools: string[];
  }): NaturalFirstIntentKind[] {
    const candidates: NaturalFirstIntentKind[] = [];
    if (input.lowSignalChat) {
      candidates.push('low-signal-chat');
    }
    if (input.memoryIntent) {
      candidates.push('memory-recall');
    }
    if (input.capabilityIntent) {
      candidates.push('capability-discovery');
    }
    if (input.toolIntent || input.requestedTools.length > 0) {
      candidates.push('tool-use');
    }
    if (input.transactionPreviewIntent) {
      candidates.push('tool-use');
    }
    if (input.operationalIntent) {
      candidates.push('operational-work');
    }
    if (input.textDanger || input.transactionApprovalIntent || input.approvalRequiredTools.length > 0) {
      candidates.push('sensitive-action');
    } else if (input.textAttention) {
      candidates.push('tool-use');
    }
    if (candidates.length === 0) {
      candidates.push('free-text-question');
    }
    return Array.from(new Set(candidates));
  }

  private decideRoute(input: {
    rawText: string;
    lowSignalChat: boolean;
    memoryIntent: boolean;
    capabilityIntent: boolean;
    toolIntent: boolean;
    operationalIntent: boolean;
    transactionApprovalIntent: boolean;
    transactionPreviewIntent: boolean;
    textDanger: boolean;
    highestRisk: NaturalFirstRiskLevel;
    approvalRequiredTools: string[];
  }): RouteDecisionInput {
    if (/^\s*\//.test(input.rawText)) {
      return {
        route: 'slash-command',
        intent: 'slash-command',
        effort: 'light',
        usesLlm: 'not-required',
        reason: 'Slash command preserves the command router as an operator shortcut.',
        signals: ['slash-command'],
        shouldEnterGateway: false,
      };
    }

    if (input.transactionApprovalIntent) {
      return {
        route: 'approval-proposal',
        intent: 'sensitive-action',
        effort: 'standard',
        usesLlm: 'optional',
        reason: 'Transactional purchase, payment, trade, or value requests require governed preview and approval.',
        signals: ['transaction-intent', 'approval-required'],
      };
    }

    if (input.transactionPreviewIntent) {
      return {
        route: 'tool-preview',
        intent: 'tool-use',
        effort: 'standard',
        usesLlm: 'optional',
        reason: 'Observational transactional request should become governed preview without live execution.',
        signals: ['transaction-preview-intent', 'preview-required'],
      };
    }

    if (input.textDanger || input.highestRisk === 'danger' || input.approvalRequiredTools.length > 0) {
      return {
        route: 'approval-proposal',
        intent: 'sensitive-action',
        effort: 'standard',
        usesLlm: 'optional',
        reason: 'request suggests a sensitive mutation or a tool that requires approval.',
        signals: ['sensitive-action', 'approval-required'],
      };
    }

    if (input.toolIntent) {
      return {
        route: 'tool-preview',
        intent: 'tool-use',
        effort: 'standard',
        usesLlm: 'optional',
        reason: 'Request suggests a tool/command and should become governed preview before execution.',
        signals: ['tool-intent', 'preview-required'],
      };
    }

    if (input.operationalIntent) {
      return {
        route: 'governed-execution',
        intent: 'operational-work',
        effort: 'heavy',
        usesLlm: 'preferred',
        reason: 'request appears to be operational work that should enter the governed agent runtime.',
        signals: ['operational-intent'],
      };
    }

    if (input.memoryIntent) {
      return {
        route: 'memory-recall',
        intent: 'memory-recall',
        effort: 'standard',
        usesLlm: 'preferred',
        reason: 'Request asks for continuity, memory, or experience reuse.',
        signals: ['memory-intent'],
      };
    }

    if (input.capabilityIntent) {
      return {
        route: 'capability-discovery',
        intent: 'capability-discovery',
        effort: 'standard',
        usesLlm: 'preferred',
        reason: 'Request asks for capability discovery or configuration.',
        signals: ['capability-intent'],
      };
    }

    if (input.lowSignalChat) {
      return {
        route: 'light-chat',
        intent: 'low-signal-chat',
        effort: 'light',
        usesLlm: 'optional',
        reason: 'Simple conversational message enters the gateway with minimal cost.',
        signals: ['low-signal-chat'],
      };
    }

    return {
      route: 'llm-reply',
      intent: 'free-text-question',
      effort: 'standard',
      usesLlm: 'preferred',
      reason: 'Free-text turns use the agent runtime; the LLM chooses tools.',
      signals: ['free-text'],
    };
  }

  private buildRisk(input: {
    highestRisk: NaturalFirstRiskLevel;
    textDanger: boolean;
    textAttention: boolean;
    toolRisk: NaturalFirstRiskLevel;
    requestedTools: string[];
    approvalRequiredTools: string[];
    transactionApprovalIntent: boolean;
    transactionPreviewIntent: boolean;
    route: NaturalFirstRoute;
  }): NaturalFirstRunRisk {
    const reasons = [
      ...(input.textDanger ? ['dangerous-text-intent'] : []),
      ...(input.textAttention ? ['attention-text-intent'] : []),
      ...(input.transactionApprovalIntent ? ['transaction-approval-intent'] : []),
      ...(input.transactionPreviewIntent ? ['transaction-preview-intent'] : []),
      ...(input.requestedTools.length > 0 ? [`requested-tools:${input.requestedTools.length}`] : []),
      ...(input.approvalRequiredTools.length > 0
        ? [`approval-required-tools:${input.approvalRequiredTools.join(',')}`]
        : []),
      ...(input.toolRisk !== 'safe' ? [`tool-risk:${input.toolRisk}`] : []),
    ];
    const requiresApproval =
      input.route === 'approval-proposal' || input.highestRisk === 'danger' || input.approvalRequiredTools.length > 0;
    return {
      level: input.highestRisk,
      requiresApproval,
      previewRequired: input.route === 'tool-preview' || requiresApproval,
      reasons: reasons.length > 0 ? reasons : ['no-mutable-risk-detected'],
    };
  }

  private build(
    input: Omit<
      NaturalFirstRunClassification,
      'source' | 'contractVersion' | 'mode' | 'shouldEnterGateway' | 'requiresApproval'
    > & {
      shouldEnterGateway?: boolean;
    },
  ): NaturalFirstRunClassification {
    return {
      source: 'NaturalFirstRunClassifier',
      contractVersion: 'natural-first-classifier/4',
      mode: 'natural-first-agent-runtime',
      ...input,
      requiresApproval: input.risk.requiresApproval,
      shouldEnterGateway: input.shouldEnterGateway ?? true,
    };
  }
}
