import { ZavorthLearningPlaneService } from '../../src/services/ZavorthLearningPlaneService.js';

function createWorkflowRun(overrides: Record<string, any> = {}) {
  return {
    workflow_run_id: 'wf-1',
    workflow_name: 'ship',
    objective: 'Publicar o pacote do gateway.',
    workspace: 'C:/repo/demo',
    origin: {
      origin_task_id: 'task-1',
      source_surface: 'web',
    },
    trigger: {
      kind: 'manual',
    },
    workspace_context: {
      workspace: 'C:/repo/demo',
    },
    created_at: '2026-04-09T13:00:00.000Z',
    updated_at: '2026-04-09T13:10:00.000Z',
    status: 'completed',
    operator_state: 'active',
    operator_closed_at: null,
    operator_close_reason: null,
    operator_closed_by_surface: null,
    stages: [
      {
        id: 'stage-1',
        label: 'Inspect runtime',
        executor: 'codex',
        role: 'operator',
        strategy_note: null,
        index: 0,
        status: 'completed',
        task_id: 'task-1',
        attempt_count: 1,
        objective: 'Inspecionar',
        handoff_summary: null,
        started_at: '2026-04-09T13:00:00.000Z',
        finished_at: '2026-04-09T13:02:00.000Z',
        result_summary: 'Tudo certo.',
        artifact_count: 1,
      },
      {
        id: 'stage-2',
        label: 'Publish release',
        executor: 'codex',
        role: 'operator',
        strategy_note: null,
        index: 1,
        status: 'completed',
        task_id: 'task-2',
        attempt_count: 1,
        objective: 'Publicar',
        handoff_summary: null,
        started_at: '2026-04-09T13:03:00.000Z',
        finished_at: '2026-04-09T13:09:00.000Z',
        result_summary: 'Release criado.',
        artifact_count: 1,
      },
    ],
    resume_stage: null,
    actionable_stages: [],
    resume_prompt: 'Repita este fluxo para futuros pacotes.',
    artifacts: [
      {
        id: 'artifact-1',
        name: 'release-notes.md',
        kind: 'doc',
        summary: 'Notas da release.',
        path: 'artifacts/release-notes.md',
        createdAt: '2026-04-09T13:09:30.000Z',
      },
    ],
    artifacts_manifest: {},
    externalized_state: null,
    ...overrides,
  };
}

describe('ZavorthLearningPlaneService', () => {
  it('derives reviewed candidates from successful workflow history', () => {
    const service = new ZavorthLearningPlaneService({
      now: () => new Date('2026-04-09T14:00:00.000Z'),
      workflowRunService: {
        listRuns: jest.fn(() => [createWorkflowRun()]),
      } as any,
      existsSync: jest.fn(() => false),
    });

    const snapshot = service.buildSnapshot({
      workspace: 'C:/repo/demo',
    });

    expect(snapshot.summary.total).toBe(1);
    expect(snapshot.summary.pending).toBe(1);
    expect(snapshot.candidates).toEqual([
      expect.objectContaining({
        id: 'candidate:wf-1',
        platformEntryId: 'skill:learned:ship:demo:wf-1',
        kind: 'playbook',
        reviewState: 'pending',
        lifecycle: 'learned_draft',
        source: expect.objectContaining({
          workflowRunId: 'wf-1',
          workspace: 'C:/repo/demo',
          objective: 'Publicar o pacote do gateway.',
        }),
      }),
    ]);
  });

  it('keeps approval and promotion explicit through persisted learning state', () => {
    let storedState: string | null = null;
    const service = new ZavorthLearningPlaneService({
      now: () => new Date('2026-04-09T14:00:00.000Z'),
      workflowRunService: {
        listRuns: jest.fn(() => [createWorkflowRun()]),
      } as any,
      stateFile: 'C:/tmp/learning-plane.json',
      existsSync: jest.fn(() => storedState !== null),
      readFileSync: jest.fn(() => storedState || ''),
      writeFileSync: jest.fn((_file, data) => {
        storedState = String(data);
      }),
      mkdirSync: jest.fn(),
    });

    const approved = service.executeAction({
      candidateId: 'candidate:wf-1',
      actionId: 'approve',
    });
    expect(approved.ok).toBe(true);
    expect(approved.status).toBe('applied');
    expect(approved.snapshot.candidates[0]).toEqual(
      expect.objectContaining({
        reviewState: 'approved',
        lifecycle: 'learned_draft',
      }),
    );

    const promoted = service.executeAction({
      candidateId: 'candidate:wf-1',
      actionId: 'promote',
    });
    expect(promoted.ok).toBe(true);
    expect(promoted.status).toBe('applied');
    expect(promoted.snapshot.candidates[0]).toEqual(
      expect.objectContaining({
        reviewState: 'approved',
        lifecycle: 'trusted_local',
      }),
    );
    expect(storedState).toContain('"trusted_local"');
  });

  it('emits stable learning quality metrics from candidate history', () => {
    const service = new ZavorthLearningPlaneService({
      now: () => new Date('2026-04-09T14:00:00.000Z'),
      workflowRunService: {
        listRuns: jest.fn(() => [
          createWorkflowRun(),
          createWorkflowRun({
            workflow_run_id: 'wf-2',
            workflow_name: 'release',
            updated_at: '2026-04-09T13:20:00.000Z',
            origin: {
              origin_task_id: 'task-2',
              source_surface: 'cli',
            },
          }),
        ]),
      } as any,
      existsSync: jest.fn(() => true),
      readFileSync: jest.fn(() => JSON.stringify({
        version: 1,
        updatedAt: '2026-04-09T14:00:00.000Z',
        entries: {
          'candidate:wf-1': {
            reviewState: 'approved',
            lifecycle: 'trusted_local',
            updatedAt: '2026-04-09T13:50:00.000Z',
          },
          'candidate:wf-2': {
            reviewState: 'rejected',
            lifecycle: 'quarantined',
            updatedAt: '2026-04-09T13:55:00.000Z',
          },
        },
      })),
    });

    const metrics = service.readMetrics({
      workspace: 'C:/repo/demo',
    });

    expect(metrics.summary).toEqual(
      expect.objectContaining({
        totalCandidates: 2,
        acceptedRate: 0.5,
        rejectedRate: 0.5,
        promotedRate: 0.5,
      }),
    );
  });
});
