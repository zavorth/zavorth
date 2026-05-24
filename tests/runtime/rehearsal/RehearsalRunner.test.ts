import {
  actionIntentToDraftEffect,
  createActionIntent,
  createResourceRef,
} from '../../../src/runtime/effects/index.js';
import { decideEffectPolicy } from '../../../src/security/EffectPolicyKernel.js';
import { RehearsalRunner } from '../../../src/runtime/rehearsal/index.js';

describe('RehearsalRunner', () => {
  it('prepares sandbox rehearsal, commit plan and rollback plan for workspace mutation', () => {
    const effect = actionIntentToDraftEffect(createActionIntent({
      id: 'intent-write',
      kind: 'workspace_mutation',
      operation: 'write file',
      summary: 'Write a file.',
      sourceTrust: 'trusted-user',
      targetScope: [createResourceRef({ kind: 'workspace', uri: 'src/index.ts' })],
      createdAt: '2026-05-22T12:00:00.000Z',
    }));
    const decision = decideEffectPolicy(effect, { sandboxAvailable: true });
    const result = new RehearsalRunner().prepare({
      id: 'rehearsal-1',
      effect,
      decision,
    });

    expect(result).toEqual(expect.objectContaining({
      kind: 'effect-rehearsal',
      status: 'prepared',
      receipts: expect.arrayContaining([
        'effect-rehearsal-prepared',
        'effect-policy:sandbox_only',
        'commit-plan:rehearsal_required',
        'rollback:available',
      ]),
    }));
    expect(result.commitPlan).toEqual(expect.objectContaining({
      status: 'rehearsal_required',
      rehearsalRequired: true,
      rollbackRequired: true,
    }));
    expect(result.rollbackPlan).toEqual(expect.objectContaining({
      available: true,
      steps: [expect.objectContaining({
        kind: 'restore_file',
        target: 'src/index.ts',
      })],
    }));
  });

  it('blocks irreversible effects without pretending rollback exists', () => {
    const effect = actionIntentToDraftEffect(createActionIntent({
      id: 'intent-delete',
      kind: 'irreversible_or_destructive',
      operation: 'delete file',
      summary: 'Delete a file.',
      sourceTrust: 'trusted-user',
      targetScope: [createResourceRef({ kind: 'workspace', uri: 'src/index.ts' })],
      createdAt: '2026-05-22T12:00:00.000Z',
    }));
    const decision = decideEffectPolicy(effect);
    const result = new RehearsalRunner().prepare({
      id: 'rehearsal-delete',
      effect,
      decision,
    });

    expect(result.status).toBe('blocked');
    expect(result.rollbackPlan.available).toBe(false);
    expect(result.blockers).toContain('irreversible-effect-has-no-automatic-rollback');
  });
});
