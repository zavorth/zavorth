import { createHash, randomUUID } from 'node:crypto';
import type {
  SecurityPolicyBrokerDecision,
  SecurityPolicyBrokerReceipt,
} from '../../security/SecurityPolicyBroker.js';
import type {
  ZavorthActionGatewayInput,
  ZavorthActionReceipt,
  ZavorthActionResult,
} from '../actions/ZavorthActionContracts.js';

export const OPERATOR_CONTINUITY_ENVELOPE_KIND = 'operator-continuity-envelope' as const;
export const OPERATOR_CONTINUITY_ENVELOPE_VERSION = 1 as const;

export type OperatorContinuitySurface =
  | 'control'
  | 'public-api'
  | 'agent-native-tool-loop'
  | 'tool-executor'
  | 'action-gateway'
  | 'code-tui'
  | 'channel'
  | 'mcp'
  | 'cli'
  | 'disk-mutation'
  | 'execution-gateway'
  | 'echo'
  | string;

export type OperatorContinuityExecutionMode =
  | 'observation'
  | 'preview'
  | 'deferred'
  | 'applied'
  | 'blocked'
  | 'failed'
  | 'approval_required';

export type OperatorContinuityDecisionSource =
  | 'security-policy-broker'
  | 'effect-boundary'
  | 'agent-security-policy'
  | 'action-gateway'
  | 'mutation-plane'
  | 'tool-exposure'
  | 'public-api-gate'
  | 'mcp-policy'
  | string;

export type OperatorContinuityIds = {
  continuityId: string;
  requestId: string;
  decisionId?: string;
  resultId?: string;
  receiptId?: string;
  correlation?: {
    runId?: string | null;
    sessionId?: string | null;
    taskId?: string | null;
    toolCallId?: string | null;
    actionId?: string | null;
    mutationPlanId?: string | null;
    policyBrokerReceiptId?: string | null;
    actionReceiptId?: string | null;
    traceId?: string | null;
    parentContinuityId?: string | null;
  };
};

export type OperatorContinuityRequest = {
  surface: OperatorContinuitySurface;
  operation: string;
  target: string;
  actorId?: string | null;
  sourceSurface?: string | null;
  argsDigest?: string;
  metadata?: Record<string, unknown>;
};

export type OperatorContinuityDecision = {
  source: OperatorContinuityDecisionSource;
  action: string;
  allowed: boolean;
  rule: string;
  reasons: string[];
  risk?: string;
  requiresApproval?: boolean;
  brokerReceipt?: SecurityPolicyBrokerReceipt | null;
  mutationPlanId?: string | null;
};

export type OperatorContinuityResult = {
  ok: boolean;
  status: OperatorContinuityExecutionMode | string;
  summary: string;
  outputDigest?: string;
  data?: Record<string, unknown>;
};

export type OperatorContinuityReceipt = {
  receiptId: string;
  generatedAt: string;
  ids: OperatorContinuityIds;
  request: OperatorContinuityRequest;
  decision: OperatorContinuityDecision | null;
  result: OperatorContinuityResult | null;
  terminal: boolean;
};

export type OperatorContinuityEnvelope = {
  kind: typeof OPERATOR_CONTINUITY_ENVELOPE_KIND;
  version: typeof OPERATOR_CONTINUITY_ENVELOPE_VERSION;
  generatedAt: string;
  closedAt?: string;
  ids: OperatorContinuityIds;
  request: OperatorContinuityRequest | null;
  decision: OperatorContinuityDecision | null;
  result: OperatorContinuityResult | null;
  receipt: OperatorContinuityReceipt | null;
};

export type OperatorContinuityKernelRuntime = {
  now?: () => Date;
  createId?: () => string;
};

function defaultNow(): Date {
  return new Date();
}

function defaultCreateId(): string {
  return randomUUID();
}

