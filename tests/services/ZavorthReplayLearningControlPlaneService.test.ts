import { ZavorthReplayLearningControlPlaneService } from '../../src/services/ZavorthReplayLearningControlPlaneService.js';

describe('ZavorthReplayLearningControlPlaneService', () => {
  const createWorkflowRun = (overrides: Record<string, any> = {}) => ({
    workflow_run_id: 'workflow-run-1',
    workflow_name: 'ship-docs',
    objective: 'Fechar docs operacionais.',
    workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
    updated_at: '2026-04-12T17:50:00.000Z',
    status: 'paused',
    resume_stage: {
      id: 'stage-docs',
      reason: 'Docs precisam de retomada operacional.',
    },
    resume_prompt: 'Retome a partir do stage-docs e valide docs.',
    artifacts: [
      {
        id: 'artifact-workflow-docs',
        name: 'wave-8-notes.md',
        kind: 'doc',
        summary: 'Notas reutilizaveis da Wave 8.',
        path: 'docs/wave-8-notes.md',
        createdAt: '2026-04-12T17:45:00.000Z',
      },
    ],
    artifacts_manifest: {
      lifecycle: [
        {
          kind: 'artifact',
          id: 'artifact-workflow-docs',
          traceId: 'trace-workflow',
          runId: 'workflow-run-1',
          sessionId: 'session-1',
          approvalId: null,
          artifactId: 'artifact-workflow-docs',
          status: 'linked',
          summary: 'Artifact do workflow ligado ao lifecycle.',
          source: 'workflow',
          surface: 'web',
          parentId: 'workflow-run-1',
          createdAt: '2026-04-12T17:45:00.000Z',
          updatedAt: '2026-04-12T17:45:00.000Z',
          metadata: {},
        },
      ],
    },
    ...overrides,
  });

  const createService = (overrides: Record<string, any> = {}) =>
    new ZavorthReplayLearningControlPlaneService({
      now: () => new Date('2026-04-12T18:00:00.000Z'),
      workspaceRoot: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      memoryPlaneService: {
        buildSnapshot: jest.fn(async () => ({
          replay: {
            recommendedEntry: { kind: 'handoff', label: 'Ultimo handoff' },
            lifecycle: [
              {
                kind: 'replay',
                id: 'replay-lifecycle-1',
                traceId: 'trace-replay',
                runId: 'workflow-run-1',
                sessionId: 'session-1',
                approvalId: null,
                artifactId: null,
                status: 'replayed',
                summary: 'Replay pronto para retomada.',
                source: 'session-replay',
                surface: 'web',
                parentId: 'workflow-run-1',
                createdAt: '2026-04-12T17:20:00.000Z',
                updatedAt: '2026-04-12T17:20:00.000Z',
                metadata: {},
              },
            ],
            timeline: [
              {
                id: 'replay-1',
                label: 'Run anterior',
                kind: 'session',
                status: 'completed',
                happenedAt: '2026-04-12T17:00:00.000Z',
                summary: 'Build passou.',
              },
              {
                id: 'replay-2',
                label: 'Artifact criado',
                kind: 'artifact',
                status: 'recorded',
                happenedAt: '2026-04-12T17:10:00.000Z',
                summary: 'Notas geradas.',
              },
            ],
          },
          artifacts: {
            recent: [
              {
                id: 'artifact-memory-log',
                label: 'release-log.txt',
                kind: 'log',
                summary: 'Log reutilizavel do release.',
                path: 'artifacts/release-log.txt',
                createdAt: '2026-04-12T17:30:00.000Z',
              },
            ],
          },
          workspace: {
            summary: 'Workspace com continuidade pronta.',
            continuityRecommendations: [{ id: 'resume-1' }],
            workflowRecommendations: [{ id: 'workflow-1' }],
          },
        })),
      },
      layeredMemoryService: {
        buildStatus: jest.fn(async () => ({
          summary: {
            total: 4,
          },
          narrative: {
            operatorSummary: 'Memoria em camadas pronta.',
          },
        })),
        readMetrics: jest.fn(async () => ({
          summary: {
            totalEntries: 4,
            procedural: 2,
            pressure: 'ok',
          },
        })),
        readProcedures: jest.fn(async () => ({
          total: 2,
        })),
      },
      learningPlaneService: {
        buildSnapshot: jest.fn(async () => ({
          summary: {
            total: 1,
            pending: 1,
            promoted: 0,
            highConfidence: 1,
          },
          candidates: [
            {
              id: 'candidate:wf-1',
              title: 'Promover playbook de release',
              kind: 'playbook',
              score: 0.91,
              reviewState: 'pending',
              lifecycle: 'learned_draft',
              source: { workflow: 'ship-docs' },
            },
          ],
          narrative: {
            operatorSummary: '1 candidato pronto para review.',
          },
        })),
        readMetrics: jest.fn(async () => ({
          summary: {
            pending: 1,
          },
        })),
      },
      workflowRunService: {
        listRuns: jest.fn(() => [createWorkflowRun()]),
      },
      hostActionService: {
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
                  createdAt: '2026-04-12T17:55:00.000Z',
                  updatedAt: '2026-04-12T17:55:00.000Z',
                  metadata: {},
                },
              ],
            },
          },
        ]),
      },
      ...overrides,
    } as any);

  it('builds a Wave 8 snapshot with replay, reusable artifacts and learning candidates', async () => {
    const service = createService();

    const snapshot = await service.buildSnapshot({ limit: 12 });

    expect(snapshot.generatedAt).toBe('2026-04-12T18:00:00.000Z');
    expect(snapshot.summary.compareReady).toBe(true);
    expect(snapshot.summary.resumeReady).toBe(true);
    expect(snapshot.summary.restoreReady).toBe(true);
    expect(snapshot.summary.reusableArtifacts).toBeGreaterThan(0);
    expect(snapshot.summary.lifecycleEvents).toBeGreaterThanOrEqual(2);
    expect(snapshot.lifecycle.latest).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'replay-lifecycle-1', kind: 'replay' }),
      expect.objectContaining({ id: 'artifact-workflow-docs', kind: 'artifact' }),
      expect.objectContaining({ id: 'host-action-1', kind: 'execution', origin: 'host-action' }),
    ]));
    expect(snapshot.cards.map((entry) => entry.id)).toContain('lifecycle');
    expect(snapshot.summary.pendingLearning).toBe(1);
    expect(snapshot.actions.map((entry) => entry.id)).toEqual(expect.arrayContaining([
      'compare-runs',
      'resume-from-artifact',
      'resume-workflow',
      'review-learning-candidate',
    ]));
    await expect(service.renderReport({ limit: 12 })).resolves.toContain('Wave 8: Replay, artifacts e learning loop');
  });

  it('promotes critical posture when memory pressure is critical', async () => {
    const service = createService({
      layeredMemoryService: {
        buildStatus: jest.fn(async () => ({
          summary: { total: 10 },
        })),
        readMetrics: jest.fn(async () => ({
          summary: {
            totalEntries: 10,
            procedural: 3,
            pressure: 'critical',
          },
        })),
        readProcedures: jest.fn(async () => ({ total: 3 })),
      },
    });

    const snapshot = await service.buildSnapshot();

    expect(snapshot.summary.posture).toBe('critical');
    expect(snapshot.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'review-memory-budget',
        severity: 'critical',
      }),
    ]));
  });

  it('keeps a cold start runtime healthy instead of attention', async () => {
    const service = createService({
      memoryPlaneService: {
        buildSnapshot: jest.fn(async () => ({
          replay: {
            recommendedEntry: null,
            timeline: [],
          },
          artifacts: {
            recent: [],
          },
          workspace: {
            summary: '',
            continuityRecommendations: [],
            workflowRecommendations: [],
          },
        })),
      },
      layeredMemoryService: {
        buildStatus: jest.fn(async () => ({
          summary: { total: 0 },
        })),
        readMetrics: jest.fn(async () => ({
          summary: {
            totalEntries: 0,
            procedural: 0,
            pressure: 'ok',
          },
        })),
        readProcedures: jest.fn(async () => ({ total: 0 })),
      },
      learningPlaneService: {
        buildSnapshot: jest.fn(async () => ({
          summary: {
            total: 0,
            pending: 0,
            promoted: 0,
            highConfidence: 0,
          },
          candidates: [],
        })),
        readMetrics: jest.fn(async () => ({
          summary: {
            pending: 0,
          },
        })),
      },
      workflowRunService: {
        listRuns: jest.fn(() => []),
      },
      hostActionService: {
        listActions: jest.fn(() => []),
      },
    });

    const snapshot = await service.buildSnapshot();

    expect(snapshot.summary.posture).toBe('healthy');
    expect(snapshot.cards.find((entry) => entry.id === 'replay')?.posture).toBe('healthy');
    expect(snapshot.cards.find((entry) => entry.id === 'artifacts')?.posture).toBe('healthy');
    expect(snapshot.cards.find((entry) => entry.id === 'workspace')?.posture).toBe('healthy');
  });
});
