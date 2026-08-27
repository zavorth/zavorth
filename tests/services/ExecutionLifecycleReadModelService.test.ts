import { ExecutionLifecycleReadModelService } from '../../src/services/ExecutionLifecycleReadModelService.js';

describe('ExecutionLifecycleReadModelService', () => {
  it('collects lifecycle records from tasks, replay and workflow artifact manifests', () => {
    const service = new ExecutionLifecycleReadModelService({
      now: () => new Date('2026-04-16T12:00:00.000Z'),
    });

    const snapshot = service.buildSnapshot({
      tasks: [
        {
          task_id: 'task-1',
          execution: {
            lifecycle: [
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
                source: 'task',
                surface: 'telegram',
                parentId: 'task-1',
                createdAt: '2026-04-16T11:58:00.000Z',
                updatedAt: '2026-04-16T11:58:00.000Z',
                metadata: {},
              },
            ],
          },
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
                source: 'task',
                surface: 'telegram',
                parentId: 'task-1',
                createdAt: '2026-04-16T11:58:00.000Z',
                updatedAt: '2026-04-16T11:58:00.000Z',
                metadata: {},
              },
            ],
            artifact_manifest: {
              lifecycle: [
                {
                  kind: 'artifact',
                  id: 'artifact-1',
                  traceId: 'trace-1',
                  runId: 'run-1',
                  sessionId: 'session-1',
                  approvalId: null,
                  artifactId: 'artifact-1',
                  status: 'linked',
                  summary: 'Artifact linked.',
                  source: 'artifact-pipeline',
                  surface: 'telegram',
                  parentId: 'task-1',
                  createdAt: '2026-04-16T11:59:00.000Z',
                  updatedAt: '2026-04-16T11:59:00.000Z',
                  metadata: {},
                },
              ],
            },
          },
        },
      ],
      replay: {
        lifecycle: [
          {
            kind: 'replay',
            id: 'replay-1',
            traceId: 'trace-replay',
            runId: 'run-replay',
            sessionId: 'session-1',
            approvalId: null,
            artifactId: null,
            status: 'replayed',
            summary: 'Replay entry.',
            source: 'session-replay',
            surface: 'web',
            parentId: null,
            createdAt: '2026-04-16T11:57:00.000Z',
            updatedAt: '2026-04-16T11:57:00.000Z',
            metadata: {},
          },
        ],
      },
      memoryPlane: {
        replay: {
          lifecycle: [
            {
              kind: 'replay',
              id: 'replay-1',
              traceId: 'trace-replay',
              runId: 'run-replay',
              sessionId: 'session-1',
              approvalId: null,
              artifactId: null,
              status: 'replayed',
              summary: 'Replay entry.',
              source: 'session-replay',
              surface: 'web',
              parentId: null,
              createdAt: '2026-04-16T11:57:00.000Z',
              updatedAt: '2026-04-16T11:57:00.000Z',
              metadata: {},
            },
          ],
        },
      },
      workflowRuns: [
        {
          workflow_run_id: 'workflow-1',
          artifacts_manifest: {
            lifecycle: [
              {
                kind: 'artifact',
                id: 'workflow-artifact-1',
                traceId: 'trace-workflow',
                runId: 'workflow-1',
                sessionId: null,
                approvalId: null,
                artifactId: 'workflow-artifact-1',
                status: 'completed',
                summary: 'Workflow artifact.',
                source: 'workflow',
                surface: null,
                parentId: 'workflow-1',
                createdAt: '2026-04-16T11:56:00.000Z',
                updatedAt: '2026-04-16T11:56:00.000Z',
                metadata: {},
              },
            ],
          },
        },
      ],
      hostActions: [
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
                createdAt: '2026-04-16T11:55:00.000Z',
                updatedAt: '2026-04-16T11:55:00.000Z',
                metadata: {},
              },
            ],
          },
        },
      ],
      automationExecutions: [
        {
          actionId: 'create',
          execution_lifecycle: [
            {
              kind: 'plan',
              id: 'plan-automation-1',
              traceId: 'plan-automation-1',
              runId: 'plan-automation-1',
              sessionId: null,
              approvalId: 'perm-automation-1',
              artifactId: null,
              status: 'approval_required',
              summary: 'Automation waiting approval.',
              source: 'automation',
              surface: 'telegram',
              parentId: 'plan-automation-1',
              createdAt: '2026-04-16T11:54:00.000Z',
              updatedAt: '2026-04-16T11:54:00.000Z',
              metadata: {},
            },
          ],
        },
      ],
      nodeInvocations: [
        {
          id: 'invoke-1',
          execution_lifecycle: [
            {
              kind: 'execution',
              id: 'invoke-1',
              traceId: 'invoke-1',
              runId: 'invoke-1',
              sessionId: null,
              approvalId: null,
              artifactId: null,
              status: 'planned',
              summary: 'Node invoke queued.',
              source: 'node-invoke',
              surface: 'node-mesh',
              parentId: 'invoke-1',
              createdAt: '2026-04-16T11:53:00.000Z',
              updatedAt: '2026-04-16T11:53:00.000Z',
              metadata: {},
            },
          ],
        },
      ],
      swarmRuns: [
        {
          swarmId: 'swarm-1',
          execution_lifecycle: [
            {
              kind: 'run',
              id: 'swarm-1',
              traceId: 'swarm-1',
              runId: 'swarm-1',
              sessionId: null,
              approvalId: null,
              artifactId: null,
              status: 'completed',
              summary: 'Swarm completed.',
              source: 'swarm',
              surface: 'zavorth-ensemble',
              parentId: 'swarm-1',
              createdAt: '2026-04-16T11:52:00.000Z',
              updatedAt: '2026-04-16T11:52:00.000Z',
              metadata: {},
            },
          ],
        },
      ],
      selfModificationResults: [
        {
          previewId: 'preview-1',
          execution_lifecycle: [
            {
              kind: 'plan',
              id: 'preview-1',
              traceId: 'preview-1',
              runId: 'preview-1',
              sessionId: null,
              approvalId: null,
              artifactId: 'preview-1',
              status: 'planned',
              summary: 'Selfmod preview planned.',
              source: 'selfmod',
              surface: 'selfmod',
              parentId: 'preview-1',
              createdAt: '2026-04-16T11:51:00.000Z',
              updatedAt: '2026-04-16T11:51:00.000Z',
              metadata: {},
            },
          ],
        },
      ],
    });

    expect(snapshot.generatedAt).toBe('2026-04-16T12:00:00.000Z');
    expect(snapshot.summary).toEqual(expect.objectContaining({
      total: 9,
      recent: 9,
      runs: 8,
      approvals: 1,
      artifacts: 2,
      replays: 1,
      approvalRequired: 2,
    }));
    expect(snapshot.latest).toEqual(expect.arrayContaining([
      expect.objectContaining({ origin: 'task', id: 'approval-1' }),
      expect.objectContaining({ origin: 'task-artifact-manifest', id: 'artifact-1' }),
      expect.objectContaining({ origin: 'workflow-artifact-manifest', id: 'workflow-artifact-1' }),
      expect.objectContaining({ origin: 'replay', id: 'replay-1' }),
      expect.objectContaining({ origin: 'host-action', id: 'host-action-1' }),
      expect.objectContaining({ origin: 'automation', id: 'plan-automation-1' }),
      expect.objectContaining({ origin: 'node-invoke', id: 'invoke-1' }),
      expect.objectContaining({ origin: 'swarm', id: 'swarm-1' }),
      expect.objectContaining({ origin: 'selfmod', id: 'preview-1' }),
    ]));
    expect(snapshot.byRun).toEqual(expect.arrayContaining([
      expect.objectContaining({
        runId: 'run-1',
        approvals: 1,
        artifacts: 1,
      }),
    ]));
  });
});
