import {
  ZAVORTH_CONTEXT_RECOVERY_ASSIMILATION_CONTRACT_VERSION,
  type ZavorthContextRecoveryContextEntry,
  type ZavorthContextRecoveryContextPack,
  type ZavorthContextRecoveryFailureClassification,
  type ZavorthContextRecoveryFailureKind,
  type ZavorthContextRecoveryInput,
  type ZavorthContextRecoveryMemoryFact,
  type ZavorthContextRecoveryMemoryLayer,
  type ZavorthContextRecoveryNextAction,
  type ZavorthContextRecoveryPlan,
  type ZavorthContextRecoveryReceipt,
  type ZavorthContextRecoverySnapshot,
  type ZavorthContextRecoveryStatus,
} from '../contracts/ZavorthContextRecoveryAssimilationContract.js';
import type {
  ZavorthReasoningActionPatternInput,
  ZavorthReasoningActionPatternSnapshot,
} from '../contracts/ZavorthReasoningActionPatternContract.js';
import { ZavorthReasoningActionPatternService } from './ZavorthReasoningActionPatternService.js';

type Runtime = {
  now?: () => Date;
  actionPatterns?: Pick<ZavorthReasoningActionPatternService, 'plan'>;
};

const SECRET_PATTERNS = [
  /\b(?:token|secret|senha|password|api[_ -]?key|chave)\s*[:=]\s*[^\s,;]+/gi,
  /\bsk-[A-Za-z0-9_-]{10,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9_]{10,}\b/g,
  /\bxox[baprs]-[A-Za-z0-9-]{8,}\b/g,
  /\b(?:id_rsa|credentials\.json|secrets?\.json|\.env)\b/gi,
];

export class ZavorthContextRecoveryAssimilationService {
  private readonly now: () => Date;
  private readonly actionPatterns: Pick<ZavorthReasoningActionPatternService, 'plan'>;

  public constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.actionPatterns = runtime.actionPatterns || new ZavorthReasoningActionPatternService({
      now: this.now,
    });
  }

  public buildSnapshot(input: ZavorthContextRecoveryInput): ZavorthContextRecoverySnapshot {
    const generatedAt = this.now().toISOString();
    const text = normalizeText(input.text);
    const actionPattern = this.actionPatterns.plan(toActionPatternInput(input, text));
    const contextPack = buildContextPack({
      input,
      text,
      sessionId: normalizeText(input.sessionId, 'default-session'),
    });
    const failure = classifyFailure(input, actionPattern);
    const recovery = buildRecoveryPlan(failure, actionPattern);
    const status = resolveStatus(actionPattern, failure, recovery);
    const receipts = buildReceipts(status, contextPack, failure, recovery, actionPattern);
    const summary = {
      hot: contextPack.hot.length,
      warm: contextPack.warm.length,
      cold: contextPack.cold.length,
      warnings: contextPack.warnings.length,
      receipts: receipts.length,
      retryBudgetRemaining: recovery.retryBudgetRemaining,
    };

    return {
      generatedAt,
      contractVersion: ZAVORTH_CONTEXT_RECOVERY_ASSIMILATION_CONTRACT_VERSION,
      source: 'ZavorthContextRecoveryAssimilationService',
      phase: 'phase-3-context-memory-error-recovery',
      status,
      request: {
        surface: normalizeText(input.surface, 'conversation'),
        actorId: nullable(input.actorId),
        textPreview: preview(text),
        rawSecretsSerialized: false,
      },
      actionPattern,
      contextPack,
      failure,
      recovery,
      receipts,
      safety: {
        compactContextOnly: true,
        rawTranscriptSerialized: false,
        rawMemorySerialized: false,
        rawFailurePayloadSerialized: false,
        secretsSerialized: false,
        ledgerBeatsRecall: true,
        lowConfidenceMemoryNeedsVerification: true,
        noRawChainOfThought: true,
        policyDecisionInheritedFromPhase2: true,
      },
      summary,
      commands: {
        report: 'npx tsx scripts/zavorth-context-recovery-assimilation.ts --text "<request>"',
        json: 'npx tsx scripts/zavorth-context-recovery-assimilation.ts --json --text "<request>"',
        check: 'node scripts/zavorth-context-recovery-assimilation-check.mjs',
        nextPhase: 'Phase 4 - Tool Orchestration And Verification Assimilation',
      },
      narrative: buildNarrative(status, failure, recovery),
    };
  }

  public formatSnapshotText(snapshot: ZavorthContextRecoverySnapshot): string {
    const lines = [
      'Zavorth Context Memory And Error Recovery - Phase 3',
      '',
      `Status: ${snapshot.status}`,
      `Failure: ${snapshot.failure.kind} | retryable=${snapshot.failure.retryable} | attempt=${snapshot.failure.attempt}`,
      `Context: hot=${snapshot.summary.hot} | warm=${snapshot.summary.warm} | cold=${snapshot.summary.cold} | warnings=${snapshot.summary.warnings}`,
      `Recovery: ${snapshot.recovery.nextAction} | retryBudget=${snapshot.recovery.retryBudgetRemaining}`,
      '',
      'Context pack:',
      ...[...snapshot.contextPack.hot, ...snapshot.contextPack.warm, ...snapshot.contextPack.cold]
        .slice(0, 8)
        .map((entry) => `- ${entry.layer}/${entry.usePolicy}: ${entry.summary}`),
      '',
      'Recovery steps:',
      ...snapshot.recovery.steps.map((step) => `- ${step}`),
      '',
      'Receipts:',
      ...snapshot.receipts.map((receipt) => `- ${receipt.kind}: ${receipt.status} | ${receipt.summary}`),
      '',
      `Next: ${snapshot.commands.nextPhase}`,
    ];
    return lines.join('\n');
  }
}

