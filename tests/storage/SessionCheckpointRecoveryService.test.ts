import { describe, it, expect, beforeEach } from '@jest/globals';
import { SessionCheckpointRecoveryService } from '../../src/storage/SessionCheckpointRecoveryService.js';

describe('SessionCheckpointRecoveryService (Tool Boundary Snapshots & Crash Recovery)', () => {
  const sessionId = 'test-session-crash-recovery';

  beforeEach(() => {
    SessionCheckpointRecoveryService.clearCheckpoint(sessionId);
  });

  it('should save, retrieve, list, and clear atomic step checkpoints', () => {
    expect(SessionCheckpointRecoveryService.getCheckpoint(sessionId)).toBeNull();

    SessionCheckpointRecoveryService.saveCheckpoint({
      sessionId,
      stepIndex: 3,
      totalSteps: 5,
      lastCompletedTool: 'replace_file_content',
      modifiedFiles: ['src/index.ts'],
      pendingTask: 'Run jest test suite',
      timestamp: new Date().toISOString(),
    });

    const checkpoint = SessionCheckpointRecoveryService.getCheckpoint(sessionId);
    expect(checkpoint).not.toBeNull();
    expect(checkpoint?.stepIndex).toBe(3);
    expect(checkpoint?.lastCompletedTool).toBe('replace_file_content');
    expect(checkpoint?.modifiedFiles).toContain('src/index.ts');

    const pending = SessionCheckpointRecoveryService.listPendingCheckpoints();
    expect(pending.some((p) => p.sessionId === sessionId)).toBe(true);

    SessionCheckpointRecoveryService.clearCheckpoint(sessionId);
    expect(SessionCheckpointRecoveryService.getCheckpoint(sessionId)).toBeNull();
  });
});
