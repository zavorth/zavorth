import { PublicRuntimeEventService } from '../../src/services/PublicRuntimeEventService.js';
import type { WebRealtimeEvent } from '../../src/services/WebRealtimeService.js';

describe('PublicRuntimeEventService', () => {
  it('maps permission events to canonical approval.request without execution authority', () => {
    const service = new PublicRuntimeEventService();
    const [event] = service.mapWebRealtimeEvent({
      id: 'permission-event-1',
      type: 'permission',
      createdAt: '2026-05-14T10:00:00.000Z',
      payload: {
        permission_id: 'perm-1',
        task_id: 'task-1',
        kind: 'workspace.write',
        reason: 'Edit one source file',
        requested_value: 'src/index.ts',
        resolved_value: 'src/index.ts',
        metadata: {
          risk: 'medium',
          files: ['src/index.ts'],
          policy: 'workspace.write.requires_approval',
        },
      },
    } as WebRealtimeEvent);

    expect(event).toEqual(expect.objectContaining({
      type: 'approval.request',
      sessionId: null,
      data: expect.objectContaining({
        approvalId: 'perm-1',
        taskId: 'task-1',
        risk: 'medium',
        action: 'workspace.write',
        preview: expect.objectContaining({
          files: ['src/index.ts'],
        }),
      }),
      safety: expect.objectContaining({
        dashboardCanExecute: false,
        rawSecretsSerialized: false,
      }),
    }));
  });

  it('maps completed tool events to tool.updated and receipt.ready', () => {
    const service = new PublicRuntimeEventService();
    const events = service.mapWebRealtimeEvent({
      id: 'tool-event-1',
      type: 'tool',
      createdAt: '2026-05-14T10:01:00.000Z',
      payload: {
        runId: 'run-1',
        taskId: 'task-1',
        workflowRunId: 'mission-1',
        toolName: 'apply_patch',
        status: 'completed',
        filesTouched: ['src/index.ts'],
        artifacts: [{ id: 'artifact-1' }],
        diff: { summary: 'changed one file' },
      },
    } as WebRealtimeEvent);

    expect(events.map((event) => event.type)).toEqual(['tool.updated', 'receipt.ready']);
    expect(events[1]).toEqual(expect.objectContaining({
      data: expect.objectContaining({
        missionId: 'mission-1',
        taskId: 'task-1',
        rollbackAvailable: true,
      }),
    }));
  });
});