function cloneEnvelope(envelope: OperatorContinuityEnvelope): OperatorContinuityEnvelope {
  return {
    kind: envelope.kind,
    version: envelope.version,
    generatedAt: envelope.generatedAt,
    ...(envelope.closedAt ? { closedAt: envelope.closedAt } : {}),
    ids: {
      ...envelope.ids,
      ...(envelope.ids.correlation
        ? { correlation: { ...envelope.ids.correlation } }
        : {}),
    },
    request: envelope.request ? { ...envelope.request, ...(envelope.request.metadata ? { metadata: { ...envelope.request.metadata } } : {}) } : null,
    decision: envelope.decision
      ? {
          ...envelope.decision,
          reasons: [...envelope.decision.reasons],
          ...(envelope.decision.brokerReceipt
            ? { brokerReceipt: { ...envelope.decision.brokerReceipt } }
            : {}),
        }
      : null,
    result: envelope.result
      ? {
          ...envelope.result,
          ...(envelope.result.data ? { data: { ...envelope.result.data } } : {}),
        }
      : null,
    receipt: envelope.receipt
      ? {
          ...envelope.receipt,
          ids: {
            ...envelope.receipt.ids,
            ...(envelope.receipt.ids.correlation
              ? { correlation: { ...envelope.receipt.ids.correlation } }
              : {}),
          },
          request: { ...envelope.receipt.request },
          decision: envelope.receipt.decision
            ? {
                ...envelope.receipt.decision,
                reasons: [...envelope.receipt.decision.reasons],
              }
            : null,
          result: envelope.receipt.result ? { ...envelope.receipt.result } : null,
        }
      : null,
  };
}

