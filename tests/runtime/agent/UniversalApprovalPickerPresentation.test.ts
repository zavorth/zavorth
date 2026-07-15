import {
  presentUniversalApprovalIntentDecision,
  buildMultiApprovalPickerResponse,
  buildSingleApprovalResponse,
  buildWaitingApprovalCard,
} from '../../../src/runtime/agent/index.js';
import {
  resolveSurfaceProfileForChannel,
  isAffordanceEnabled,
} from '../../../src/domain/surface/application/surface-affordance/index.js';
import type {
  UniversalApprovalIntentCandidate,
  UniversalApprovalIntentDecisionResult,
} from '../../../src/runtime/agent/UniversalApprovalIntentResolver.js';

function candidate(
  partial: Partial<UniversalApprovalIntentCandidate> & { approvalId: string },
): UniversalApprovalIntentCandidate {
  return {
    runId: partial.runId || `run-${partial.approvalId}`,
    approvalId: partial.approvalId,
    userId: partial.userId || 'u1',
    sessionId: partial.sessionId || 's1',
    channel: partial.channel || 'telegram',
    title: partial.title || 'Do something sensitive',
    risk: partial.risk || 'attention',
    createdAt: partial.createdAt || '2026-05-12T12:00:00.000Z',
  };
}

function ambiguousResult(
  candidates: UniversalApprovalIntentCandidate[],
  channel: UniversalApprovalIntentDecisionResult['resolution']['channel'] = 'telegram',
): UniversalApprovalIntentDecisionResult {
  return {
    ok: false,
    result: null,
    error: 'Several approvals are waiting',
    resolution: {
      status: 'ambiguous',
      decision: 'approved',
      ref: null,
      source: 'slash-command',
      channel,
      userId: 'u1',
      sessionId: 's1',
      target: null,
      candidates,
      reason: 'Several approvals are waiting.',
      commandHint: '/approve 1',
    },
  };
}

