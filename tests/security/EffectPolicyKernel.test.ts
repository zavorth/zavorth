import {
  actionIntentToDraftEffect,
  createActionIntent,
  createResourceRef,
} from '../../src/runtime/effects/index.js';
import { decideEffectPolicy } from '../../src/security/EffectPolicyKernel.js';

describe('EffectPolicyKernel', () => {
  it('allows safe observations without approval', () => {
    const effect = actionIntentToDraftEffect(createActionIntent({
      id: 'intent-time',
      kind: 'tool_call',
      toolName: 'get_datetime',
      operation: 'get_datetime',
      summary: 'Read current datetime.',
      sourceTrust: 'trusted-user',
      targetScope: [createResourceRef({ kind: 'time', uri: 'timezone:America/Sao_Paulo' })],
      createdAt: '2026-05-22T12:00:00.000Z',
    }));

    expect(decideEffectPolicy(effect)).toEqual(expect.objectContaining({
      kernelVersion: 'effect-policy-kernel/1',
      action: 'allow',
      allowed: true,
      approvalRequired: false,
      receiptRequired: false,
      rule: 'effect/allow-observation',
    }));
  });

  it('keeps draft-only output away from host commits', () => {
    const effect = actionIntentToDraftEffect(createActionIntent({
      id: 'intent-draft',
      kind: 'draft',
      operation: 'draft patch',
      summary: 'Draft a patch without applying it.',
      sourceTrust: 'trusted-user',
      targetScope: [createResourceRef({ kind: 'workspace', uri: 'src/index.ts' })],
      createdAt: '2026-05-22T12:00:00.000Z',
    }));

    expect(decideEffectPolicy(effect)).toEqual(expect.objectContaining({
      action: 'draft_only',
      allowed: false,
      rule: 'effect/draft-only',
    }));
  });

  it('routes workspace writes to sandbox-only rehearsal before commit', () => {
    const effect = actionIntentToDraftEffect(createActionIntent({
      id: 'intent-write',
      kind: 'workspace_mutation',
      operation: 'apply patch',
      summary: 'Patch a workspace file.',
      sourceTrust: 'trusted-user',
      targetScope: [createResourceRef({ kind: 'workspace', uri: 'src/index.ts' })],
      createdAt: '2026-05-22T12:00:00.000Z',
    }));

    expect(decideEffectPolicy(effect, { sandboxAvailable: true })).toEqual(expect.objectContaining({
      action: 'sandbox_only',
      approvalRequired: false,
      rollbackRequired: true,
      rule: 'effect/sandbox-mutation',
    }));
  });

  it('denies untrusted content attempting to authorize real side effects', () => {
    const effect = actionIntentToDraftEffect(createActionIntent({
      id: 'intent-untrusted-write',
      kind: 'workspace_mutation',
      operation: 'apply patch',
      summary: 'Patch requested by untrusted content.',
      sourceTrust: 'untrusted-content',
      targetScope: [createResourceRef({ kind: 'workspace', uri: 'src/index.ts' })],
      createdAt: '2026-05-22T12:00:00.000Z',
    }));

    expect(decideEffectPolicy(effect)).toEqual(expect.objectContaining({
      action: 'deny',
      allowed: false,
      rule: 'effect/deny-untrusted-side-effect',
    }));
  });

  it('denies secret access combined with network egress', () => {
    const effect = {
      intentId: 'intent-secret-egress',
      reads: [],
      writes: [],
      deletes: [],
      networkEgress: [createResourceRef({ kind: 'network', uri: 'https://example.com' })],
      secretAccess: [createResourceRef({ kind: 'secret', uri: 'env:API_KEY', sensitivity: 'secret' })],
      processSpawn: [],
      persistence: [],
      humanVisibleSend: [],
      reversibility: 'irreversible' as const,
      sourceTrust: 'trusted-user' as const,
    };

    expect(decideEffectPolicy(effect)).toEqual(expect.objectContaining({
      action: 'deny',
      risk: 'forbidden',
      rule: 'effect/deny-secret-egress',
    }));
  });
});