export function digestOperatorPayload(value: unknown, maxChars = 240): string {
  const raw = typeof value === 'string' ? value : safeJson(value);
  const truncated = raw.length > maxChars ? `${raw.slice(0, maxChars)}…` : raw;
  const hash = createHash('sha256').update(raw).digest('hex').slice(0, 16);
  return `sha256:${hash}:len=${raw.length}:${truncated}`;
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

export function createOperatorContinuityIds(
  partial: Partial<OperatorContinuityIds> = {},
  createId: () => string = defaultCreateId,
): OperatorContinuityIds {
  const continuityId = String(partial.continuityId || '').trim() || createId();
  const requestId = String(partial.requestId || '').trim() || createId();
  return {
    continuityId,
    requestId,
    ...(partial.decisionId ? { decisionId: partial.decisionId } : {}),
    ...(partial.resultId ? { resultId: partial.resultId } : {}),
    ...(partial.receiptId ? { receiptId: partial.receiptId } : {}),
    ...(partial.correlation ? { correlation: { ...partial.correlation } } : {}),
  };
}

export function decisionFromBroker(
  decision: SecurityPolicyBrokerDecision,
  extras: Partial<OperatorContinuityDecision> = {},
): OperatorContinuityDecision {
  return {
    source: 'security-policy-broker',
    action: decision.action,
    allowed: decision.allowed,
    rule: decision.rule,
    reasons: [...decision.reasons],
    risk: decision.receipt.risk,
    requiresApproval: decision.requiresUserConfirmation || decision.requiresAdminPolicy,
    brokerReceipt: decision.receipt,
    ...extras,
  };
}

export function decisionFromEffectBoundary(input: {
  action: string;
  allowed: boolean;
  rule: string;
  reasons: string[];
  risk?: string;
  requiresApproval?: boolean;
  mutationPlanId?: string | null;
}): OperatorContinuityDecision {
  return {
    source: 'effect-boundary',
    action: input.action,
    allowed: input.allowed,
    rule: input.rule,
    reasons: [...input.reasons],
    ...(input.risk ? { risk: input.risk } : {}),
    ...(typeof input.requiresApproval === 'boolean'
      ? { requiresApproval: input.requiresApproval }
      : {}),
    ...(input.mutationPlanId !== undefined
      ? { mutationPlanId: input.mutationPlanId }
      : {}),
  };
}

export function decisionFromActionResult(
  result: Pick<ZavorthActionResult, 'status' | 'summary' | 'ok' | 'data'>,
): OperatorContinuityDecision {
  const status = result.status;
  const allowed = status === 'ok' || status === 'preview' || status === 'applied';
  const requiresApproval = status === 'approval_required';
  const mutationPlanId = result.data && typeof result.data.mutationPlanId === 'string'
    ? result.data.mutationPlanId
    : null;
  return {
    source: 'action-gateway',
    action: status,
    allowed: allowed && !requiresApproval,
    rule: `action-gateway:${status}`,
    reasons: [result.summary],
    requiresApproval,
    mutationPlanId,
  };
}

export function requestFromActionGatewayInput(
  input: ZavorthActionGatewayInput,
): OperatorContinuityRequest {
  return {
    surface: 'action-gateway',
    operation: input.operation,
    target: String(input.actionId || input.query || '').trim() || '<unknown>',
    actorId: input.actorId || null,
    sourceSurface: input.sourceSurface || null,
    argsDigest: digestOperatorPayload(input.args || {}),
    metadata: {
      domain: input.domain || null,
      hasApprovalId: Boolean(String(input.approvalId || '').trim()),
      trustedOperatorConfirmation: input.trustedOperatorConfirmation === true,
    },
  };
}

export function resultFromActionResult(
  result: ZavorthActionResult,
): OperatorContinuityResult {
  const mode: OperatorContinuityExecutionMode =
    result.status === 'applied'
      ? 'applied'
      : result.status === 'preview'
        ? 'preview'
        : result.status === 'approval_required'
          ? 'approval_required'
          : result.status === 'blocked' || result.status === 'not_found'
            ? 'blocked'
            : result.ok ? 'observation'
              : 'failed';
  return {
    ok: result.ok,
    status: mode,
    summary: result.summary,
    outputDigest: digestOperatorPayload(result.lines || []),
    data: {
      actionId: result.actionId,
      operation: result.operation,
      gatewayStatus: result.status,
      ...(result.receipt ? { actionReceiptId: result.receipt.id } : {}),
    },
  };
}

export function resultFromToolOutcome(input: {
  ok: boolean;
  summary: string;
  status?: OperatorContinuityExecutionMode | string;
  output?: unknown;
  data?: Record<string, unknown>;
}): OperatorContinuityResult {
  return {
    ok: input.ok,
    status: input.status || (input.ok ? 'applied' : 'failed'),
    summary: input.summary,
    ...(input.output !== undefined ? { outputDigest: digestOperatorPayload(input.output) } : {}),
    ...(input.data ? { data: input.data } : {}),
  };
}

export function mergeCorrelation(
  current: OperatorContinuityIds['correlation'] | undefined,
  patch: NonNullable<OperatorContinuityIds['correlation']>,
): NonNullable<OperatorContinuityIds['correlation']> {
  return {
    ...(current || {}),
    ...Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined),
    ),
  };
}

/**
 * Operator continuity kernel: normalizes request → decision → result → receipt ids
 * across daily mutation planes without owning policy engines or UI.
 */
export class OperatorContinuityKernel {
  private readonly now: () => Date;
  private readonly createId: () => string;

  constructor(runtime: OperatorContinuityKernelRuntime = {}) {
    this.now = runtime.now || defaultNow;
    this.createId = runtime.createId || defaultCreateId;
  }

  public begin(partial: Partial<OperatorContinuityIds> = {}): OperatorContinuityEnvelope {
    const generatedAt = this.now().toISOString();
    return {
      kind: OPERATOR_CONTINUITY_ENVELOPE_KIND,
      version: OPERATOR_CONTINUITY_ENVELOPE_VERSION,
      generatedAt,
      ids: createOperatorContinuityIds(partial, this.createId),
      request: null,
      decision: null,
      result: null,
      receipt: null,
    };
  }

