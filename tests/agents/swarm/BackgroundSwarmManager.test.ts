import { describe, it, expect } from '@jest/globals';
import { BackgroundSwarmManager } from '../../../src/agents/swarm/BackgroundSwarmManager.js';
import type { SwarmExecutionReport } from '../../../src/agents/DynamicSwarmCoordinator.js';

describe('BackgroundSwarmManager (Async Swarm Delegation)', () => {
  it('should start a background swarm task and report status', async () => {
    const mockExecutor = async (): Promise<SwarmExecutionReport> => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return {
        taskId: 'mock_task_1',
        taskDescription: 'Refactor auth module',
        status: 'success',
        specialists: [],
        treeView: 'tree_view',
        selfHealing: { passed: true, attempts: 1, remainingErrors: [], fixedErrors: [], consensusScore: 1.0 },
        totalCostUsd: 0.001,
        totalDurationMs: 50,
        finalSynthesis: 'Done',
      };
    };

    const task = BackgroundSwarmManager.startTask('bg_test_1', 'Refactor auth module', mockExecutor);
    expect(task.id).toBe('bg_test_1');
    expect(task.status).toBe('running');

    const listed = BackgroundSwarmManager.listTasks();
    expect(listed.some((t) => t.id === 'bg_test_1')).toBe(true);

    // Wait for async task to complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    const completedTask = BackgroundSwarmManager.getTask('bg_test_1');
    expect(completedTask?.status).toBe('completed');
    expect(completedTask?.report?.status).toBe('success');
  });

  it('should support task cancellation', () => {
    const mockLongExecutor = async (): Promise<SwarmExecutionReport> => {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return {} as SwarmExecutionReport;
    };

    BackgroundSwarmManager.startTask('bg_test_cancel', 'Long running task', mockLongExecutor);
    const cancelled = BackgroundSwarmManager.cancelTask('bg_test_cancel');
    expect(cancelled).toBe(true);

    const task = BackgroundSwarmManager.getTask('bg_test_cancel');
    expect(task?.status).toBe('cancelled');
  });
});