function toActionPatternInput(
  input: ZavorthContextRecoveryInput,
  text: string,
): ZavorthReasoningActionPatternInput {
  return {
    text,
    surface: input.surface,
    actorId: input.actorId,
    availableSurfaces: input.availableSurfaces,
    approvalId: input.approvalId,
    ownerConfirmed: input.ownerConfirmed,
  };
}

function buildContextPack(input: {
  input: ZavorthContextRecoveryInput;
  text: string;
  sessionId: string;
}): ZavorthContextRecoveryContextPack {
  const warnings: string[] = [];
  const entries: ZavorthContextRecoveryContextEntry[] = [];
  const pushEntry = (entry: ZavorthContextRecoveryContextEntry) => {
    if (entry.summary.includes('[redacted]')) warnings.push(`Redacted sensitive value from ${entry.id}.`);
    if (entry.confidence < 0.55) warnings.push(`Low confidence memory ${entry.id} requires verification.`);
    entries.push(entry);
  };

  const events = Array.isArray(input.input.recentEvents) ? input.input.recentEvents : [];
  events.slice(-5).forEach((event, index) => {
    pushEntry(contextEntry({
      id: `hot-event-${index + 1}`,
      layer: 'hot',
      source: 'recent-events',
      summary: event,
      confidence: 0.9,
      retentionHint: 'session',
    }));
  });

  const facts = Array.isArray(input.input.memoryFacts) ? input.input.memoryFacts : [];
  facts.slice(0, 12).forEach((fact, index) => {
    const confidence = clampConfidence(fact.confidence);
    const layer = normalizeLayer(fact.layer, confidence);
    pushEntry(contextEntry({
      id: normalizeText(fact.id, `memory-${index + 1}`),
      layer,
      source: normalizeText(fact.source, 'operator-memory'),
      summary: fact.summary,
      confidence,
      retentionHint: layer === 'cold' ? 'long_term' : 'workspace',
    }));
  });

  if (normalizeText(input.input.priorSummary)) {
    pushEntry(contextEntry({
      id: 'cold-prior-summary',
      layer: 'cold',
      source: 'prior-summary',
      summary: String(input.input.priorSummary),
      confidence: 0.7,
      retentionHint: 'workspace',
    }));
  }

  if (entries.length === 0) {
    pushEntry(contextEntry({
      id: 'hot-request',
      layer: 'hot',
      source: 'request',
      summary: `Current request only: ${preview(input.text) || 'empty request'}.`,
      confidence: 1,
      retentionHint: 'session',
    }));
  }

  const hot = entries.filter((entry) => entry.layer === 'hot').slice(0, 6);
  const warm = entries.filter((entry) => entry.layer === 'warm').slice(0, 6);
  const cold = entries.filter((entry) => entry.layer === 'cold').slice(0, 4);
  const estimatedTokens = estimateTokens([...hot, ...warm, ...cold].map((entry) => entry.summary).join('\n'));

  return {
    sessionId: input.sessionId,
    tokenBudget: 1800,
    estimatedTokens,
    hot,
    warm,
    cold,
    warnings,
    rawMemorySerialized: false,
    secretsSerialized: false,
    untrustedMemoryRequiresVerification: true,
  };
}

