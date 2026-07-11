import { describe, expect, it } from 'vitest';
import {
  buildWorkboardRuntimeAction,
  columnToRuntimeStatus,
  describeWorkboardSync,
  mergeBoardsForDisplay,
} from '../src/workboard/workboardRuntimeSync';
import { createDefaultWorkboard } from '../src/desktop-state/productData';

describe('workboard runtime sync', () => {
  it('describes local runtime and hybrid modes', () => {
    expect(describeWorkboardSync({ hasRuntimeProjection: false }).mode).toBe('local');
    expect(describeWorkboardSync({ hasRuntimeProjection: true }).mode).toBe('runtime');
    expect(describeWorkboardSync({ hasRuntimeProjection: true, lastPushOk: true }).mode).toBe('hybrid');
    expect(describeWorkboardSync({ hasRuntimeProjection: false, lastPushOk: true }).label).toMatch(/Push bridge/i);
    expect(describeWorkboardSync({ hasRuntimeProjection: false, lastPushOk: false }).label).toMatch(/push failed/i);
  });

  it('maps columns to runtime statuses', () => {
    expect(columnToRuntimeStatus('todo')).toBe('queued');
    expect(columnToRuntimeStatus('doing')).toBe('running');
    expect(columnToRuntimeStatus('done')).toBe('completed');
    expect(columnToRuntimeStatus('blocked')).toBe('blocked');
  });

  it('merges runtime board ahead of local boards', () => {
    const local = [createDefaultWorkboard()];
    const merged = mergeBoardsForDisplay(local, {
      selectedTaskId: null,
      selectedTask: null,
      sessions: [{ sessionId: 's1', objective: 'Ship', status: 'running', maxDepth: 2, maxChildren: 2 }],
      tasks: [{
        taskId: 't1',
        sessionId: 's1',
        parentTaskId: null,
        title: 'Runtime task',
        status: 'running',
        claimedBy: null,
        heartbeatAt: null,
        blockedReason: null,
        summary: null,
      }],
      workers: [],
      receipts: [],
      summary: { sessions: 1, queued: 0, running: 1, completed: 0, blocked: 0 },
      safety: {
        sqliteDurable: true,
        mutationRequiresApproval: true,
        retryBounded: true,
        spawnDepthBounded: true,
      },
    });
    expect(merged[0].id).toBe('runtime-workboard');
    expect(merged.some(board => board.id === local[0].id)).toBe(true);
  });

  it('builds runtime actions for card mutations', () => {
    const board = createDefaultWorkboard();
    const card = board.cards[0];
    const action = buildWorkboardRuntimeAction({
      board,
      card,
      operation: 'upsert-card',
      sessionId: 'desktop-main',
    });
    expect(action.type).toBe('workboard-sync');
    expect(action.payload.operation).toBe('upsert-card');
    expect(action.payload.card?.taskId).toBe(card.id);
  });

  it('packs a full board into one sync action', () => {
    const board = createDefaultWorkboard();
    const action = buildWorkboardRuntimeAction({
      board,
      operation: 'sync-board',
      sessionId: 'desktop-main',
    });
    expect(action.payload.cards).toHaveLength(board.cards.length);
    expect(action.payload.cards?.[0].taskId).toBe(board.cards[0].id);
  });
});
