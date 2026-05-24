import {
  actionIntentToDraftEffect,
  createActionIntent,
  createResourceRef,
  hasRealSideEffect,
  inferEffectRisk,
  isReadOnlyEffect,
  mergeEffects,
} from '../../../src/runtime/effects/index.js';

describe('EffectAlgebra', () => {
  it('keeps datetime questions as safe read-only observations', () => {
    const intent = createActionIntent({
      id: 'intent-time',
      kind: 'tool_call',
      toolName: 'get_datetime',
      operation: 'get_datetime',
      summary: 'Read current datetime for Brasilia.',
      sourceTrust: 'trusted-user',
      targetScope: [
        createResourceRef({ kind: 'time', uri: 'timezone:America/Sao_Paulo' }),
      ],
      createdAt: '2026-05-22T12:00:00.000Z',
    });

    const effect = actionIntentToDraftEffect(intent);

    expect(effect.reads).toHaveLength(1);
    expect(hasRealSideEffect(effect)).toBe(false);
    expect(isReadOnlyEffect(effect)).toBe(true);
    expect(inferEffectRisk(effect)).toBe('safe');
  });

  it('classifies workspace mutation as rollback-backed attention risk', () => {
    const intent = createActionIntent({
      id: 'intent-write',
      kind: 'workspace_mutation',
      operation: 'apply patch',
      summary: 'Patch a source file.',
      sourceTrust: 'trusted-user',
      targetScope: [
        createResourceRef({ kind: 'workspace', uri: 'src/index.ts', sensitivity: 'internal' }),
      ],
      createdAt: '2026-05-22T12:00:00.000Z',
    });

    const effect = actionIntentToDraftEffect(intent);

    expect(effect.writes).toEqual([expect.objectContaining({ uri: 'src/index.ts' })]);
    expect(effect.reversibility).toBe('rollback_available');
    expect(hasRealSideEffect(effect)).toBe(true);
    expect(inferEffectRisk(effect)).toBe('attention');
  });

  it('marks secret access combined with egress as forbidden', () => {
    const merged = mergeEffects('batch-1', [
      {
        intentId: 'secret',
        reads: [],
        writes: [],
        deletes: [],
        networkEgress: [],
        secretAccess: [createResourceRef({ kind: 'secret', uri: 'env:API_KEY', sensitivity: 'secret' })],
        processSpawn: [],
        persistence: [],
        humanVisibleSend: [],
        reversibility: 'none',
        sourceTrust: 'trusted-user',
      },
      {
        intentId: 'send',
        reads: [],
        writes: [],
        deletes: [],
        networkEgress: [createResourceRef({ kind: 'network', uri: 'https://example.com' })],
        secretAccess: [],
        processSpawn: [],
        persistence: [],
        humanVisibleSend: [],
        reversibility: 'irreversible',
        sourceTrust: 'trusted-user',
      },
    ]);

    expect(merged.secretAccess).toHaveLength(1);
    expect(merged.networkEgress).toHaveLength(1);
    expect(merged.reversibility).toBe('irreversible');
    expect(inferEffectRisk(merged)).toBe('forbidden');
  });
});