function contextEntry(input: {
  id: string;
  layer: ZavorthContextRecoveryMemoryLayer;
  source: string;
  summary: string;
  confidence: number;
  retentionHint: ZavorthContextRecoveryContextEntry['retentionHint'];
}): ZavorthContextRecoveryContextEntry {
  const summary = redact(preview(normalizeText(input.summary)));
  const confidence = clampConfidence(input.confidence);
  return {
    id: input.id,
    layer: input.layer,
    source: input.source,
    summary,
    confidence,
    trusted: confidence >= 0.75,
    retentionHint: input.retentionHint,
    usePolicy: confidence >= 0.85 ? 'authoritative' : confidence >= 0.55 ? 'supporting' : 'needs_verification',
  };
}

function classifyFailure(
  input: ZavorthContextRecoveryInput,
  actionPattern: ZavorthReasoningActionPatternSnapshot,
): ZavorthContextRecoveryFailureClassification {
  const failure = input.lastFailure || null;
  if (!failure) {
    const inherited = classifyFromActionPattern(actionPattern);
    if (inherited.kind !== 'none') return inherited;
    return {
      kind: 'none',
      severity: 'none',
      retryable: false,
      repeatedFailure: false,
      failedToolId: null,
      attempt: 0,
      summary: 'No failure provided; continue with the Phase 2 action pattern.',
      evidence: ['phase-2-action-pattern'],
    };
  }

  const message = normalizeText(failure.message, 'unknown failure');
  const normalized = normalizeForMatch(message);
  const attempt = Math.max(1, Number(failure.attempt || 1) || 1);
  const kind = inferFailureKind(normalized, actionPattern);
  const retryable = failure.retryable ?? isRetryable(kind, attempt);
  return {
    kind,
    severity: kind === 'policy_block' || kind === 'secret_risk' ? 'blocker' : 'warning',
    retryable,
    repeatedFailure: attempt > 1,
    failedToolId: nullable(failure.toolId),
    attempt,
    summary: redact(preview(message)),
    evidence: [
      failure.code ? `code:${redact(String(failure.code))}` : 'code:none',
      `attempt:${attempt}`,
      `phase2:${actionPattern.status}`,
    ],
  };
}

function classifyFromActionPattern(actionPattern: ZavorthReasoningActionPatternSnapshot): ZavorthContextRecoveryFailureClassification {
  if (actionPattern.status === 'blocked') {
    return phase2Failure('policy_block', 'Phase 2 blocked the unsafe action.', 'blocker', false, actionPattern.status);
  }
  if (actionPattern.status === 'approval-required') {
    return phase2Failure('approval_missing', 'Phase 2 requires approval before impact.', 'warning', false, actionPattern.status);
  }
  if (actionPattern.status === 'needs-setup') {
    return phase2Failure('missing_setup', 'A required local capability is not configured yet.', 'warning', false, actionPattern.status);
  }
  return phase2Failure('none', 'No failure inferred from Phase 2.', 'none', false, actionPattern.status);
}

