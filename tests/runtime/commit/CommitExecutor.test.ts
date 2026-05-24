import {
  actionIntentToDraftEffect,
  createActionIntent,
  createResourceRef,
} from '../../../src/runtime/effects/index.js';
import { buildCommitPlan, buildRollbackPlan, CommitExecutor } from '../../../src/runtime/commit/index.js';
import { createEffectPolicyDecision } from '../../../src/runtime/effects/EffectDecision.js';

describe('CommitExecutor', () => {
  it('refuses commit plans that still require rehearsal', () => {
    const effect = actionIntentToDraftEffect(createActionIntent({
      id: 'intent-write',
      kind: 'workspace_mutation',
      operation: 'write file',
      summary: 'Write a file.',
      sourceTrust: 'trusted-user',
      targetScope: [createResourceRef({ kind: 'workspace', uri: 'src/index.ts' })],
      createdAt: '2026-05-22T12:00:00.000Z',
    }));
    const rollbackPlan = buildRollbackPlan({ id: 'rollback-1', effect });
    const plan = buildCommitPlan({
      id: 'commit-1',
      effect,
      rollbackPlan,
      decision: createEffectPolicyDecision({
        action: 'sandbox_only',
        reasons: ['sandbox required'],
        rollbackRequired: true,
      }),
    });

    expect(new CommitExecutor().evaluate(plan)).toEqual(expect.objectContaining({
      status: 'not_ready',
      commitAllowed: false,
    }));
  });

  it('allows only explicit ready plans to move to a host adapter', () => {
    const effect = actionIntentToDraftEffect(createActionIntent({
      id: 'intent-read',
      kind: 'observation',
      operation: 'read',
      summary: 'Read only.',
      sourceTrust: 'trusted-user',
      targetScope: [createResourceRef({ kind: 'workspace', uri: 'README.md' })],
      createdAt: '2026-05-22T12:00:00.000Z',
    }));
    const rollbackPlan = buildRollbackPlan({ id: 'rollback-read', effect, required: false });
    const plan = buildCommitPlan({
      id: 'commit-read',
      effect,
      rollbackPlan,
      decision: createEffectPolicyDecision({
        action: 'allow',
        reasons: ['read only'],
        receiptRequired: false,
      }),
    });

    expect(new CommitExecutor().evaluate(plan)).toEqual({
      status: 'ready_to_commit',
      commitAllowed: true,
      reasons: ['Commit plan is ready; caller must still execute through an approved host adapter.'],
    });
  });
});
