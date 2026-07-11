import { describe, expect, it, vi } from 'vitest';
import {
  blockSubagentTask,
  completeSubagentTask,
  createSubagent,
  queueSubagentTask,
  startQueuedSubagentTask,
  waitForSubagentIdle,
} from '../src/desktop-state/subagents';

function agent() {
  return createSubagent('Reviewer', 'review', () => 'agent-1', () => '2026-07-10T12:00:00.000Z');
}

describe('subagent task lifecycle', () => {
  it('queues without claiming completion and starts later without duplicating the task', () => {
    const queued = queueSubagentTask([agent()], 'agent-1', 'Review the diff', () => '2026-07-10T12:01:00.000Z');
    expect(queued[0].status).toBe('queued');
    expect(queued[0].messages).toHaveLength(1);

    const running = startQueuedSubagentTask(queued, 'agent-1', () => '2026-07-10T12:02:00.000Z');
    expect(running[0].status).toBe('running');
    expect(running[0].messages).toHaveLength(1);
  });

  it('records the actual assistant response only after completion', () => {
    const queued = queueSubagentTask([agent()], 'agent-1', 'Review the diff');
    const completed = completeSubagentTask(queued, 'agent-1', 'Review the diff', 'Two issues found with evidence.');
    expect(completed[0].status).toBe('completed');
    expect(completed[0].messages.at(-1)?.text).toBe('Two issues found with evidence.');
  });

  it('uses blocked rather than failed when an existing run never becomes idle', () => {
    const queued = queueSubagentTask([agent()], 'agent-1', 'Review the diff');
    const blocked = blockSubagentTask(queued, 'agent-1', 'Still waiting');
    expect(blocked[0].status).toBe('blocked');
  });

  it('waits for the active run instead of failing immediately', async () => {
    vi.useFakeTimers();
    let busy = true;
    const pending = waitForSubagentIdle(() => busy, { timeoutMs: 1_000, pollMs: 50 });
    await vi.advanceTimersByTimeAsync(100);
    busy = false;
    await vi.advanceTimersByTimeAsync(50);
    await expect(pending).resolves.toBe(true);
    vi.useRealTimers();
  });
});