function phase2Failure(
  kind: ZavorthContextRecoveryFailureKind,
  summary: string,
  severity: ZavorthContextRecoveryFailureClassification['severity'],
  retryable: boolean,
  status: string,
): ZavorthContextRecoveryFailureClassification {
  return {
    kind,
    severity,
    retryable,
    repeatedFailure: false,
    failedToolId: null,
    attempt: 0,
    summary,
    evidence: [`phase2:${status}`],
  };
}

function inferFailureKind(
  normalized: string,
  actionPattern: ZavorthReasoningActionPatternSnapshot,
): ZavorthContextRecoveryFailureKind {
  if (hasAny(normalized, ['secret', 'token', 'credential', 'senha', 'api key'])) return 'secret_risk';
  if (actionPattern.status === 'blocked' || hasAny(normalized, ['policy', 'bloqueado', 'denied', 'forbidden'])) return 'policy_block';
  if (actionPattern.status === 'approval-required' || hasAny(normalized, ['approval', 'aprovacao', 'confirmacao'])) return 'approval_missing';
  if (actionPattern.status === 'needs-setup' || hasAny(normalized, ['not configured', 'missing', 'nao configurado', 'adb not found', 'binary not found', 'setup'])) return 'missing_setup';
  if (hasAny(normalized, ['ambiguous', 'ambiguo', 'nao entendi', 'unknown intent'])) return 'ambiguous_request';
  if (hasAny(normalized, ['assert', 'test failed', 'verification', 'validacao falhou', 'screenshot mismatch'])) return 'verification_failed';
  if (hasAny(normalized, ['rate limit', 'provider', 'model', 'timeout', 'quota'])) return 'provider_error';
  if (hasAny(normalized, ['ssrf', 'egress', 'enotfound', 'econn', 'network', 'localhost', '169.254.169.254'])) return 'network_blocked';
  if (hasAny(normalized, ['tool', 'command failed', 'exit code', 'erro de ferramenta'])) return 'tool_error';
  return 'unknown';
}

function buildRecoveryPlan(
  failure: ZavorthContextRecoveryFailureClassification,
  actionPattern: ZavorthReasoningActionPatternSnapshot,
): ZavorthContextRecoveryPlan {
  const retryBudgetRemaining = Math.max(0, 2 - failure.attempt);
  const retryAllowed = failure.retryable && retryBudgetRemaining > 0 && actionPattern.status !== 'blocked';
  const nextAction = resolveNextAction(failure, actionPattern, retryAllowed);
  return {
    nextAction,
    retryAllowed,
    retryBudgetRemaining,
    maxRetries: 2,
    retryOnlyWhenEvidenceChanges: true,
    avoidSameFailingToolUntilEvidenceChanges: true,
    askUserWhenAmbiguous: true,
    rollbackRequiredBeforeMutationRetry: true,
    steps: recoverySteps(nextAction, failure, actionPattern),
    stopConditions: [
      'Do not retry forbidden or secret-risk actions.',
      'Do not repeat the same failing tool unless new evidence changes the expected result.',
      'Do not retry workspace mutation without rollback evidence.',
      'Ask the user when the next safe route is ambiguous.',
    ],
  };
}

function resolveNextAction(
  failure: ZavorthContextRecoveryFailureClassification,
  actionPattern: ZavorthReasoningActionPatternSnapshot,
  retryAllowed: boolean,
): ZavorthContextRecoveryNextAction {
  if (failure.kind === 'none') return 'proceed';
  if (failure.kind === 'policy_block' || failure.kind === 'secret_risk') return 'stop_and_report';
  if (failure.kind === 'approval_missing' || actionPattern.status === 'approval-required') return 'request_approval';
  if (failure.kind === 'missing_setup' || actionPattern.status === 'needs-setup') return 'run_setup';
  if (failure.kind === 'ambiguous_request') return 'ask_user';
  if (retryAllowed && (failure.kind === 'tool_error' || failure.kind === 'provider_error')) return 'retry_with_new_evidence';
  if (retryAllowed && failure.kind === 'verification_failed') return 'retry_safer_route';
  if (failure.kind === 'network_blocked') return 'request_approval';
  return 'stop_and_report';
}