describe('UniversalApprovalPickerPresentation (surface-agnostic buttons)', () => {
  it('uses native buttons on telegram (inline_buttons affordance)', () => {
    const profile = resolveSurfaceProfileForChannel('telegram');
    expect(isAffordanceEnabled(profile, 'inline_buttons')).toBe(true);

    const built = buildMultiApprovalPickerResponse(
      [
        candidate({ approvalId: 'a1', title: 'Install package' }),
        candidate({ approvalId: 'a2', title: 'Delete file' }),
      ],
      'approved',
      profile,
    );
    expect(built.usedNativeButtons).toBe(true);
    expect(built.response.actions.length).toBeGreaterThanOrEqual(4);
    expect(built.response.actions.some((a) => a.callbackData?.includes('approval:approve:'))).toBe(true);
    expect(built.response.actions.some((a) => a.command === '/approve 1')).toBe(true);
  });

  it('falls back to text numbers on cli (no inline_buttons)', () => {
    const profile = resolveSurfaceProfileForChannel('cli');
    expect(isAffordanceEnabled(profile, 'inline_buttons')).toBe(false);

    const built = buildMultiApprovalPickerResponse(
      [candidate({ approvalId: 'a1' }), candidate({ approvalId: 'a2' })],
      'approved',
      profile,
    );
    expect(built.usedNativeButtons).toBe(false);
    expect(built.response.actions).toHaveLength(0);
    const textBlock = built.response.blocks.find((b) => b.kind === 'text');
    expect(textBlock && textBlock.kind === 'text' ? textBlock.text : '').toMatch(/\/approve 1/);
  });

  it('presentUniversalApprovalIntentDecision wires channel profile', () => {
    const result = ambiguousResult(
      [candidate({ approvalId: 'x1', title: 'One' }), candidate({ approvalId: 'x2', title: 'Two' })],
      'discord',
    );

    const discord = presentUniversalApprovalIntentDecision(result, 'discord');
    expect(discord.surfaceResponse).not.toBeNull();
    expect(discord.usedNativeButtons).toBe(true);
    expect(discord.actions.length).toBeGreaterThan(0);

    const cli = presentUniversalApprovalIntentDecision(result, 'cli');
    expect(cli.surfaceResponse).not.toBeNull();
    expect(cli.usedNativeButtons).toBe(false);
    expect(cli.text).toMatch(/\/approve 1|Pick an approval|Several approvals/i);
  });

  it('does not build picker for resolved single-candidate decisions', () => {
    const single: UniversalApprovalIntentDecisionResult = {
      ok: true,
      result: null,
      error: null,
      resolution: {
        status: 'resolved',
        decision: 'approved',
        ref: 'a1',
        source: 'slash-command',
        channel: 'telegram',
        userId: 'u1',
        sessionId: 's1',
        target: null,
        candidates: [candidate({ approvalId: 'a1' })],
        reason: 'ok',
        commandHint: '/approve',
      },
    };
    const presented = presentUniversalApprovalIntentDecision(single, 'telegram');
    expect(presented.surfaceResponse).toBeNull();
    expect(presented.usedNativeButtons).toBe(false);
  });

  it('single-pending card uses Approve/Reject buttons on telegram', () => {
    const profile = resolveSurfaceProfileForChannel('telegram');
    expect(isAffordanceEnabled(profile, 'inline_buttons')).toBe(true);

    const built = buildSingleApprovalResponse(
      candidate({ approvalId: 'solo-1', title: 'Install package' }),
      null,
      profile,
    );
    expect(built.usedNativeButtons).toBe(true);
    expect(built.response.actions).toHaveLength(2);
    expect(built.response.actions.some((a) => a.callbackData === 'approval:approve:solo-1')).toBe(true);
    expect(built.response.actions.some((a) => a.callbackData === 'approval:reject:solo-1')).toBe(true);
    expect(built.response.actions.some((a) => a.command === '/approve')).toBe(true);
    expect(built.response.actions.some((a) => a.command === '/reject')).toBe(true);
    expect(built.response.metadata?.singleApprovalCard).toBe(true);
  });

  it('single-pending card has no buttons on cli (slash text only)', () => {
    const profile = resolveSurfaceProfileForChannel('cli');
    expect(isAffordanceEnabled(profile, 'inline_buttons')).toBe(false);

    const built = buildSingleApprovalResponse(
      candidate({ approvalId: 'solo-cli', title: 'Sensitive action' }),
      'approved',
      profile,
    );
    expect(built.usedNativeButtons).toBe(false);
    expect(built.response.actions).toHaveLength(0);
    const textBlock = built.response.blocks.find((b) => b.kind === 'text');
    const text = textBlock && textBlock.kind === 'text' ? textBlock.text : '';
    expect(text).toMatch(/\/approve/);
    expect(text).toMatch(/\/reject/);
  });

  it('presentUniversalApprovalIntentDecision surfaces single card for ambiguous(1)', () => {
    const result = ambiguousResult([candidate({ approvalId: 'only-one', title: 'One pending' })], 'telegram');

    const telegram = presentUniversalApprovalIntentDecision(result, 'telegram');
    expect(telegram.surfaceResponse).not.toBeNull();
    expect(telegram.usedNativeButtons).toBe(true);
    expect(telegram.actions.some((a) => a.command === '/approve')).toBe(true);
    expect(telegram.actions.some((a) => a.callbackData?.includes('approval:approve:only-one'))).toBe(true);
    expect(telegram.surfaceResponse?.metadata?.singleApprovalCard).toBe(true);

    const cli = presentUniversalApprovalIntentDecision(result, 'cli');
    expect(cli.surfaceResponse).not.toBeNull();
    expect(cli.usedNativeButtons).toBe(false);
    expect(cli.actions).toHaveLength(0);
    expect(cli.text).toMatch(/\/approve/);
  });

  it('buildWaitingApprovalCard works for openers (telegram vs cli)', () => {
    const c = candidate({ approvalId: 'wait-1', title: 'Natural First intent', channel: 'telegram' });

    const telegram = buildWaitingApprovalCard(c, 'telegram');
    expect(telegram.surfaceResponse).not.toBeNull();
    expect(telegram.usedNativeButtons).toBe(true);
    expect(telegram.actions.some((a) => a.command === '/approve')).toBe(true);
    expect(telegram.actions.some((a) => a.callbackData === 'approval:approve:wait-1')).toBe(true);

    const cli = buildWaitingApprovalCard(c, 'cli');
    expect(cli.surfaceResponse).not.toBeNull();
    expect(cli.usedNativeButtons).toBe(false);
    expect(cli.actions).toHaveLength(0);
    expect(cli.text).toMatch(/\/approve/);
  });

  it('keeps confirmation_required as plain text (no auto single card)', () => {
    const result: UniversalApprovalIntentDecisionResult = {
      ok: false,
      result: null,
      error: null,
      resolution: {
        status: 'confirmation_required',
        decision: 'approved',
        ref: null,
        source: 'text',
        channel: 'telegram',
        userId: 'u1',
        sessionId: 's1',
        target: null,
        candidates: [candidate({ approvalId: 'danger-1', risk: 'danger' })],
        reason: 'Danger-risk approval needs matching context.',
        commandHint: null,
      },
    };
    const presented = presentUniversalApprovalIntentDecision(result, 'telegram');
    expect(presented.surfaceResponse).toBeNull();
    expect(presented.usedNativeButtons).toBe(false);
  });
});
