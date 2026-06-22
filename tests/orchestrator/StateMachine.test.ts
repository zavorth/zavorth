import { StateMachine } from '../../src/orchestrator/StateMachine';

describe('StateMachine', () => {
  it('treats repeated transitions as idempotent', () => {
    expect(StateMachine.canTransition('running', 'running')).toBe(true);
    expect(StateMachine.transition('running', 'running')).toBe('running');
  });

  it('knows active and terminal statuses', () => {
    expect(StateMachine.isActive('approved')).toBe(true);
    expect(StateMachine.isActive('delivery_pending')).toBe(true);
    expect(StateMachine.isTerminal('completed')).toBe(true);
    expect(StateMachine.isTerminal('failed')).toBe(true);
    expect(StateMachine.isTerminal('running')).toBe(false);
  });

  it('exposes active statuses for repository polling', () => {
    const activeStatuses = StateMachine.getActiveStatuses();

    expect(activeStatuses).toContain('planned');
    expect(activeStatuses).toContain('approved');
    expect(activeStatuses).toContain('rollback_pending');
    expect(activeStatuses).not.toContain('completed');
  });

  it('exposes richer lifecycle semantics for resume and retry', () => {
    expect(StateMachine.getPhase('waiting_approval')).toBe('approval');
    expect(StateMachine.getPhase('delivery_pending')).toBe('delivery');
    expect(StateMachine.canResume('running')).toBe(true);
    expect(StateMachine.canResume('completed')).toBe(false);
    expect(StateMachine.canRetry('failed')).toBe(true);
    expect(StateMachine.canRetry('running')).toBe(false);
  });

  it('builds lifecycle snapshots with allowed transitions', () => {
    const snapshot = StateMachine.buildLifecycleSnapshot('planned', '2026-03-31T10:00:00.000Z');

    expect(snapshot).toEqual(expect.objectContaining({
      current_status: 'planned',
      phase: 'planning',
      can_resume: true,
      can_retry: false,
      updated_at: '2026-03-31T10:00:00.000Z',
    }));
    expect(snapshot.allowed_next_statuses).toEqual(
      expect.arrayContaining(['waiting_approval', 'running', 'failed', 'cancelled']),
    );
  });

  it('preserves persisted terminal or more advanced states when stale updates arrive', () => {
    expect(StateMachine.shouldPreservePersistedStatus('completed', 'running')).toBe(true);
    expect(StateMachine.shouldPreservePersistedStatus('delivery_pending', 'running')).toBe(true);
    expect(StateMachine.shouldPreservePersistedStatus('waiting_approval', 'approved')).toBe(false);
    expect(StateMachine.shouldPreservePersistedStatus('running', 'running')).toBe(false);
  });
});