function recoverySteps(
  nextAction: ZavorthContextRecoveryNextAction,
  failure: ZavorthContextRecoveryFailureClassification,
  actionPattern: ZavorthReasoningActionPatternSnapshot,
): string[] {
  const common = [
    'Summarize what happened before taking another action.',
    'Carry forward only compact context entries with source and confidence.',
  ];
  if (nextAction === 'proceed') return [...common, 'Proceed with the Phase 2 allowed actions.'];
  if (nextAction === 'request_approval') return [...common, 'Show the approval boundary and wait for owner confirmation before impact.'];
  if (nextAction === 'run_setup') return [...common, 'Run the relevant doctor/setup preset before retrying.'];
  if (nextAction === 'ask_user') return [...common, 'Ask one concise clarification question and pause execution.'];
  if (nextAction === 'retry_with_new_evidence') {
    return [
      ...common,
      `Avoid repeating ${failure.failedToolId || 'the failed tool'} until new evidence is available.`,
      'Use the safest equivalent read-only route before any mutation.',
    ];
  }
  if (nextAction === 'retry_safer_route') {
    return [
      ...common,
      'Re-run verification with a narrower target and compare against the previous failure.',
      actionPattern.summary.approvalRequired > 0 ? 'Keep approval boundaries visible before applying any fix.' : 'Keep the retry read-only unless a new approval is issued.',
    ];
  }
  return [...common, 'Stop execution and report the blocked reason plus a safe alternative.'];
}

function resolveStatus(
  actionPattern: ZavorthReasoningActionPatternSnapshot,
  failure: ZavorthContextRecoveryFailureClassification,
  recovery: ZavorthContextRecoveryPlan,
): ZavorthContextRecoveryStatus {
  if (failure.kind === 'policy_block' || failure.kind === 'secret_risk' || actionPattern.status === 'blocked') return 'blocked';
  if (recovery.nextAction === 'request_approval' || actionPattern.status === 'approval-required') return 'approval-required';
  if (recovery.nextAction === 'run_setup' || actionPattern.status === 'needs-setup') return 'needs-setup';
  if (recovery.nextAction === 'ask_user') return 'needs-user-clarification';
  if (failure.kind !== 'none') return 'recovery-ready';
  return 'ready';
}

function buildReceipts(
  status: ZavorthContextRecoveryStatus,
  contextPack: ZavorthContextRecoveryContextPack,
  failure: ZavorthContextRecoveryFailureClassification,
  recovery: ZavorthContextRecoveryPlan,
  actionPattern: ZavorthReasoningActionPatternSnapshot,
): ZavorthContextRecoveryReceipt[] {
  const receipts: ZavorthContextRecoveryReceipt[] = [
    {
      id: 'receipt-phase-3-context-pack',
      kind: 'phase-3-context-pack',
      status: 'recorded',
      summary: `Context pack built with ${contextPack.hot.length} hot, ${contextPack.warm.length} warm and ${contextPack.cold.length} cold entries.`,
    },
    {
      id: 'receipt-memory-safety',
      kind: 'memory-safety',
      status: 'recorded',
      summary: 'Only compact redacted memory summaries were serialized; ledger remains authoritative over recall.',
    },
    {
      id: 'receipt-failure-classification',
      kind: 'failure-classification',
      status: failure.severity === 'blocker' ? 'blocked' : 'recorded',
      summary: `${failure.kind}: ${failure.summary}`,
    },
    {
      id: 'receipt-recovery-plan',
      kind: 'recovery-plan',
      status: status === 'blocked' ? 'blocked' : 'recorded',
      summary: `${recovery.nextAction}; retry budget remaining ${recovery.retryBudgetRemaining}.`,
    },
  ];
  if (status === 'approval-required' || actionPattern.status === 'approval-required') {
    receipts.push({
      id: 'receipt-approval-boundary',
      kind: 'approval-boundary',
      status: 'requires-approval',
      summary: 'Phase 3 inherited the approval boundary from Phase 2 or failure recovery.',
    });
  }
  if (status === 'blocked' || !recovery.retryAllowed) {
    receipts.push({
      id: 'receipt-blocked-retry',
      kind: 'blocked-retry',
      status: status === 'blocked' ? 'blocked' : 'recorded',
      summary: 'Retry is limited by policy, retry budget or missing evidence.',
    });
  }
  return receipts;
}

