import { describe, it, expect, vi } from 'vitest';
import {
  mapToolCallToEffectDecision,
} from '../../../src/tools/governance/index.js';

describe('ToolEffectMapper', () => {
  it('maps safe tool calls to allowed policy decisions', () => {
    const mapping = mapToolCallToEffectDecision({
      toolCall: {
        id: 'call-time',
        name: 'get_datetime',
        arguments: { timezone: 'America/Sao_Paulo' },
      },
      sourceTrust: 'trusted-user',
    });

    expect(mapping.analysis.risk).toBe('safe');
    expect(mapping.decision).toEqual(expect.objectContaining({
      action: 'allow',
      allowed: true,
      rule: 'effect/allow-observation',
    }));
  });

  it('maps workspace mutation tool calls to sandbox-only decisions', () => {
    const mapping = mapToolCallToEffectDecision({
      toolCall: {
        id: 'call-write',
        name: 'write_file',
        arguments: { path: 'src/index.ts', content: 'hello' },
      },
      sourceTrust: 'trusted-user',
      policyContext: { sandboxAvailable: true },
    });

    expect(mapping.analysis.effect.writes).toHaveLength(1);
    expect(mapping.decision).toEqual(expect.objectContaining({
      action: 'sandbox_only',
      rule: 'effect/sandbox-mutation',
    }));
  });

  it('maps untrusted side-effect tool calls to deny decisions', () => {
    const mapping = mapToolCallToEffectDecision({
      toolCall: {
        id: 'call-untrusted',
        name: 'write_file',
        arguments: { path: 'src/index.ts', content: 'hello' },
      },
      sourceTrust: 'untrusted-content',
    });

    expect(mapping.decision).toEqual(expect.objectContaining({
      action: 'deny',
      rule: 'effect/deny-untrusted-side-effect',
    }));
  });
});
