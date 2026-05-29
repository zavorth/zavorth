import { PolicyDenialCircuitBreaker } from '../../src/runtime/agent/PolicyDenialCircuitBreaker';
import type { ToolCall } from '../../src/providers/ILlmProvider';
import type { ToolEffectMapping } from '../../src/tools/governance';

function toolCall(args: Record<string, unknown> = {}): ToolCall {
  return {
    id: 'tool-call-1',
    name: 'write_file',
    arguments: args,
  };
}

function mapping(rule = 'effect/deny-host-mutation'): ToolEffectMapping {
  return {
    toolCallId: 'tool-call-1',
    toolName: 'write_file',
    actionIntent: {
      id: 'intent-1',
      kind: 'workspace_mutation',
      toolName: 'write_file',
      operation: 'write',
      args: { path: 'C:/repo/outside.txt' },
      summary: 'Write outside workspace',
      sourceTrust: 'trusted-user',
      targetScope: [{ kind: 'filesystem', uri: 'C:/repo/outside.txt' }],
      createdAt: new Date(0).toISOString(),
    },
    analysis: {
      readOnly: false,
      hasRealSideEffect: true,
      summary: 'Writes outside the workspace.',
      effect: {
        intentId: 'intent-1',
        reads: [],
        writes: [{ kind: 'filesystem', uri: 'C:/repo/outside.txt' }],
        deletes: [],
        networkEgress: [],
        secretAccess: [],
        processSpawn: [],
        persistence: [],
        humanVisibleSend: [],
        reversibility: 'reversible',
        sourceTrust: 'trusted-user',
      },
    },
    decision: {
      kernelVersion: 'effect-policy-kernel/1',
      action: 'deny',
      allowed: false,
      risk: 'danger',
      effectSummary: 'Writes outside the workspace.',
      reasons: ['Host mutation is outside policy.'],
      rule,
      receiptRequired: true,
      approvalRequired: false,
      rollbackRequired: false,
    },
  };
}

describe('PolicyDenialCircuitBreaker', () => {
  it('blocks repeated denials for the same normalized intent family', () => {
    const breaker = new PolicyDenialCircuitBreaker({
      maxAttemptsPerIntent: 3,
      now: () => new Date('2026-01-01T00:00:00.000Z'),
    });

    const first = breaker.recordDeniedToolCall({ toolCall: toolCall({ path: 'C:/repo/a.txt' }), mapping: mapping() });
    const second = breaker.recordDeniedToolCall({ toolCall: toolCall({ path: 'C:/repo/b.txt' }), mapping: mapping() });
    const third = breaker.recordDeniedToolCall({ toolCall: toolCall({ path: 'C:/repo/c.txt' }), mapping: mapping() });

    expect(first.blocked).toBe(false);
    expect(second.blocked).toBe(false);
    expect(third.blocked).toBe(true);
    expect(third.reason).toBe('repeated-policy-denial');
    expect(breaker.hasBlockedIntent()).toBe(true);
    expect(breaker.snapshot()).toEqual([
      expect.objectContaining({
        attempts: 3,
        blocked: true,
        critical: false,
        intentKind: 'workspace_mutation',
        operation: 'write',
        reason: 'repeated-policy-denial',
        rule: 'effect/deny-host-mutation',
        toolName: 'write_file',
      }),
    ]);
  });

  it('blocks critical policy denials immediately', () => {
    const breaker = new PolicyDenialCircuitBreaker({
      maxAttemptsPerIntent: 3,
      now: () => new Date('2026-01-01T00:00:00.000Z'),
    });
    const decision = breaker.recordDeniedToolCall({
      toolCall: toolCall(),
      mapping: mapping('effect/deny-secret-egress'),
    });

    expect(decision.blocked).toBe(true);
    expect(decision.reason).toBe('critical-policy-denial');
    expect(decision.attempts).toBe(1);
    expect(breaker.snapshot()[0]).toEqual(expect.objectContaining({
      attempts: 1,
      blocked: true,
      critical: true,
      reason: 'critical-policy-denial',
      rule: 'effect/deny-secret-egress',
    }));
  });

  it('normalizes target details so tiny argument rewrites do not bypass the breaker', () => {
    const breaker = new PolicyDenialCircuitBreaker({ maxAttemptsPerIntent: 2 });

    const first = breaker.recordDeniedToolCall({
      toolCall: toolCall({ path: 'C:/repo/secrets/a.txt', content: 'one' }),
      mapping: mapping('effect/deny-host-mutation'),
    });
    const second = breaker.recordDeniedToolCall({
      toolCall: toolCall({ path: 'C:/repo/secrets/b.txt', content: 'two' }),
      mapping: mapping('effect/deny-host-mutation'),
    });

    expect(first.signature).toBe(second.signature);
    expect(second.blocked).toBe(true);
    expect(second.reason).toBe('repeated-policy-denial');
  });
});
