import { buildModeEscalationPendingCard } from '../../../src/services/ModeEscalationPresentation.js';
import { buildPermissionPendingCard } from '../../../src/services/PermissionProposalPresentation.js';
import { buildSelfmodProposalPendingCard } from '../../../src/services/SelfmodProposalPresentation.js';
import { SharedSurfaceLearningCommandPack } from '../../../src/domain/surface/presentation/shared-surface/SharedSurfaceLearningCommandPack.js';
import {
  isAffordanceEnabled,
  resolveSurfaceProfileForChannel,
} from '../../../src/domain/surface/application/surface-affordance/index.js';

describe('Mode escalate card + /learning ordinal UX', () => {
  it('builds mode escalate card with buttons on telegram', () => {
    const profile = resolveSurfaceProfileForChannel('telegram');
    expect(isAffordanceEnabled(profile, 'inline_buttons')).toBe(true);

    const card = buildModeEscalationPendingCard({
      channel: 'telegram',
      request: {
        id: 'mode-req-long-uuid-should-not-be-primary',
        summary: 'Need builder mode for diffs',
        recommendedScope: 'once',
        fallback: 'Stay in chat mode',
        reasons: ['code edit requested'],
        requiredMode: { id: 'builder' } as any,
        effectiveMode: { id: 'chat' } as any,
      },
    });

    expect(card.usedNativeButtons).toBe(true);
    expect(card.surfaceResponse.actions.length).toBeGreaterThanOrEqual(3);
    expect(card.surfaceResponse.actions.some((a) => a.command === '/mode approve once')).toBe(true);
    expect(card.surfaceResponse.actions.some((a) => a.command === '/mode reject')).toBe(true);
    expect(card.text).toMatch(/Mode escalation/i);
    expect(card.text).not.toMatch(/mode-req-long-uuid-should-not-be-primary/);
  });

  it('mode escalate card has no buttons on cli', () => {
    const card = buildModeEscalationPendingCard({
      channel: 'cli',
      request: {
        id: 'req-1',
        summary: 'Need operator mode',
        recommendedScope: 'session',
        fallback: 'Stay light',
        reasons: ['remote mesh'],
        requiredMode: { id: 'operator' } as any,
        effectiveMode: { id: 'chat' } as any,
      },
    });
    expect(card.usedNativeButtons).toBe(false);
    expect(card.surfaceResponse.actions).toHaveLength(0);
    expect(card.text).toMatch(/\/mode approve/);
  });

  it('/learning list is numbered and actions accept ordinal 1', async () => {
    const replies: string[] = [];
    const ctx = {
      platform: 'telegram',
      userId: 'u1',
      reply: async (text: string) => {
        replies.push(String(text || ''));
      },
    } as any;

    const candidates = [
      {
        candidateId: 'cand-aaaaaaaa-bbbb',
        title: 'First candidate',
        kind: 'procedure',
        score: 0.9,
        reviewState: 'pending',
        lifecycle: 'draft',
        summary: 'Do the thing',
      },
      {
        candidateId: 'cand-cccccccc-dddd',
        title: 'Second candidate',
        kind: 'skill',
        score: 0.7,
        reviewState: 'pending',
        lifecycle: 'draft',
        summary: 'Other thing',
      },
    ];

    const pack = new SharedSurfaceLearningCommandPack({
      learningPlaneService: {
        buildSnapshot: () => ({
          narrative: {
            headline: 'Learning plane home',
            operatorSummary: 'Review candidates before promote.',
          },
          summary: {
            total: 2,
            pending: 2,
            approved: 0,
            promoted: 0,
            published: 0,
            quarantined: 0,
          },
          candidates,
        }),
        executeAction: async (input: { candidateId: string; actionId: string }) => ({
          summary: `Executed ${input.actionId}`,
          status: 'ok',
          candidateId: input.candidateId,
          actionId: input.actionId,
          details: [],
          silentInstallBlocked: false,
          skillCandidateId: null,
        }),
      } as any,
    });

    await pack.maybeHandle(ctx, '/learning', 'list');
    expect(replies[0]).toMatch(/^1\./m);
    expect(replies[0]).toMatch(/^2\./m);
    expect(replies[0]).toMatch(/\/learning approve 1/);
    expect(replies[0]).not.toMatch(/cand-aaaaaaaa-bbbb/);

    replies.length = 0;
    await pack.maybeHandle(ctx, '/learning', 'approve 1');
    expect(replies[0]).toMatch(/Executed approve/);
    expect(replies[0]).toMatch(/cand-aaa|Candidate:/i);

    replies.length = 0;
    await pack.maybeHandle(ctx, '/learning', 'promote');
    expect(replies[0]).toMatch(/Use \/learning approve 1|promote 1/i);
  });
});