  public recordRequest(
    envelope: OperatorContinuityEnvelope,
    request: OperatorContinuityRequest,
  ): OperatorContinuityEnvelope {
    const next = cloneEnvelope(envelope);
    next.request = {
      ...request,
      operation: String(request.operation || '').trim() || 'unknown',
      target: String(request.target || '').trim() || '<unknown>',
      surface: request.surface || 'tool-executor',
    };
    return next;
  }

  public attachDecision(
    envelope: OperatorContinuityEnvelope,
    decision: OperatorContinuityDecision,
  ): OperatorContinuityEnvelope {
    const next = cloneEnvelope(envelope);
    const decisionId = next.ids.decisionId || this.createId();
    next.ids.decisionId = decisionId;
    next.decision = {
      ...decision,
      reasons: [...(decision.reasons || [])],
    };
    if (decision.brokerReceipt?.receiptId) {
      next.ids.correlation = mergeCorrelation(next.ids.correlation, {
        policyBrokerReceiptId: decision.brokerReceipt.receiptId,
      });
    }
    if (decision.mutationPlanId) {
      next.ids.correlation = mergeCorrelation(next.ids.correlation, {
        mutationPlanId: decision.mutationPlanId,
      });
    }
    return next;
  }

  public attachResult(
    envelope: OperatorContinuityEnvelope,
    result: OperatorContinuityResult,
  ): OperatorContinuityEnvelope {
    const next = cloneEnvelope(envelope);
    next.ids.resultId = next.ids.resultId || this.createId();
    next.result = { ...result };
    const actionReceiptId = result.data && typeof result.data.actionReceiptId === 'string'
      ? result.data.actionReceiptId
      : null;
    if (actionReceiptId) {
      next.ids.correlation = mergeCorrelation(next.ids.correlation, {
        actionReceiptId,
      });
    }
    return next;
  }

  public correlate(
    envelope: OperatorContinuityEnvelope,
    correlation: NonNullable<OperatorContinuityIds['correlation']>,
  ): OperatorContinuityEnvelope {
    const next = cloneEnvelope(envelope);
    next.ids.correlation = mergeCorrelation(next.ids.correlation, correlation);
    return next;
  }

  public finalizeReceipt(
    envelope: OperatorContinuityEnvelope,
    overrides: Partial<OperatorContinuityReceipt> = {},
  ): OperatorContinuityEnvelope {
    const next = cloneEnvelope(envelope);
    if (!next.request) {
      throw new Error('OperatorContinuityKernel.finalizeReceipt requires a recorded request.');
    }
    const closedAt = this.now().toISOString();
    const receiptId = String(
      overrides.receiptId
      || next.ids.receiptId
      || next.decision?.brokerReceipt?.receiptId
      || this.createId(),
    ).trim();
    next.ids.receiptId = receiptId;
    next.closedAt = closedAt;
    next.receipt = {
      receiptId,
      generatedAt: closedAt,
      ids: {
        ...next.ids,
        ...(next.ids.correlation ? { correlation: { ...next.ids.correlation } } : {}),
      },
      request: { ...next.request },
      decision: next.decision
        ? {
            ...next.decision,
            reasons: [...next.decision.reasons],
          }
        : null,
      result: next.result ? { ...next.result } : null,
      terminal: overrides.terminal !== undefined ? overrides.terminal : true,
      ...Object.fromEntries(
        Object.entries(overrides).filter(([key]) => key !== 'ids' && key !== 'request'),
      ),
    };
    return next;
  }