function buildNarrative(
  status: ZavorthContextRecoveryStatus,
  failure: ZavorthContextRecoveryFailureClassification,
  recovery: ZavorthContextRecoveryPlan,
): ZavorthContextRecoverySnapshot['narrative'] {
  if (status === 'blocked') {
    return {
      headline: 'Recovery blocked by policy',
      operatorSummary: 'The failure or requested action is unsafe to retry automatically.',
      nextAction: 'Report the block and offer a safe dry-run, clarification or approval path.',
    };
  }
  if (status === 'approval-required') {
    return {
      headline: 'Recovery waits for approval',
      operatorSummary: 'The next safe step has live impact or sensitive boundary risk.',
      nextAction: 'Ask for owner approval using the recovery receipt.',
    };
  }
  if (status === 'needs-setup') {
    return {
      headline: 'Recovery needs setup',
      operatorSummary: 'The request is understood, but a local capability is not ready yet.',
      nextAction: 'Run the relevant setup doctor, then retry with the same compact context.',
    };
  }
  if (status === 'needs-user-clarification') {
    return {
      headline: 'Clarification required',
      operatorSummary: 'The safest route depends on missing user intent.',
      nextAction: 'Ask one short question and pause before retrying.',
    };
  }
  if (status === 'recovery-ready') {
    return {
      headline: 'Safe recovery plan ready',
      operatorSummary: `${failure.kind} can continue through ${recovery.nextAction}.`,
      nextAction: 'Apply the recovery steps without repeating the failing route blindly.',
    };
  }
  return {
    headline: 'Context pack ready',
    operatorSummary: 'No failure was detected; use compact context and Phase 2 action patterns.',
    nextAction: 'Proceed with allowed actions and targeted verification.',
  };
}

function isRetryable(kind: ZavorthContextRecoveryFailureKind, attempt: number): boolean {
  if (attempt >= 2) return false;
  return kind === 'tool_error' || kind === 'provider_error' || kind === 'verification_failed' || kind === 'unknown';
}

function normalizeLayer(
  value: ZavorthContextRecoveryMemoryFact['layer'],
  confidence: number,
): ZavorthContextRecoveryMemoryLayer {
  if (value === 'hot' || value === 'warm' || value === 'cold') return value;
  if (confidence >= 0.9) return 'warm';
  if (confidence >= 0.55) return 'warm';
  return 'cold';
}

function clampConfidence(value: unknown): number {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return 0.65;
  return Math.max(0, Math.min(1, numberValue));
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text || fallback;
}

function normalizeForMatch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function nullable(value: unknown): string | null {
  const text = normalizeText(value);
  return text || null;
}

function preview(text: string): string {
  return text.length > 180 ? `${text.slice(0, 177)}...` : text;
}

function redact(text: string): string {
  let output = text;
  for (const pattern of SECRET_PATTERNS) output = output.replace(pattern, '[redacted]');
  return output;
}

function hasAny(text: string, needles: string[]): boolean {
  return needles.some((needle) => text.includes(needle));
}
