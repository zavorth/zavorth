import type { ToolCall } from '../../providers/ILlmProvider.js';
import type { ToolEffectMapping } from '../../tools/governance/index.js';

export type PolicyDenialCircuitBreakerRecord = {
  signature: string;
  attempts: number;
  blocked: boolean;
  reason: string;
  toolName: string;
  intentKind: string;
  operation: string;
  rule: string;
  critical: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
};

export type PolicyDenialCircuitBreakerDecision = PolicyDenialCircuitBreakerRecord & {
  firstAttempt: boolean;
};

export type PolicyDenialCircuitBreakerOptions = {
  maxAttemptsPerIntent?: number | null;
  now?: () => Date;
};

const DEFAULT_MAX_ATTEMPTS_PER_INTENT = 3;
const CRITICAL_RULE_PATTERNS = [
  /secret/i,
  /credential/i,
  /exfil/i,
  /destructive/i,
  /admin/i,
  /policy\.modify|policy-tamper|tamper-policy|require-admin-policy/i,
];

export class PolicyDenialCircuitBreaker {
  private readonly ledger = new Map<string, PolicyDenialCircuitBreakerRecord>();
  private readonly maxAttemptsPerIntent: number;
  private readonly now: () => Date;

  constructor(options: PolicyDenialCircuitBreakerOptions = {}) {
    const configured = Number(options.maxAttemptsPerIntent);
    this.maxAttemptsPerIntent = Number.isFinite(configured) && configured > 0
      ? Math.floor(configured)
      : DEFAULT_MAX_ATTEMPTS_PER_INTENT;
    this.now = options.now || (() => new Date());
  }

  public recordDeniedToolCall(input: {
    toolCall: ToolCall;
    mapping?: ToolEffectMapping | null;
    reason?: string | null;
  }): PolicyDenialCircuitBreakerDecision {
    const signature = this.buildSignature(input);
    const timestamp = this.now().toISOString();
    const existing = this.ledger.get(signature) || null;
    const attempts = (existing?.attempts || 0) + 1;
    const critical = this.isCritical(input);
    const blocked = critical || attempts >= this.maxAttemptsPerIntent;
    const reason = critical ? 'critical-policy-denial'
      : blocked ? 'repeated-policy-denial'
        : 'policy-denial-recorded';
    const descriptor = this.buildDescriptor(input);
    const record: PolicyDenialCircuitBreakerRecord = {
      signature,
      attempts,
      blocked,
      reason,
      toolName: descriptor.toolName,
      intentKind: descriptor.intentKind,
      operation: descriptor.operation,
      rule: descriptor.rule,
      critical,
      firstSeenAt: existing?.firstSeenAt || timestamp,
      lastSeenAt: timestamp,
    };
    this.ledger.set(signature, record);

    return {
      ...record,
      firstAttempt: attempts === 1,
    };
  }

  public snapshot(): PolicyDenialCircuitBreakerRecord[] {
    return Array.from(this.ledger.values())
      .sort((left, right) => left.firstSeenAt.localeCompare(right.firstSeenAt));
  }

  public hasBlockedIntent(): boolean {
    return this.snapshot().some((record) => record.blocked);
  }

  private buildSignature(input: {
    toolCall: ToolCall;
    mapping?: ToolEffectMapping | null;
    reason?: string | null;
  }): string {
    const mapping = input.mapping || null;
    const effect = mapping?.analysis.effect || null;
    const intent = mapping?.actionIntent || null;
    const resourceFamily = [
      effect?.writes?.length ? 'write' : '',
      effect?.deletes?.length ? 'delete' : '',
      effect?.networkEgress?.length ? 'network' : '',
      effect?.secretAccess?.length ? 'secret' : '',
      effect?.processSpawn?.length ? 'process' : '',
      effect?.persistence?.length ? 'persistence' : '',
      effect?.humanVisibleSend?.length ? 'send' : '',
    ].filter(Boolean).join('+') || 'unknown-effect';
    const targetScope = [
      ...(intent?.targetScope || []),
      ...(effect?.writes || []),
      ...(effect?.deletes || []),
      ...(effect?.networkEgress || []),
      ...(effect?.secretAccess || []),
      ...(effect?.processSpawn || []),
      ...(effect?.humanVisibleSend || []),
    ]
      .map((resource) => `${resource.kind}:${normalizeTarget(resource.uri || resource.kind)}`)
      .slice(0, 8)
      .join(',');

    return [
      normalizeText(input.toolCall.name).toLowerCase(),
      normalizeText(intent?.kind || 'tool_call').toLowerCase(),
      normalizeText(intent?.operation || input.toolCall.name).toLowerCase(),
      normalizeText(mapping?.decision.rule || input.reason || 'policy').toLowerCase(),
      resourceFamily,
      targetScope || 'no-target',
    ].join('|');
  }

  private buildDescriptor(input: {
    toolCall: ToolCall;
    mapping?: ToolEffectMapping | null;
    reason?: string | null;
  }): Pick<PolicyDenialCircuitBreakerRecord, 'toolName' | 'intentKind' | 'operation' | 'rule'> {
    const mapping = input.mapping || null;
    const intent = mapping?.actionIntent || null;
    return {
      toolName: normalizeText(input.toolCall.name, 'unknown_tool').toLowerCase(),
      intentKind: normalizeText(intent?.kind || 'tool_call').toLowerCase(),
      operation: normalizeText(intent?.operation || input.toolCall.name, 'unknown_operation').toLowerCase(),
      rule: normalizeText(mapping?.decision.rule || input.reason || 'policy').toLowerCase(),
    };
  }

  private isCritical(input: {
    mapping?: ToolEffectMapping | null;
    reason?: string | null;
  }): boolean {
    const mapping = input.mapping || null;
    const haystack = [
      mapping?.decision.rule,
      ...(mapping?.decision.reasons || []),
      input.reason,
    ].map((entry) => normalizeText(entry).toLowerCase()).join(' ');
    return CRITICAL_RULE_PATTERNS.some((pattern) => pattern.test(haystack));
  }
}

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizeTarget(value: unknown): string {
  return normalizeText(value, 'unknown')
    .replace(/[A-Za-z]:[\\/][^,\s)]+/g, '<path>')
    .replace(/[\\/][^,\s)]+/g, '<path>')
    .replace(/\d+/g, '<n>')
    .slice(0, 120)
    .toLowerCase();
}
