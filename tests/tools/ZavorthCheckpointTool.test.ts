import { describe, it, expect } from '@jest/globals';
import { ZavorthCheckpointTool } from '../../src/tools/ZavorthCheckpointTool.js';

describe('ZavorthCheckpointTool (Session Step Recovery Tool)', () => {
  const tool = new ZavorthCheckpointTool();

  it('exposes correct metadata', () => {
    expect(tool.name).toBe('zavorth_checkpoint');
  });

  it('saves, retrieves, lists, and clears checkpoints', async () => {
    const sessionId = 'test-tool-checkpoint-ses';

    // 1. Save checkpoint
    const saveRes = JSON.parse(await tool.execute({
      action: 'save',
      sessionId,
      pendingTask: 'Refactoring database models',
      modifiedFiles: ['src/db.ts'],
      stepIndex: 3,
      totalSteps: 5,
    }));
    expect(saveRes.success).toBe(true);

    // 2. Get checkpoint
    const getRes = JSON.parse(await tool.execute({ action: 'get', sessionId }));
    expect(getRes.success).toBe(true);
    expect(getRes.checkpoint.pendingTask).toBe('Refactoring database models');

    // 3. List checkpoints
    const listRes = JSON.parse(await tool.execute({ action: 'list' }));
    expect(listRes.success).toBe(true);
    expect(listRes.checkpoints.some((c: any) => c.sessionId === sessionId)).toBe(true);

    // 4. Clear checkpoint
    const clearRes = JSON.parse(await tool.execute({ action: 'clear', sessionId }));
    expect(clearRes.success).toBe(true);
  });
});