describe('Perm / selfmod proposal-time approval cards', () => {
  it('permission opener has Approve/Reject buttons on telegram and ordinal slash', () => {
    const profile = resolveSurfaceProfileForChannel('telegram');
    expect(isAffordanceEnabled(profile, 'inline_buttons')).toBe(true);

    const card = buildPermissionPendingCard({
      channel: 'telegram',
      ordinal: 1,
      permission: {
        permission_id: 'perm-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        executor: 'shell',
        kind: 'run',
        reason: 'Run a sensitive command',
        status: 'pending',
        scope: 'once',
        workspace: null,
        requested_value: 'rm -rf /tmp/x',
        resolved_value: null,
      },
    });

    expect(card.usedNativeButtons).toBe(true);
    expect(card.surfaceResponse.actions.some((a) => a.label?.includes('Approve'))).toBe(true);
    expect(card.surfaceResponse.actions.some((a) => a.label?.includes('Reject'))).toBe(true);
    expect(card.surfaceResponse.actions.some((a) => a.callbackData === '/perm approve 1')).toBe(true);
    expect(card.surfaceResponse.actions.some((a) => a.command === '/perm approve 1')).toBe(true);
    expect(card.text).toMatch(/\/perm approve 1/);
    expect(card.text).not.toMatch(/perm-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/);
    expect(card.text).not.toMatch(/type\s+Approve/i);
  });

  it('permission opener falls back to slash-only on cli (no free-text Approve)', () => {
    const card = buildPermissionPendingCard({
      channel: 'cli',
      ordinal: 1,
      permission: {
        permission_id: 'perm-cli-1',
        executor: 'fs',
        kind: 'write',
        reason: 'Write file',
        status: 'pending',
        scope: 'once',
        workspace: 'ws',
        requested_value: null,
        resolved_value: null,
      },
    });
    expect(card.usedNativeButtons).toBe(false);
    expect(card.surfaceResponse.actions).toHaveLength(0);
    expect(card.text).toMatch(/\/perm approve 1/);
    expect(card.text).toMatch(/\/perm reject 1/);
    expect(card.text).not.toMatch(/type\s+Approve/i);
  });

  it('selfmod proposal opener has Apply/Reject on telegram', () => {
    const card = buildSelfmodProposalPendingCard({
      channel: 'telegram',
      previewId: '123e4567-e89b-12d3-a456-426614174000',
      summary: 'Patch readiness honesty copy',
      relativePath: 'src/example.ts',
      mode: 'file',
      success: true,
    });

    expect(card.usedNativeButtons).toBe(true);
    expect(card.surfaceResponse.actions.some((a) => a.label?.includes('Apply'))).toBe(true);
    expect(card.surfaceResponse.actions.some((a) => a.label?.includes('Reject'))).toBe(true);
    expect(card.surfaceResponse.actions.some((a) => String(a.callbackData || '').includes('/selfmod apply'))).toBe(
      true,
    );
    expect(card.text).toMatch(/buttons below|Apply/i);
    expect(card.text).not.toMatch(/type\s+Approve/i);
    // Full UUID is allowed in the apply slash command for correctness, but not as free-text primary.
    expect(card.text).toMatch(/Preview ref: 123e4567/);
  });

  it('selfmod proposal opener on cli uses slash apply, not free-text Approve', () => {
    const card = buildSelfmodProposalPendingCard({
      channel: 'cli',
      previewId: 'preview-abc-123456',
      summary: 'Goal preview',
      mode: 'goal',
      changeCount: 3,
      success: true,
    });
    expect(card.usedNativeButtons).toBe(false);
    expect(card.surfaceResponse.actions).toHaveLength(0);
    expect(card.text).toMatch(/\/selfmod apply preview-abc-123456/);
    expect(card.text).not.toMatch(/type\s+Approve/i);
  });
});
