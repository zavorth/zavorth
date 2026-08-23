import {
  clearPendingSurfaceApprovalsByApprovalId,
  registerPendingSurfaceApproval,
  resetPendingSurfaceApprovalIndexForTests,
  resolvePendingSurfaceApproval,
} from '../../src/domain/surface/application/surface-projection/index.js';

/**
 * Sibling approval stacks (Echo/task-executor permission flows) must retire
 * rendered presenters with the same cross-surface semantics the approval
 * spine uses: one decision anywhere dismisses the tracked card everywhere.
 */
describe('sibling approval stack dismissal parity', () => {
  afterEach(() => {
    resetPendingSurfaceApprovalIndexForTests();
  });

  it('retires every rendered presenter of an approval id across all surfaces', () => {
    registerPendingSurfaceApproval({
      approvalId: 'perm-1',
      surface: 'telegram',
      chatId: '100',
      messageId: '501',
      ttlMs: 60_000,
    });
    registerPendingSurfaceApproval({
      approvalId: 'perm-1',
      surface: 'discord',
      chatId: 'guild:200',
      messageId: '602',
      ttlMs: 60_000,
    });
    registerPendingSurfaceApproval({
      approvalId: 'perm-unrelated',
      surface: 'telegram',
      chatId: '300',
      messageId: '703',
      ttlMs: 60_000,
    });

    expect(clearPendingSurfaceApprovalsByApprovalId('perm-1')).toBe(2);

    expect(resolvePendingSurfaceApproval({ surface: 'telegram', chatId: '100', messageId: '501' })).toBeNull();
    expect(resolvePendingSurfaceApproval({ surface: 'discord', chatId: 'guild:200', messageId: '602' })).toBeNull();
    // The unrelated presenter stays untouched.
    expect(
      resolvePendingSurfaceApproval({ surface: 'telegram', chatId: '300', messageId: '703' })?.approvalId,
    ).toBe('perm-unrelated');
  });

  it('keeps sibling decisions scoped to their own ids so coexisting stacks never collide', () => {
    // Distinct chats: the projection index deliberately falls back to the
    // latest pending card within one chat, so cross-id isolation is asserted
    // where that fallback cannot mask the result.
    registerPendingSurfaceApproval({
      approvalId: 'echo-perm-a',
      surface: 'telegram',
      chatId: '900',
      messageId: '901',
      ttlMs: 60_000,
    });
    registerPendingSurfaceApproval({
      approvalId: 'task-perm-b',
      surface: 'telegram',
      chatId: '910',
      messageId: '902',
      ttlMs: 60_000,
    });

    clearPendingSurfaceApprovalsByApprovalId('echo-perm-a');

    expect(resolvePendingSurfaceApproval({ surface: 'telegram', chatId: '900', messageId: '901' })).toBeNull();
    expect(
      resolvePendingSurfaceApproval({ surface: 'telegram', chatId: '910', messageId: '902' })?.approvalId,
    ).toBe('task-perm-b');
  });

  it('reports zero removals for unknown ids instead of throwing', () => {
    expect(clearPendingSurfaceApprovalsByApprovalId('never-rendered')).toBe(0);
    expect(clearPendingSurfaceApprovalsByApprovalId('')).toBe(0);
  });
});
