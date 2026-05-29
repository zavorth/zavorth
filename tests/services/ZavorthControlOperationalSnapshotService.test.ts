import { ZavorthControlOperationalSnapshotService } from '../../src/domain/surface/presentation/zavorthControl/ZavorthControlOperationalSnapshotService.js';

describe('ZavorthControlOperationalSnapshotService', () => {
  it('exposes execution lifecycle as an operational zavorthControl snapshot', () => {
    const service = new ZavorthControlOperationalSnapshotService();
    const deps = {
      continuityUserId: 'user-1',
      sessionContinuity: {
        buildSnapshot: jest.fn(() => ({
          focusTask: {
            taskId: 'task-1',
            workspace: 'C:/repo',
          },
          recentTasks: [
            {
              task_id: 'task-1',
              metadata: {
                execution_lifecycle: [
                  {
                    kind: 'approval',
                    id: 'approval-1',
                    traceId: 'trace-1',
                    runId: 'run-1',
                    sessionId: 'session-1',
                    approvalId: 'approval-1',
                    artifactId: null,
                    status: 'approval_required',
                    summary: 'Approval waiting.',
                    source: 'approval-manager',
                    surface: 'web',
                    parentId: 'task-1',
                    createdAt: '2026-04-16T11:00:00.000Z',
                    updatedAt: '2026-04-16T11:00:00.000Z',
                    metadata: {},
                  },
                ],
              },
            },
          ],
        })),
      },
      memoryPlane: {
        buildSnapshot: jest.fn(),
      },
      sessionReplay: {
        buildSnapshot: jest.fn(() => ({
          recommendedEntry: { targetId: 'task-1' },
          lifecycle: [
            {
              kind: 'replay',
              id: 'replay-1',
              traceId: 'trace-1',
              runId: 'run-1',
              sessionId: 'session-1',
              approvalId: null,
              artifactId: null,
              status: 'replayed',
              summary: 'Replay linked.',
              source: 'session-replay',
              surface: 'web',
              parentId: 'task-1',
              createdAt: '2026-04-16T11:01:00.000Z',
              updatedAt: '2026-04-16T11:01:00.000Z',
              metadata: {},
            },
          ],
        })),
      },
      sessionHandoff: {
        buildSnapshot: jest.fn(),
      },
      taskManager: {
        getRecentTasks: jest.fn(() => [
          {
            task_id: 'task-1',
            metadata: {
              execution_lifecycle: [
                {
                  kind: 'approval',
                  id: 'approval-1',
                  traceId: 'trace-1',
                  runId: 'run-1',
                  sessionId: 'session-1',
                  approvalId: 'approval-1',
                  artifactId: null,
                  status: 'approval_required',
                  summary: 'Approval waiting.',
                  source: 'approval-manager',
                  surface: 'web',
                  parentId: 'task-1',
                  createdAt: '2026-04-16T11:00:00.000Z',
                  updatedAt: '2026-04-16T11:00:00.000Z',
                  metadata: {},
                },
              ],
            },
          },
        ]),
      },
      workflowRuns: {
        listRuns: jest.fn(() => [
          {
            workflow_run_id: 'workflow-1',
            artifacts_manifest: {
              lifecycle: [
                {
                  kind: 'artifact',
                  id: 'artifact-1',
                  traceId: 'trace-workflow',
                  runId: 'workflow-1',
                  sessionId: null,
                  approvalId: null,
                  artifactId: 'artifact-1',
                  status: 'linked',
                  summary: 'Artifact linked.',
                  source: 'workflow',
                  surface: null,
                  parentId: 'workflow-1',
                  createdAt: '2026-04-16T11:02:00.000Z',
                  updatedAt: '2026-04-16T11:02:00.000Z',
                  metadata: {},
                },
              ],
            },
          },
        ]),
      },
      hostActions: {
        listActions: jest.fn(() => [
          {
            actionId: 'host-action-1',
            metadata: {
              execution_lifecycle: [
                {
                  kind: 'execution',
                  id: 'host-action-1',
                  traceId: 'trace-host',
                  runId: 'host-run-1',
                  sessionId: 'session-host',
                  approvalId: null,
                  artifactId: null,
                  status: 'completed',
                  summary: 'Host action completed.',
                  source: 'supervised-execution-gateway',
                  surface: 'web',
                  parentId: 'host-action-1',
                  createdAt: '2026-04-16T11:03:00.000Z',
                  updatedAt: '2026-04-16T11:03:00.000Z',
                  metadata: {},
                },
              ],
            },
          },
        ]),
      },
    };

    const snapshot = service.readLifecycleSnapshot(deps as any);

    expect(snapshot).toEqual(expect.objectContaining({
      available: true,
      summary: expect.objectContaining({
        recent: 4,
        approvals: 1,
        artifacts: 1,
        replays: 1,
        approvalRequired: 1,
      }),
      latest: expect.arrayContaining([
        expect.objectContaining({ id: 'approval-1', origin: 'task' }),
        expect.objectContaining({ id: 'artifact-1', origin: 'workflow-artifact-manifest' }),
        expect.objectContaining({ id: 'host-action-1', origin: 'host-action' }),
      ]),
    }));
    expect(deps.workflowRuns.listRuns).toHaveBeenCalledWith({ workspace: 'C:/repo', limit: 5 });
    expect(deps.taskManager.getRecentTasks).toHaveBeenCalledWith(50, 'user-1');
    expect(deps.hostActions.listActions).toHaveBeenCalledWith(50);
  });
});
