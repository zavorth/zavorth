import {
  actionIntentToDraftEffect,
  createActionIntent,
  createResourceRef,
} from '../../src/runtime/effects/index.js';
import {
  decideSecurityPolicy,
  decideSecurityPolicyForEffect,
} from '../../src/security/SecurityPolicyBroker.js';

describe('SecurityPolicyBroker', () => {
  const now = () => new Date('2026-05-09T12:00:00.000Z');

  it('normalizes tool confirmations into a user-confirmation decision with a receipt', () => {
    const decision = decideSecurityPolicy({
      surface: 'tool',
      operation: 'execute',
      target: 'create_file',
      sourceTrust: 'trusted-user',
      toolDecision: {
        action: 'require_confirmation',
        allowed: false,
        risk: 'review',
        toolName: 'create_file',
        surface: 'native-tool',
        capabilities: ['filesystem'],
        securityProfile: {
          id: 'professional',
          label: 'Uso profissional',
          source: 'default',
        },
        requiresConfirmation: true,
        reasons: ['Human confirmation is required before execution.'],
        rule: 'CONFIRMATION_REQUIRED',
      },
    }, { now });

    expect(decision.action).toBe('require_user_confirmation');
    expect(decision.allowed).toBe(false);
    expect(decision.receipt).toEqual(expect.objectContaining({
      surface: 'tool',
      action: 'require_user_confirmation',
      target: 'create_file',
      profile: expect.objectContaining({ id: 'professional' }),
      userConfirmationRequired: true,
    }));
  });

  it('records redacted egress as allow_with_redaction', () => {
    const decision = decideSecurityPolicy({
      surface: 'llm-egress',
      operation: 'provider_payload',
      target: 'llm-provider',
      redaction: {
        applied: true,
        findingCount: 2,
        reasons: ['Raw secrets were redacted.'],
      },
    }, { now });

    expect(decision.action).toBe('allow_with_redaction');
    expect(decision.allowed).toBe(true);
    expect(decision.receipt.redaction).toEqual({
      applied: true,
      findingCount: 2,
    });
  });

  it('routes blocked MCP tools to admin policy instead of silent allow', () => {
    const decision = decideSecurityPolicy({
      surface: 'mcp',
      operation: 'tool_access',
      target: 'remote_shell',
      mcpDecision: {
        allowed: false,
        profile: 'safe',
        reason: 'Tool blocked by safe MCP profile.',
      },
    }, { now });

    expect(decision.action).toBe('require_admin_policy');
    expect(decision.requiresAdminPolicy).toBe(true);
    expect(decision.receipt.rule).toBe('MCP_ADMIN_POLICY_REQUIRED');
  });

  it('denies unsafe web fetch targets with risk-blocked evidence', () => {
    const decision = decideSecurityPolicy({
      surface: 'web-fetch',
      operation: 'public_egress',
      target: 'http://169.254.169.254/latest/meta-data',
      blocked: true,
      risk: 'forbidden',
      reasons: ['Private metadata endpoint blocked.'],
    }, { now });

    expect(decision.action).toBe('deny');
    expect(decision.allowed).toBe(false);
    expect(decision.receipt.riskBlocked).toBe(true);
    expect(decision.receipt.reasons).toContain('Private metadata endpoint blocked.');
  });

  it('adapts effect policy decisions into broker receipts', () => {
    const effect = actionIntentToDraftEffect(createActionIntent({
      id: 'intent-untrusted-write',
      kind: 'workspace_mutation',
      operation: 'apply patch',
      summary: 'Patch from untrusted content.',
      sourceTrust: 'untrusted-content',
      targetScope: [createResourceRef({ kind: 'workspace', uri: 'src/index.ts' })],
      createdAt: '2026-05-22T12:00:00.000Z',
    }));

    const decision = decideSecurityPolicyForEffect(effect, {
      surface: 'effect-boundary',
      workspace: 'C:/repo',
    }, { now });

    expect(decision.action).toBe('deny');
    expect(decision.allowed).toBe(false);
    expect(decision.receipt).toEqual(expect.objectContaining({
      surface: 'workspace',
      operation: 'effect_boundary',
      target: 'intent-untrusted-write',
      rule: 'effect/deny-untrusted-side-effect',
      sourceTrust: 'untrusted-content',
    }));
  });
});