  public async runMutation<T>(input: {
    request: OperatorContinuityRequest;
    decide: () => OperatorContinuityDecision | Promise<OperatorContinuityDecision>;
    execute?: () => Promise<T>;
    mapResult?: (value: T) => OperatorContinuityResult;
    mapBlockedResult?: (decision: OperatorContinuityDecision) => OperatorContinuityResult;
    correlation?: NonNullable<OperatorContinuityIds['correlation']>;
    ids?: Partial<OperatorContinuityIds>;
  }): Promise<{ envelope: OperatorContinuityEnvelope; value?: T }> {
    let envelope = this.begin(input.ids || {});
    if (input.correlation) {
      envelope = this.correlate(envelope, input.correlation);
    }
    envelope = this.recordRequest(envelope, input.request);
    const decision = await input.decide();
    envelope = this.attachDecision(envelope, decision);

    if (!decision.allowed || decision.requiresApproval) {
      const blocked = input.mapBlockedResult
        ? input.mapBlockedResult(decision)
        : resultFromToolOutcome({
            ok: false,
            status: decision.requiresApproval ? 'approval_required' : 'blocked',
            summary: decision.reasons.join(' ') || `Blocked by ${decision.source}.`,
            data: {
              action: decision.action,
              rule: decision.rule,
              ...(decision.mutationPlanId ? { mutationPlanId: decision.mutationPlanId } : {}),
              ...(decision.brokerReceipt?.receiptId
                ? { policyBrokerReceiptId: decision.brokerReceipt.receiptId }
                : {}),
            },
          });
      envelope = this.attachResult(envelope, blocked);
      envelope = this.finalizeReceipt(envelope);
      return { envelope };
    }

    if (!input.execute) {
      const observation = resultFromToolOutcome({
        ok: true,
        status: 'observation',
        summary: decision.reasons.join(' ') || 'Policy allowed without execution.',
      });
      envelope = this.attachResult(envelope, observation);
      envelope = this.finalizeReceipt(envelope);
      return { envelope };
    }

    try {
      const value = await input.execute();
      const mapped = input.mapResult
        ? input.mapResult(value)
        : resultFromToolOutcome({
            ok: true,
            status: 'applied',
            summary: `Executed ${input.request.operation} on ${input.request.target}.`,
            output: value,
          });
      envelope = this.attachResult(envelope, mapped);
      envelope = this.finalizeReceipt(envelope);
      return { envelope, value };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      envelope = this.attachResult(envelope, resultFromToolOutcome({
        ok: false,
        status: 'failed',
        summary: message,
      }));
      envelope = this.finalizeReceipt(envelope);
      throw Object.assign(
        error instanceof Error ? error : new Error(message),
        { operatorContinuity: envelope },
      );
    }
  }

  public toPublicView(envelope: OperatorContinuityEnvelope): {
    continuityId: string;
    receiptId: string | null;
    decisionAction: string | null;
    allowed: boolean | null;
    status: string | null;
    policyBrokerReceiptId: string | null;
    actionReceiptId: string | null;
    mutationPlanId: string | null;
    terminal: boolean;
  } {
    return {
      continuityId: envelope.ids.continuityId,
      receiptId: envelope.receipt?.receiptId || envelope.ids.receiptId || null,
      decisionAction: envelope.decision?.action || null,
      allowed: envelope.decision ? envelope.decision.allowed : null,
      status: envelope.result?.status || null,
      policyBrokerReceiptId: envelope.ids.correlation?.policyBrokerReceiptId || null,
      actionReceiptId: envelope.ids.correlation?.actionReceiptId || null,
      mutationPlanId: envelope.ids.correlation?.mutationPlanId || null,
      terminal: envelope.receipt?.terminal === true,
    };
  }
}

export function extractOperatorContinuityPublicView(
  envelope: OperatorContinuityEnvelope | null | undefined,
): ReturnType<OperatorContinuityKernel['toPublicView']> | null {
  if (!envelope || envelope.kind !== OPERATOR_CONTINUITY_ENVELOPE_KIND) {
    return null;
  }
  return new OperatorContinuityKernel().toPublicView(envelope);
}

export function isOperatorContinuityEnvelope(value: unknown): value is OperatorContinuityEnvelope {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return record.kind === OPERATOR_CONTINUITY_ENVELOPE_KIND
    && record.version === OPERATOR_CONTINUITY_ENVELOPE_VERSION
    && Boolean(record.ids && typeof record.ids === 'object');
}
