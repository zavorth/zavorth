import { TaskStateMachine } from '../../src/orchestrator/TaskStateMachine';
import type { Task } from '../../src/contracts/TaskContract';

describe('TaskStateMachine', () => {
  function makeTask(overrides: Partial<Task>): Task {
    return {
      id: 'test-task',
      title: 'Test Task',
      status: 'pending',
      source: 'test',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      approval_status: null,
      requires_approval: false,
      artifacts: [],
      metadata: {},
      ...overrides,
    };
  }

  describe('State description', () => {
    it('should describe pending task as queued', () => {
      const task = makeTask({ status: 'pending' });
      const desc = TaskStateMachine.describe(task);
      expect(desc.state).toBe('queued');
    });

    it('should describe running task', () => {
      const task = makeTask({ status: 'running' });
      const desc = TaskStateMachine.describe(task);
      expect(desc.state).toBe('running');
    });

    it('should describe completed task as terminal', () => {
      const task = makeTask({ status: 'completed' });
      const desc = TaskStateMachine.describe(task);
      expect(desc.state).toBe('completed');
      expect(desc.terminal).toBe(true);
    });

    it('should describe failed task as terminal', () => {
      const task = makeTask({ status: 'failed' });
      const desc = TaskStateMachine.describe(task);
      expect(desc.state).toBe('failed');
      expect(desc.terminal).toBe(true);
    });

    it('should describe cancelled task as terminal', () => {
      const task = makeTask({ status: 'cancelled' });
      const desc = TaskStateMachine.describe(task);
      expect(desc.state).toBe('cancelled');
      expect(desc.terminal).toBe(true);
    });

    it('should identify retryable states', () => {
      const completed = TaskStateMachine.describe(makeTask({ status: 'completed' }));
      const failed = TaskStateMachine.describe(makeTask({ status: 'failed' }));
      expect(completed.retryable).toBe(true);
      expect(failed.retryable).toBe(true);
    });

    it('should identify active states', () => {
      const running = TaskStateMachine.describe(makeTask({ status: 'running' }));
      const pending = TaskStateMachine.describe(makeTask({ status: 'pending' }));
      expect(running.active).toBe(true);
      expect(pending.active).toBe(true);
    });

    it('should identify non-active terminal states', () => {
      const completed = TaskStateMachine.describe(makeTask({ status: 'completed' }));
      expect(completed.active).toBe(false);
    });
  });

  describe('Allowed actions', () => {
    it('should allow cancel for running tasks', () => {
      const task = makeTask({ status: 'running' });
      const desc = TaskStateMachine.describe(task);
      expect(desc.allowedActions).toContain('cancel');
    });

    it('should allow retry for completed tasks', () => {
      const task = makeTask({ status: 'completed' });
      const desc = TaskStateMachine.describe(task);
      expect(desc.allowedActions).toContain('retry');
    });

    it('should allow retry for failed tasks', () => {
      const task = makeTask({ status: 'failed' });
      const desc = TaskStateMachine.describe(task);
      expect(desc.allowedActions).toContain('retry');
    });
  });

  describe('Formal states', () => {
    it('should have all formal states defined', () => {
      expect(TaskStateMachine.FORMAL_STATES).toContain('queued');
      expect(TaskStateMachine.FORMAL_STATES).toContain('planning');
      expect(TaskStateMachine.FORMAL_STATES).toContain('running');
      expect(TaskStateMachine.FORMAL_STATES).toContain('completed');
      expect(TaskStateMachine.FORMAL_STATES).toContain('failed');
      expect(TaskStateMachine.FORMAL_STATES).toContain('cancelled');
    });
  });
});
